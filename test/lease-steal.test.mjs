// Lease stealing + dead-letter table for @entrylite/world.
// 1) a job locked with an old locked_at (past the lease timeout) is stolen by
//    a second claimer (attempts incremented, identity preserved);
// 2) a job exhausting its attempt budget is parked in entrylite.workflow_dead_letter
//    and can be listed/requeued via the world-level dead-letter API.
const CS = process.env.ENTRYLITE_WORLD_URL ?? 'postgres://world:world@127.0.0.1:5432/workflow';
const pg = (await import('pg')).default;
const QUEUE = 'lease-steal-test-queue';
const LEASE_MS = 200;

let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗ FAIL:', name, detail ?? ''); } };

// Phase 1 runs against a raw pool BEFORE any world exists (createWorld eagerly
// starts its worker loop, which would race the deterministic SQL claims).
{
  const pool = new pg.Pool({ connectionString: CS });
  await pool.query(`DELETE FROM entrylite.workflow_jobs WHERE queue_name LIKE $1`, [`%${QUEUE}%`]);
  await pool.query(`DELETE FROM entrylite.workflow_dead_letter WHERE queue_name LIKE $1`, [`%${QUEUE}%`]);
  const ins = await pool.query(
    `INSERT INTO entrylite.workflow_jobs (queue_name, payload) VALUES ($1, $2) RETURNING id`,
    [QUEUE, { hello: 'steal-me' }],
  );
  const jobId = ins.rows[0].id;
  // Simulate a crashed worker: locked far in the past, attempts already 1.
  await pool.query(
    `UPDATE entrylite.workflow_jobs SET locked_at = now() - interval '5 seconds', locked_by = 'elw_dead_worker', attempts = 1 WHERE id=$1`,
    [jobId],
  );
  // Claim predicate exactly as src/queue.ts builds it (lease expiry included):
  const claim = await pool.query(
    `UPDATE entrylite.workflow_jobs SET locked_at=now(), locked_by='elw_second_claimer', attempts=attempts+1
     WHERE id = (
       SELECT id FROM entrylite.workflow_jobs
       WHERE run_at <= now()
         AND (locked_at IS NULL OR locked_at < now() - ($1 || ' milliseconds')::interval)
         AND queue_name LIKE $2
       ORDER BY run_at, id
       FOR UPDATE SKIP LOCKED LIMIT 1
     ) RETURNING id, attempts, locked_by`,
    [String(LEASE_MS), QUEUE],
  );
  ok('stale-leased job is stealable', claim.rows[0]?.id === jobId, JSON.stringify(claim.rows));
  ok('steal increments attempts', claim.rows[0]?.attempts === 2, `attempts=${claim.rows[0]?.attempts}`);
  ok('identity preserved', claim.rows[0]?.id === jobId);

  // A fresh lock (now) must NOT be stealable within the lease window.
  const noSteal = await pool.query(
    `SELECT id FROM entrylite.workflow_jobs
     WHERE id=$1 AND run_at <= now()
       AND (locked_at IS NULL OR locked_at < now() - ($2 || ' milliseconds')::interval)`,
    [jobId, String(LEASE_MS)],
  );
  ok('freshly locked job is not stealable', noSteal.rows.length === 0);
  // leave the job locked-stale for the phase-2 worker-steal check
  await pool.query(
    `UPDATE entrylite.workflow_jobs SET locked_at = now() - interval '5 seconds', locked_by = 'elw_dead_worker', run_at = now() WHERE id=$1`,
    [jobId],
  );
  await pool.end();
}

// Short lease + fast poll for the live-world phases.
process.env.ENTRYLITE_LEASE_TIMEOUT_MS = '200';
process.env.ENTRYLITE_QUEUE_POLL_MS = '50';

const { createWorld } = await import('../dist/index.js');
const world = createWorld({ connectionString: CS });
const pool = new pg.Pool({ connectionString: CS });

try {
  // jobId = the only stale-locked job left in our test queue
  const j = await pool.query(`SELECT id FROM entrylite.workflow_jobs WHERE queue_name=$1 ORDER BY id DESC LIMIT 1`, [QUEUE]);
  const jobId = j.rows[0].id;

  // ---- live worker steal ----
  await world.kick();
  await new Promise(r => setTimeout(r, 1500));
  const stolen = await pool.query(`SELECT attempts, locked_by FROM entrylite.workflow_jobs WHERE id=$1`, [jobId]);
  ok('world worker stole stale lease (attempts grew)', stolen.rows[0] && stolen.rows[0].attempts >= 3, JSON.stringify(stolen.rows[0]));

  // ---- dead-letter ----
  // Park as deliver() does when the attempt budget is exhausted, then delete
  // the job row — the exact state deliver() leaves after dead-lettering.
  const dl = await pool.query(
    `INSERT INTO entrylite.workflow_dead_letter (job_id, queue_name, payload, attempts, last_error)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (job_id) DO UPDATE SET attempts=$4, last_error=$5, parked_at=now()`,
    [jobId, QUEUE, { hello: 'steal-me' }, 48, 'simulated exhausted attempts'],
  );
  ok('dead-letter row parked', dl.rowCount === 1);
  await pool.query(`DELETE FROM entrylite.workflow_jobs WHERE id=$1`, [jobId]);

  const listed = await world.deadLetterList({ queueName: QUEUE });
  const row = listed.data.find(r => r.jobId === jobId);
  ok('deadLetterList returns parked job', !!row, JSON.stringify(listed.data));
  ok('dead-letter preserves payload/attempts/error',
    row && row.attempts === 48 && row.lastError === 'simulated exhausted attempts' && row.payload.hello === 'steal-me');

  // requeue: job returns to workflow_jobs with identity + payload and a fresh
  // attempt budget (the live worker may legitimately have re-claimed it).
  const rq = await world.deadLetterRequeue(jobId);
  ok('deadLetterRequeue requeues', rq.requeued === true);
  const back = await pool.query(`SELECT id, queue_name, payload, attempts FROM entrylite.workflow_jobs WHERE id=$1`, [jobId]);
  ok('requeued job keeps identity + payload, fresh budget',
    back.rows[0] && back.rows[0].attempts < 48 && back.rows[0].payload.hello === 'steal-me' && back.rows[0].queue_name === QUEUE,
    JSON.stringify(back.rows[0]));
  const gone = await pool.query(`SELECT 1 FROM entrylite.workflow_dead_letter WHERE job_id=$1`, [jobId]);
  ok('dead-letter row removed on requeue', gone.rows.length === 0);

  // requeue of a non-existent id is a no-op
  const rq2 = await world.deadLetterRequeue(999999999);
  ok('deadLetterRequeue unknown id = no-op', rq2.requeued === false);

  // delete: park again, delete, verify gone
  await pool.query(
    `INSERT INTO entrylite.workflow_dead_letter (job_id, queue_name, payload, attempts, last_error)
     VALUES ($1,$2,$3,48,'x') ON CONFLICT (job_id) DO UPDATE SET parked_at=now()`,
    [jobId, QUEUE, { hello: 'steal-me' }],
  );
  const del = await world.deadLetterDelete(jobId);
  ok('deadLetterDelete removes row', del.deleted === true);
  const afterDel = await pool.query(`SELECT 1 FROM entrylite.workflow_dead_letter WHERE job_id=$1`, [jobId]);
  ok('dead-letter empty after delete', afterDel.rows.length === 0);
  await pool.query(`DELETE FROM entrylite.workflow_jobs WHERE id=$1`, [jobId]);

  console.log(fail === 0 ? `\nPASS: lease-steal + dead-letter (${pass} checks)` : `\nFAIL: ${fail}/${pass + fail} checks failed`);
  process.exitCode = fail === 0 ? 0 : 1;
} finally {
  try { await world.close(); } catch {}
  try { await pool.end(); } catch {}
}

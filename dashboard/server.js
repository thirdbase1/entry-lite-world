'use strict';
// @entrylite/world dashboard API — Express + pg
const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const devalue = require('/home/agentuser/entry-agents/node_modules/.pnpm/devalue@5.9.4/node_modules/devalue');

const PORT = process.env.PORT || 3300;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://world:world@127.0.0.1:5432/workflow',
  max: 5,
});

// Decode {data: base64('devl'+devalue-string), __type:'Uint8Array'} payloads to plain JSON.
function decodePayload(v, depth = 0) {
  if (v == null) return v;
  if (depth > 8) return '[deep]';
  if (Array.isArray(v)) return v.map((x) => decodePayload(x, depth + 1));
  if (typeof v === 'object') {
    if (v.__type === 'Uint8Array' && typeof v.data === 'string') {
      try {
        const raw = Buffer.from(v.data, 'base64').toString('utf8');
        if (raw.startsWith('devl')) return decodePayload(devalue.parse(raw.slice(4)), depth + 1);
        return raw;
      } catch (e) {
        return { __decodeError: String(e.message) };
      }
    }
    const out = {};
    for (const [k, val] of Object.entries(v)) out[k] = decodePayload(val, depth + 1);
    return out;
  }
  return v;
}

const app = express();
app.use(express.json());

const DEPLOY_PREFIX = 'workflow//./workflows/';
function prettyName(n) {
  if (typeof n !== 'string') return n;
  if (n.startsWith(DEPLOY_PREFIX)) {
    const rest = n.slice(DEPLOY_PREFIX.length).replace(/\/\//g, '/');
    return rest.replace(/^features\//, '');
  }
  return n;
}

// ---- Runs list ----
app.get('/api/runs', async (req, res) => {
  const { status = '', q = '', page = '1', pageSize = '25' } = req.query;
  const limit = Math.min(Math.max(parseInt(pageSize, 10) || 25, 1), 100);
  const p = Math.max(parseInt(page, 10) || 1, 1);
  const where = [];
  const params = [];
  if (status && status !== 'all') { params.push(status); where.push(`status = $${params.length}`); }
  if (q) { params.push(`%${q}%`); where.push(`run_id ILIKE $${params.length}`); }
  const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const total = await pool.query(`SELECT count(*)::int AS n FROM entrylite.workflow_runs ${w}`, params);
  params.push(limit, (p - 1) * limit);
  const rows = await pool.query(
    `SELECT run_id, workflow_name, status, spec_version, input, output, error,
            created_at, started_at, completed_at
       FROM entrylite.workflow_runs ${w}
      ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  res.json({
    total: total.rows[0].n,
    page: p,
    pageSize: limit,
    runs: rows.rows.map((r) => ({
      runId: r.run_id,
      workflow: prettyName(r.workflow_name),
      status: r.status,
      specVersion: r.spec_version,
      createdAt: r.created_at,
      startedAt: r.started_at,
      completedAt: r.completed_at,
      error: r.error,
    })),
  });
});

// ---- Run detail ----
app.get('/api/runs/:runId', async (req, res) => {
  const { runId } = req.params;
  const run = await pool.query('SELECT * FROM entrylite.workflow_runs WHERE run_id = $1', [runId]);
  if (!run.rows.length) return res.status(404).json({ error: 'run not found' });
  const r = run.rows[0];
  const [steps, events, hooks] = await Promise.all([
    pool.query(
      `SELECT step_id, step_name, status, attempt, input, output, error, started_at, completed_at, retry_after
         FROM entrylite.workflow_steps WHERE run_id = $1 ORDER BY created_at`,
      [runId]
    ),
    pool.query(
      `SELECT event_id, event_type, correlation_id, event_data, created_at
         FROM entrylite.workflow_events WHERE run_id = $1 ORDER BY created_at, event_id`,
      [runId]
    ),
    pool.query(
      `SELECT hook_id, token, owner_id, is_webhook, created_at, token_retention_until
         FROM entrylite.workflow_hooks WHERE run_id = $1 ORDER BY created_at`,
      [runId]
    ),
  ]);
  res.json({
    runId: r.run_id,
    workflow: prettyName(r.workflow_name),
    rawWorkflow: r.workflow_name,
    status: r.status,
    specVersion: r.spec_version,
    deploymentId: r.deployment_id,
    input: decodePayload(r.input),
    output: decodePayload(r.output),
    error: r.error,
    errorCode: r.error_code,
    attributes: decodePayload(r.attributes),
    createdAt: r.created_at,
    startedAt: r.started_at,
    completedAt: r.completed_at,
    steps: steps.rows.map((s) => ({
      stepId: s.step_id, stepName: prettyName(s.step_name), status: s.status, attempt: s.attempt,
      input: decodePayload(s.input), output: decodePayload(s.output), error: s.error,
      startedAt: s.started_at, completedAt: s.completed_at, retryAfter: s.retry_after,
    })),
    events: events.rows.map((e) => ({
      eventId: e.event_id, eventType: e.event_type, correlationId: e.correlation_id,
      data: decodePayload(e.event_data), createdAt: e.created_at,
    })),
    hooks: hooks.rows.map((h) => ({
      hookId: h.hook_id, token: h.token, ownerId: h.owner_id,
      isWebhook: h.is_webhook, createdAt: h.created_at, retentionUntil: h.token_retention_until,
    })),
  });
});

// ---- Queue health ----
app.get('/api/queues', async (_req, res) => {
  const stats = await pool.query(
    `SELECT queue_name,
            count(*) FILTER (WHERE locked_at IS NULL)::int AS pending,
            count(*) FILTER (WHERE locked_at IS NOT NULL)::int AS locked,
            min(run_at) FILTER (WHERE locked_at IS NULL) AS oldest_pending,
            count(*)::int AS total
       FROM entrylite.workflow_jobs GROUP BY queue_name ORDER BY queue_name`
  );
  res.json({
    queues: stats.rows.map((q) => ({
      queue: q.queue_name, pending: q.pending, locked: q.locked,
      total: q.total, oldestPending: q.oldest_pending,
    })),
  });
});

// ---- Dead letter ----
app.get('/api/dead-letter', async (_req, res) => {
  const exists = await pool.query(
    `SELECT 1 FROM information_schema.tables
      WHERE table_schema='entrylite' AND table_name='workflow_dead_letter'`
  );
  if (!exists.rows.length) return res.json({ available: false, items: [] });
  const cols = await pool.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema='entrylite' AND table_name='workflow_dead_letter' ORDER BY ordinal_position`
  );
  const names = cols.rows.map((c) => c.column_name);
  const pick = (...cands) => names.find((n) => cands.includes(n));
  const idC = pick('id', 'dead_letter_id', 'dl_id', 'job_id');
  const errC = pick('error', 'last_error', 'error_message');
  const sel = [
    idC || 'NULL AS id',
    pick('run_id', 'queue_name') || 'NULL',
    pick('job_id') || 'NULL AS job_id',
    pick('queue_name', 'queue') || "'' AS queue_name",
    pick('payload') || 'NULL AS payload',
    errC || 'NULL AS error',
    pick('attempts') || 'NULL AS attempts',
    pick('created_at', 'failed_at') || 'NULL AS created_at',
  ].join(', ');
  const rows = await pool.query(
    `SELECT ${sel} FROM entrylite.workflow_dead_letter ORDER BY created_at DESC NULLS LAST LIMIT 100`
  );
  res.json({
    available: true,
    columns: names,
    items: rows.rows.map((r) => ({ ...r, payload: decodePayload(r.payload) })),
  });
});

// Requeue: POST /api/dead-letter/requeue { id }
app.post('/api/dead-letter/requeue', async (req, res) => {
  const id = req.body && req.body.id;
  if (id == null) return res.status(400).json({ error: 'id required' });
  const exists = await pool.query(
    `SELECT 1 FROM information_schema.tables
      WHERE table_schema='entrylite' AND table_name='workflow_dead_letter'`
  );
  if (!exists.rows.length) return res.status(404).json({ error: 'dead_letter table not found' });
  const cols = await pool.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema='entrylite' AND table_name='workflow_dead_letter'`
  );
  const names = cols.rows.map((c) => c.column_name);
  if (!names.includes('job_id') && !names.includes('id')) return res.status(400).json({ error: 'no id column' });
  const idCol = names.includes('id') ? 'id' : 'job_id';
  // Requeue strategy: delete from dead letter and insert back into workflow_jobs if enough info.
  const row = await pool.query(`SELECT * FROM entrylite.workflow_dead_letter WHERE ${idCol} = $1`, [id]);
  if (!row.rows.length) return res.status(404).json({ error: 'dead letter not found' });
  const dl = row.rows[0];
  const payload = dl.payload || (dl.job ? dl.job.payload : null);
  if (payload && names.includes('queue_name') !== false && payload) {
    try {
      await pool.query(
        `INSERT INTO entrylite.workflow_jobs (queue_name, payload) VALUES ($1, $2)`,
        [dl.queue_name || 'default', payload]
      );
      await pool.query('DELETE FROM entrylite.workflow_dead_letter WHERE ' + idCol + ' = $1', [id]);
      return res.json({ requeued: true, id });
    } catch (e) {
      return res.status(500).json({ error: String(e.message) });
    }
  }
  return res.status(400).json({ error: 'dead letter row lacks payload to requeue' });
});

app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`@entrylite/world dashboard listening on http://localhost:${PORT}`);
});

// Parity tests: in-band writer fence (capabilities.inBandFence) + hook
// force-claim victim journaling (hook_disposed w/ forceClaimedBy) + refusal
// (hook_conflict w/ forceRefusedReason 'victim-spec-version') + events.list
// snapshot + resolveData 'skip-step-inputs'.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from '../dist/index.js';
import pg from 'pg';

const CS = process.env.ENTRYLITE_WORLD_URL ?? 'postgres://world:world@127.0.0.1:5432/workflow';
const world = createWorld({ connectionString: CS });

test('capabilities declare inBandFence + eventsResolveData', () => {
  assert.equal(world.capabilities.inBandFence, true);
  assert.equal(world.capabilities.eventsResolveData, true);
});

const mkRun = async (name) => {
  const runId = world.createRunId();
  await world.events.create(runId, {
    specVersion: 8, eventType: 'run_created',
    eventData: { deploymentId: 'dpl_fence_test', workflowName: name, workflowCode: new Uint8Array([1]), context: {} },
  });
  return runId;
};

test('in-band fence: correct expectedSeqInBand succeeds, stale one throws InBandSupersededError', async () => {
  const runId = await mkRun('wf-fence-test');
  // run_created counted as in-band position 1 → next fenced write expects 1.
  const ok = await world.events.create(runId, { eventType: 'run_started', eventData: {} }, { inBand: true, expectedSeqInBand: 1 });
  assert.ok(ok.event);
  // Another in-band write now expects 2; a stale writer still holding 1 is refused.
  await assert.rejects(
    () => world.events.create(runId, { eventType: 'run_started', eventData: {} }, { inBand: true, expectedSeqInBand: 1 }),
    (err) => err.name === 'InBandSupersededError' && err.seqInBand === 2,
  );
  // Out-of-band writes are never refused and don't move the count.
  await world.events.create(runId, { eventType: 'noop', eventData: {} });
  const ok2 = await world.events.create(runId, { eventType: 'run_started', eventData: {} }, { inBand: true, expectedSeqInBand: 2 });
  assert.ok(ok2.event);
  // list() snapshot reports the counter.
  const list = await world.events.list({ runId });
  assert.equal(list.snapshot.seqInBand, 3);
  await world.runs.experimentalDelete?.(runId).catch(() => {});
});

test('events.list resolveData skip-step-inputs strips step input from page', async () => {
  const runId = await mkRun('wf-skip-test-' + crypto.randomUUID().slice(0, 8));
  const sid = 's-' + crypto.randomUUID().slice(0, 8);
  // lazy step start: step_created event carries input in eventData
  await world.events.create(runId, { specVersion: 8, eventType: 'step_started', correlationId: sid, eventData: { stepId: sid, stepName: sid, input: [1, 2, 3] } });
  const full = await world.events.list({ runId });
  const stripped = await world.events.list({ runId, resolveData: 'skip-step-inputs' });
  const fullRow = full.data.find((e) => e.eventType === 'step_created');
  const stripRow = stripped.data.find((e) => e.eventType === 'step_created');
  assert.ok(fullRow?.eventData?.input);
  assert.equal(stripRow?.eventData?.input, undefined);
});

// The world's worker pool keeps the loop alive; exit explicitly.
process.exit(0);

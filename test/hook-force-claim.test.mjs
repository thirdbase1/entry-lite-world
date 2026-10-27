// Hook force-claim contract: victim journaling (hook_disposed w/ forceClaimedBy
// in the victim's log) + refusal against a running sub-spec-8 victim
// (hook_conflict w/ forceRefusedReason 'victim-spec-version').
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createWorld } from '../dist/index.js';

const CS = process.env.ENTRYLITE_WORLD_URL ?? 'postgres://world:world@127.0.0.1:5432/workflow';
const world = createWorld({ connectionString: CS });

const mkRun = async (name, specVersion = 8) => {
  const runId = world.createRunId();
  await world.events.create(runId, {
    specVersion, eventType: 'run_created',
    eventData: { deploymentId: 'dpl_force_test', workflowName: name, workflowCode: new Uint8Array([1]), context: {} },
  });
  return runId;
};

const mkHook = async (runId, token, specVersion = 8) => {
  await world.events.create(runId, {
    specVersion, eventType: 'hook_created', correlationId: `hk-${crypto.randomUUID().slice(0, 8)}`,
    eventData: { token, metadata: {} },
  });
};

test('force claim: victim run gets hook_disposed with forceClaimedBy; token re-points toclaimer', async () => {
  const token = `tok-${crypto.randomUUID()}`;
  const victim = await mkRun('wf-force-victim-' + crypto.randomUUID().slice(0, 6));
  const claimer = await mkRun('wf-force-claimer-' + crypto.randomUUID().slice(0, 6));
  const hookId = `hk-${crypto.randomUUID().slice(0, 8)}`;
  await world.events.create(victim, { specVersion: 8, eventType: 'hook_created', correlationId: hookId, eventData: { token, metadata: {} } });
  // claimer force-creates a hook with the same token
  const res = await world.events.create(claimer, { specVersion: 8, eventType: 'hook_created', correlationId: `hk-${crypto.randomUUID().slice(0, 8)}`, eventData: { token, metadata: {}, force: true } });
  assert.ok(res.event, 'forced hook_created commits for the claimer');
  // victim's log holds a hook_disposed naming the claimer
  const vLog = await world.events.list({ runId: victim });
  const disposed = vLog.data.find((e) => e.eventType === 'hook_disposed');
  assert.ok(disposed, 'victim log has hook_disposed');
  assert.equal(disposed.eventData.forceClaimedBy.runId, claimer, 'forceClaimedBy names the claimer run');
  assert.ok(disposed.eventData.forceClaimedBy.hookId, 'forceClaimedBy carries the hook id');
});

test('force refused against running sub-spec-8 victim: hook_conflict with victim-spec-version', async () => {
  const token = `tok-${crypto.randomUUID()}`;
  const victim = await mkRun('wf-old-victim-' + crypto.randomUUID().slice(0, 6), 4);
  const claimer = await mkRun('wf-old-claimer-' + crypto.randomUUID().slice(0, 6));
  const hookId = `hk-${crypto.randomUUID().slice(0, 8)}`;
  await world.events.create(victim, { specVersion: 4, eventType: 'hook_created', correlationId: hookId, eventData: { token, metadata: {} } });
  const res = await world.events.create(claimer, { specVersion: 8, eventType: 'hook_created', correlationId: `hk-${crypto.randomUUID().slice(0, 8)}`, eventData: { token, metadata: {}, force: true } });
  assert.ok(res.event, 'forced create answers with an event (not a throw)');
  assert.equal(res.event.eventType, 'hook_conflict', 'ordinary hook_conflict returned');
  assert.equal(res.event.eventData.forceRefusedReason, 'victim-spec-version');
  assert.equal(res.event.eventData.conflictingRunId, victim);
});

// The world's worker pool keeps the loop alive; exit explicitly.
process.exit(0);

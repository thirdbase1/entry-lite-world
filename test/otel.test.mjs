// OTel test: register a minimal recording provider/tracer via @opentelemetry/api,
// fire a run through the world, assert spans with expected names/attributes.
import assert from 'node:assert/strict';
import {
  ProxyTracerProvider,
  context,
  propagation,
  trace as otelTrace,
  ROOT_CONTEXT,
} from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';

// Real context manager: the default noop manager's with() doesn't set the
// active context, so spans would never parent or propagate.
context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());

// ---- minimal in-memory recording SDK ----
const recordedSpans = [];

class RecordingSpan {
  constructor(name, parentCtx, attributes = {}) {
    this.name = name;
    this.attributes = { ...attributes };
    this.status = undefined;
    this.ended = false;
    this.spanContext = {
      traceId: '11111111111111111111111111111111',
      spanId: String(++RecordingSpan._seq).padStart(16, '0'),
      traceFlags: 1,
    };
    this.parentContext = parentCtx ?? null;
    recordedSpans.push(this);
  }
  static _seq = 0;
  setAttribute(k, v) { this.attributes[k] = v; return this; }
  setAttributes(attrs) { Object.assign(this.attributes, attrs); return this; }
  setStatus(s) { this.status = s; return this; }
  addEvent() { return this; }
  recordException() { return this; }
  updateName(n) { this.name = n; return this; }
  isRecording() { return !this.ended; }
  set spanContext(sc) { this._ctx = sc; }
  get spanContext() { return this._ctx; }
  end() { this.ended = true; }
}

class RecordingTracer {
  startActiveSpan(name, arg1, arg2, arg3) {
    // forms: (name, fn) | (name, opts, fn) | (name, ctx, opts, fn)
    let opts, ctx, fn;
    if (typeof arg1 === 'function') { fn = arg1; }
    else if (typeof arg2 === 'function') { opts = arg1; fn = arg2; ctx = ROOT_CONTEXT; }
    else { ctx = arg1; opts = arg2; fn = arg3; }
    const span = new RecordingSpan(name, ctx, opts?.attributes);
    return context.with(otelTrace.setSpan(context.active(), span), () => fn(span));
  }
  // startSpan used if someone bypasses active-span API
  startSpan(name, opts, ctx) { return new RecordingSpan(name, ctx, opts?.attributes); }
}

class RecordingProvider {
  getTracer(name, version, opts) {
    return new RecordingTracer();
  }
}

const provider = new RecordingProvider();
otelTrace.setGlobalTracerProvider(provider);

// Register a propagator so injectTraceContextIntoHeaders emits traceparent.
propagation.setGlobalPropagator({
  inject(ctx, carrier, setter) {
    const span = otelTrace.getSpan(ctx);
    if (span?.spanContext) {
      setter.set(carrier, 'traceparent', `00-${span.spanContext.traceId}-${span.spanContext.spanId}-01`);
    }
  },
  extract: (ctx) => ctx,
  fields: ['traceparent'],
});

process.env.ENTRYLITE_QUEUE_NAMESPACE = process.env.ENTRYLITE_QUEUE_NAMESPACE ?? 'oteliso' + Math.random().toString(36).slice(2, 8);
const { createWorld } = await import('../dist/index.js');
const world = createWorld({ connectionString: 'postgres://world:world@127.0.0.1:5432/workflow' });

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗ FAIL:', name, detail ?? ''); }
};

// Fire a run through the world: run_created → run_started → step events → run_completed.
const runId = (await world.events.create(null, {
  eventType: 'run_created',
  specVersion: world.specVersion,
  eventData: { deploymentId: 'dpl_test', workflowName: 'wfOtel', input: [1], executionContext: {}, attributes: {} },
})).run?.runId;
await world.events.create(runId, { eventType: 'run_started', specVersion: world.specVersion });
await world.events.create(runId, { eventType: 'step_created', correlationId: 'st1', specVersion: world.specVersion, eventData: { stepName: 's', input: [1] } });
await world.events.create(runId, { eventType: 'step_started', correlationId: 'st1', specVersion: world.specVersion });
await world.events.create(runId, { eventType: 'step_completed', correlationId: 'st1', specVersion: world.specVersion, eventData: { output: [2] } });
await world.events.create(runId, { eventType: 'run_completed', specVersion: world.specVersion, eventData: { output: { ok: true } } });

// Queue enqueue path: exercise world.queue so entrylite.queue.enqueue span records.
// Also wait for the queue worker to claim and deliver the enqueued job. Delivery
// goes to BASE_URL (default http://localhost:3000) which isn't running; transport
// failure still exercises entrylite.queue.claim and entrylite.queue.deliver spans.
await world.queue('wfOtel', { runId });

// Poll until a deliver span shows up (the worker is asynchronous), then close.
const waitUntil = async (cond, ms) => {
  const start = Date.now();
  while (!cond() && Date.now() - start < ms) await new Promise((r) => setTimeout(r, 50));
};
await waitUntil(() => recordedSpans.some((s) => s.name === 'entrylite.queue.deliver'), 5000);
const claimEnded = () => recordedSpans
  .filter((s) => s.name === 'entrylite.queue.claim' && s.attributes['entrylite.queue.name'] === 'wfOtel' && !s.ended).length === 0
  || Date.now() - claimStart > 6000;
const claimStart = Date.now();
await waitUntil(claimEnded, 7000);
await world.close();
const names = () => recordedSpans.map((s) => s.name);
ok('events.create spans recorded', names().filter((n) => n === 'entrylite.events.create').length >= 6, JSON.stringify(names()));
ok('queue.enqueue span recorded', names().includes('entrylite.queue.enqueue'), JSON.stringify(names()));

const runCreatedSpan = recordedSpans.find((s) => s.name === 'entrylite.events.create' && s.attributes['entrylite.run.id'] === runId && s.attributes['entrylite.event.type'] === 'run_created');
ok('run_created span has runId attribute', !!runCreatedSpan, JSON.stringify(recordedSpans.find((s) => s.name === 'entrylite.events.create')?.attributes));
ok('run_created span has namespace attribute', runCreatedSpan?.attributes['entrylite.namespace'] !== undefined);
// Assert spans ended (claim spans from the poll loop race with close(); only
// check spans whose lifecycle we awaited).
ok('spans ended', recordedSpans
  .filter((s) => s.name !== 'entrylite.queue.claim')
  .every((s) => s.ended),
  JSON.stringify(recordedSpans.filter((s) => s.name !== 'entrylite.queue.claim' && !s.ended).map((s) => s.name)));

// Trace-context injection: inside an active span, world.queue must put traceparent on the delivery headers.
// We verify via injectTraceContextIntoHeaders used in deliver — simulate by checking headers build.
{
  const { injectTraceContextIntoHeaders } = await import('../dist/telemetry.js');
  const headers = { 'content-type': 'application/json' };
  await otelTrace.getTracer('entrylite-world').startActiveSpan('test.delivery', {}, async (span) => {
    await injectTraceContextIntoHeaders(headers);
    span.end();
  });
  ok('traceparent injected into delivery headers', /^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/.test(headers.traceparent ?? ''), JSON.stringify(headers));
  ok('traceparent traceId matches active span', headers.traceparent?.includes(recordedSpans.find((s) => s.name === 'test.delivery')?.spanContext?.spanId ?? 'NONE'), headers.traceparent);
}

await world.close().catch(() => {});
await new Promise((r) => setTimeout(r, 100));
ok('queue.deliver span recorded', names().includes('entrylite.queue.deliver'), JSON.stringify(names()));
const deliverSpan = recordedSpans.filter((s) => s.name === 'entrylite.queue.deliver').pop();
ok('deliver span has queue name attribute', typeof deliverSpan?.attributes['entrylite.queue.name'] === 'string');
ok('deliver span has attempts attribute', typeof deliverSpan?.attributes['entrylite.queue.attempts'] === 'number');

console.log(`\notel: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);

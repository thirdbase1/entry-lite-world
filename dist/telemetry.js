// On globalThis (not module scope) so multiple copies of this module in one
// process share a single lazy import / tracer.
const OTEL_KEY = Symbol.for('entrylite.world//telemetry');
const otel = globalThis[OTEL_KEY] ??
    (globalThis[OTEL_KEY] = { apiPromise: null, tracerPromise: null });
async function getOtelApi() {
    if (!otel.apiPromise) {
        // Dynamic import keeps the dependency optional at runtime; a resolution
        // failure (peer not installed) disables tracing silently.
        otel.apiPromise = import('@opentelemetry/api').catch(() => null);
    }
    return otel.apiPromise;
}
async function getTracer() {
    if (!otel.tracerPromise) {
        otel.tracerPromise = getOtelApi().then((otelApi) => otelApi ? otelApi.trace.getTracer('entrylite-world') : null);
    }
    return otel.tracerPromise;
}
/** True when the real (non-noop) OTel API resolved — used by tests/diagnostics. */
export async function otelAvailable() {
    return (await getOtelApi()) !== null;
}
/**
 * Wrap an async fn in a span. No-op (just runs fn) when OTel is unavailable.
 * Attributes are applied to the span when it starts; fn may set more via the
 * passed span.
 */
export async function trace(spanName, attributes, fn) {
    const [tracer, otelApi] = await Promise.all([getTracer(), getOtelApi()]);
    if (!tracer || !otelApi)
        return fn();
    const cleanAttrs = Object.fromEntries(Object.entries(attributes).filter(([, v]) => v !== undefined));
    return tracer.startActiveSpan(spanName, { attributes: cleanAttrs }, async (span) => {
        try {
            const result = await fn(span);
            span.setStatus({ code: otelApi.SpanStatusCode.OK });
            return result;
        }
        catch (e) {
            span.setStatus({
                code: otelApi.SpanStatusCode.ERROR,
                message: e instanceof Error ? e.message : String(e),
            });
            throw e;
        }
        finally {
            span.end();
        }
    });
}
/**
 * Inject the active W3C trace context (traceparent/tracestate/baggage) into
 * the given header record. No-ops when OTel is unavailable or no propagator
 * is registered (the default no-op propagator writes nothing), so callers can
 * invoke it unconditionally before outgoing fetches.
 */
export async function injectTraceContextIntoHeaders(headers) {
    const otelApi = await getOtelApi();
    if (!otelApi)
        return;
    try {
        otelApi.propagation.inject(otelApi.context.active(), headers);
    }
    catch {
        /* a broken propagator must never break delivery */
    }
}
/** The deployment's queue namespace (shared semantics with util.ts). */
export const getNamespace = () => process.env.ENTRYLITE_QUEUE_NAMESPACE ?? '';

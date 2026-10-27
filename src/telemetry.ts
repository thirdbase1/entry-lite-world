/**
 * Entry-Lite World — optional OpenTelemetry support.
 *
 * Mirrors world-vercel's telemetry.ts pattern: `@opentelemetry/api` is an
 * OPTIONAL peer dependency, lazily imported once. If it is absent (or fails
 * to resolve), every helper no-ops and the world behaves exactly as before.
 *
 * Spans use the tracer name 'entrylite-world'. Context injection uses the
 * globally registered propagator (typically W3C traceparent) so app-side
 * spans can parent off outgoing delivery requests.
 */
import type * as api from '@opentelemetry/api';

interface OtelState {
  apiPromise: Promise<typeof api | null> | null;
  tracerPromise: Promise<api.Tracer | null> | null;
}

// On globalThis (not module scope) so multiple copies of this module in one
// process share a single lazy import / tracer.
const OTEL_KEY = Symbol.for('entrylite.world//telemetry');
const otel: OtelState =
  ((globalThis as any)[OTEL_KEY] as OtelState | undefined) ??
  ((globalThis as any)[OTEL_KEY] = { apiPromise: null, tracerPromise: null });

async function getOtelApi(): Promise<typeof api | null> {
  if (!otel.apiPromise) {
    // Dynamic import keeps the dependency optional at runtime; a resolution
    // failure (peer not installed) disables tracing silently.
    otel.apiPromise = (import('@opentelemetry/api') as Promise<typeof api>).catch(
      () => null,
    );
  }
  return otel.apiPromise;
}

async function getTracer(): Promise<api.Tracer | null> {
  if (!otel.tracerPromise) {
    otel.tracerPromise = getOtelApi().then((otelApi) =>
      otelApi ? otelApi.trace.getTracer('entrylite-world') : null,
    );
  }
  return otel.tracerPromise;
}

/** True when the real (non-noop) OTel API resolved — used by tests/diagnostics. */
export async function otelAvailable(): Promise<boolean> {
  return (await getOtelApi()) !== null;
}

/**
 * Wrap an async fn in a span. No-op (just runs fn) when OTel is unavailable.
 * Attributes are applied to the span when it starts; fn may set more via the
 * passed span.
 */
export async function trace<T>(
  spanName: string,
  attributes: Record<string, string | number | boolean | undefined>,
  fn: (span?: api.Span) => Promise<T>,
): Promise<T> {
  const [tracer, otelApi] = await Promise.all([getTracer(), getOtelApi()]);
  if (!tracer || !otelApi) return fn();
  const cleanAttrs = Object.fromEntries(
    Object.entries(attributes).filter(([, v]) => v !== undefined),
  );
  return tracer.startActiveSpan(spanName, { attributes: cleanAttrs }, async (span) => {
    try {
      const result = await fn(span);
      span.setStatus({ code: otelApi.SpanStatusCode.OK });
      return result;
    } catch (e) {
      span.setStatus({
        code: otelApi.SpanStatusCode.ERROR,
        message: e instanceof Error ? e.message : String(e),
      });
      throw e;
    } finally {
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
export async function injectTraceContextIntoHeaders(
  headers: Record<string, string>,
): Promise<void> {
  const otelApi = await getOtelApi();
  if (!otelApi) return;
  try {
    otelApi.propagation.inject(otelApi.context.active(), headers);
  } catch {
    /* a broken propagator must never break delivery */
  }
}

/** The deployment's queue namespace (shared semantics with util.ts). */
export const getNamespace = (): string =>
  process.env.ENTRYLITE_QUEUE_NAMESPACE ?? '';
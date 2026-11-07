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
/** True when the real (non-noop) OTel API resolved — used by tests/diagnostics. */
export declare function otelAvailable(): Promise<boolean>;
/**
 * Wrap an async fn in a span. No-op (just runs fn) when OTel is unavailable.
 * Attributes are applied to the span when it starts; fn may set more via the
 * passed span.
 */
export declare function trace<T>(spanName: string, attributes: Record<string, string | number | boolean | undefined>, fn: (span?: api.Span) => Promise<T>): Promise<T>;
/**
 * Inject the active W3C trace context (traceparent/tracestate/baggage) into
 * the given header record. No-ops when OTel is unavailable or no propagator
 * is registered (the default no-op propagator writes nothing), so callers can
 * invoke it unconditionally before outgoing fetches.
 */
export declare function injectTraceContextIntoHeaders(headers: Record<string, string>): Promise<void>;
/** The deployment's queue namespace (shared semantics with util.ts). */
export declare const getNamespace: () => string;

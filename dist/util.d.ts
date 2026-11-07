/**
 * Entry-Lite World — shared low-level utilities.
 * Plain node-postgres, no ORM. Queue payload format = TypedJSON identical to
 * world-local (Uint8Array => { __type: 'Uint8Array', data: base64 }).
 */
import type { Pool, PoolClient } from 'pg';
export declare const SPEC_VERSION = 4;
export declare const TERMINAL_RUN_STATUSES: readonly ["completed", "failed", "cancelled"];
export declare const TERMINAL_STEP_STATUSES: readonly ["completed", "failed", "cancelled"];
export type Json = string | number | boolean | null | Json[] | {
    [k: string]: Json;
} | Uint8Array;
/** JSON transport preserving Uint8Array (same wire format as world-local). */
export declare function jsonReplacer(_key: string, value: unknown): unknown;
export declare function jsonReviver(_key: string, value: any): unknown;
export declare function serializeBody(message: unknown): Buffer;
export declare function deserializeBody(raw: string | Buffer): unknown;
export declare const newRunId: () => string;
export declare const newEventId: () => string;
export declare const newStepId: () => string;
export declare const newHookId: () => string;
export declare const newMessageId: () => string;
export declare const newChunkId: () => string;
/**
 * Per-deployment queue namespace. Independent deployments sharing one
 * PostgreSQL database set different ENTRYLITE_QUEUE_NAMESPACE values; every
 * queue row is stored under `<ns>::<queueName>` and every claim/lease/
 * recovery/sweep query is scoped to this deployment's rows, so no deployment
 * can claim, lease, retry, or recover another's jobs. Unset = legacy
 * single-deployment mode (no prefix, unchanged behavior). Validated once at
 * import — explicit and stable across restarts, never auto-generated.
 */
export declare const RAW_NAMESPACE: string;
export declare const NAMESPACE_RE: RegExp;
export declare const NS_SEP = "::";
export declare const NAMESPACE: string;
/** Full DB-stored queue name for a logical queue name. */
export declare function nsQueueName(queueName: string): string;
/** True if a DB-stored queue_name belongs to this deployment. */
export declare function isOwnQueueName(dbQueueName: string): boolean;
/** SQL fragment scoping a queue_name column to this deployment's rows. */
export declare const NS_CLAIM_WHERE: string;
/** Namespace-stamped idempotency key (job_key). */
export declare function nsJobKey(key: string | null | undefined): string | null;
/** Compact: strip undefined values (matches worlds' compact()). */
export declare function compact<T extends Record<string, unknown>>(obj: T): T;
/** Parse a queue name "q_<prefix>::<rest>" style used by the SDK. */
export declare function parseQueueName(queueName: string): {
    prefix: string;
    id: string;
};
export declare function withTx<T>(pool: Pool, fn: (tx: PoolClient) => Promise<T>): Promise<T>;
/** Structured error normalization for run.error / step.error text columns. */
export declare function errorToText(err: unknown): string;

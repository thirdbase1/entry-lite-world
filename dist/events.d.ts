/**
 * Entry-Lite World — event creation + entity materialization.
 * Mirrors the official postgres world's semantics with Entry-Lite's schema:
 * one transaction per event: validate → materialize entity → insert event
 * (position = MAX(slot)+1 inside the tx) → return EventResult.
 */
import type { Pool } from 'pg';
export interface EventResultLike {
    event?: any;
    run?: any;
    step?: any;
    hook?: any;
    wait?: any;
}
/**
 * Create an event and materialize the entity change in ONE transaction.
 * Enqueues the wake message(s) via the jobs table in the same tx (wake rows
 * are returned so queue layer can rely on their existence).
 */
export declare function createEvent(pool: Pool, runId: string | null, data: any, wakes?: Array<{
    queueName: string;
    body: unknown;
    delaySeconds?: number;
    jobKey?: string;
}>, params?: {
    inBand?: boolean;
    expectedSeqInBand?: number;
    eventCount?: number;
}): Promise<EventResultLike>;
/** Reverse of jsonSafe for reads. */
export declare function jsonUnsafe(v: unknown): unknown;

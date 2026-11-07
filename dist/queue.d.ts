/**
 * Entry-Lite World — durable queue + streamer.
 * Queue: entrylite.workflow_jobs, SKIP LOCKED pickup, LISTEN/NOTIFY wake,
 * in-process worker loop delivering to the SDK's queue handler (direct call,
 * no HTTP hop). Handler result `{ timeoutSeconds }` = long-poll reschedule.
 */
import type { Pool } from 'pg';
export declare function createQueue(pool: Pool): {
    kick: () => void;
    queue(queueName: string, message: unknown, opts?: any): Promise<{
        messageId: string | null;
    }>;
    createQueueHandler(queueNamePrefix: string, handler: (message: unknown, meta: any) => Promise<void | {
        timeoutSeconds: number;
    }>): (req: Request) => Promise<Response>;
    getDeploymentId(): Promise<string>;
    deadLetterList(options?: {
        limit?: number;
        queueName?: string;
    }): Promise<any>;
    deadLetterRequeue(jobId: number | string): Promise<{
        requeued: boolean;
    }>;
    deadLetterDelete(jobId: number | string): Promise<{
        deleted: boolean;
    }>;
    start(): Promise<void>;
    close(): Promise<void>;
};
export declare function createStreamer(pool: Pool): {
    streams: {
        write(runId: string, name: string, chunk: string | Uint8Array): Promise<void>;
        writeMulti(runId: string, name: string, chunks: (string | Uint8Array)[]): Promise<void>;
        close(runId: string, name: string): Promise<void>;
        get(runId: string, name: string, startIndex?: number): Promise<ReadableStream<Uint8Array>>;
        list(runId: string): Promise<string[]>;
        getChunks(runId: string, name: string, options?: any): Promise<any>;
        getInfo(runId: string, name: string): Promise<{
            tailIndex: number;
            done: boolean;
        }>;
    };
    close(): Promise<void>;
};

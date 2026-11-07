export declare function createWorld(config?: {
    connectionString?: string;
    maxPoolSize?: number;
    streamFlushIntervalMs?: number;
    /** Per-deployment queue namespace (overrides ENTRYLITE_QUEUE_NAMESPACE env). */
    queueNamespace?: string;
}): {
    telemetry: {
        recordStepExecution: (stepId: string) => void;
    };
    start(): Promise<void>;
    close(): Promise<void>;
    clear(): Promise<void>;
    streamFlushIntervalMs?: number | undefined;
    invoke: (runId: string, payload: unknown, options?: {
        idempotencyKey?: string;
        timeoutMs?: number;
    }) => Promise<unknown>;
    analytics: {
        runs: {
            get(runId: string): Promise<{
                runId: any;
                status: any;
                workflowName: any;
                attributes: any;
                createdAt: any;
                startedAt: any;
                completedAt: any;
            }>;
            list(params?: any): Promise<{
                data: any[];
                pagination: {
                    cursor?: string | undefined;
                    hasMore: boolean;
                };
            }>;
        };
        attributes: {
            list(params?: any): Promise<{
                data: any[];
                pagination: {
                    cursor?: string | undefined;
                    hasMore: boolean;
                };
            }>;
        };
        steps: {
            get(runId: string, stepId: string): Promise<{
                runId: any;
                stepId: any;
                status: any;
                createdAt: any;
                startedAt: any;
                completedAt: any;
            }>;
            list(params: any): Promise<{
                data: any[];
                pagination: {
                    cursor?: string | undefined;
                    hasMore: boolean;
                };
            }>;
        };
        events: {
            get(runId: string, eventId: string): Promise<{
                eventId: any;
                runId: any;
                eventType: any;
                correlationId: any;
                entityId: any;
                stepName: null;
                workflowName: any;
                deploymentId: any;
                specVersion: any;
                runCreatedAt: any;
                createdAt: any;
            }>;
            getMany(runId: string, eventIds: readonly string[]): Promise<{
                eventId: any;
                runId: any;
                eventType: any;
                correlationId: any;
                entityId: any;
                stepName: null;
                workflowName: any;
                deploymentId: any;
                specVersion: any;
                runCreatedAt: any;
                createdAt: any;
            }[]>;
            list(params: any): Promise<{
                data: any[];
                pagination: {
                    cursor?: string | undefined;
                    hasMore: boolean;
                };
            }>;
            listByCorrelationId(params: any): Promise<{
                data: any[];
                pagination: {
                    cursor?: string | undefined;
                    hasMore: boolean;
                };
            }>;
        };
        hooks: {
            get(hookId: string, _params?: any): Promise<{
                runId: any;
                hookId: any;
                status: string;
                createdAt: any;
                updatedAt: any;
                isWebhook: any;
                isSystem: any;
            }>;
            list(params: any): Promise<{
                data: any[];
                pagination: {
                    cursor?: string | undefined;
                    hasMore: boolean;
                };
            }>;
        };
        waits: {
            get(runId: string, waitId: string): Promise<{
                runId: any;
                waitId: string;
                status: any;
                resumeAt: any;
                createdAt: any;
                updatedAt: any;
                completedAt: any;
            }>;
            list(params: any): Promise<{
                data: any[];
                pagination: {
                    cursor?: string | undefined;
                    hasMore: boolean;
                };
            }>;
        };
    };
    getEnvironment: () => string | undefined;
    experimental_snapshots: {
        save(runId: string, data: Uint8Array, metadata: any): Promise<void>;
        load(runId: string): Promise<{
            data: Uint8Array;
            metadata: any;
        } | null>;
        delete(runId: string): Promise<void>;
    };
    uploadDynamicWorkflowCode: (runId: string, params: {
        workflowName: string;
        code: Uint8Array;
    }) => Promise<string>;
    getEncryptionKeyForRun: (runOrId: any) => Promise<Uint8Array | undefined>;
    queueBatch: (queueName: string, messages: readonly {
        message: unknown;
        opts?: any;
    }[]) => Promise<any[]>;
    registerRoute: (prefix: string, path: string) => void;
    registerHandler: (prefix: string, handler: (req: Request) => Promise<Response>) => void;
    getRouteForPrefix: (prefix: string) => string | undefined;
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
    specVersion: number;
    getRuntimeDeadline: () => Promise<Date | undefined>;
    createRunId: () => string;
    regionForRunId: (_runId: string) => string | null;
    validateRunExecutionContext: (_value: Record<string, unknown>) => void;
    describeRun: (run: Readonly<Record<string, unknown>>) => Record<string, string | null>;
    capabilities: {
        hookRetention: {
            active: boolean;
        };
        maxConcurrency: boolean;
        queueNamespace: boolean;
        hookResumeDedup: boolean;
        hookForceClaim: boolean;
        dynamicWorkflowCode: boolean;
        invoke: boolean;
        inBandFence: boolean;
        eventsResolveData: boolean;
    };
    runs: {
        waitForTerminalStatus: (id: string, params?: any) => Promise<any>;
        getMany: (ids: readonly string[], params?: any) => Promise<any[]>;
        cancelMany: (request: {
            runIds: readonly string[];
            cancelReason?: string;
        }) => Promise<any>;
        experimentalSetAttributes: (runId: string, changes: Array<{
            key: string;
            value: string | null;
        }>, options?: {
            allowReservedAttributes?: boolean;
        }) => Promise<{
            attributes: Record<string, string>;
        }>;
        get(runId: string, params?: any): Promise<any>;
        list(params?: any): Promise<any>;
        cancel(runId: string): Promise<any>;
    };
    steps: {
        get(runId: string, stepId: string, params?: any): Promise<any>;
        list(params: any): Promise<any>;
    };
    hooks: {
        get(hookId: string, params?: any): Promise<any>;
        getByToken(token: string, params?: any): Promise<any>;
        list(params: any): Promise<any>;
    };
    events: {
        create(runId: string | null, data: any, params?: any): Promise<any>;
        get: (runId: string, eventId: string, params?: any) => Promise<any>;
        list: (params: any) => Promise<any>;
        listByCorrelationId: (params: any) => Promise<any>;
        createBatch: (runId: string, events: any[], _params?: any) => Promise<{
            results: any[];
        }>;
    };
};

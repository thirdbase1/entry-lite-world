import type { Pool } from 'pg';
export declare function createExtras(pool: Pool, opts: {
    nsQueueName: (name: string) => string;
    nsJobKey: (key: string) => string;
    getNamespace: () => string;
    queue: {
        queue: (queueName: string, message: unknown, opts?: any) => Promise<{
            messageId: string | null;
        }>;
        start?: () => Promise<void>;
    };
    eventsRead: any;
    runsStorage: any;
    mapRun: (row: any) => any;
    mapStep: (row: any) => any;
    mapHook: (row: any) => any;
    newEventId?: () => string;
}): {
    _runsAdditions: {
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
    };
    _invoke: (runId: string, payload: unknown, options?: {
        idempotencyKey?: string;
        timeoutMs?: number;
    }) => Promise<unknown>;
    _snapshots: {
        save(runId: string, data: Uint8Array, metadata: any): Promise<void>;
        load(runId: string): Promise<{
            data: Uint8Array;
            metadata: any;
        } | null>;
        delete(runId: string): Promise<void>;
    };
    _uploadDynamicWorkflowCode: (runId: string, params: {
        workflowName: string;
        code: Uint8Array;
    }) => Promise<string>;
    _getEncryptionKeyForRun: (runOrId: any) => Promise<Uint8Array | undefined>;
    _eventsAdditions: {
        createBatch: (runId: string, events: any[], _params?: any) => Promise<{
            results: any[];
        }>;
    };
    _queueAdditions: {
        queueBatch: (queueName: string, messages: readonly {
            message: unknown;
            opts?: any;
        }[]) => Promise<any[]>;
        registerRoute: (prefix: string, path: string) => void;
        registerHandler: (prefix: string, handler: (req: Request) => Promise<Response>) => void;
        getRouteForPrefix: (prefix: string) => string | undefined;
    };
    _analytics: {
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
    _getEnvironment: () => string | undefined;
    _handlers: Map<string, (req: Request) => Promise<Response>>;
    _routes: Map<string, (req: Request) => Promise<Response>>;
};

/**
 * Entry-Lite World — storage views (runs/steps/hooks/events reads).
 */
import type { Pool } from 'pg';
export declare function createRunsStorage(pool: Pool): {
    get(runId: string, params?: any): Promise<any>;
    list(params?: any): Promise<any>;
    cancel(runId: string): Promise<any>;
};
export declare function createStepsStorage(pool: Pool): {
    get(runId: string, stepId: string, params?: any): Promise<any>;
    list(params: any): Promise<any>;
};
export declare function createHooksStorage(pool: Pool): {
    get(hookId: string, params?: any): Promise<any>;
    getByToken(token: string, params?: any): Promise<any>;
    list(params: any): Promise<any>;
};
export declare function createEventsReadStorage(pool: Pool): {
    get(runId: string, eventId: string, params?: any): Promise<any>;
    list(params: any): Promise<any>;
    listByCorrelationId(params: any): Promise<any>;
};

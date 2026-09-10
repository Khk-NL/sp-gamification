interface SpTask {
  id: string;
  title: string;
  timeSpent: number;
  isDone: boolean;
  resolvedTagNames?: string[];
}

interface SpNodeResult {
  success: boolean;
  result?: unknown;
  error?: unknown;
}

interface SpPluginApi {
  Hooks: Record<string, string>;
  registerHook(hook: string, handler: (payload: any) => void | Promise<void>): void;
  loadSyncedData(key?: string): Promise<string | null>;
  persistDataSynced(data: string, key?: string): Promise<void>;
  getTasks(): Promise<SpTask[]>;
  showSnack(config: { msg: string; type?: 'SUCCESS' | 'ERROR' | 'WARNING' | 'INFO' }): void;
  notify(config: { title: string; body: string }): Promise<void>;
  request<T = unknown>(url: string, options?: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
    timeout?: number;
    responseType?: 'json' | 'text';
  }): Promise<T>;
  onReady?(handler: () => void | Promise<void>): void;
  onMessage?(handler: (message: unknown) => unknown | Promise<unknown>): void;
  onUnload?(handler: () => void | Promise<void>): void;
  executeNodeScript?(request: {
    script: string;
    args?: unknown[];
    timeout?: number;
  }): Promise<SpNodeResult>;
}

declare const PluginAPI: SpPluginApi;

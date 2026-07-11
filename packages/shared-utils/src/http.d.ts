export type OpenClawIncomingMessage = {
  headers: Record<string, string | string[] | undefined>;
  on(event: string, listener: (...args: unknown[]) => void): unknown;
  destroy(): void;
};

export type OpenClawServerResponse = {
  writeHead(statusCode: number, headers: Record<string, string>): void;
  end(payload: string): void;
};

export function corsHeaders(extraHeaders?: Record<string, string>): Record<string, string>;

export function sendJson(res: OpenClawServerResponse, statusCode: number, payload: unknown): void;

export function readJsonBody<T = Record<string, unknown>>(
  req: OpenClawIncomingMessage,
  maxBytes?: number
): Promise<T>;

export function createEventPublisher(
  eventHubUrl: string,
  serviceName: string,
  fetchFn?: typeof fetch
): (type: string, payload?: Record<string, unknown>) => Promise<{ ok: boolean; error?: string }>;

export function registerService(eventHubUrl: string, name: string, url: string): Promise<void>;

export function getRequestId(req: OpenClawIncomingMessage): string;

export function withTracing(
  fetchFn: typeof fetch,
  serviceName: string
): (url: string | URL, options?: RequestInit & { requestId?: string }) => Promise<Response>;

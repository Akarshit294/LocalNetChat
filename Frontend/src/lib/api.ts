// The backend runs on the machine that served this page, on port 8000.
// Built from the page's own address, so the same code works on the laptop
// (localhost) and on a phone on the same Wi-Fi (the laptop's LAN IP).
const API_BASE = `http://${window.location.hostname}:8000`;
const REQUEST_TIMEOUT_MS = 10_000;

export const WS_URL = `ws://${window.location.hostname}:8000/ws`;

export class ApiError extends Error {
  readonly status: number;
  readonly body: string;

  constructor(status: number, body: string) {
    super(`${status}: ${body}`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }

  get isNotFound() {
    return this.status === 404;
  }

  get isServerError() {
    return this.status >= 500;
  }

  // FastAPI's HTTPException(detail=...) arrives as {"detail": "..."}.
  // Null when the body isn't that shape.
  get detail(): string | null {
    try {
      const d = (JSON.parse(this.body) as { detail?: unknown })?.detail;
      return typeof d === 'string' && d.trim() ? d : null;
    } catch {
      return null;
    }
  }
}

async function request<T>(
  path: string,
  options: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
  const { timeoutMs, headers: incomingHeaders, ...rest } = options;
  const headers = new Headers(incomingHeaders);

  // Only a JSON body gets Content-Type. On a GET it would force a CORS
  // preflight for nothing, and FormData needs the browser's own multipart
  // Content-Type (the one carrying the boundary).
  const sendsJson = rest.body != null && !(rest.body instanceof FormData);
  if (sendsJson && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers,
    signal: AbortSignal.timeout(timeoutMs ?? REQUEST_TIMEOUT_MS),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => 'Unknown error');
    throw new ApiError(res.status, body);
  }

  // 204 No Content, or anything that isn't JSON: nothing to parse.
  if (!res.headers.get('content-type')?.includes('application/json')) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

export interface HealthResponse {
  status: string;
}

export const api = {
  health: () => request<HealthResponse>('/health'),
  verifyUsername: (username: string) => request<{ available: boolean }>(`/verify_username?username=${encodeURIComponent(username)}`),
};

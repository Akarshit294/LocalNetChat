// The HTTP side of the app. Under ?fake there is no server to ask, so `health`
// and `/users/check` are answered by the one in ../realtime/mockServer.
import { net } from '../realtime/mockServer.ts';
import { FAKE } from './mode.ts';

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

// a real request takes a moment, and the name box shows "checking..." while it
// does. Without this the fake answer lands before you have finished blinking.
function pause(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const api = {
  health: async (): Promise<HealthResponse> => {
    if (!FAKE) {
      return request<HealthResponse>('/health');
    }
    await pause(180);
    return { status: 'ok (faked in this tab)' };
  },

  verifyUsername: async (username: string): Promise<{ available: boolean }> => {
    if (!FAKE) {
      return request<{ available: boolean }>(
        `/users/check?username=${encodeURIComponent(username)}`,
      );
    }
    await pause(240);
    // like the real endpoint, this doesn't know who's asking, so it reports
    // your own name as taken
    return { available: net.isNameFree(username) };
  },
};

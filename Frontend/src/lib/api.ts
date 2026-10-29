// The HTTP side of the app. Under ?fake there is no server to ask, so `health`,
// `/users/check` and `/files` are answered by the one in ../realtime/mockServer.
import { net } from '../realtime/mockServer.ts';
import { FAKE } from './mode.ts';

// The backend is reached through the server that served this page: `/api/...`
// and `/ws` on our own origin, which Vite passes on to uvicorn (vite.config.ts).
// The page is https so that calls can have the camera, and an https page is not
// allowed to call an http:// or ws:// address.
//
// Our own origin is wherever the page was opened from, so the same code works
// on the laptop (localhost) and on a phone on the same Wi-Fi (the laptop's IP).
const API_BASE = '/api';
const REQUEST_TIMEOUT_MS = 10_000;
// 50 MB over a busy Wi-Fi can take a minute, so a file gets far longer than a question
const FILE_TIMEOUT_MS = 5 * 60_000;

// the page's own address with the scheme swapped: https -> wss, http -> ws
export const WS_URL = `${window.location.origin.replace(/^http/, 'ws')}/ws`;

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

// One request with a time limit. Anything but a 2xx is thrown as an ApiError,
// so a caller only ever sees a response that worked.
async function send(
  path: string,
  options: RequestInit & { timeoutMs?: number } = {},
): Promise<Response> {
  const { timeoutMs, headers: incomingHeaders, ...rest } = options;
  const headers = new Headers(incomingHeaders);

  // Only a JSON body, which is a string, gets Content-Type: application/json.
  // On a GET it would force a CORS preflight for nothing. FormData needs the
  // browser's own multipart Content-Type (the one carrying the boundary). And a
  // File is labelled by the browser with its own type, so a photo goes up as
  // image/jpeg rather than being called JSON.
  const sendsJson = typeof rest.body === 'string';
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
  return res;
}

async function request<T>(
  path: string,
  options: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
  const res = await send(path, options);

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

  // POST /files. The body is the file itself, not a form, so the server gets
  // exactly its bytes. It answers with the new file's id; the "file" note that
  // puts it in the conversation comes over the socket, to us as to everyone.
  shareFile: async (token: string, chatId: string, file: File): Promise<{ file_id: string }> => {
    if (!FAKE) {
      const query = new URLSearchParams({ chat_id: chatId, name: file.name });
      return request<{ file_id: string }>(`/files?${query}`, {
        method: 'POST',
        body: file,
        // an HTTP request has no socket to say who sent it, so the token does
        headers: { Authorization: `Bearer ${token}` },
        timeoutMs: FILE_TIMEOUT_MS,
      });
    }
    await pause(400);
    const answer = net.shareFile(chatId, file);
    if ('refused' in answer) {
      throw new ApiError(answer.status, JSON.stringify({ detail: answer.refused }));
    }
    return answer;
  },

  // GET /files/{id}: the raw bytes, held in this tab's memory as a Blob
  fetchFile: async (token: string, fileId: string): Promise<Blob> => {
    if (!FAKE) {
      const res = await send(`/files/${encodeURIComponent(fileId)}`, {
        headers: { Authorization: `Bearer ${token}` },
        timeoutMs: FILE_TIMEOUT_MS,
      });
      return res.blob();
    }
    await pause(300);
    const blob = net.fileBlob(fileId);
    if (!blob) {
      throw new ApiError(404, JSON.stringify({ detail: 'No such file' }));
    }
    return blob;
  },
};

// What to tell a person about a request that failed, in words.
export function reasonOf(error: unknown): string {
  if (error instanceof ApiError) {
    return error.detail ?? `The server answered ${error.status}`;
  }
  if (error instanceof DOMException && error.name === 'TimeoutError') {
    return 'That took too long, so it was given up';
  }
  return "Couldn't reach the server";
}

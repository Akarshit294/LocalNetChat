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

  // POST /sessions: "log in" with a name. The answer sets an HttpOnly session
  // cookie, which this page can't read and never needs to: the browser sends it
  // by itself, with the socket and every request after. The fake server checks
  // the name when it's joined instead, so there's nothing to do here for it.
  createSession: async (name: string): Promise<void> => {
    if (!FAKE) {
      await request('/sessions', { method: 'POST', body: JSON.stringify({ user_name: name }) });
    }
  },

  // POST /files. The body is the file itself, not a form, so the server gets
  // exactly its bytes. It answers with the new file's id; the "file" note that
  // puts it in the conversation comes over the socket, to us as to everyone.
  //
  // XMLHttpRequest rather than fetch, because only it reports how much of an
  // upload has gone: `onProgress` gets 0 to 1 as it goes.
  shareFile: (chatId: string, file: File, onProgress?: (fraction: number) => void): Promise<{ file_id: string }> => {
    if (FAKE) {
      return fakeShare(chatId, file, onProgress);
    }
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const query = new URLSearchParams({ chat_id: chatId, name: file.name });
      xhr.open('POST', `${API_BASE}/files?${query}`);
      // no time limit: 20 GB over Wi-Fi takes many minutes; a dropped connection still ends it
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          onProgress?.(event.loaded / event.total);
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText) as { file_id: string });
        } else {
          reject(new ApiError(xhr.status, xhr.responseText));
        }
      };
      // the same errors fetch would give, so reasonOf reads them the same way
      xhr.onerror = () => reject(new TypeError('network error'));
      xhr.ontimeout = () => reject(new DOMException('timed out', 'TimeoutError'));
      // the cookie goes along by itself; the browser labels the body with the file's type
      xhr.send(file);
    });
  },

  // Where a file can be fetched from: a <video>, an <img> or a download link
  // asks for it there itself, with the cookie, and in pieces if it wants.
  fileUrl: (fileId: string): string => `${API_BASE}/files/${encodeURIComponent(fileId)}`,
};

// The fake server's upload: the same refusals, and a little progress to watch.
async function fakeShare(chatId: string, file: File, onProgress?: (fraction: number) => void) {
  for (const fraction of [0.25, 0.5, 0.75, 1]) {
    await pause(100);
    onProgress?.(fraction);
  }
  const answer = net.shareFile(chatId, file);
  if ('refused' in answer) {
    throw new ApiError(answer.status, JSON.stringify({ detail: answer.refused }));
  }
  return answer;
}

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

import Constants from 'expo-constants';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { getSecret, setSecret } from './storage';
import type { Session } from './types';

/**
 * Where the API lives. Set EXPO_PUBLIC_API_URL at build time. Without it the
 * default is the local dev loop on :8097 — on a phone that means the machine
 * running Metro, whose address Expo reports as hostUri during development,
 * because "localhost" on the phone is the phone itself.
 */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? defaultDevUrl()).replace(/\/$/, '');

function defaultDevUrl(): string {
  const host = Platform.OS === 'web' ? null : Constants.expoConfig?.hostUri?.split(':')[0];
  return `http://${host || 'localhost'}:8097`;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

type Tokens = { access: string; refresh: string };
let tokens: Tokens | null = null;
let refreshing: Promise<boolean> | null = null;
const listeners = new Set<() => void>();

export function onSignedOut(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function loadTokens(): Promise<boolean> {
  const access = await getSecret('snapclaim.access');
  const refresh = await getSecret('snapclaim.refresh');
  tokens = access && refresh ? { access, refresh } : null;
  return tokens !== null;
}

export async function storeSession(session: Session) {
  tokens = { access: session.access_token, refresh: session.refresh_token };
  await setSecret('snapclaim.access', tokens.access);
  await setSecret('snapclaim.refresh', tokens.refresh);
}

export async function clearSession() {
  const refresh = tokens?.refresh;
  tokens = null;
  await setSecret('snapclaim.access', null);
  await setSecret('snapclaim.refresh', null);
  if (refresh) {
    fetch(`${API_URL}/api/v1/auth/logout`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh }),
    }).catch(() => undefined);
  }
}

export function accessToken() {
  return tokens?.access ?? null;
}

async function refreshTokens(): Promise<boolean> {
  if (!tokens) return false;
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refresh_token: tokens!.refresh }),
      });
      if (!res.ok) return false;
      const session = (await res.json()) as Session;
      await storeSession(session);
      return true;
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

type Options = { method?: string; body?: unknown; form?: FormData; raw?: boolean; auth?: boolean };

/** True when the access token has expired or is within half a minute of it, read from its own payload. */
function expiresSoon(token: string): boolean {
  try {
    const payload = token.split('.')[1] ?? '';
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const exp = (JSON.parse(json) as { exp?: number }).exp;
    return typeof exp === 'number' && exp * 1000 < Date.now() + 30_000;
  } catch {
    return false;
  }
}

export async function api<T>(path: string, options: Options = {}): Promise<T> {
  // Trade an expired token for a fresh one up front, rather than letting the request fail first.
  if (options.auth !== false && tokens && expiresSoon(tokens.access)) await refreshTokens();
  const attempt = async (): Promise<Response> => {
    const headers: Record<string, string> = {};
    if (options.auth !== false && tokens) headers.authorization = `Bearer ${tokens.access}`;
    if (options.body !== undefined) headers['content-type'] = 'application/json';
    return fetch(`${API_URL}${path}`, {
      method: options.method ?? (options.body !== undefined || options.form ? 'POST' : 'GET'),
      headers,
      body: options.form ?? (options.body === undefined ? undefined : JSON.stringify(options.body)),
    });
  };

  let res: Response;
  try {
    res = await attempt();
    if (res.status === 401 && options.auth !== false && tokens) {
      if (await refreshTokens()) res = await attempt();
      else {
        await clearSession();
        listeners.forEach((l) => l());
      }
    }
  } catch (err) {
    throw new ApiError(0, 'network', `Could not reach the server at ${API_URL}`, err);
  }

  if (res.status === 204) return undefined as T;
  if (options.raw) {
    if (!res.ok) throw new ApiError(res.status, 'http', `Request failed (${res.status})`);
    return (await res.arrayBuffer()) as T;
  }
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const error = (data as { error?: { code?: string; message?: string; details?: unknown } } | null)?.error;
    throw new ApiError(res.status, error?.code ?? 'http', error?.message ?? `Request failed (${res.status})`, error?.details);
  }
  return data as T;
}

/** Download a file the API serves: the browser saves it; phones open the share sheet. */
export async function downloadFile(path: string, fileName: string): Promise<void> {
  if (Platform.OS === 'web') {
    const bytes = await api<ArrayBuffer>(path, { raw: true });
    const url = URL.createObjectURL(new Blob([bytes]));
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return;
  }
  const dir = new Directory(Paths.cache, 'exports');
  if (!dir.exists) dir.create();
  const target = new File(dir, fileName);
  if (target.exists) target.delete();
  const sep = path.includes('?') ? '&' : '?';
  const file = await File.downloadFileAsync(`${API_URL}${path}${sep}access_token=${encodeURIComponent(accessToken() ?? '')}`, target);
  await Sharing.shareAsync(file.uri, { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', dialogTitle: fileName });
}

/** URL for an <Image>; the token rides in the query because images cannot send headers. */
export function receiptImageUrl(receiptId: string) {
  return `${API_URL}/api/v1/receipts/${receiptId}/image?access_token=${encodeURIComponent(accessToken() ?? '')}`;
}

export function describeError(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Something went wrong';
}

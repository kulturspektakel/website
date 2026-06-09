/**
 * Migrated from `~/api.kulturspektakel.de/src/utils/nuclino.ts`.
 * Minimal Nuclino API client used for link unfurling and the #wiki update cron.
 */
export type APIObject = {
  id: string;
  workspaceId: string;
  url: string;
  title: string;
  createdAt: string;
  createdUserId: string;
  lastUpdatedAt: string;
  lastUpdatedUserId: string;
} & (
  | {object: 'item'; contentMeta: {itemIds: string[]; fileIds: string[]}}
  | {object: 'cluster'; childIds: string[]}
);

export type APIObjectWithContent = APIObject & {content: string};

export type NuclinoUser = {
  object: 'user';
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl: string | undefined;
};

type APIResponse<T> =
  | {status: 'success'; data: T}
  | {status: 'fail' | 'error'; message: string};

/**
 * Thrown when the Nuclino API responds with a non-2xx status. Carries the HTTP
 * status so callers can decide how to react (e.g. the #wiki cron tolerates a
 * temporarily-unavailable API — 429/5xx — and skips that run).
 */
export class NuclinoApiError extends Error {
  constructor(readonly status: number, statusText: string) {
    super(`Nuclino API ${status} ${statusText}`);
    this.name = 'NuclinoApiError';
  }

  /** Transient: rate-limited or upstream server error, retried on the next run. */
  get isUnavailable(): boolean {
    return this.status === 429 || this.status >= 500;
  }
}

async function nuclinoAPIRequest<T>(url: string): Promise<T> {
  const apiKey = process.env.NUCLINO_API_KEY;
  if (!apiKey) {
    throw new Error('NUCLINO_API_KEY is not set');
  }
  const res = await fetch(url, {headers: {Authorization: apiKey}});
  if (!res.ok) {
    throw new NuclinoApiError(res.status, res.statusText);
  }
  const data: APIResponse<T> = await res.json();
  if (data.status !== 'success') {
    throw new Error(data.message);
  }
  return data.data;
}

export async function items(params: {
  search?: string;
  limit?: number;
  after?: string;
}): Promise<Array<APIObject>> {
  const query = new URLSearchParams({workspaceId: process.env.NUCLINO_WORKSPACE_ID ?? ''});
  for (const [k, v] of Object.entries(params)) {
    if (v) query.set(k, String(v));
  }
  const r = await nuclinoAPIRequest<{results: Array<APIObject>}>(
    `https://api.nuclino.com/v0/items/?${query.toString()}`,
  );
  return r.results;
}

export function item(id: string): Promise<APIObjectWithContent> {
  return nuclinoAPIRequest<APIObjectWithContent>(
    `https://api.nuclino.com/v0/items/${id}`,
  );
}

export function user(id: string): Promise<NuclinoUser> {
  return nuclinoAPIRequest<NuclinoUser>(
    `https://api.nuclino.com/v0/users/${id}`,
  );
}

export async function allItems(): Promise<Array<APIObject>> {
  const results: Array<APIObject> = [];
  let after: string | undefined = undefined;
  while (true) {
    const page = await items({after, limit: 100});
    results.push(...page);
    if (page.length !== 100) {
      break;
    }
    after = results[results.length - 1].id;
  }
  return results;
}

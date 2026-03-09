const BASE_URL = "https://api.prod.getdex.com";

let apiKey: string | undefined;

export function getApiKey(): string {
  if (!apiKey) {
    apiKey = process.env.DEX_API_KEY;
  }
  if (!apiKey) {
    throw new Error(
      "DEX_API_KEY environment variable is not set. " +
        "Get your API key from Dex → Settings → API."
    );
  }
  return apiKey;
}

function headers(hasBody: boolean): Record<string, string> {
  const h: Record<string, string> = {
    Authorization: `Bearer ${getApiKey()}`,
  };
  if (hasBody) {
    h["Content-Type"] = "application/json";
  }
  return h;
}

export class DexApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public body: string
  ) {
    super(`Dex API error ${status} ${statusText}: ${body}`);
    this.name = "DexApiError";
  }
}

export type QueryValue =
  | string
  | number
  | boolean
  | undefined
  | QueryValue[]
  | { [key: string]: QueryValue };

function flattenQuery(
  prefix: string,
  value: QueryValue,
  out: [string, string][]
): void {
  if (value === undefined || value === null) return;

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      flattenQuery(`${prefix}[${i}]`, value[i], out);
    }
  } else if (typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      flattenQuery(`${prefix}[${k}]`, v, out);
    }
  } else {
    out.push([prefix, String(value)]);
  }
}

function applyQuery(
  url: URL,
  query: Record<string, QueryValue>
): void {
  const pairs: [string, string][] = [];
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;

    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        flattenQuery(`${key}[${i}]`, value[i], pairs);
      }
    } else if (typeof value === "object") {
      for (const [nestedKey, nestedValue] of Object.entries(value)) {
        flattenQuery(`${key}[${nestedKey}]`, nestedValue, pairs);
      }
    } else {
      pairs.push([key, String(value)]);
    }
  }
  for (const [k, v] of pairs) {
    url.searchParams.set(k, v);
  }
}

async function request<T = unknown>(
  method: string,
  path: string,
  options?: {
    query?: Record<string, QueryValue>;
    body?: unknown;
  }
): Promise<T> {
  const url = new URL(path, BASE_URL);

  if (options?.query) {
    applyQuery(url, options.query);
  }

  const hasBody = options?.body !== undefined;
  const res = await fetch(url.toString(), {
    method,
    headers: headers(hasBody),
    body: hasBody ? JSON.stringify(options.body) : undefined,
  });

  const text = await res.text();

  if (!res.ok) {
    throw new DexApiError(res.status, res.statusText, text);
  }

  if (!text) return undefined as T;

  try {
    return JSON.parse(text) as T;
  } catch {
    return text as T;
  }
}

export const dex = {
  get<T = unknown>(path: string, query?: Record<string, QueryValue>) {
    return request<T>("GET", path, { query });
  },

  post<T = unknown>(path: string, body?: unknown, query?: Record<string, QueryValue>) {
    return request<T>("POST", path, { body, query });
  },

  put<T = unknown>(path: string, body?: unknown, query?: Record<string, QueryValue>) {
    return request<T>("PUT", path, { body, query });
  },

  delete<T = unknown>(path: string, query?: Record<string, QueryValue>) {
    return request<T>("DELETE", path, { query });
  },
};

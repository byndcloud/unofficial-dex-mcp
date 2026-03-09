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
  | Record<string, string | number | boolean | undefined>;

function applyQuery(
  url: URL,
  query: Record<string, QueryValue>
): void {
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;

    if (typeof value === "object") {
      for (const [nestedKey, nestedValue] of Object.entries(value)) {
        if (nestedValue !== undefined && nestedValue !== null) {
          url.searchParams.set(`${key}[${nestedKey}]`, String(nestedValue));
        }
      }
    } else {
      url.searchParams.set(key, String(value));
    }
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

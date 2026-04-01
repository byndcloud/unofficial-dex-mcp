import { AsyncLocalStorage } from "node:async_hooks";

interface RequestContext {
  dexApiKey: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

export function getDexApiKey(): string {
  const ctx = requestContext.getStore();
  if (ctx?.dexApiKey) return ctx.dexApiKey;

  // Fallback to env var (stdio mode)
  const envKey = process.env.DEX_API_KEY;
  if (envKey) return envKey;

  throw new Error(
    "No Dex API key available. Provide DEX_API_KEY or authenticate via OAuth."
  );
}

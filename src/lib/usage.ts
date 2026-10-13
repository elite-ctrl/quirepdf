import { createServerFn } from "@tanstack/react-start";

export type UsageRow = {
  browser: string;
  label: string;
  agent: string;
  visits: number;
  firstSeen: string;
  lastSeen: string;
};

export type UsageReport =
  | { ok: false }
  | { ok: true; browsers: number; visits: number; rows: UsageRow[] };

export const noteUnlock = createServerFn({ method: "POST" })
  .validator((input: unknown): { code: string; browser: string; agent: string } => {
    if (!input || typeof input !== "object") throw new Error("Missing unlock note.");
    const data = input as Record<string, unknown>;
    return {
      code: typeof data.code === "string" ? data.code.slice(0, 80) : "",
      browser: typeof data.browser === "string" ? data.browser.slice(0, 64) : "",
      agent: typeof data.agent === "string" ? data.agent.slice(0, 40) : "",
    };
  })
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const { recordUnlock } = await import("@/lib/usage.server");
    return recordUnlock(data);
  });

export const loadUsage = createServerFn({ method: "POST" })
  .validator((input: unknown): { owner: string } => {
    if (!input || typeof input !== "object") throw new Error("Missing owner code.");
    const owner = (input as { owner?: unknown }).owner;
    return { owner: typeof owner === "string" ? owner.slice(0, 80) : "" };
  })
  .handler(async ({ data }): Promise<UsageReport> => {
    const { reportUsage } = await import("@/lib/usage.server");
    return reportUsage(data.owner);
  });

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

export function noteUnlock(_input: { data: { code: string; browser: string; agent: string } }) {
  return Promise.resolve({ ok: true });
}

export function loadUsage(_input: { data: { owner: string } }): Promise<UsageReport> {
  return Promise.resolve({ ok: false });
}

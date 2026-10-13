import { createHash, timingSafeEqual } from "node:crypto";
import { getSql } from "@/lib/db";
import { normalizePasscode } from "@/lib/passcode";

const CODES = [{ label: "shared", pass: "keel6284brass" }];
const OWNER = "folio8841ink";
const BROWSER = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const AGENT = /^(Chrome|Edge|Safari|Firefox|Browser) · (Windows|Mac|iPhone|Android|Linux|Other)$/;

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

function same(left: string, right: string): boolean {
  const a = createHash("sha256").update(left).digest();
  const b = createHash("sha256").update(right).digest();
  return timingSafeEqual(a, b);
}

function cleanAgent(agent: string): string {
  return AGENT.test(agent) ? agent : "Browser · Other";
}

export async function recordUnlock(input: { code: string; browser: string; agent: string }): Promise<{ ok: boolean }> {
  const browser = input.browser.trim().toLowerCase();
  if (!BROWSER.test(browser)) return { ok: false };
  const agent = cleanAgent(input.agent);
  const code = normalizePasscode(input.code);
  const match = CODES.find((item) => code.length > 0 && same(code, item.pass));
  const sql = await getSql();

  if (!match) {
    if (code.length > 0) return { ok: false };
    const updated = await sql<{ id: number }>`
      update unlocks
      set seen_at = now(), agent = ${agent}
      where id = (
        select id from unlocks
        where browser = ${browser}
        order by seen_at desc
        limit 1
      )
      returning id
    `;
    return { ok: updated.length > 0 };
  }

  const recent = await sql<{ id: number }>`
    update unlocks
    set seen_at = now(), agent = ${agent}
    where id = (
      select id from unlocks
      where browser = ${browser}
        and label = ${match.label}
        and seen_at > now() - interval '6 hours'
      order by seen_at desc
      limit 1
    )
    returning id
  `;
  if (recent.length > 0) return { ok: true };

  const known = await sql<{ n: number }>`
    select count(*)::int as n from unlocks where browser = ${browser} and label = ${match.label}
  `;
  const total = await sql<{ n: number }>`select count(*)::int as n from unlocks`;
  if ((known[0]?.n ?? 0) === 0 && (total[0]?.n ?? 0) >= 500) return { ok: true };
  await sql`insert into unlocks (browser, label, agent) values (${browser}, ${match.label}, ${agent})`;
  return { ok: true };
}

export async function reportUsage(owner: string): Promise<UsageReport> {
  if (!same(normalizePasscode(owner), OWNER)) return { ok: false };
  const sql = await getSql();
  const [summary] = await sql<{ browsers: number; visits: number }>`
    select count(distinct browser)::int as browsers, count(*)::int as visits from unlocks
  `;
  const rows = await sql<{
    browser: string;
    label: string;
    agent: string;
    visits: number;
    first_seen: string;
    last_seen: string;
  }>`
    select browser, label, agent, visits,
      to_char(first_seen at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as first_seen,
      to_char(last_seen at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as last_seen
    from (
      select
        browser,
        label,
        agent,
        count(*) over (partition by browser, label)::int as visits,
        min(seen_at) over (partition by browser, label) as first_seen,
        max(seen_at) over (partition by browser, label) as last_seen,
        row_number() over (partition by browser, label order by seen_at desc) as n
      from unlocks
    ) listed
    where n = 1
    order by last_seen desc
    limit 100
  `;
  return {
    ok: true,
    browsers: summary?.browsers ?? 0,
    visits: summary?.visits ?? 0,
    rows: rows.map((row) => ({
      browser: row.browser,
      label: row.label,
      agent: row.agent,
      visits: Number(row.visits) || 0,
      firstSeen: row.first_seen,
      lastSeen: row.last_seen,
    })),
  };
}

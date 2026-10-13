import { t as __esmMin } from "./rolldown-runtime-DkIiUugF.mjs";
import { n as normalizePasscode, t as init_passcode } from "./passcode-CCf-E2Pc.mjs";
import { createHash, timingSafeEqual } from "node:crypto";
//#region node_modules/.nitro/vite/services/ssr/assets/usage.server-D-p5m8bL.js
var _0002_unlocks_default;
var init__0002_unlocks = __esmMin((() => {
	_0002_unlocks_default = "create table if not exists unlocks (\n  id serial primary key,\n  browser text not null,\n  label text not null,\n  agent text not null,\n  seen_at timestamptz not null default now()\n);\n\ncreate index if not exists unlocks_browser_idx on unlocks (browser, seen_at desc);\n";
}));
/**
* Migration bookkeeping shared by the two appliers — `scripts/migrate.mjs`
* (deploy, `readdir`) and `src/lib/db.ts` (PGLite preview, `import.meta.glob`).
*
* Applied files are keyed by BASENAME, so the same file applies once no matter
* which directory it is globbed from. That is what makes the auth schema safe to
* copy from `migrations/auth/` into `migrations/` when an app turns sign-in on:
* a database that already has `0001_auth.sql` will not re-run it.
*
* Neither applier descends into subdirectories, so `migrations/auth/*.sql` is
* out of scope for both until it is copied up.
*/
/**
* The `_migrations` key for a migration path (or bare filename).
* @param {string} path
* @returns {string}
*/
function migrationName(path) {
	return path.split("/").pop() ?? path;
}
/**
* @param {string} path
* @returns {boolean}
*/
function isMigrationFile(path) {
	return path.endsWith(".sql");
}
/**
* Migrations in `paths` that are not yet in `applied`, in apply order.
* Non-`.sql` entries (a `readdir` also yields `migrations/auth/`) are dropped.
* @param {Iterable<string>} paths
* @param {Iterable<string>} applied
* @returns {Array<{ name: string, path: string }>}
*/
function pendingMigrations(paths, applied) {
	const done = new Set(applied);
	return [...paths].filter(isMigrationFile).map((path) => ({
		name: migrationName(path),
		path
	})).sort((a, b) => a.name.localeCompare(b.name)).filter(({ name }) => !done.has(name));
}
var init_migration_plan = __esmMin((() => {}));
/** Wrap a query runner in the tagged-template + `.query()` `Sql` surface. */
function toSql(run) {
	const sql = (async (strings, ...values) => {
		let text = strings[0];
		for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1]}`;
		return run(text, values);
	});
	sql.query = (text, params = []) => run(text, params);
	return sql;
}
function createNeonSql() {
	globalRef.__pgSqlPromise__ ??= (async () => {
		const { Pool, types } = await import("../_libs/pg.mjs").then((n) => n.t);
		types.setTypeParser(OID_INT8, Number);
		types.setTypeParser(OID_DATE, identity);
		types.setTypeParser(OID_INTERVAL, identity);
		const pool = new Pool({ connectionString: databaseUrl });
		return toSql(async (text, params) => {
			return (await pool.query(text, params)).rows;
		});
	})().catch((err) => {
		globalRef.__pgSqlPromise__ = void 0;
		throw err;
	});
	return globalRef.__pgSqlPromise__;
}
async function createPgliteSql() {
	globalRef.__pgliteInstance__ ??= (async () => {
		const { PGlite } = await import("../_libs/electric-sql__pglite.mjs").then((n) => n.t);
		const pg = new PGlite({ parsers: {
			[OID_INT8]: Number,
			[OID_DATE]: identity,
			[OID_INTERVAL]: identity
		} });
		await pg.waitReady;
		await pg.exec("create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())");
		return pg;
	})().catch((err) => {
		globalRef.__pgliteInstance__ = void 0;
		throw err;
	});
	const pg = await globalRef.__pgliteInstance__;
	const migrate = async () => {
		const migrations = /* #__PURE__ */ Object.assign({ "/migrations/0002_unlocks.sql": _0002_unlocks_default });
		const done = (await pg.query("select name from _migrations")).rows.map((r) => r.name);
		for (const { name, path } of pendingMigrations(Object.keys(migrations), done)) await pg.transaction(async (tx) => {
			await tx.exec(migrations[path]);
			await tx.query("insert into _migrations (name) values ($1)", [name]);
		});
	};
	const pass = (globalRef.__pgliteMigrateChain__ ?? Promise.resolve()).catch(() => void 0).then(migrate);
	globalRef.__pgliteMigrateChain__ = pass;
	await pass;
	return toSql(async (text, params) => {
		return (await pg.query(text, params)).rows;
	});
}
async function createSql() {
	if (typeof window !== "undefined") throw new Error("@/lib/db is server-only — call getSql() from a createServerFn handler or a server route loader, never from client code.");
	return dbSource === "neon" ? createNeonSql() : createPgliteSql();
}
/**
* Get the shared, **server-only** SQL client. Neon when `DATABASE_URL` is set,
* otherwise the local PGLite fallback. Memoized — safe to call per request.
*
* Schema comes from `migrations/*.sql`, auto-applied before the first query on
* both backends — define tables there, never inline in server functions.
*/
function getSql() {
	sqlPromise ??= createSql().catch((err) => {
		sqlPromise = null;
		throw err;
	});
	return sqlPromise;
}
/**
* Finish DB bootstrap before the server handles traffic.
*
* - **PGLite** (preview / no `DATABASE_URL`): open the in-memory DB and apply
*   `migrations/*.sql`. Idempotent — concurrent callers share one promise.
* - **Neon**: no-op (pool is created lazily on first query).
*
* Vite `configureServer` awaits this at dev startup; production imports of this
* module kick it off immediately (see bottom of file).
*/
function ensureDbReady() {
	if (dbSource !== "pglite") return Promise.resolve();
	return getSql().then(() => void 0);
}
var rawDatabaseUrl;
var databaseUrl;
var dbSource;
var globalRef;
var OID_INT8;
var OID_DATE;
var OID_INTERVAL;
var identity;
var sqlPromise;
var globalBoot;
var init_db = __esmMin((() => {
	init__0002_unlocks();
	init_migration_plan();
	rawDatabaseUrl = typeof process !== "undefined" ? process.env.DATABASE_URL : void 0;
	databaseUrl = rawDatabaseUrl && rawDatabaseUrl.trim() ? rawDatabaseUrl : void 0;
	dbSource = databaseUrl ? "neon" : "pglite";
	globalRef = globalThis;
	OID_INT8 = 20;
	OID_DATE = 1082;
	OID_INTERVAL = 1186;
	identity = (v) => v;
	sqlPromise = null;
	globalBoot = globalThis;
	if (typeof window === "undefined" && dbSource === "pglite") globalBoot.__pgBootstrapPromise__ ??= ensureDbReady().catch((err) => {
		globalBoot.__pgBootstrapPromise__ = void 0;
		console.error("[db] PGLite bootstrap failed:", err);
		throw err;
	});
}));
function same(left, right) {
	const a = createHash("sha256").update(left).digest();
	const b = createHash("sha256").update(right).digest();
	return timingSafeEqual(a, b);
}
function cleanAgent(agent) {
	return AGENT.test(agent) ? agent : "Browser · Other";
}
async function recordUnlock(input) {
	const browser = input.browser.trim().toLowerCase();
	if (!BROWSER.test(browser)) return { ok: false };
	const agent = cleanAgent(input.agent);
	const code = normalizePasscode(input.code);
	const match = CODES.find((item) => code.length > 0 && same(code, item.pass));
	const sql = await getSql();
	if (!match) {
		if (code.length > 0) return { ok: false };
		return { ok: (await sql`
      update unlocks
      set seen_at = now(), agent = ${agent}
      where id = (
        select id from unlocks
        where browser = ${browser}
        order by seen_at desc
        limit 1
      )
      returning id
    `).length > 0 };
	}
	if ((await sql`
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
  `).length > 0) return { ok: true };
	const known = await sql`
    select count(*)::int as n from unlocks where browser = ${browser} and label = ${match.label}
  `;
	const total = await sql`select count(*)::int as n from unlocks`;
	if ((known[0]?.n ?? 0) === 0 && (total[0]?.n ?? 0) >= 500) return { ok: true };
	await sql`insert into unlocks (browser, label, agent) values (${browser}, ${match.label}, ${agent})`;
	return { ok: true };
}
async function reportUsage(owner) {
	if (!same(normalizePasscode(owner), OWNER)) return { ok: false };
	const sql = await getSql();
	const [summary] = await sql`
    select count(distinct browser)::int as browsers, count(*)::int as visits from unlocks
  `;
	const rows = await sql`
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
			lastSeen: row.last_seen
		}))
	};
}
var CODES;
var OWNER;
var BROWSER;
var AGENT;
__esmMin((() => {
	init_db();
	init_passcode();
	CODES = [{
		label: "shared",
		pass: "keel6284brass"
	}];
	OWNER = "folio8841ink";
	BROWSER = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
	AGENT = /^(Chrome|Edge|Safari|Firefox|Browser) · (Windows|Mac|iPhone|Android|Linux|Other)$/;
}))();
//#endregion
export { recordUnlock, reportUsage };

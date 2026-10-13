import { t as __esmMin } from "./rolldown-runtime-DkIiUugF.mjs";
import { a as TSS_SERVER_FUNCTION, n as init_esm$2, r as createServerFn } from "./ssr.mjs";
import { t as init_esm } from "./esm-DX00ZYfL.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/usage-k-rTeJXd.js
var createServerRpc;
var init_createServerRpc = __esmMin((() => {
	init_esm$2();
	createServerRpc = (serverFnMeta, splitImportFn) => {
		const url = "/_serverFn/" + serverFnMeta.id;
		return Object.assign(splitImportFn, {
			url,
			serverFnMeta,
			[TSS_SERVER_FUNCTION]: true
		});
	};
}));
var init_server_rpc = __esmMin((() => {
	init_createServerRpc();
}));
var noteUnlock_createServerFn_handler;
var noteUnlock;
var loadUsage_createServerFn_handler;
var loadUsage;
__esmMin((() => {
	init_server_rpc();
	init_esm();
	noteUnlock_createServerFn_handler = createServerRpc({
		id: "336e109a772a1a734805de279b3f56df868f0b93a7aa4f30a984c44f21461a80",
		name: "noteUnlock",
		filename: "src/lib/usage.ts"
	}, (opts) => noteUnlock.__executeServer(opts));
	noteUnlock = createServerFn({ method: "POST" }).validator((input) => {
		if (!input || typeof input !== "object") throw new Error("Missing unlock note.");
		const data = input;
		return {
			code: typeof data.code === "string" ? data.code.slice(0, 80) : "",
			browser: typeof data.browser === "string" ? data.browser.slice(0, 64) : "",
			agent: typeof data.agent === "string" ? data.agent.slice(0, 40) : ""
		};
	}).handler(noteUnlock_createServerFn_handler, async ({ data }) => {
		const { recordUnlock } = await import("./usage.server-D-p5m8bL.mjs");
		return recordUnlock(data);
	});
	loadUsage_createServerFn_handler = createServerRpc({
		id: "9f8ea6b9b7c6c5268e4b8e4f3ee2c6cb8076e86cc6778203f688801636a7303e",
		name: "loadUsage",
		filename: "src/lib/usage.ts"
	}, (opts) => loadUsage.__executeServer(opts));
	loadUsage = createServerFn({ method: "POST" }).validator((input) => {
		if (!input || typeof input !== "object") throw new Error("Missing owner code.");
		const owner = input.owner;
		return { owner: typeof owner === "string" ? owner.slice(0, 80) : "" };
	}).handler(loadUsage_createServerFn_handler, async ({ data }) => {
		const { reportUsage } = await import("./usage.server-D-p5m8bL.mjs");
		return reportUsage(data.owner);
	});
}))();
//#endregion
export { loadUsage_createServerFn_handler, noteUnlock_createServerFn_handler };

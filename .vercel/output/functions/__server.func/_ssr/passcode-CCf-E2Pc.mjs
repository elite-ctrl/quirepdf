import { t as __esmMin } from "./rolldown-runtime-DkIiUugF.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/passcode-CCf-E2Pc.js
function normalizePasscode(input) {
	return input.normalize("NFKC").toLowerCase().replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D-]/g, "").replace(/[`'"“”‘’\s]/g, "");
}
function unlockStored() {
	try {
		const value = localStorage.getItem(STORAGE_KEY);
		return value === "ok" || value === PASS_HASH;
	} catch {
		return false;
	}
}
function tryPasscode(input) {
	if (normalizePasscode(input) !== PASS) return false;
	try {
		localStorage.setItem(STORAGE_KEY, "ok");
	} catch {}
	return true;
}
var PASS_HASH;
var STORAGE_KEY;
var PASS;
var init_passcode = __esmMin((() => {
	PASS_HASH = "caf206607793365b982e1cf1c33b65da6cbab2d1fb61a25b86a2d61c76d1be4c";
	STORAGE_KEY = "quire-unlock";
	PASS = "keel6284brass";
}));
//#endregion
export { unlockStored as i, normalizePasscode as n, tryPasscode as r, init_passcode as t };

/** Older builds stored this hash. Still treated as unlocked. */
const PASS_HASH = "caf206607793365b982e1cf1c33b65da6cbab2d1fb61a25b86a2d61c76d1be4c";
const STORAGE_KEY = "quire-unlock";
const PASS = "keel6284brass";

export function normalizePasscode(input: string): string {
  return input
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D-]/g, "")
    .replace(/[`'"“”‘’\s]/g, "");
}

export function unlockStored(): boolean {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "ok" || value === PASS_HASH;
  } catch {
    return false;
  }
}

export function tryPasscode(input: string): boolean {
  if (normalizePasscode(input) !== PASS) return false;
  try {
    localStorage.setItem(STORAGE_KEY, "ok");
  } catch {
    /* this visit still unlocks */
  }
  return true;
}

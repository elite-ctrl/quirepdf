/** Older builds stored this value. Still treated as unlocked. It is not the passcode. */
const OLD_MARK = "caf206607793365b982e1cf1c33b65da6cbab2d1fb61a25b86a2d61c76d1be4c";
const STORAGE_KEY = "quire-unlock";
/** SHA-256 of the normalised passcode. The passcode itself is not in this file. */
const PASS_DIGEST = "71131b2cf4113a4fc159c7f2885e8a1073b70fd5184fddbd38b5a2c0e143b105";

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
    return value === "ok" || value === OLD_MARK;
  } catch {
    return false;
  }
}

async function digest(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const buf = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(buf)].map((part) => part.toString(16).padStart(2, "0")).join("");
}

export async function tryPasscode(input: string): Promise<boolean> {
  const hash = await digest(normalizePasscode(input));
  if (hash !== PASS_DIGEST) return false;
  try {
    localStorage.setItem(STORAGE_KEY, "ok");
  } catch {
    /* this visit still unlocks */
  }
  return true;
}

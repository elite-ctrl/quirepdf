/** SHA-256 of the passcode that is shared after payment. Not the passcode itself. */
const PASS_HASH = "caf206607793365b982e1cf1c33b65da6cbab2d1fb61a25b86a2d61c76d1be4c";
const STORAGE_KEY = "quire-unlock";

export function unlockStored(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === PASS_HASH;
  } catch {
    return false;
  }
}

async function digest(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input.trim().toLowerCase());
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function tryPasscode(input: string): Promise<boolean> {
  if (!input.trim()) return false;
  const hash = await digest(input);
  if (hash !== PASS_HASH) return false;
  try {
    localStorage.setItem(STORAGE_KEY, PASS_HASH);
  } catch {
    /* this visit still unlocks */
  }
  return true;
}

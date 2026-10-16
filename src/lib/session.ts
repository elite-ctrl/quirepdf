import { sanitizeMark, type Mark } from "./marks.ts";

const DB_NAME = "quire-desk";
const STORE = "sessions";

export type Session = {
  name: string;
  marks: Mark[];
  importedSourceIds: string[];
  savedAt: number;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function fingerprint(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes.slice(0));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function loadSession(key: string): Promise<Session | null> {
  let db: IDBDatabase | undefined;
  try {
    const connection = await openDb();
    db = connection;
    const record = await new Promise<unknown>((resolve, reject) => {
      const tx = connection.transaction(STORE, "readonly");
      const request = tx.objectStore(STORE).get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      tx.onabort = () => reject(tx.error ?? new Error("Session read aborted."));
    });
    if (!record || typeof record !== "object") return null;
    const session = record as Partial<Session>;
    if (!Array.isArray(session.marks) || !Array.isArray(session.importedSourceIds)) return null;
    const marks = session.marks.map(sanitizeMark).filter((mark): mark is Mark => mark !== null);
    return {
      name: typeof session.name === "string" ? session.name : "document.pdf",
      marks,
      importedSourceIds: session.importedSourceIds.filter((id): id is string => typeof id === "string"),
      savedAt: typeof session.savedAt === "number" ? session.savedAt : Date.now(),
    };
  } catch {
    return null;
  } finally {
    db?.close();
  }
}

/** True means the transaction completed, not merely that the write was queued. */
export async function saveSession(key: string, session: Session): Promise<boolean> {
  let db: IDBDatabase | undefined;
  try {
    const connection = await openDb();
    db = connection;
    await new Promise<void>((resolve, reject) => {
      const tx = connection.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(session, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error("Session save aborted."));
    });
    return true;
  } catch {
    return false;
  } finally {
    db?.close();
  }
}

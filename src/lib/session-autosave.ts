export type AutosaveState = {
  key: string | null;
  status: "idle" | "pending" | "saving" | "saved" | "error";
};

type Snapshot<T> = { key: string; value: T; revision: number };

/** Debounce edits, but never discard the previous document's pending save. */
export function createSessionAutosaver<T>({
  persist,
  onChange,
  delay = 350,
}: {
  persist: (key: string, value: T) => Promise<boolean>;
  onChange: (state: AutosaveState) => void;
  delay?: number;
}) {
  let pending: Snapshot<T> | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let revision = 0;
  let savedRevision = 0;
  let chain = Promise.resolve(true);

  function clearTimer() {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  }

  function notify(snapshot: Snapshot<T>, status: AutosaveState["status"]) {
    // An old write must not claim that a newer edit/document has been saved.
    if (snapshot.revision === revision) onChange({ key: snapshot.key, status });
  }

  function flush(): Promise<boolean> {
    clearTimer();
    const snapshot = pending;
    if (!snapshot) return chain;
    pending = null;
    // Serialize writes so that an older snapshot cannot overwrite a newer one.
    chain = chain.then(async () => {
      notify(snapshot, "saving");
      let saved = false;
      try {
        saved = await persist(snapshot.key, snapshot.value);
      } catch {
        // A failed save must not prevent subsequent edits from being saved.
      }
      if (saved) savedRevision = snapshot.revision;
      notify(snapshot, saved ? "saved" : "error");
      return saved;
    });
    return chain;
  }

  function schedule(key: string, value: T) {
    if (pending && pending.key !== key) void flush();
    clearTimer();
    pending = { key, value, revision: ++revision };
    onChange({ key, status: "pending" });
    timer = setTimeout(() => void flush(), delay);
  }

  return {
    schedule,
    flush,
    isDirty: () => savedRevision !== revision,
  };
}

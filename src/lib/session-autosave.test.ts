import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createSessionAutosaver, type AutosaveState } from "./session-autosave.ts";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("session autosave", () => {
  it("debounces rapid edits and persists the latest snapshot", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const writes: string[] = [];
    const saver = createSessionAutosaver({
      persist: async (_key, value: string) => {
        writes.push(value);
        return true;
      },
      onChange: () => {},
    });
    saver.schedule("a", "first");
    t.mock.timers.tick(200);
    saver.schedule("a", "latest");
    t.mock.timers.tick(349);
    assert.deepEqual(writes, []);
    t.mock.timers.tick(1);
    await saver.flush();
    assert.deepEqual(writes, ["latest"]);
    assert.equal(saver.isDirty(), false);
  });

  it("flushes a pending document when the document changes", async () => {
    const writes: [string, string][] = [];
    const saver = createSessionAutosaver({
      persist: async (key, value: string) => {
        writes.push([key, value]);
        return true;
      },
      onChange: () => {},
    });
    saver.schedule("a", "unsaved annotation");
    saver.schedule("b", "other document");
    assert.equal(await saver.flush(), true);
    assert.deepEqual(writes, [
      ["a", "unsaved annotation"],
      ["b", "other document"],
    ]);
  });

  it("flushes immediately without waiting for the debounce timer", async () => {
    let count = 0;
    const saver = createSessionAutosaver({
      persist: async () => {
        count++;
        return true;
      },
      onChange: () => {},
    });
    saver.schedule("a", "edit");
    assert.equal(saver.isDirty(), true);
    assert.equal(await saver.flush(), true);
    await saver.flush();
    assert.equal(count, 1);
  });

  it("serializes writes and keeps newer edits dirty while an old write finishes", async () => {
    const first = deferred<boolean>();
    const second = deferred<boolean>();
    const writes: string[] = [];
    const states: AutosaveState[] = [];
    const saver = createSessionAutosaver({
      persist: async (_key, value: string) => {
        writes.push(value);
        return value === "old" ? first.promise : second.promise;
      },
      onChange: (state) => states.push(state),
    });
    saver.schedule("a", "old");
    const oldSave = saver.flush();
    await Promise.resolve();
    saver.schedule("a", "new");
    const newSave = saver.flush();
    assert.deepEqual(writes, ["old"]);
    first.resolve(true);
    await oldSave;
    assert.equal(saver.isDirty(), true);
    assert.notEqual(states.at(-1)?.status, "saved");
    second.resolve(true);
    await newSave;
    assert.deepEqual(writes, ["old", "new"]);
    assert.equal(states.at(-1)?.status, "saved");
    assert.equal(saver.isDirty(), false);
  });

  it("does not show an old document's success or failure on the new document", async () => {
    const old = deferred<boolean>();
    const states: AutosaveState[] = [];
    const saver = createSessionAutosaver({
      persist: async (key) => (key === "a" ? old.promise : true),
      onChange: (state) => states.push(state),
    });
    saver.schedule("a", "edit");
    const oldSave = saver.flush();
    await Promise.resolve();
    saver.schedule("b", "edit");
    old.resolve(false);
    await oldSave;
    assert.deepEqual(states.at(-1), { key: "b", status: "pending" });
    await saver.flush();
    assert.deepEqual(states.at(-1), { key: "b", status: "saved" });
  });

  it("reports failed transactions and can retry the same document", async () => {
    let available = false;
    const states: AutosaveState[] = [];
    const saver = createSessionAutosaver({
      persist: async () => available,
      onChange: (state) => states.push(state),
    });
    saver.schedule("a", "edit");
    assert.equal(await saver.flush(), false);
    assert.equal(saver.isDirty(), true);
    assert.deepEqual(states.at(-1), { key: "a", status: "error" });
    available = true;
    saver.schedule("a", "edit");
    assert.equal(await saver.flush(), true);
    assert.equal(saver.isDirty(), false);
  });

  it("recovers after persistence throws instead of poisoning the write queue", async () => {
    let attempts = 0;
    const saver = createSessionAutosaver({
      persist: async () => {
        if (++attempts === 1) throw new Error("Storage blocked");
        return true;
      },
      onChange: () => {},
    });
    saver.schedule("a", "edit");
    assert.equal(await saver.flush(), false);
    saver.schedule("a", "new edit");
    assert.equal(await saver.flush(), true);
    assert.equal(saver.isDirty(), false);
  });

  it("has nothing to save before the first document is opened", async () => {
    const saver = createSessionAutosaver({
      persist: async () => {
        throw new Error("Should not run");
      },
      onChange: () => {},
    });
    assert.equal(await saver.flush(), true);
    assert.equal(saver.isDirty(), false);
  });
});

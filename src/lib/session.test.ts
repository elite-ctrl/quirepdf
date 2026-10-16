import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { IDBDatabase, IDBFactory } from "fake-indexeddb";
import { loadSession, saveSession, type Session } from "./session.ts";
import type { Mark } from "./marks.ts";

const mark: Mark = {
  id: "mark-1",
  page: 1,
  kind: "highlight",
  pass: 1,
  ink: "brass",
  label: "query",
  note: "Check this",
  quote: "Revenue",
  quads: [{ x: 10, y: 20, w: 30, h: 10 }],
  createdAt: 100,
};
const session: Session = {
  name: "document.pdf",
  marks: [mark],
  importedSourceIds: ["original-1"],
  savedAt: 200,
};

describe("session storage", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "indexedDB");
  beforeEach(() => {
    Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: new IDBFactory() });
  });
  afterEach(() => {
    if (original) Object.defineProperty(globalThis, "indexedDB", original);
    else Reflect.deleteProperty(globalThis, "indexedDB");
  });

  it("returns true only after the write completes and restores the saved marks", async () => {
    assert.equal(await saveSession("a", session), true);
    const restored = await loadSession("a");
    assert.equal(restored?.name, session.name);
    assert.equal(restored?.marks[0]?.note, mark.note);
    assert.equal(restored?.marks[0]?.quote, mark.quote);
    assert.deepEqual(restored?.importedSourceIds, session.importedSourceIds);
    assert.equal(restored?.savedAt, session.savedAt);
  });

  it("returns false when browser storage is unavailable", async () => {
    Reflect.deleteProperty(globalThis, "indexedDB");
    assert.equal(await saveSession("a", session), false);
    assert.equal(await loadSession("a"), null);
  });

  it("reports an aborted transaction rather than hanging or claiming success", async (t) => {
    const transaction = IDBDatabase.prototype.transaction;
    t.mock.method(
      IDBDatabase.prototype,
      "transaction",
      function (this: IDBDatabase, ...args: Parameters<typeof transaction>) {
        const tx = transaction.apply(this, args);
        if (args[1] === "readwrite") queueMicrotask(() => tx.abort());
        return tx;
      },
    );
    assert.equal(await saveSession("a", session), false);
    assert.equal(await loadSession("a"), null);
  });

  it("closes database connections even when a write throws", async (t) => {
    const close = t.mock.method(IDBDatabase.prototype, "close");
    const transaction = IDBDatabase.prototype.transaction;
    t.mock.method(
      IDBDatabase.prototype,
      "transaction",
      function (this: IDBDatabase, ...args: Parameters<typeof transaction>) {
        if (args[1] === "readwrite") throw new Error("Quota exceeded");
        return transaction.apply(this, args);
      },
    );
    assert.equal(await saveSession("a", session), false);
    assert.equal(close.mock.callCount(), 1);
  });

  it("does not mix the sessions of different PDFs", async () => {
    await saveSession("a", session);
    await saveSession("b", { ...session, name: "other.pdf", marks: [] });
    assert.equal((await loadSession("a"))?.marks.length, 1);
    assert.equal((await loadSession("b"))?.marks.length, 0);
    assert.equal(await loadSession("missing"), null);
  });
});

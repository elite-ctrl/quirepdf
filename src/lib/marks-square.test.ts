import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { KINDS, kindName, sanitizeMark, sortMarks, type Mark } from "./marks.ts";

const square: Mark = {
  id: "sq-1",
  page: 1,
  kind: "square",
  pass: 1,
  ink: "crimson",
  label: "query",
  note: "Check this table",
  quote: "",
  quads: [{ x: 40, y: 300, w: 120, h: 80 }],
  createdAt: 1,
};

describe("square marks", () => {
  it("is a listed kind with a name", () => {
    assert.ok(KINDS.some((kind) => kind.id === "square"));
    assert.equal(kindName("square"), "Square");
  });

  it("survives sanitising (session restore)", () => {
    assert.deepEqual(sanitizeMark(JSON.parse(JSON.stringify(square))), { ...square, from: undefined, to: undefined, sourceId: undefined });
  });

  it("is rejected without a box", () => {
    assert.equal(sanitizeMark({ ...square, quads: [] }), null);
  });

  it("sorts by the top of its box", () => {
    const higher = { ...square, id: "sq-2", quads: [{ x: 40, y: 500, w: 50, h: 20 }] };
    assert.deepEqual(sortMarks([square, higher]).map((mark) => mark.id), ["sq-2", "sq-1"]);
  });
});

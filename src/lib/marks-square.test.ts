import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { KINDS, kindName, nudgeMark, sanitizeMark, sortMarks, type Mark } from "./marks.ts";

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
    assert.deepEqual(sanitizeMark(JSON.parse(JSON.stringify(square))), { ...square, from: undefined, to: undefined, sourceId: undefined, fill: undefined });
  });

  it("is rejected without a box", () => {
    assert.equal(sanitizeMark({ ...square, quads: [] }), null);
  });

  it("sorts by the top of its box", () => {
    const higher = { ...square, id: "sq-2", quads: [{ x: 40, y: 500, w: 50, h: 20 }] };
    assert.deepEqual(sortMarks([square, higher]).map((mark) => mark.id), ["sq-2", "sq-1"]);
  });

  it("keeps the tint flag for squares only", () => {
    assert.equal(sanitizeMark({ ...square, fill: true })?.fill, true);
    assert.equal(sanitizeMark({ ...square, fill: "yes" })?.fill, undefined);
    assert.equal(sanitizeMark({ ...square, kind: "highlight", fill: true })?.fill, undefined);
  });

  it("nudges shapes but not text marks", () => {
    assert.deepEqual(nudgeMark(square, 10, -1)?.quads, [{ x: 50, y: 299, w: 120, h: 80 }]);
    const arrow: Mark = { ...square, kind: "arrow", quads: [], from: { x: 0, y: 0 }, to: { x: 5, y: 5 } };
    const movedArrow = nudgeMark(arrow, 1, 2);
    assert.deepEqual([movedArrow?.from, movedArrow?.to], [{ x: 1, y: 2 }, { x: 6, y: 7 }]);
    assert.equal(nudgeMark({ ...square, kind: "highlight" }, 1, 1), null);
  });
});

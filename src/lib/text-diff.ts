import type { InkId, Mark, Quad } from "@/lib/marks";

export type PlacedWord = { text: string; quad: Quad };

type Op =
  | { op: "eq"; a0: number; a1: number; b0: number; b1: number }
  | { op: "del"; a0: number; a1: number }
  | { op: "ins"; b0: number; b1: number };

const MARK_CAP = 400;

/** Split a text run into words and give each word a share of the run's box. */
export function wordsInRun(str: string, x: number, y: number, w: number, h: number): PlacedWord[] {
  if (!str || w <= 0 || h <= 0) return [];
  const total = Math.max(1, str.length);
  const words: PlacedWord[] = [];
  for (const match of str.matchAll(/\S+/g)) {
    const start = match.index ?? 0;
    const text = match[0];
    if (!text) continue;
    words.push({
      text,
      quad: {
        x: x + (w * start) / total,
        y,
        w: Math.max(0.4, (w * text.length) / total),
        h,
      },
    });
  }
  return words;
}

function diffTokens(before: string[], after: string[]): Op[] | null {
  const n = before.length;
  const m = after.length;
  if (n === 0 && m === 0) return [];
  if (n === 0) return [{ op: "ins", b0: 0, b1: m }];
  if (m === 0) return [{ op: "del", a0: 0, a1: n }];
  if (n * m > 2_000_000) return null;
  const cols = m + 1;
  const from = new Uint8Array((n + 1) * cols);
  let previous = new Int32Array(cols);
  let current = new Int32Array(cols);
  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= m; j += 1) {
      const at = i * cols + j;
      if (before[i - 1] === after[j - 1]) {
        current[j] = previous[j - 1] + 1;
        from[at] = 1;
      } else if (previous[j] >= current[j - 1]) {
        current[j] = previous[j];
        from[at] = 2;
      } else {
        current[j] = current[j - 1];
        from[at] = 3;
      }
    }
    const swap = previous;
    previous = current;
    current = swap;
    current.fill(0);
  }
  const steps: { t: number; i: number; j: number }[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const dir = from[i * cols + j];
      if (dir === 1) {
        steps.push({ t: 1, i: i - 1, j: j - 1 });
        i -= 1;
        j -= 1;
        continue;
      }
      if (dir === 3) {
        steps.push({ t: 3, i, j: j - 1 });
        j -= 1;
        continue;
      }
      steps.push({ t: 2, i: i - 1, j });
      i -= 1;
      continue;
    }
    if (i > 0) {
      steps.push({ t: 2, i: i - 1, j: 0 });
      i -= 1;
      continue;
    }
    steps.push({ t: 3, i: 0, j: j - 1 });
    j -= 1;
  }
  steps.reverse();
  const ops: Op[] = [];
  for (const step of steps) {
    const last = ops[ops.length - 1];
    if (step.t === 1) {
      if (last?.op === "eq" && last.a1 === step.i && last.b1 === step.j) {
        last.a1 += 1;
        last.b1 += 1;
      } else ops.push({ op: "eq", a0: step.i, a1: step.i + 1, b0: step.j, b1: step.j + 1 });
    } else if (step.t === 2) {
      if (last?.op === "del" && last.a1 === step.i) last.a1 += 1;
      else ops.push({ op: "del", a0: step.i, a1: step.i + 1 });
    } else if (last?.op === "ins" && last.b1 === step.j) last.b1 += 1;
    else ops.push({ op: "ins", b0: step.j, b1: step.j + 1 });
  }
  return ops;
}

function clip(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max - 1)}…`;
}

function joined(words: PlacedWord[], max: number): string {
  return clip(words.map((word) => word.text).join(" "), max);
}

function mergeLineQuads(quads: Quad[]): Quad[] {
  const sorted = [...quads].sort((a, b) => b.y - a.y || a.x - b.x);
  const merged: Quad[] = [];
  for (const quad of sorted) {
    const last = merged[merged.length - 1];
    const gap = last ? quad.x - (last.x + last.w) : 0;
    const sameLine =
      !!last && Math.abs(last.y - quad.y) < Math.max(2, Math.min(last.h, quad.h) * 0.6) && gap < 14 && gap > -4;
    if (!last || !sameLine) {
      merged.push({ ...quad });
      continue;
    }
    const right = Math.max(last.x + last.w, quad.x + quad.w);
    const bottom = Math.min(last.y, quad.y);
    const top = Math.max(last.y + last.h, quad.y + quad.h);
    last.x = Math.min(last.x, quad.x);
    last.y = bottom;
    last.w = right - last.x;
    last.h = top - bottom;
  }
  return merged;
}

function changeId(): string {
  return `change-${crypto.randomUUID()}`;
}

function highlightMark(page: number, ink: InkId, note: string, words: PlacedWord[]): Mark {
  return {
    id: changeId(),
    page,
    kind: "highlight",
    pass: 1,
    ink,
    label: "note",
    note,
    quote: joined(words, 500),
    quads: mergeLineQuads(words.map((word) => word.quad)),
    createdAt: Date.now(),
  };
}

function deletionMark(page: number, words: PlacedWord[], anchor: Quad | null, stack: number): Mark {
  const text = joined(words, 280);
  const base = anchor ?? { x: 72, y: 680, w: 12, h: 12 };
  return {
    id: changeId(),
    page,
    kind: "callout",
    pass: 1,
    ink: "crimson",
    label: "note",
    note: `Deleted: ${text}`,
    quote: joined(words, 500),
    quads: [{ x: base.x + (stack % 3) * 16, y: base.y + base.h + 8 + stack * 44, w: 200, h: 40 }],
    to: { x: base.x, y: base.y + base.h / 2 },
    createdAt: Date.now(),
  };
}

/** Marks for one page. `before` is the earlier copy. `after` is this file. */
export function marksForPage(before: PlacedWord[], after: PlacedWord[], page: number): Mark[] {
  const ops = diffTokens(
    before.map((word) => word.text),
    after.map((word) => word.text),
  );
  if (!ops) {
    if (!before.length && !after.length) return [];
    if (!before.length) return [highlightMark(page, "steel", "Added.", after)];
    if (!after.length) return [deletionMark(page, before, null, 0)];
    return [highlightMark(page, "brass", `Was: ${joined(before, 500)}`, after)];
  }
  const marks: Mark[] = [];
  let removed: PlacedWord[] = [];
  let added: PlacedWord[] = [];
  let stack = 0;
  const flush = (anchor: Quad | null) => {
    if (!removed.length && !added.length) return;
    if (removed.length && added.length) {
      marks.push(highlightMark(page, "brass", `Was: ${joined(removed, 500)}`, added));
    } else if (added.length) {
      marks.push(highlightMark(page, "steel", "Added.", added));
    } else {
      marks.push(deletionMark(page, removed, anchor, stack));
      stack += 1;
    }
    removed = [];
    added = [];
  };
  let lastAnchor: Quad | null = null;
  for (const op of ops) {
    if (op.op === "eq") {
      flush(after[op.b0]?.quad ?? lastAnchor);
      lastAnchor = after[op.b1 - 1]?.quad ?? lastAnchor;
      continue;
    }
    if (op.op === "del") removed.push(...before.slice(op.a0, op.a1));
    else added.push(...after.slice(op.b0, op.b1));
  }
  flush(lastAnchor);
  return marks;
}

export function capChanges(marks: Mark[]): { marks: Mark[]; capped: boolean } {
  if (marks.length <= MARK_CAP) return { marks, capped: false };
  return { marks: marks.slice(0, MARK_CAP), capped: true };
}

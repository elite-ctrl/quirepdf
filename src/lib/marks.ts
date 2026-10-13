export const KINDS = [
  { id: "highlight", name: "Highlight" },
  { id: "underline", name: "Underline" },
  { id: "strikeout", name: "Strikeout" },
  { id: "callout", name: "Callout" },
  { id: "arrow", name: "Arrow" },
] as const;

export const LABELS = [
  { id: "query", name: "Query" },
  { id: "style", name: "Style" },
  { id: "term", name: "Term" },
  { id: "number", name: "Number" },
  { id: "xref", name: "Cross-ref" },
  { id: "note", name: "Note" },
] as const;

export const INKS = [
  { id: "brass", name: "Brass" },
  { id: "steel", name: "Steel" },
  { id: "crimson", name: "Crimson" },
] as const;

export type Kind = (typeof KINDS)[number]["id"];
export type LabelId = (typeof LABELS)[number]["id"];
export type InkId = (typeof INKS)[number]["id"];
export type Pass = 1 | 2;
export type Tool = "select" | Kind;

export type Quad = { x: number; y: number; w: number; h: number };
export type Point = { x: number; y: number };

export type Mark = {
  id: string;
  page: number;
  kind: Kind;
  pass: Pass;
  ink: InkId;
  label: LabelId;
  note: string;
  quote: string;
  quads: Quad[];
  from?: Point;
  to?: Point;
  sourceId?: string;
  createdAt: number;
};

export const INK_RGB: Record<InkId, [number, number, number]> = {
  brass: [141 / 255, 90 / 255, 43 / 255],
  steel: [30 / 255, 77 / 255, 107 / 255],
  crimson: [140 / 255, 47 / 255, 47 / 255],
};

const HEADER = /^\[(?:(First read|Second read|P[12]) · )?(Query|Style|Term|Number|Cross-ref|Note)\]\n?/;

export function kindName(kind: Kind): string {
  return KINDS.find((item) => item.id === kind)?.name ?? "Highlight";
}

export function labelName(label: LabelId): string {
  return LABELS.find((item) => item.id === label)?.name ?? "Note";
}

export function formatContents(mark: Mark): string {
  const head = `[${labelName(mark.label)}]`;
  const note = mark.note.trim();
  return note ? `${head}\n${note}` : head;
}

export function parseNote(contents: string): { pass: Pass; label: LabelId; note: string } {
  const match = contents.match(HEADER);
  if (!match || !match[2]) return { pass: 1, label: "note", note: contents.trim() };
  const label = LABELS.find((item) => item.name === match[2])?.id ?? "note";
  const pass: Pass = match[1] === "Second read" || match[1] === "P2" ? 2 : 1;
  return {
    pass,
    label,
    note: contents.slice(match[0].length).trim(),
  };
}

export function nearestInk(channels: [number, number, number]): InkId {
  const [r, g, b] = channels.map((channel) => channel / 255);
  let best: InkId = "brass";
  let bestDistance = Infinity;
  for (const ink of INKS) {
    const [ir, ig, ib] = INK_RGB[ink.id];
    const distance = (ir - r) ** 2 + (ig - g) ** 2 + (ib - b) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = ink.id;
    }
  }
  return best;
}

export function sortMarks(marks: Mark[]): Mark[] {
  return [...marks].sort((a, b) => {
    if (a.page !== b.page) return a.page - b.page;
    return markTop(b) - markTop(a);
  });
}

function markTop(mark: Mark): number {
  if (mark.kind === "arrow" && mark.from && mark.to) return Math.max(mark.from.y, mark.to.y);
  const quad = mark.quads[0];
  return quad ? quad.y + quad.h : (mark.to?.y ?? 0);
}

function isQuad(value: unknown): value is Quad {
  if (!value || typeof value !== "object") return false;
  const quad = value as Quad;
  return [quad.x, quad.y, quad.w, quad.h].every((n) => typeof n === "number" && Number.isFinite(n));
}

function isPoint(value: unknown): value is Point {
  if (!value || typeof value !== "object") return false;
  const point = value as Point;
  return typeof point.x === "number" && Number.isFinite(point.x) && typeof point.y === "number" && Number.isFinite(point.y);
}

export function sanitizeMark(value: unknown): Mark | null {
  if (!value || typeof value !== "object") return null;
  const mark = value as Partial<Mark>;
  if (typeof mark.id !== "string" || typeof mark.page !== "number") return null;
  const kind = KINDS.find((item) => item.id === mark.kind)?.id;
  if (!kind) return null;
  if (mark.pass !== 1 && mark.pass !== 2) return null;
  if (mark.ink !== "brass" && mark.ink !== "steel" && mark.ink !== "crimson") return null;
  const label = LABELS.find((item) => item.id === mark.label)?.id;
  if (!label) return null;
  if (typeof mark.note !== "string" || typeof mark.quote !== "string") return null;
  if (!Array.isArray(mark.quads) || !mark.quads.every(isQuad)) return null;
  const from = isPoint(mark.from) ? { x: mark.from.x, y: mark.from.y } : undefined;
  const to = isPoint(mark.to) ? { x: mark.to.x, y: mark.to.y } : undefined;
  if (kind === "arrow" && (!from || !to)) return null;
  if (kind === "callout" && mark.quads.length === 0) return null;
  if (kind !== "arrow" && kind !== "callout" && mark.quads.length === 0) return null;
  return {
    id: mark.id,
    page: mark.page,
    kind,
    pass: mark.pass,
    ink: mark.ink,
    label,
    note: mark.note,
    quote: mark.quote,
    quads: mark.quads,
    from,
    to,
    sourceId: typeof mark.sourceId === "string" ? mark.sourceId : undefined,
    createdAt: typeof mark.createdAt === "number" ? mark.createdAt : Date.now(),
  };
}

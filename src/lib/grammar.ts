import type { PdfDoc } from "@/lib/pdf-client";
import type { Mark, Quad } from "@/lib/marks";

export type GrammarHit = { start: number; end: number; quote: string; note: string };

const CJK = /[\u3400-\u9FFF\uF900-\uFAFF\u3040-\u30FF\uAC00-\uD7AF]/;
const KEEP = new Set([
  "Agreement",
  "BoundaryError",
  "Capitalization",
  "Eggcorn",
  "Grammar",
  "Malapropism",
  "Miscellaneous",
  "Nonstandard",
  "Punctuation",
  "Repetition",
  "Spelling",
  "Typo",
  "Usage",
  "WordChoice",
  "WordOrder",
]);
const ITS_NOUN =
  /^(own|revenue|profit|loss|board|shares|directors|assets|liabilities|equity|value|price|date|name|purpose|terms|results|operations)\b/i;

type Span = { start: number; end: number; x: number; y: number; w: number; h: number };

type TextRun = {
  str: string;
  transform: number[];
  width: number;
  height: number;
  hasEOL?: boolean;
};

type Joined = { text: string; map: number[] };

type Engine = {
  lint: (text: string, options?: { language?: "plaintext" }) => Promise<HarperLint[]>;
};

type HarperLint = {
  get_problem_text: () => string;
  lint_kind: () => string;
  message: () => string;
  span: () => { start: number; end: number };
  suggestion_count: () => number;
  suggestions: () => { get_replacement_text: () => string; free?: () => void }[];
  free?: () => void;
};

let enginePromise: Promise<Engine> | null = null;

function engine(): Promise<Engine> {
  if (!enginePromise) {
    enginePromise = (async () => {
      const [{ Dialect, LocalLinter }, { binary }] = await Promise.all([import("harper.js"), import("harper.js/binary")]);
      const linter = new LocalLinter({ binary, dialect: Dialect.British });
      await linter.setup();
      return linter;
    })().catch((error: unknown) => {
      enginePromise = null;
      throw error;
    });
  }
  return enginePromise;
}

/** Join wrapped lines so a break in the PDF is not read as a new word. */
export function joinForLint(text: string): Joined {
  const out: string[] = [];
  const map: number[] = [];
  const push = (char: string, origin: number) => {
    out.push(char);
    map.push(origin);
  };
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index] ?? "";
    if (char === "\r") continue;
    if (char === "-" && text[index + 1] === "\n" && /[a-z]/.test(text[index + 2] ?? "")) {
      index += 1;
      continue;
    }
    if (char === "\n") {
      if (text[index + 1] === "\n") {
        push("\n", index);
        index += 1;
        continue;
      }
      const before = text[index - 1] ?? "";
      const after = text[index + 1] ?? "";
      if (CJK.test(before) && CJK.test(after)) continue;
      push(" ", index);
      continue;
    }
    push(char, index);
  }
  return { text: out.join(""), map };
}

function originOf(joined: Joined, start: number, end: number): { start: number; end: number } {
  const from = joined.map[start] ?? 0;
  const last = joined.map[Math.max(start, end - 1)];
  return { start: from, end: last === undefined ? from : last + 1 };
}

function plain(message: string): string {
  return message
    .replace(/`([^`]+)`/g, '"$1"')
    .replace(/\s+/g, " ")
    .trim();
}

function usableReplacement(problem: string, replacement: string): string {
  const next = replacement.trim();
  if (!next || next === problem) return "";
  if (!/\s/.test(problem) && /\s/.test(next)) return "";
  return next;
}

function skipProblem(kind: string, problem: string): boolean {
  if (!problem || CJK.test(problem)) return true;
  if ((kind === "Spelling" || kind === "Typo") && /^[A-Z0-9]{2,}$/.test(problem)) return true;
  return false;
}

function addHit(hits: GrammarHit[], text: string, start: number, end: number, note: string) {
  if (hits.length >= 80) return;
  if (start < 0 || end <= start) return;
  if (hits.some((hit) => start < hit.end && end > hit.start)) return;
  const quote = text.slice(start, end).replace(/\s+/g, " ").trim();
  if (!quote || CJK.test(quote)) return;
  hits.push({ start, end, quote, note });
}

function supplements(text: string, hits: GrammarHit[]) {
  for (const match of text.matchAll(/\b[Tt]here\s+(is|was)\s+(two|three|four|five|six|seven|eight|nine|ten|several|many|\d{2,}|[2-9])\b/g)) {
    const start = match.index ?? 0;
    addHit(hits, text, start, start + match[0].length, `Use "there ${match[1] === "is" ? "are" : "were"}".`);
  }
  for (const match of text.matchAll(/\bit's\s+([A-Za-z]+)/gi)) {
    if (!ITS_NOUN.test(match[1] ?? "")) continue;
    const start = match.index ?? 0;
    addHit(hits, text, start, start + "it's".length + 1 + (match[1]?.length ?? 0), 'Use "its".');
  }
  for (const match of text.matchAll(/\byour\s+welcome\b/gi)) {
    const start = match.index ?? 0;
    addHit(hits, text, start, start + match[0].length, 'Use "you\'re welcome".');
  }
}

/** British English. Spelling is included. Chinese is ignored. Nothing is sent off this computer. */
export async function lintEnglish(text: string): Promise<GrammarHit[]> {
  const checker = await engine();
  const lints = await checker.lint(text, { language: "plaintext" });
  const hits: GrammarHit[] = [];
  supplements(text, hits);
  for (const lint of lints) {
    const problem = lint.get_problem_text();
    const kind = lint.lint_kind();
    const span = lint.span();
    const replacement = lint.suggestion_count() ? usableReplacement(problem, lint.suggestions()[0]?.get_replacement_text() ?? "") : "";
    const message = plain(lint.message());
    lint.free?.();
    if (!KEEP.has(kind) || skipProblem(kind, problem)) continue;
    const note =
      !replacement && (kind === "Typo" || kind === "Spelling") && !/\s/.test(problem)
        ? `Check the spelling of "${problem}".`
        : replacement && !message.toLowerCase().includes(`"${replacement.toLowerCase()}"`) && !message.startsWith("Use ")
          ? `${message} Use "${replacement}".`
          : message;
    addHit(hits, text, span.start, span.end, note || `Check "${problem}".`);
  }
  return hits;
}

function quadsBetween(spans: Span[], start: number, end: number): Quad[] {
  const quads: Quad[] = [];
  for (const span of spans) {
    if (span.end <= start || span.start >= end || span.w <= 0) continue;
    const spanLength = Math.max(1, span.end - span.start);
    const overlapStart = Math.max(start, span.start);
    const overlapEnd = Math.min(end, span.end);
    const startRatio = (overlapStart - span.start) / spanLength;
    const endRatio = (overlapEnd - span.start) / spanLength;
    const w = span.w * (endRatio - startRatio);
    if (w < 0.2) continue;
    quads.push({ x: span.x + span.w * startRatio, y: span.y, w, h: span.h });
  }
  return quads;
}

function markId(): string {
  return `grammar-${crypto.randomUUID()}`;
}

function underline(page: number, quads: Quad[], quote: string, note: string): Mark {
  return {
    id: markId(),
    page,
    kind: "underline",
    pass: 1,
    ink: "steel",
    label: "style",
    note,
    quote,
    quads,
    createdAt: Date.now(),
  };
}

function callout(page: number, note: string, anchor: Quad, width: number, height: number, stack: number): Mark {
  const boxW = 220;
  const boxH = 42;
  let x = anchor.x;
  let y = anchor.y + anchor.h + 8 + stack * 46;
  if (y + boxH > height - 12) y = Math.max(12, anchor.y - boxH - 8 - stack * 46);
  if (x + boxW > width - 12) x = Math.max(12, width - boxW - 12);
  return {
    id: markId(),
    page,
    kind: "callout",
    pass: 1,
    ink: "steel",
    label: "style",
    note,
    quote: note,
    quads: [{ x, y, w: boxW, h: boxH }],
    to: { x: anchor.x + anchor.w / 2, y: anchor.y + anchor.h / 2 },
    createdAt: Date.now(),
  };
}

async function readPage(pdf: PdfDoc, pageNumber: number): Promise<{ text: string; spans: Span[]; width: number; height: number }> {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  let text = "";
  const spans: Span[] = [];
  for (const item of content.items) {
    if (!("str" in item)) continue;
    const run = item as TextRun;
    const piece = run.str.normalize("NFKC");
    if (text && piece && !/\s$/.test(text) && !/^\s/.test(piece)) text += " ";
    if (piece) {
      const start = text.length;
      text += piece;
      const height = run.height || Math.hypot(run.transform[2] ?? 0, run.transform[3] ?? 0) || 10;
      spans.push({
        start,
        end: text.length,
        x: run.transform[4] ?? 0,
        y: run.transform[5] ?? 0,
        w: run.width || Math.max(4, piece.length * height * 0.45),
        h: height,
      });
    }
    if (run.hasEOL) text += "\n";
  }
  return { text, spans, width: viewport.width, height: viewport.height };
}

/** Underlines each English point and adds a callout. Chinese text is left alone. */
export async function grammarMarks(pdf: PdfDoc): Promise<Mark[]> {
  const marks: Mark[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    if (marks.length >= 160) break;
    const layout = await readPage(pdf, pageNumber);
    const joined = joinForLint(layout.text);
    if (!/[A-Za-z]/.test(joined.text)) continue;
    const hits = await lintEnglish(joined.text);
    let stack = 0;
    for (const hit of hits) {
      if (marks.length >= 160) break;
      const range = originOf(joined, hit.start, hit.end);
      const quads = quadsBetween(layout.spans, range.start, range.end);
      if (!quads.length) continue;
      marks.push(underline(pageNumber, quads, hit.quote, hit.note));
      marks.push(callout(pageNumber, hit.note, quads[0], layout.width, layout.height, stack));
      stack += 1;
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return marks;
}

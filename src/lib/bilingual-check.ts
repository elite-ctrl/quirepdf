import { pagePlainText, type PdfDoc } from "@/lib/pdf-client";

export type SideGap = { raw: string; extra: number };

export type PairCheck = {
  page: number;
  sourcePage: number | null;
  targetPage: number | null;
  datesSource: SideGap[];
  datesTarget: SideGap[];
  figuresSource: SideGap[];
  figuresTarget: SideGap[];
};

type Token = { kind: "date" | "figure"; key: string; raw: string };

const MONTHS: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sept: 9,
  sep: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};

const MONTH = "January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept|Sep|Oct|Nov|Dec";

function iso(year: number, month: number, day: number): string | null {
  if (year < 100) year += year >= 70 ? 1900 : 2000;
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function monthOf(name: string): number {
  return MONTHS[name.toLowerCase().replace(/\.$/, "")] ?? 0;
}

function canonicalNumber(value: number): string | null {
  if (!Number.isFinite(value)) return null;
  const rounded = Math.round(value * 1e6) / 1e6;
  if (Object.is(rounded, -0)) return "0";
  if (Number.isInteger(rounded)) return String(rounded);
  return String(rounded);
}

function scaleOf(word: string | undefined): number {
  if (!word) return 1;
  const name = word.replace(/\s+/g, "").toLowerCase();
  if (name === "million" || name === "mn" || name === "百萬" || name === "百万") return 1e6;
  if (name === "billion" || name === "bn" || name === "十億" || name === "十亿") return 1e9;
  if (name === "萬" || name === "万") return 1e4;
  if (name === "億" || name === "亿") return 1e8;
  if (name === "cent" || name === "cents" || name === "仙") return 0.01;
  return 1;
}

function percentOf(word: string | undefined): boolean {
  if (!word) return false;
  return /%|％|个百分点|percent/.test(word.toLowerCase());
}

export function tokensIn(source: string): Token[] {
  const text = source.normalize("NFKC");
  const tokens: Token[] = [];
  const mask = new Array(text.length).fill(false);
  const dates: Array<{ re: RegExp; key: (match: RegExpMatchArray) => string | null }> = [
    {
      re: /(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/g,
      key: (match) => iso(+match[1], +match[2], +match[3]),
    },
    {
      re: new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH})\\.?\\s+(\\d{4})\\b`, "gi"),
      key: (match) => iso(+match[3], monthOf(match[2]), +match[1]),
    },
    {
      re: new RegExp(`\\b(${MONTH})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b`, "gi"),
      key: (match) => iso(+match[3], monthOf(match[1]), +match[2]),
    },
    {
      re: /\b(\d{4})[/-](\d{1,2})[/-](\d{1,2})\b/g,
      key: (match) => iso(+match[1], +match[2], +match[3]),
    },
    {
      re: /\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b/g,
      key: (match) => iso(+match[3], +match[2], +match[1]),
    },
    {
      re: /(\d{4})\s*年\s*(\d{1,2})\s*月/g,
      key: (match) => {
        const month = +match[2];
        const year = +match[1];
        if (year < 1900 || year > 2100 || month < 1 || month > 12) return null;
        return `${year}-${String(month).padStart(2, "0")}`;
      },
    },
  ];
  for (const pattern of dates) {
    for (const match of text.matchAll(pattern.re)) {
      const start = match.index ?? 0;
      const end = start + match[0].length;
      if (mask.slice(start, end).some(Boolean)) continue;
      const key = pattern.key(match);
      if (!key) continue;
      mask.fill(true, start, end);
      tokens.push({ kind: "date", key, raw: match[0].replace(/\s+/g, " ").trim() });
    }
  }

  const bare = [...text].map((char, index) => (mask[index] ? " " : char)).join("");
  const figure =
    /(?:\(|^|[^\d.])((?:HK\$|US\$|USD|HKD|RMB|CNY|EUR|GBP|[$£€¥])?\s*(?:\d{1,3}(?:[,，]\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)\s*(?:十[亿億]|百[万萬]|[亿億]|[万萬]|million|billion|mn|bn|cents?|仙|%|％|个百分点|per\s*cent)?\)?)/gi;
  for (const match of bare.matchAll(figure)) {
    const raw = match[1].replace(/\s+/g, " ").trim();
    const body = raw.replace(/[()]/g, "");
    const parts = body.match(
      /^(?:HK\$|US\$|USD|HKD|RMB|CNY|EUR|GBP|[$£€¥])?\s*(\d{1,3}(?:[,，]\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)(.*)$/i,
    );
    if (!parts) continue;
    const magnitude = Number(parts[1].replace(/[,，]/g, ""));
    if (!Number.isFinite(magnitude)) continue;
    const tail = parts[2] ?? "";
    const negative = raw.startsWith("(") && raw.endsWith(")");
    const value = magnitude * scaleOf(tail) * (negative ? -1 : 1);
    const key = percentOf(tail) ? `${canonicalNumber(value)}%` : canonicalNumber(value);
    if (!key) continue;
    tokens.push({ kind: "figure", key, raw: raw.replace(/[()]/g, "") });
  }
  return tokens;
}

function gaps(source: Token[], target: Token[], kind: Token["kind"]): { source: SideGap[]; target: SideGap[] } {
  const tally = (list: Token[]) => {
    const map = new Map<string, { count: number; raw: string }>();
    for (const token of list) {
      if (token.kind !== kind) continue;
      const current = map.get(token.key);
      if (current) current.count += 1;
      else map.set(token.key, { count: 1, raw: token.raw });
    }
    return map;
  };
  const a = tally(source);
  const b = tally(target);
  const only = (from: Map<string, { count: number; raw: string }>, other: Map<string, { count: number; raw: string }>) => {
    const found: SideGap[] = [];
    for (const [key, item] of from) {
      const extra = item.count - (other.get(key)?.count ?? 0);
      if (extra > 0) found.push({ raw: item.raw, extra });
    }
    return found;
  };
  return { source: only(a, b), target: only(b, a) };
}

export function compareSides(sourceText: string, targetText: string): Pick<PairCheck, "datesSource" | "datesTarget" | "figuresSource" | "figuresTarget"> {
  const source = tokensIn(sourceText);
  const target = tokensIn(targetText);
  const dates = gaps(source, target, "date");
  const figures = gaps(source, target, "figure");
  return {
    datesSource: dates.source,
    datesTarget: dates.target,
    figuresSource: figures.source,
    figuresTarget: figures.target,
  };
}

const emptySide = {
  datesSource: [],
  datesTarget: [],
  figuresSource: [],
  figuresTarget: [],
};

export async function checkBilingual(source: PdfDoc, target: PdfDoc): Promise<PairCheck[]> {
  const count = Math.max(source.numPages, target.numPages);
  const pages = Array.from({ length: count }, (_, index) => index + 1);
  const sourceText = new Map<number, string>();
  const targetText = new Map<number, string>();
  await Promise.all([
    ...pages.filter((page) => page <= source.numPages).map(async (page) => {
      sourceText.set(page, await pagePlainText(source, page));
    }),
    ...pages.filter((page) => page <= target.numPages).map(async (page) => {
      targetText.set(page, await pagePlainText(target, page));
    }),
  ]);
  return pages.map((page) => {
    const sourcePage = page <= source.numPages ? page : null;
    const targetPage = page <= target.numPages ? page : null;
    if (sourcePage === null || targetPage === null) {
      return { page, sourcePage, targetPage, ...emptySide };
    }
    return { page, sourcePage, targetPage, ...compareSides(sourceText.get(page) ?? "", targetText.get(page) ?? "") };
  });
}

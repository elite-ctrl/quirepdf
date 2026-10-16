import type { PdfDoc } from "@/lib/pdf-client";
import type { Mark, Quad } from "@/lib/marks";

export type SideGap = { raw: string; extra: number };

export type FormatGap = { raw: string; note: string; at: number };

export type PairCheck = {
  page: number;
  sourcePage: number | null;
  targetPage: number | null;
  datesSource: SideGap[];
  datesTarget: SideGap[];
  figuresSource: SideGap[];
  figuresTarget: SideGap[];
  formats: FormatGap[];
  /** Bracket problems on the target page, and a note when the paired pages hold different numbers of brackets. */
  brackets: BracketGap[];
};

type Face = { bold: boolean; italic: boolean };

type Token = { kind: "date" | "figure"; key: string; raw: string; bold: boolean; italic: boolean };

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
  if (name === "thousand" || name === "千") return 1e3;
  if (name === "萬" || name === "万") return 1e4;
  if (name === "億" || name === "亿") return 1e8;
  if (/^(?:hk)?cents?$/.test(name) || name === "仙" || name === "港仙") return 0.01;
  return 1;
}

/** "%" for per cent, "pp" for percentage points, "" otherwise. Percentage points are a different unit from per cent. */
function unitOf(word: string | undefined): "%" | "pp" | "" {
  if (!word) return "";
  const name = word.toLowerCase();
  if (/percentage\s*points?|ppts?|[個个]?百分[點点]/.test(name)) return "pp";
  if (/%|％|per\s*cent/.test(name)) return "%";
  return "";
}

const CN_DIGITS: Record<string, number> = { "〇": 0, "零": 0, "○": 0, "一": 1, "二": 2, "兩": 2, "两": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9 };

/** Reads an Arabic or Chinese-numeral integer: 2025, 二零二五, 十二, 三十一, 一百. */
function intOf(text: string): number {
  const value = text.trim();
  if (/^\d+$/.test(value)) return Number(value);
  if (!/[十百千]/.test(value)) {
    let digits = "";
    for (const char of value) {
      if (!(char in CN_DIGITS)) return NaN;
      digits += CN_DIGITS[char];
    }
    return digits ? Number(digits) : NaN;
  }
  let total = 0;
  let current = 0;
  for (const char of value) {
    if (char in CN_DIGITS) current = CN_DIGITS[char];
    else if (char === "十" || char === "百" || char === "千") {
      total += (current || 1) * (char === "十" ? 10 : char === "百" ? 100 : 1000);
      current = 0;
    } else return NaN;
  }
  return total + current;
}

/** Reads a Chinese-numeral decimal such as 十二點五. */
function decimalOf(text: string): number {
  const [whole, fraction] = text.replace(/[點点]/, ".").split(".");
  const head = intOf(whole || "零");
  if (fraction === undefined) return head;
  let digits = "";
  for (const char of fraction) digits += /\d/.test(char) ? char : String(CN_DIGITS[char] ?? "x");
  return /^\d+$/.test(digits) ? Number(`${head}.${digits}`) : NaN;
}

function styleOf(faces: Face[] | undefined, start: number, end: number): Face {
  if (!faces) return { bold: false, italic: false };
  let bold = 0;
  let italic = 0;
  let count = 0;
  for (let index = start; index < end; index += 1) {
    const face = faces[index];
    if (!face) continue;
    count += 1;
    if (face.bold) bold += 1;
    if (face.italic) italic += 1;
  }
  if (!count) return { bold: false, italic: false };
  return { bold: bold * 2 >= count, italic: italic * 2 >= count };
}

function isCjk(char: string): boolean {
  return /[\u3400-\u9FFF]/.test(char);
}

function tighten(piece: string): string {
  return piece.replace(/(\d)\s+(?=[,，.年月日%％])/g, "$1").replace(/([,，.年月日])\s+(?=\d)/g, "$1");
}

function glued(text: string, piece: string): boolean {
  const left = text.trimEnd();
  const right = piece.trimStart();
  const a = left.at(-1) ?? "";
  const b = right[0] ?? "";
  if (!a || !b) return false;
  if (isCjk(a) && isCjk(b)) return true;
  if (/\d/.test(a) && /[年月日%％]/.test(b)) return true;
  if (/[年月日]/.test(a) && /\d/.test(b)) return true;
  if (/\d/.test(a) && /^[,，]/.test(right)) return true;
  if (/[,，]/.test(a) && /^\d{3}(?!\d)/.test(right)) return true;
  const leftDigits = left.match(/\d+$/)?.[0] ?? "";
  const rightDigits = right.match(/^\d+/)?.[0] ?? "";
  if (leftDigits && rightDigits) return false;
  if (/[([［【]/.test(a) && /\d/.test(b)) return true;
  if (a === "." && /\d/.test(b) && !/\d/.test(left.at(-2) ?? "")) return true;
  return false;
}

function separate(text: string, piece: string): boolean {
  if (!text || !piece || /\s$/.test(text) || /^\s/.test(piece)) return false;
  return !glued(text, piece);
}

function foldDigitSpaces(text: string): { text: string; map: number[] } {
  let chars = [...text];
  let map = chars.map((_, index) => index);
  for (let pass = 0; pass < 8; pass += 1) {
    const source = chars.join("");
    const dead = new Set<number>();
    for (const match of source.matchAll(/(\d)\s+(?=\d(?:\s+\d)*\s*[年月日])/g)) {
      dead.add((match.index ?? 0) + 1);
    }
    if (!dead.size) break;
    chars = chars.filter((_, index) => !dead.has(index));
    map = map.filter((_, index) => !dead.has(index));
  }
  return { text: chars.join(""), map };
}

function blankFurniture(text: string): string {
  const wipe = (pattern: RegExp) => {
    text = text.replace(pattern, (match) => " ".repeat(match.length));
  };
  wipe(/File:[\s\S]*?request\)/g);
  wipe(/[–—]\s*\d+\s*[–—]/g);
  wipe(/\bLR\s*[\d.A-Za-z]+(?:\s*\(\d+\))?/g);
  wipe(/\bBL:\s*\([^)]*\)(?:\s*\/\s*\([^)]*\))?/g);
  wipe(/\b\d+\s*\(W\)\s*x\s*\d+\s*\(H\)/gi);
  wipe(/\bNote\s+\d+\s+to\b/g);
  wipe(/1st\s+Proof[\s\S]{0,160}?Pagination:\s*TBC/gi);
  return text;
}

function faceNote(source: Face, target: Face): string {
  const parts: string[] = [];
  if (source.bold !== target.bold) parts.push(source.bold ? "Source is bold." : "Source is not bold.");
  if (source.italic !== target.italic) parts.push(source.italic ? "Source is italic." : "Source is not italic.");
  return parts.join(" ");
}

function styleKey(face: Face): string {
  return `${face.bold ? "b" : ""}${face.italic ? "i" : ""}` || "r";
}

const YEAR = "(\\d{4}|[〇零○一二三四五六七八九]{4})";
const CN_MONTH = "(\\d{1,2}|十[一二]?|[一二三四五六七八九])";
const CN_DAY = "(\\d{1,2}|[一二三]?十[一二三四五六七八九]?|[一二三四五六七八九])";
const TC_TO = "\\s*(?:至|到|起至|-|–|—|~)\\s*";
const EN_DAY = "(\\d{1,2})(?:st|nd|rd|th)?";
const EN_TO = "\\s*(?:to|until|till|through|and|-|–|—)\\s*";
const CUR = "HK\\$|US\\$|USD|HKD|RMB|CNY|EUR|GBP|[$£€¥]";
const NUM = "\\d{1,3}(?:[,，]\\d{3})+(?:\\.\\d+)?|\\d+(?:\\.\\d+)?";
const TAIL =
  "十[亿億]|百[万萬]|[亿億]|[万萬]|(?:thousand|million|billion)(?![A-Za-z])|千(?![瓦克米卡焦升])|(?:percentage\\s+points?|ppts?|mn|bn|(?:HK\\s*)?cents?|per\\s*cent)(?![A-Za-z])|港仙|仙|%|％|[個个]百分[點点]|百分[點点]";
const CURRENCY_AFTER = /^\s*(?:港元|港幣|美元|人民幣|人民币|元|歐元|英鎊|日圓|日元|HKD|USD|RMB|(?:Hong Kong |US )?dollars?)/i;
const CURRENCY_BEFORE = /(?:港幣|人民幣|人民币|美元|RMB|HKD|USD)\s*$/i;

type DateRule = { re: RegExp; keys: (match: RegExpMatchArray) => Array<string | null> };

function monthKey(year: number, month: number): string | null {
  if (year < 1900 || year > 2100 || month < 1 || month > 12) return null;
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** Date rules in priority order: ranges first, then full dates, then month-year, then Chinese-numeral years. */
const DATE_RULES: DateRule[] = [
  {
    // 2026年及2025年6月30日: both years share the month and day.
    re: new RegExp(`${YEAR}\\s*年\\s*(?:及|和|與|与|、|或)\\s*${YEAR}\\s*年\\s*${CN_MONTH}\\s*月\\s*${CN_DAY}\\s*日`, "g"),
    keys: (m) => [iso(intOf(m[1]), intOf(m[3]), intOf(m[4])), iso(intOf(m[2]), intOf(m[3]), intOf(m[4]))],
  },
  {
    // 30 June 2026 and 2025: both years share the day and month.
    re: new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH})\\.?\\s+(\\d{4})\\s*(?:and|&|or)\\s*(\\d{4})\\b`, "gi"),
    keys: (m) => [iso(+m[3], monthOf(m[2]), +m[1]), iso(+m[4], monthOf(m[2]), +m[1])],
  },
  {
    // 2025年11月1日至12月31日
    re: new RegExp(`${YEAR}\\s*年\\s*${CN_MONTH}\\s*月\\s*${CN_DAY}\\s*日${TC_TO}${CN_MONTH}\\s*月\\s*${CN_DAY}\\s*日`, "g"),
    keys: (m) => {
      const year = intOf(m[1]);
      const from = intOf(m[2]);
      const to = intOf(m[4]);
      return [iso(year, from, intOf(m[3])), iso(to < from ? year + 1 : year, to, intOf(m[5]))];
    },
  },
  {
    // 2025年12月1日至31日
    re: new RegExp(`${YEAR}\\s*年\\s*${CN_MONTH}\\s*月\\s*${CN_DAY}\\s*日${TC_TO}${CN_DAY}\\s*日`, "g"),
    keys: (m) => [iso(intOf(m[1]), intOf(m[2]), intOf(m[3])), iso(intOf(m[1]), intOf(m[2]), intOf(m[4]))],
  },
  {
    // 1 November to 31 December 2025
    re: new RegExp(`\\b${EN_DAY}\\s+(${MONTH})\\.?${EN_TO}${EN_DAY}\\s+(${MONTH})\\.?,?\\s+(\\d{4})\\b`, "gi"),
    keys: (m) => {
      const from = monthOf(m[2]);
      const to = monthOf(m[4]);
      return [iso(to < from ? +m[5] - 1 : +m[5], from, +m[1]), iso(+m[5], to, +m[3])];
    },
  },
  {
    // 1 to 31 December 2025
    re: new RegExp(`\\b${EN_DAY}${EN_TO}${EN_DAY}\\s+(${MONTH})\\.?,?\\s+(\\d{4})\\b`, "gi"),
    keys: (m) => [iso(+m[4], monthOf(m[3]), +m[1]), iso(+m[4], monthOf(m[3]), +m[2])],
  },
  {
    // December 1 to 31, 2025
    re: new RegExp(`\\b(${MONTH})\\.?\\s+${EN_DAY}${EN_TO}${EN_DAY},?\\s+(\\d{4})\\b`, "gi"),
    keys: (m) => [iso(+m[4], monthOf(m[1]), +m[2]), iso(+m[4], monthOf(m[1]), +m[3])],
  },
  {
    re: new RegExp(`${YEAR}\\s*年\\s*${CN_MONTH}\\s*月\\s*${CN_DAY}\\s*日`, "g"),
    keys: (m) => [iso(intOf(m[1]), intOf(m[2]), intOf(m[3]))],
  },
  {
    // "For the year ended 30 June / 2026 2025 2024" is a heading over year columns, not one date.
    re: new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH})\\.?\\s+(\\d{4})\\b(?![ \\t]+(?:19|20)\\d{2}\\b)`, "gi"),
    keys: (m) => [iso(+m[3], monthOf(m[2]), +m[1])],
  },
  {
    re: new RegExp(`\\b(${MONTH})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b`, "gi"),
    keys: (m) => [iso(+m[3], monthOf(m[1]), +m[2])],
  },
  {
    re: /\b(\d{4})[/-](\d{1,2})[/-](\d{1,2})\b/g,
    keys: (m) => [iso(+m[1], +m[2], +m[3])],
  },
  {
    re: /\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b/g,
    keys: (m) => [iso(+m[3], +m[2], +m[1])],
  },
  {
    re: /(?<!\b20\d{2}[ \t]+)\b(20\d{2})(?:[ \t]+|[ \t]*\n[ \t]*)(\d{1,2})[ \t]+(\d{1,2})(?![\d%％])/g,
    keys: (m) => [iso(+m[1], +m[2], +m[3])],
  },
  {
    // 2025年1月至6月
    re: new RegExp(`${YEAR}\\s*年\\s*${CN_MONTH}\\s*月${TC_TO}${CN_MONTH}\\s*月(?!\\s*[\\d一二三四五六七八九十]+\\s*日)`, "g"),
    keys: (m) => {
      const year = intOf(m[1]);
      const from = intOf(m[2]);
      const to = intOf(m[3]);
      return [monthKey(year, from), monthKey(to < from ? year + 1 : year, to)];
    },
  },
  {
    // January to June 2025
    re: new RegExp(`\\b(${MONTH})\\.?${EN_TO}(${MONTH})\\.?,?\\s+(\\d{4})\\b`, "g"),
    keys: (m) => {
      const from = monthOf(m[1]);
      const to = monthOf(m[2]);
      return [monthKey(to < from ? +m[3] - 1 : +m[3], from), monthKey(+m[3], to)];
    },
  },
  {
    re: new RegExp(`${YEAR}\\s*年\\s*${CN_MONTH}\\s*月`, "g"),
    keys: (m) => [monthKey(intOf(m[1]), intOf(m[2]))],
  },
  {
    // December 2025; capitalised so "may 2025" in running text is not read as a date.
    re: new RegExp(`\\b(${MONTH})\\.?,?\\s+(\\d{4})\\b(?![ \\t]+(?:19|20)\\d{2}\\b)`, "g"),
    keys: (m) => [monthKey(+m[2], monthOf(m[1]))],
  },
  {
    // 二零二五年 (Arabic years are read with the figures)
    re: /([〇零○一二三四五六七八九]{4})\s*年/g,
    keys: (m) => {
      const year = intOf(m[1]);
      return [year >= 1900 && year <= 2100 ? String(year) : null];
    },
  },
];

export function tokensIn(source: string, faces?: Face[]): Token[] {
  const text = blankFurniture(source.normalize("NFKC"));
  const tokens: Token[] = [];
  const mask = new Array(text.length).fill(false);
  const claim = (start: number, end: number) => {
    if (mask.slice(start, end).some(Boolean)) return false;
    mask.fill(true, start, end);
    return true;
  };
  for (const rule of DATE_RULES) {
    for (const match of text.matchAll(rule.re)) {
      const start = match.index ?? 0;
      const end = start + match[0].length;
      if (mask.slice(start, end).some(Boolean)) continue;
      const keys = rule.keys(match);
      if (!keys.length || keys.some((key) => !key)) continue;
      claim(start, end);
      const raw = match[0].replace(/\s+/g, " ").trim();
      for (const key of keys) tokens.push({ kind: "date", key: key as string, raw, ...styleOf(faces, start, end) });
    }
  }

  const equated: Array<{ re: RegExp; key: (match: RegExpMatchArray) => string | null }> = [
    // 十二個月 is twelve months; 十二月 alone is December and is not a figure.
    { re: /十二\s*[個个]\s*月/g, key: () => "12" },
    { re: /\b12\s*[-‐‑–—]\s*months?\b/gi, key: () => "12" },
    {
      re: /百分之\s*([\d.〇零○一二三四五六七八九十百點点]+)/g,
      key: (match) => {
        const value = /^[\d.]+$/.test(match[1]) ? Number(match[1]) : decimalOf(match[1]);
        const key = canonicalNumber(value);
        return key && key !== "0" ? `${key}%` : null;
      },
    },
  ];
  for (const pattern of equated) {
    for (const match of text.matchAll(pattern.re)) {
      const start = match.index ?? 0;
      const end = start + match[0].length;
      const key = pattern.key(match);
      if (!key || !claim(start, end)) continue;
      tokens.push({ kind: "figure", key, raw: match[0].replace(/\s+/g, " ").trim(), ...styleOf(faces, start, end) });
    }
  }

  // A "%" that starts a new line belongs to a column heading, not to the number above it (2025 / %).
  const bare = [...text]
    .map((char, index) => (mask[index] ? " " : char))
    .join("")
    .replace(/(\d[ \t]*\n)([\s%％]*)/g, (_, lead: string, rest: string) => lead + rest.replace(/[%％]/g, " "));
  const figure = new RegExp(
    `(?:^|[^\\d.,，]|(?<=\\D)[.,，])(\\(?\\s*(?:(?<![A-Za-z0-9-])[-−])?(?:${CUR})?\\s*(?:${NUM})(?:\\s*(?:[\\]）)]\\s*)?(?:${TAIL}))?\\)?)`,
    "gi",
  );
  for (const match of bare.matchAll(figure)) {
    const raw = match[1].replace(/\s+/g, " ").trim();
    const start = (match.index ?? 0) + match[0].length - match[1].length;
    const end = start + match[1].length;
    const body = raw.replace(/[()]/g, "").trim();
    const parts = body.match(new RegExp(`^([-−])?\\s*(${CUR})?\\s*(${NUM})(.*)$`, "i"));
    if (!parts) continue;
    const magnitude = Number(parts[3].replace(/[,，]/g, ""));
    if (!Number.isFinite(magnitude)) continue;
    const tail = (parts[4] ?? "").replace(/^[\]）)\s]+/, "");
    let bracketed = raw.startsWith("(") && raw.endsWith(")");
    // "ten (10) years" and "(2004)" repeat a count or a year; only a bracketed amount reads as negative.
    if (bracketed && !parts[1] && !parts[2] && !tail.trim() && /^\d+$/.test(parts[3])) {
      const whole = Number(parts[3]);
      if (whole < 100 || (whole >= 1900 && whole <= 2100)) bracketed = false;
    }
    // A dash that opens a line and stands apart from the number is a list bullet ("－ 2026年"), not a minus.
    const bullet = !!parts[1] && /^[-−]\s/.test(raw) && /(?:^|\n)[ \t]*$/.test(bare.slice(0, start + match[1].length - match[1].trimStart().length));
    const negative = bracketed || (!!parts[1] && !bullet);
    const scale = scaleOf(tail);
    const unit = unitOf(tail);
    const currency = !!parts[2] || CURRENCY_AFTER.test(bare.slice(end)) || CURRENCY_BEFORE.test(bare.slice(Math.max(0, start - 8), start));
    const value = magnitude * scale * (negative ? -1 : 1);
    const number = canonicalNumber(value);
    if (!number || number === "0") continue;
    const face = styleOf(faces, start, end);
    const shown = bracketed ? raw : raw.replace(/^\(\s*/, "").replace(/\s*\)$/, "").replace(bullet ? /^[-−]\s*/ : /^$/, "");
    if (!unit && scale === 1 && !currency && /^\d+$/.test(number)) {
      const whole = Number(number);
      // A bare four-digit 1900–2100 with no separator or currency is a year; years are compared as dates.
      if (whole >= 1900 && whole <= 2100 && !/[,，]/.test(parts[3])) {
        tokens.push({ kind: "date", key: number, raw: shown, ...face });
        continue;
      }
      if (whole < 100) continue;
    }
    tokens.push({ kind: "figure", key: unit ? `${number}${unit}` : number, raw: shown, ...face });
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

export function compareSides(
  sourceText: string,
  targetText: string,
  sourceFaces?: Face[],
  targetFaces?: Face[],
): Pick<PairCheck, "datesSource" | "datesTarget" | "figuresSource" | "figuresTarget" | "formats"> {
  const source = tokensIn(sourceText, sourceFaces);
  const target = tokensIn(targetText, targetFaces);
  const dates = gaps(source, target, "date");
  const figures = gaps(source, target, "figure");
  const styled = [...styleGaps(source, target, "date"), ...styleGaps(source, target, "figure")];
  const covered = new Set(styled.map((item) => item.raw));
  const formats = [
    ...styled,
    ...wordStyleGaps(sourceText, sourceFaces, targetText, targetFaces).filter(
      (item) => ![...covered].some((raw) => raw === item.raw || raw.includes(item.raw)),
    ),
  ];
  return {
    datesSource: dates.source,
    datesTarget: dates.target,
    figuresSource: figures.source,
    figuresTarget: figures.target,
    formats,
  };
}

function styleGaps(source: Token[], target: Token[], kind: Token["kind"]): FormatGap[] {
  const grouped = (list: Token[]) => {
    const map = new Map<string, Token[]>();
    for (const token of list) {
      if (token.kind !== kind) continue;
      const bucket = map.get(token.key) ?? [];
      bucket.push(token);
      map.set(token.key, bucket);
    }
    return map;
  };
  const from = grouped(source);
  const found: FormatGap[] = [];
  for (const [key, targetList] of grouped(target)) {
    const sourceList = from.get(key);
    if (!sourceList?.length) continue;
    const paired = Math.min(sourceList.length, targetList.length);
    const seen = new Map<string, number>();
    for (let index = 0; index < targetList.length; index += 1) {
      const token = targetList[index];
      const at = seen.get(token.raw) ?? 0;
      seen.set(token.raw, at + 1);
      if (index >= paired) continue;
      const note = faceNote(sourceList[index], token);
      if (note) found.push({ raw: token.raw, note, at });
    }
  }
  return found;
}

function worthStyle(text: string): boolean {
  const flat = text.trim();
  if (flat.length < 2) return false;
  if (/^[\d,，.]+$/.test(flat)) return false;
  if (/^[A-Za-z]{1,2}$/.test(flat)) return false;
  return /[A-Za-z\u3400-\u9FFF]/.test(flat);
}

function wordStyleGaps(sourceText: string, sourceFaces: Face[] | undefined, targetText: string, targetFaces: Face[] | undefined): FormatGap[] {
  const words = (text: string, faces?: Face[]) => {
    const list: Array<Face & { text: string }> = [];
    for (const match of text.matchAll(/\S+/g)) {
      const start = match.index ?? 0;
      const token = match[0];
      if (!worthStyle(token)) continue;
      list.push({ text: token, ...styleOf(faces, start, start + token.length) });
    }
    return list;
  };
  const pools = new Map<string, Face[]>();
  for (const word of words(sourceText, sourceFaces)) {
    const bucket = pools.get(word.text) ?? [];
    bucket.push(word);
    pools.set(word.text, bucket);
  }
  const seen = new Map<string, number>();
  const found: FormatGap[] = [];
  for (const word of words(targetText, targetFaces)) {
    const at = seen.get(word.text) ?? 0;
    seen.set(word.text, at + 1);
    const pool = pools.get(word.text);
    if (!pool?.length) continue;
    const key = styleKey(word);
    const matchAt = pool.findIndex((face) => styleKey(face) === key);
    if (matchAt >= 0) {
      pool.splice(matchAt, 1);
      continue;
    }
    const sourceFace = pool.shift();
    if (!sourceFace) continue;
    const note = faceNote(sourceFace, word);
    if (note) found.push({ raw: word.text, note, at });
  }
  return found;
}

type FontRecord = { bold?: boolean; italic?: boolean; black?: boolean };

const OPEN_BRACKETS = "([【〔";
const CLOSE_BRACKETS = ")]】〕";
const FULL_WIDTH_BRACKETS = /[（）［］【】〔〕]/;
const ANY_BRACKET = /[()[\]（）［］【】〔〕]/;

type PageText = { text: string; faces: Face[]; full: Set<number> };

async function readStyled(pdf: PdfDoc, pageNumber: number): Promise<PageText> {
  const page = await pdf.getPage(pageNumber);
  const content = await page.getTextContent();
  const objs = page.commonObjs;
  const cache = new Map<string, Face>();
  const faceOf = (fontName: string | undefined): Face => {
    if (!fontName) return { bold: false, italic: false };
    const cached = cache.get(fontName);
    if (cached) return cached;
    let face: Face = { bold: false, italic: false };
    try {
      const font = objs.get(fontName) as FontRecord;
      face = { bold: !!(font?.bold || font?.black), italic: !!font?.italic };
    } catch {
      face = { bold: false, italic: false };
    }
    cache.set(fontName, face);
    return face;
  };
  let text = "";
  const faces: Face[] = [];
  const fullAt = new Set<number>();
  const push = (piece: string, face: Face) => {
    text += piece;
    for (let index = 0; index < piece.length; index += 1) faces.push(face);
  };
  for (const item of content.items) {
    if (!("str" in item)) continue;
    const run = item as TextRun;
    const piece = tighten(run.str.normalize("NFKC"));
    const face = faceOf(run.fontName);
    if (!piece.trim()) {
      if (run.hasEOL) push("\n", { bold: false, italic: false });
      continue;
    }
    if (separate(text, piece)) push(" ", { bold: false, italic: false });
    // NFKC folds （ to (, so remember which brackets were full-width in the PDF.
    const widths = [...run.str].filter((char) => ANY_BRACKET.test(char)).map((char) => FULL_WIDTH_BRACKETS.test(char));
    let nth = 0;
    [...piece].forEach((char, offset) => {
      if (!ANY_BRACKET.test(char)) return;
      if (widths[nth]) fullAt.add(text.length + offset);
      nth += 1;
    });
    push(piece, face);
    if (run.hasEOL) push("\n", { bold: false, italic: false });
  }
  const folded = foldDigitSpaces(text);
  const finalText = blankFurniture(folded.text);
  const full = new Set<number>();
  folded.map.forEach((origin, index) => {
    if (fullAt.has(origin) && ANY_BRACKET.test(finalText[index] ?? "")) full.add(index);
  });
  return { text: finalText, faces: folded.map.map((index) => faces[index] ?? { bold: false, italic: false }), full };
}

function isMillionRaw(raw: string): boolean {
  return /million|百萬|百万|(?:^|[^A-Za-z])mn(?:$|[^A-Za-z])/i.test(raw);
}

function isBareCoefficient(raw: string): boolean {
  const body = raw.replace(/[()]/g, "").trim();
  if (/[,，%％]|million|billion|百萬|百万|十[亿億]|[亿億万萬]/i.test(body)) return false;
  return /^(?:HK\$|US\$|USD|HKD|RMB|CNY|EUR|GBP|[$£€¥])?\s*\d+(?:\.\d+)?$/.test(body);
}

/** A bracket problem on one page. raw is the bracket as it appears in the page text. */
export type BracketGap = { raw: string; note: string; at: number };

const SHOWN_OPEN = ["(", "[", "【", "〔"];
const SHOWN_CLOSE = [")", "]", "】", "〕"];
const FULL_OPEN = ["（", "［", "【", "〔"];
const FULL_CLOSE = ["）", "］", "】", "〕"];

function shown(char: string, full: boolean): string {
  const open = OPEN_BRACKETS.indexOf(char);
  if (open >= 0) return full ? FULL_OPEN[open] : SHOWN_OPEN[open];
  const close = CLOSE_BRACKETS.indexOf(char);
  return close >= 0 ? (full ? FULL_CLOSE[close] : SHOWN_CLOSE[close]) : char;
}

/** A pair of brackets this many characters apart or fewer is checked for full-width/half-width mixing. */
const WIDTH_REACH = 120;

/** A closing bracket that numbers a list item: "1)", "a)", "iv)". */
function listMarker(text: string, at: number): boolean {
  const lineStart = text.lastIndexOf("\n", at - 1) + 1;
  return /^\s*(?:\d{1,3}|[A-Za-z]|[ivxlc]{1,5}|[一二三四五六七八九十]{1,3})$/i.test(text.slice(lineStart, at));
}

/**
 * Scans the target document for brackets that are not closed, are closed by the wrong kind,
 * or mix full-width and half-width. Brackets may open on one page and close on the next.
 */
export function bracketIssues(pages: Map<number, { text: string; full: Set<number> }>): Map<number, BracketGap[]> {
  const found = new Map<number, BracketGap[]>();
  const stack: Array<{ page: number; char: string; full: boolean; at: number; index: number }> = [];
  const add = (page: number, char: string, at: number, note: string) => {
    const list = found.get(page) ?? [];
    list.push({ raw: char, note, at });
    found.set(page, list);
  };
  for (const page of [...pages.keys()].sort((a, b) => a - b)) {
    const { text, full } = pages.get(page) as { text: string; full: Set<number> };
    const seen = new Map<string, number>();
    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      const isOpen = OPEN_BRACKETS.includes(char);
      const isClose = CLOSE_BRACKETS.includes(char);
      if (!isOpen && !isClose) continue;
      const at = seen.get(char) ?? 0;
      seen.set(char, at + 1);
      const wide = full.has(index);
      if (isOpen) {
        stack.push({ page, char, full: wide, at, index });
        continue;
      }
      const kind = CLOSE_BRACKETS.indexOf(char);
      const top = stack.at(-1);
      if (!top || OPEN_BRACKETS.indexOf(top.char) !== kind) {
        if (listMarker(text, index)) continue;
        if (!top) {
          add(page, char, at, `Bracket: ${shown(char, wide)} has no opening bracket.`);
          continue;
        }
        // Close the nearest matching opener if there is one; otherwise this closer is stray.
        const match = stack.map((item) => OPEN_BRACKETS.indexOf(item.char)).lastIndexOf(kind);
        if (match < 0) {
          add(page, char, at, `Bracket: ${shown(char, wide)} does not match the open ${shown(top.char, top.full)}.`);
          continue;
        }
        for (const item of stack.splice(match + 1)) add(item.page, item.char, item.at, `Bracket: ${shown(item.char, item.full)} is not closed.`);
      }
      const open = stack.pop() as { page: number; char: string; full: boolean; at: number; index: number };
      // Only judge width when the pair sits together; far-apart pairs may be table cells read out of order.
      if (open.full !== wide && kind < 2 && open.page === page && index - open.index <= WIDTH_REACH) {
        add(page, char, at, `Bracket: ${shown(open.char, open.full)} is closed with ${open.full ? "half-width" : "full-width"} ${shown(char, wide)}.`);
      }
    }
  }
  for (const item of stack) add(item.page, item.char, item.at, `Bracket: ${shown(item.char, item.full)} is not closed.`);
  return found;
}

/** How many pages either side of the counterpart page a matching figure or date may sit. */
const PAGE_WINDOW = 1;

/** Maps a page in one document to its proportional counterpart in the other. */
function counterpart(page: number, from: number, to: number): number {
  if (to <= 1 || from <= 1) return Math.max(1, Math.min(page, to));
  return Math.max(1, Math.min(to, Math.round(((page - 1) * (to - 1)) / (from - 1)) + 1));
}

/** How far from the proportional page a page may be matched by its content. */
const ALIGN_REACH = 4;

type Align = { toTarget: (sourcePage: number) => number; toSource: (targetPage: number) => number };

function overlap(left: Token[], right: Token[]): number {
  const wanted = new Map<string, number>();
  for (const token of left) {
    const key = `${token.kind}:${token.key}`;
    wanted.set(key, (wanted.get(key) ?? 0) + 1);
  }
  let score = 0;
  for (const token of right) {
    const key = `${token.kind}:${token.key}`;
    const count = wanted.get(key) ?? 0;
    if (count > 0) {
      score += 1;
      wanted.set(key, count - 1);
    }
  }
  return score;
}

/**
 * Pages rarely line up one-to-one when the two files are laid out separately. Starting from the proportional
 * page, each target page moves to the nearby source page that shares the most figures and dates with it.
 */
function alignPages(sourceTokens: Map<number, Token[]>, targetTokens: Map<number, Token[]>, sourceCount: number, targetCount: number): Align {
  const chosen = new Map<number, number>();
  const scores = new Map<number, number>();
  for (let page = 1; page <= targetCount; page += 1) {
    const home = counterpart(page, targetCount, sourceCount);
    const mine = targetTokens.get(page) ?? [];
    let best = home;
    let bestScore = overlap(mine, sourceTokens.get(home) ?? []);
    for (let reach = 1; reach <= ALIGN_REACH; reach += 1) {
      for (const candidate of [home - reach, home + reach]) {
        if (candidate < 1 || candidate > sourceCount) continue;
        const score = overlap(mine, sourceTokens.get(candidate) ?? []);
        if (score > bestScore) {
          best = candidate;
          bestScore = score;
        }
      }
    }
    // Only move off the proportional page on solid evidence: two or more shared tokens covering half the page.
    if (best !== home && (bestScore < 2 || bestScore * 2 < mine.length)) {
      best = home;
      bestScore = overlap(mine, sourceTokens.get(home) ?? []);
    }
    chosen.set(page, best);
    scores.set(page, bestScore);
  }
  const back = new Map<number, number>();
  for (const [targetPage, sourcePage] of chosen) {
    const had = back.get(sourcePage);
    const home = counterpart(sourcePage, sourceCount, targetCount);
    const score = scores.get(targetPage) ?? 0;
    const hadScore = had === undefined ? -1 : (scores.get(had) ?? 0);
    if (score > hadScore || (score === hadScore && had !== undefined && Math.abs(targetPage - home) < Math.abs(had - home))) back.set(sourcePage, targetPage);
  }
  return {
    toSource: (page) => chosen.get(page) ?? counterpart(page, targetCount, sourceCount),
    toTarget: (page) => back.get(page) ?? counterpart(page, sourceCount, targetCount),
  };
}

type Slot = { page: number; token: Token; used: boolean };

function slotsOf(pages: Map<number, Token[]>, kind: Token["kind"]): Slot[] {
  const slots: Slot[] = [];
  for (const page of [...pages.keys()].sort((a, b) => a - b)) {
    for (const token of pages.get(page) ?? []) if (token.kind === kind) slots.push({ page, token, used: false });
  }
  return slots;
}

/** Other keys a figure may legitimately appear under: a bare coefficient and the same number in millions. */
function aliasesOf(token: Token): Array<{ key: string; accepts: (other: Token) => boolean }> {
  if (token.kind !== "figure") return [];
  const value = Number(token.key);
  if (!Number.isFinite(value) || value === 0) return [];
  const list: Array<{ key: string; accepts: (other: Token) => boolean }> = [];
  if (isBareCoefficient(token.raw)) {
    const key = canonicalNumber(value * 1e6);
    if (key) list.push({ key, accepts: (other) => isMillionRaw(other.raw) });
  }
  if (isMillionRaw(token.raw)) {
    const key = canonicalNumber(value / 1e6);
    if (key) list.push({ key, accepts: (other) => isBareCoefficient(other.raw) });
  }
  return list;
}

function hasBareNumber(text: string, number: string): boolean {
  return new RegExp(`(?:^|[^\\d.,，])${number}(?![\\d.,，])`).test(text);
}

/**
 * Pairs each source occurrence with one target occurrence of the same key on the counterpart page,
 * or failing that within PAGE_WINDOW pages. Every occurrence is used once, so a figure repeated on one
 * side only is reported, and a figure that only appears far away in the other document is not a match.
 */
function pairOccurrences(
  sourceTokens: Map<number, Token[]>,
  targetTokens: Map<number, Token[]>,
  sourceText: Map<number, { text: string }>,
  targetText: Map<number, { text: string }>,
  align: Align,
  kind: Token["kind"],
): { source: Map<number, SideGap[]>; target: Map<number, SideGap[]> } {
  const source = slotsOf(sourceTokens, kind);
  const target = slotsOf(targetTokens, kind);
  const byKey = new Map<string, Slot[]>();
  for (const slot of target) {
    const list = byKey.get(slot.token.key) ?? [];
    list.push(slot);
    byKey.set(slot.token.key, list);
  }
  for (let distance = 0; distance <= PAGE_WINDOW; distance += 1) {
    for (const exact of [true, false]) {
      for (const slot of source) {
        if (slot.used) continue;
        const home = align.toTarget(slot.page);
        const wanted = exact ? [{ key: slot.token.key, accepts: () => true }] : aliasesOf(slot.token);
        for (const want of wanted) {
          const hit = (byKey.get(want.key) ?? []).find(
            (other) => !other.used && Math.abs(other.page - home) === distance && want.accepts(other.token),
          );
          if (!hit) continue;
          slot.used = true;
          hit.used = true;
          break;
        }
      }
    }
  }
  // "12 months" may be written with a bare 12 (12個月) that is not itself a figure.
  const near = (texts: Map<number, { text: string }>, home: number) =>
    [...texts].some(([page, value]) => Math.abs(page - home) <= PAGE_WINDOW && hasBareNumber(value.text, "12"));
  for (const slot of source) {
    if (!slot.used && kind === "figure" && slot.token.key === "12") slot.used = near(targetText, align.toTarget(slot.page));
  }
  for (const slot of target) {
    if (!slot.used && kind === "figure" && slot.token.key === "12") slot.used = near(sourceText, align.toSource(slot.page));
  }
  // Chinese often states a repeated date once per sentence ("as at 30 June 2026 … as at 30 June 2026" becomes one
  // 於2026年6月30日), so a date is only reported when the other side has no such date nearby at all.
  if (kind === "date") {
    const present = (slots: Slot[], key: string, home: number) =>
      slots.some((other) => other.token.key === key && Math.abs(other.page - home) <= PAGE_WINDOW);
    for (const slot of source) if (!slot.used) slot.used = present(target, slot.token.key, align.toTarget(slot.page));
    for (const slot of target) if (!slot.used) slot.used = present(source, slot.token.key, align.toSource(slot.page));
  }
  const collect = (slots: Slot[], place: (page: number) => number) => {
    const found = new Map<number, SideGap[]>();
    for (const slot of slots) {
      if (slot.used) continue;
      const page = place(slot.page);
      const list = found.get(page) ?? [];
      const same = list.find((item) => item.raw === slot.token.raw);
      if (same) same.extra += 1;
      else list.push({ raw: slot.token.raw, extra: 1 });
      found.set(page, list);
    }
    return found;
  };
  return {
    // Source gaps are shown on the counterpart target page.
    source: collect(source, (page) => align.toTarget(page)),
    target: collect(target, (page) => page),
  };
}

/** Picks the source page whose figures and dates best match a target page, near its aligned page. */
function pairedSourcePage(
  targetPage: number,
  sourceTokens: Map<number, Token[]>,
  targetTokens: Map<number, Token[]>,
  sourceCount: number,
  align: Align,
): number | null {
  if (!sourceCount) return null;
  const home = align.toSource(targetPage);
  const mine = targetTokens.get(targetPage) ?? [];
  let best = home;
  let bestScore = -1;
  for (let page = home - PAGE_WINDOW; page <= home + PAGE_WINDOW; page += 1) {
    if (page < 1 || page > sourceCount) continue;
    const score = overlap(mine, sourceTokens.get(page) ?? []);
    if (score > bestScore || (score === bestScore && Math.abs(page - home) < Math.abs(best - home))) {
      best = page;
      bestScore = score;
    }
  }
  return best;
}

export async function checkBilingual(source: PdfDoc, target: PdfDoc): Promise<PairCheck[]> {
  const count = Math.max(source.numPages, target.numPages);
  const pages = Array.from({ length: count }, (_, index) => index + 1);
  const sourceText = new Map<number, PageText>();
  const targetText = new Map<number, PageText>();
  await Promise.all([
    ...pages.filter((page) => page <= source.numPages).map(async (page) => {
      sourceText.set(page, await readStyled(source, page));
    }),
    ...pages.filter((page) => page <= target.numPages).map(async (page) => {
      targetText.set(page, await readStyled(target, page));
    }),
  ]);
  const sourceTokens = new Map<number, Token[]>();
  const targetTokens = new Map<number, Token[]>();
  for (const [page, value] of sourceText) sourceTokens.set(page, tokensIn(value.text, value.faces));
  for (const [page, value] of targetText) targetTokens.set(page, tokensIn(value.text, value.faces));
  const align = alignPages(sourceTokens, targetTokens, source.numPages, target.numPages);
  const sides = [sourceTokens, targetTokens, sourceText, targetText, align] as const;
  const dates = pairOccurrences(...sides, "date");
  const figures = pairOccurrences(...sides, "figure");
  const brackets = bracketIssues(targetText);
  return pages.map((page) => {
    const targetPage = page <= target.numPages ? page : null;
    const sourcePage = targetPage
      ? pairedSourcePage(page, sourceTokens, targetTokens, source.numPages, align)
      : page <= source.numPages
        ? page
        : null;
    const formats =
      sourcePage && targetPage
        ? compareSides(
            sourceText.get(sourcePage)?.text ?? "",
            targetText.get(targetPage)?.text ?? "",
            sourceText.get(sourcePage)?.faces,
            targetText.get(targetPage)?.faces,
          ).formats
        : [];
    const bracketGaps = targetPage ? [...(brackets.get(targetPage) ?? [])] : [];
    return {
      page,
      sourcePage,
      targetPage,
      datesSource: targetPage ? (dates.source.get(page) ?? []) : [],
      datesTarget: targetPage ? (dates.target.get(page) ?? []) : [],
      figuresSource: targetPage ? (figures.source.get(page) ?? []) : [],
      figuresTarget: targetPage ? (figures.target.get(page) ?? []) : [],
      formats,
      brackets: bracketGaps,
    };
  });
}

type TextRun = {
  str: string;
  transform: number[];
  width: number;
  height: number;
  hasEOL?: boolean;
  fontName?: string;
};

type Span = { start: number; end: number; x: number; y: number; w: number; h: number };

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function expand(list: SideGap[]): string[] {
  const raws: string[] = [];
  for (const item of list) {
    const times = Math.max(1, Math.round(item.extra));
    for (let index = 0; index < times; index += 1) raws.push(item.raw);
  }
  return raws;
}

async function pageLayout(pdf: PdfDoc, pageNumber: number): Promise<{ text: string; spans: Span[]; width: number; height: number }> {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  let text = "";
  const spans: Span[] = [];
  for (const item of content.items) {
    if (!("str" in item)) continue;
    const run = item as TextRun;
    const piece = tighten(run.str.normalize("NFKC"));
    if (!piece.trim()) {
      if (run.hasEOL) text += "\n";
      continue;
    }
    if (separate(text, piece)) text += " ";
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
  const folded = foldDigitSpaces(text);
  const spansOut = spans.flatMap((span) => {
    let start = -1;
    let end = -1;
    folded.map.forEach((origin, index) => {
      if (origin < span.start || origin >= span.end) return;
      if (start < 0) start = index;
      end = index + 1;
    });
    if (start < 0) return [];
    return [{ ...span, start, end }];
  });
  return { text: blankFurniture(folded.text), spans: spansOut, width: viewport.width, height: viewport.height };
}

function locate(text: string, spans: Span[], raw: string): Quad[][] {
  const parts = raw.normalize("NFKC").trim().split(/\s+/).filter(Boolean).map(escapeRegExp);
  if (!parts.length) return [];
  const found: Quad[][] = [];
  for (const match of text.matchAll(new RegExp(parts.join("\\s+"), "g"))) {
    const at = match.index ?? 0;
    const end = at + match[0].length;
    const quads: Quad[] = [];
    for (const span of spans) {
      if (span.end <= at || span.start >= end || span.w <= 0) continue;
      const spanLength = Math.max(1, span.end - span.start);
      const overlapStart = Math.max(at, span.start);
      const overlapEnd = Math.min(end, span.end);
      const startRatio = (overlapStart - span.start) / spanLength;
      const endRatio = (overlapEnd - span.start) / spanLength;
      const w = span.w * (endRatio - startRatio);
      if (w < 0.2) continue;
      quads.push({ x: span.x + span.w * startRatio, y: span.y, w, h: span.h });
    }
    if (quads.length) found.push(quads);
  }
  return found;
}

function figureId(): string {
  return `figure-${crypto.randomUUID()}`;
}

function markText(page: number, quads: Quad[], quote: string, note: string, ink: "brass" | "steel", label: "number" | "style", kind: "highlight" | "underline"): Mark {
  return {
    id: figureId(),
    page,
    kind,
    pass: 1,
    ink,
    label,
    note,
    quote,
    quads,
    createdAt: Date.now(),
  };
}

function callout(page: number, note: string, box: Quad, tip: { x: number; y: number }, ink: "brass" | "steel", label: "number" | "style"): Mark {
  return {
    id: figureId(),
    page,
    kind: "callout",
    pass: 1,
    ink,
    label,
    note,
    quote: note,
    quads: [box],
    to: tip,
    createdAt: Date.now(),
  };
}

function placeCallout(
  page: number,
  note: string,
  anchor: Quad | null,
  width: number,
  height: number,
  stack: number,
  ink: "brass" | "steel" = "brass",
  label: "number" | "style" = "number",
): Mark {
  const boxW = 210;
  const boxH = 36;
  if (anchor) {
    let x = anchor.x;
    let y = anchor.y + anchor.h + 8 + stack * 40;
    if (y + boxH > height - 12) y = Math.max(12, anchor.y - boxH - 8 - stack * 40);
    if (x + boxW > width - 12) x = Math.max(12, width - boxW - 12);
    return callout(page, note, { x, y, w: boxW, h: boxH }, { x: anchor.x + anchor.w / 2, y: anchor.y + anchor.h / 2 }, ink, label);
  }
  const y = Math.max(36, height - 56 - stack * 44);
  return callout(page, note, { x: 36, y, w: boxW, h: boxH }, { x: 48, y: y - 10 }, ink, label);
}

/** Marks the discrepant wording on the target. A callout is used only when that wording is not on the page. */
export async function marksOnTarget(target: PdfDoc, pairs: PairCheck[]): Promise<Mark[]> {
  const marks: Mark[] = [];
  for (const pair of pairs) {
    if (marks.length >= 200) break;
    if (pair.targetPage === null) continue;
    const layout = await pageLayout(target, pair.targetPage);
    const cache = new Map<string, Quad[][]>();
    const used = new Map<string, number>();
    const take = (raw: string): Quad[] | null => {
      const found = cache.get(raw) ?? locate(layout.text, layout.spans, raw);
      if (!cache.has(raw)) cache.set(raw, found);
      const index = used.get(raw) ?? 0;
      used.set(raw, index + 1);
      return found[index] ?? null;
    };
    let stack = 0;
    const add = (kind: "Date" | "Figure", sourceRaws: string[], targetRaws: string[]) => {
      const paired = Math.min(sourceRaws.length, targetRaws.length);
      for (let index = 0; index < targetRaws.length; index += 1) {
        if (marks.length >= 200) return;
        const raw = targetRaws[index];
        const note = index < paired ? `Source ${kind.toLowerCase()}: ${sourceRaws[index]}` : "Not on the source.";
        const quads = take(raw);
        if (quads) marks.push(markText(pair.targetPage as number, quads, raw, note, "brass", "number", "highlight"));
        else marks.push(placeCallout(pair.targetPage as number, `Target ${kind.toLowerCase()}: ${raw}. ${note}`, null, layout.width, layout.height, stack));
        stack += 1;
      }
      for (let index = paired; index < sourceRaws.length; index += 1) {
        if (marks.length >= 200) return;
        marks.push(
          placeCallout(
            pair.targetPage as number,
            `Source ${kind.toLowerCase()}: ${sourceRaws[index]}`,
            null,
            layout.width,
            layout.height,
            stack,
          ),
        );
        stack += 1;
      }
    };
    add("Date", expand(pair.datesSource), expand(pair.datesTarget));
    add("Figure", expand(pair.figuresSource), expand(pair.figuresTarget));
    for (const item of pair.brackets ?? []) {
      if (marks.length >= 200) break;
      const found = item.raw ? (cache.get(item.raw) ?? locate(layout.text, layout.spans, item.raw)) : [];
      if (item.raw && !cache.has(item.raw)) cache.set(item.raw, found);
      const quads = found[item.at] ?? null;
      if (quads) marks.push(markText(pair.targetPage, quads, item.raw, item.note, "steel", "style", "highlight"));
      else marks.push(placeCallout(pair.targetPage, item.note, null, layout.width, layout.height, stack, "steel", "style"));
      stack += 1;
    }
    for (const item of pair.formats) {
      if (marks.length >= 200) break;
      const found = cache.get(item.raw) ?? locate(layout.text, layout.spans, item.raw);
      if (!cache.has(item.raw)) cache.set(item.raw, found);
      const quads = found[item.at] ?? null;
      if (quads) marks.push(markText(pair.targetPage, quads, item.raw, item.note, "steel", "style", "underline"));
      else marks.push(placeCallout(pair.targetPage, `${item.raw}. ${item.note}`, null, layout.width, layout.height, stack, "steel", "style"));
      stack += 1;
    }
  }
  return marks;
}


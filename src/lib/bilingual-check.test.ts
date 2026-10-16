import { test } from "node:test";
import assert from "node:assert/strict";
import { checkBilingual, compareSides } from "./bilingual-check.ts";

/** Lists every flagged figure and date on one source/target page pair. */
function flags(en: string, tc: string): string[] {
  const result = compareSides(en, tc);
  return [
    ...result.datesSource.map((gap) => `EN date ${gap.raw}`),
    ...result.datesTarget.map((gap) => `TC date ${gap.raw}`),
    ...result.figuresSource.map((gap) => `EN figure ${gap.raw}`),
    ...result.figuresTarget.map((gap) => `TC figure ${gap.raw}`),
  ];
}

const clean: Array<[string, string, string]> = [
  ["Arabic full date", "as at 31 December 2025", "於2025年12月31日"],
  ["Chinese-numeral date", "as at 31 December 2025", "於二零二五年十二月三十一日"],
  ["〇 Chinese-numeral date", "on 30 June 2026", "於二〇二六年六月三十日"],
  ["month-year", "in December 2025", "於2025年12月"],
  ["Chinese-numeral month-year", "in December 2025", "於二零二五年十二月"],
  ["same-month range", "from 1 to 31 December 2025", "2025年12月1日至31日"],
  ["hyphen range", "1–31 December 2025", "2025年12月1日至31日"],
  ["cross-month range", "1 November to 31 December 2025", "2025年11月1日至12月31日"],
  ["year-end crossing range", "1 December 2025 to 31 January 2026", "2025年12月1日至2026年1月31日"],
  ["US-style range", "December 1 to 31, 2025", "2025年12月1日至31日"],
  ["month range", "January to June 2025", "2025年1月至6月"],
  ["year only", "2025 annual results", "2025年度業績"],
  ["Chinese-numeral year", "2025 Interim Report", "二零二五年中期報告"],
  ["fiscal year", "for 2024/25", "2024/25年度"],
  ["December is not twelve months", "in December", "於十二月"],
  ["twelve months", "the 12-month period", "十二個月期間"],
  ["HK$ million vs 億", "HK$1,234.5 million", "12.345億港元"],
  ["RMB billion vs 億", "RMB2.5 billion", "人民幣25億元"],
  ["thousand", "HK$5 thousand", "5千港元"],
  ["small amount with currency", "HK$50", "50港元"],
  ["small amount with 元", "a fee of HK$8", "費用港幣8元"],
  ["HK$2,000 is an amount", "HK$2,000", "2,000港元"],
  ["per cent", "12.5 per cent", "12.5%"],
  ["percent", "12.5 percent", "12.5%"],
  ["Chinese-numeral percent", "12.5%", "百分之十二點五"],
  ["Arabic 百分之", "12.5%", "百分之12.5"],
  ["percentage points", "up 2.5 percentage points", "上升2.5個百分點"],
  ["simplified percentage points", "up 2.5 percentage points", "上升2.5个百分点"],
  ["cents vs 港仙", "8.5 HK cents per share", "每股8.5港仙"],
  ["cents vs 仙", "8.5 cents", "8.5仙"],
  ["bracket negatives", "loss of (1,234)", "虧損(1,234)"],
  ["full-width bracket negatives", "(1,234)", "（1,234）"],
  ["minus vs bracket", "loss of (1,234)", "虧損-1,234"],
  ["minus after Chinese", "-3.5%", "下跌-3.5%"],
  ["comparative in brackets", "(2024: HK$1,234 million)", "（2024年：12.34億港元）"],
  ["hyphenated codes are not negative", "COVID-19 code ABC-123", "COVID-19 代碼ABC-123"],
  ["page range", "pages 110-112", "第110-112頁"],
  ["year range", "2024-2025", "2024-2025年"],
  ["lower-case may is not a month", "the Company may 2025", "本公司2025"],
  ["rule reference", "Rule 13.51(2)", "第13.51(2)條"],
  ["section reference", "paragraph 1.2.3", "第1.2.3段"],
];

for (const [name, en, tc] of clean) {
  test(`clean: ${name}`, () => assert.deepEqual(flags(en, tc), []));
}

const caught: Array<[string, string, string, string[]]> = [
  ["wrong year", "2025 annual results", "2024年度業績", ["EN date 2025", "TC date 2024"]],
  ["wrong Chinese-numeral day", "31 December 2025", "二零二五年十二月三十日", ["EN date 31 December 2025", "TC date 二零二五年十二月三十日"]],
  ["wrong month-year", "December 2025", "2025年11月", ["EN date December 2025", "TC date 2025年11月"]],
  ["wrong range end", "1 to 31 December 2025", "2025年12月1日至30日", ["EN date 1 to 31 December 2025", "TC date 2025年12月1日至30日"]],
  ["sign flip", "-3.5%", "3.5%", ["EN figure -3.5%", "TC figure 3.5%"]],
  ["bracket negative vs positive", "loss of (1,234)", "虧損1,234", ["EN figure (1,234)", "TC figure 1,234"]],
  ["small amount", "HK$50", "80港元", ["EN figure HK$50", "TC figure 80"]],
  ["amount in year range", "HK$2,000", "3,000港元", ["EN figure HK$2,000", "TC figure 3,000"]],
  ["share count in year range", "2,025 shares", "2,026股", ["EN figure 2,025", "TC figure 2,026"]],
  ["per cent vs percentage points", "up 2.5 per cent", "上升2.5個百分點", ["EN figure 2.5 per cent", "TC figure 2.5個百分點"]],
  ["wrong cents", "8.5 cents", "8.6港仙", ["EN figure 8.5 cents", "TC figure 8.6港仙"]],
  ["wrong Chinese-numeral percent", "12.5%", "百分之十二點六", ["EN figure 12.5%", "TC figure 百分之十二點六"]],
  ["repeated on one side", "HK$1,500 and HK$1,500", "1,500港元", ["EN figure HK$1,500"]],
];

for (const [name, en, tc, expected] of caught) {
  test(`caught: ${name}`, () => assert.deepEqual(flags(en, tc), expected));
}

type Run = { str: string; bold?: boolean };

/** A minimal stand-in for a pdf.js document: one text run per line. */
function doc(pages: Array<string | Run[]>) {
  return {
    numPages: pages.length,
    getPage: async (number: number) => {
      const page = pages[number - 1];
      const runs: Run[] = typeof page === "string" ? page.split("\n").map((str) => ({ str })) : page;
      return {
        getTextContent: async () => ({
          items: runs.map((run) => ({ str: run.str, hasEOL: true, transform: [1, 0, 0, 1, 0, 0], width: 10, height: 10, fontName: run.bold ? "B" : "R" })),
        }),
        commonObjs: { get: (name: string) => ({ bold: name === "B" }) },
        getViewport: () => ({ width: 595, height: 842 }),
      };
    },
  } as never;
}

async function documentFlags(en: Array<string | Run[]>, tc: Array<string | Run[]>): Promise<string[]> {
  const pairs = await checkBilingual(doc(en), doc(tc));
  return pairs.flatMap((pair) => [
    ...pair.datesSource.map((gap) => `p${pair.page} EN date ${gap.raw}×${gap.extra}`),
    ...pair.datesTarget.map((gap) => `p${pair.page} TC date ${gap.raw}×${gap.extra}`),
    ...pair.figuresSource.map((gap) => `p${pair.page} EN figure ${gap.raw}×${gap.extra}`),
    ...pair.figuresTarget.map((gap) => `p${pair.page} TC figure ${gap.raw}×${gap.extra}`),
    ...pair.formats.map((gap) => `p${pair.page} style ${gap.raw}`),
  ]);
}

test("document: a figure repeated in the source but once in the target is reported", async () => {
  assert.deepEqual(await documentFlags(["Revenue HK$1,500", "Cost HK$1,500"], ["收益1,500港元", "成本"]), ["p2 EN figure HK$1,500×1"]);
});

test("document: a figure missing from its page is not matched far away", async () => {
  assert.deepEqual(await documentFlags(["Revenue HK$9,876", "Note", "Other"], ["收益", "附註", "其他9,876港元"]), [
    "p1 EN figure HK$9,876×1",
    "p3 TC figure 9,876×1",
  ]);
});

test("document: a figure that reflowed onto the next page still matches", async () => {
  assert.deepEqual(await documentFlags(["Revenue HK$9,876", "Note", "Other"], ["收益", "9,876港元", "其他"]), []);
});

test("document: extra source pages map proportionally instead of piling onto page 1", async () => {
  const en = ["a HK$1,111", "b", "c", "d", "e HK$5,555"];
  const tc = ["a 1,111港元", "b", "c"];
  assert.deepEqual(await documentFlags(en, tc), ["p3 EN figure HK$5,555×1"]);
});

test("document: the 12-month bare-number rule still applies", async () => {
  assert.deepEqual(await documentFlags(["for the 12-month period"], ["12個月期間"]), []);
});

test("document: style is compared with the best-matching source page", async () => {
  const en: Run[][] = [
    [{ str: "Cover" }],
    [{ str: "Revenue HK$1,234 million", bold: true }],
    [{ str: "Profit HK$567 million" }],
  ];
  const tc: Run[][] = [
    [{ str: "收益12.34億港元", bold: true }],
    [{ str: "溢利5.67億港元" }],
    [{ str: "封底" }],
  ];
  const pairs = await checkBilingual(doc(en), doc(tc));
  assert.equal(pairs[0].sourcePage, 2);
  assert.equal(pairs[1].sourcePage, 3);
  assert.deepEqual(pairs.flatMap((pair) => pair.formats), []);
});

async function bracketNotes(en: Array<string | Run[]>, tc: Array<string | Run[]>): Promise<string[]> {
  const pairs = await checkBilingual(doc(en), doc(tc));
  return pairs.flatMap((pair) => pair.brackets.map((gap) => `p${pair.page} ${gap.raw || "-"}#${gap.at} ${gap.note}`));
}

test("brackets: balanced pairs on both sides are clean", async () => {
  assert.deepEqual(await bracketNotes(['the Company ("Company") (a) [1]'], ["本公司（「本公司」）（a）［1］"]), []);
});

test("brackets: an unclosed target bracket is marked", async () => {
  assert.deepEqual(await bracketNotes(["(a) and (b)"], ["（a）及（b"]), ["p1 (#1 Bracket: （ is not closed."]);
});

test("brackets: a stray closing bracket is marked", async () => {
  assert.deepEqual(await bracketNotes(["(a) b"], ["（a）b）"]), ["p1 )#1 Bracket: ） has no opening bracket."]);
});

test("brackets: the wrong kind of closing bracket is marked", async () => {
  assert.deepEqual(await bracketNotes(["(a)"], ["（a］"]), [
    "p1 ]#0 Bracket: ］ does not match the open （.",
    "p1 (#0 Bracket: （ is not closed.",
  ]);
});

test("brackets: mixing full-width and half-width is marked", async () => {
  assert.deepEqual(await bracketNotes(["(a)"], ["（a)"]), ["p1 )#0 Bracket: （ is closed with half-width )."]);
});

test("brackets: a bracket may close on the next page", async () => {
  assert.deepEqual(await bracketNotes(["(continued", "here)"], ["（續", "此處）"]), []);
});

test("brackets: list markers such as 1) and a) are not stray", async () => {
  assert.deepEqual(await bracketNotes(["1) first\na) second"], ["1) 第一\na) 第二"]), []);
});

test("brackets: a different number of brackets from the source is not flagged", async () => {
  assert.deepEqual(await bracketNotes(['Mr. Wong (黃自強) ("Mr. Wong")'], ["黃先生(「黃先生」)"]), []);
});

test("brackets: a far-apart pair is not judged for width", async () => {
  const gap = "，".repeat(200);
  assert.deepEqual(await bracketNotes(["(a)"], [`（a${gap})`]), []);
});

test("brackets: bracket marks land on the target bracket", async () => {
  const { marksOnTarget } = await import("./bilingual-check.ts");
  const target = doc(["（a）及（b"]);
  const pairs = await checkBilingual(doc(["(a) and (b)"]), target);
  const marks = await marksOnTarget(target, pairs);
  assert.equal(marks.length, 1);
  assert.equal(marks[0].kind, "highlight");
  assert.equal(marks[0].quote, "(");
  assert.equal(marks[0].note, "Bracket: （ is not closed.");
});

test("a column-heading % on the next line is not joined to the year above it", () => {
  assert.deepEqual(flags("2026\n2025\n%\n%\n", "2026年\n2025年\n%\n%\n"), []);
});

test("pages that sit a few pages off proportion are matched by content", async () => {
  const filler = (n: number) => Array.from({ length: n }, (_, index) => `Page ${index + 1}`);
  const en = [...filler(7), "joined in August 1995 and left in June 1997", ...filler(2)];
  const tc = [...filler(4), "於1995年8月加入，於1997年6月離開", ...filler(5)];
  const pairs = await checkBilingual(doc(en), doc(tc));
  const flagged = pairs.flatMap((p) => [...p.datesSource, ...p.datesTarget]);
  assert.deepEqual(flagged, []);
});

test("a date that is on no nearby page is still reported", async () => {
  const filler = (n: number) => Array.from({ length: n }, (_, index) => `Page ${index + 1}`);
  const en = [...filler(9), "joined in August 1995"];
  const tc = [...filler(4), "於1996年8月加入", ...filler(5)];
  const pairs = await checkBilingual(doc(en), doc(tc));
  assert.equal(pairs.flatMap((p) => [...p.datesSource, ...p.datesTarget]).length, 2);
});

test("figures: a bracketed count or year is not read as a negative amount", () => {
  assert.deepEqual(flags("not longer than ten (10) years and twelve (12) months", "不得超過十（10）年及十二（12）個月"), []);
  assert.deepEqual(flags("the Greenhouse Gas Protocol (2004).", "溫室氣體盤查議定書（2004年）計算。"), []);
  assert.deepEqual(flags("a loss of HK$(1,500)", "虧損(1,500)港元"), []);
});

test("figures: a line-opening dash bullet is not a minus sign", () => {
  assert.deepEqual(flags("to be recognised:\n– 2026 N/A 82,254\n– 2027 84,589", "確認為收入：\n－ 2026年 不適用 82,254\n－ 2027年 84,589"), []);
});

test("figures: 千 in a unit such as 千瓦時 is not a thousand", () => {
  assert.deepEqual(flags("Petrol 1 kWh 6,978", "汽油1 千瓦時 6,978"), []);
});

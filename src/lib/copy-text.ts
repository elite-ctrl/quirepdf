const CJK = /[\u3400-\u9FFF\uF900-\uFAFF\u3040-\u30FF\uAC00-\uD7AF\u3000-\u303F\uFF00-\uFFEF]/;

/** Join visual line breaks from a PDF selection. A blank line stays a break. Chinese joins without a space. */
export function joinCopiedLines(text: string): string {
  const flat = text.replace(/\r\n/g, "\n").replace(/\u00ad/g, "");
  return flat.replace(/[ \t]*\n+[ \t]*/g, (gap, index, all) => {
    if (gap.split("\n").length > 2) return "\n";
    const before = all[index - 1] ?? "";
    const after = all[index + gap.length] ?? "";
    if (CJK.test(before) && CJK.test(after)) return "";
    return " ";
  });
}

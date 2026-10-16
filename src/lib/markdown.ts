import { kindName, labelName, sortMarks, type Mark } from "@/lib/marks";

export function marksToMarkdown(fileName: string, marks: Mark[]): string {
  const sorted = sortMarks(marks);
  const when = new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
  const lines = [
    `# Faircopy notes — ${fileName}`,
    "",
    `${sorted.length} mark${sorted.length === 1 ? "" : "s"} · ${when}`,
    "",
    "The PDF stayed in the browser. This sheet is the comment list only.",
    "",
  ];
  if (!sorted.length) {
    lines.push("No marks.");
    return lines.join("\n");
  }
  for (const mark of sorted) {
    lines.push(`## Page ${mark.page} · ${kindName(mark.kind)} · ${labelName(mark.label)}`);
    lines.push("");
    if (mark.quote.trim()) {
      lines.push(`> ${mark.quote.trim().replaceAll("\n", "\n> ")}`);
      lines.push("");
    }
    lines.push(mark.note.trim() || "_No note._");
    lines.push("");
    lines.push("---");
    lines.push("");
  }
  return lines.join("\n");
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function safeStem(name: string): string {
  const stem = name.replace(/\.pdf$/i, "").replace(/[\\/:*?"<>|]+/g, " ").trim();
  return (stem || "document").slice(0, 80);
}

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const ink = rgb(0.11, 0.09, 0.07);
const quiet = rgb(0.33, 0.3, 0.26);
const brass = rgb(141 / 255, 90 / 255, 43 / 255);

export async function buildSamplePdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const left = 56;

  const first = doc.addPage([595.28, 841.89]);
  first.drawText("QUORUM HOLDINGS LIMITED", { x: left, y: 780, size: 14, font: bold, color: ink });
  first.drawLine({ start: { x: left, y: 770 }, end: { x: 250, y: 770 }, thickness: 1.6, color: brass });
  first.drawText("(Incorporated in the Cayman Islands with limited liability)", {
    x: left,
    y: 750,
    size: 10,
    font,
    color: quiet,
  });
  first.drawText("(Stock Code: 0000)", { x: left, y: 736, size: 10, font, color: quiet });
  first.drawText("INTERIM RESULTS ANNOUNCEMENT", { x: left, y: 696, size: 13, font: bold, color: ink });
  first.drawText("FOR THE SIX MONTHS ENDED 30 JUNE 2026", { x: left, y: 678, size: 11, font: bold, color: ink });

  const pageOne = [
    [640, 'The board of directors (the "Board") of Quorum Holdings Limited'],
    [624, '(the "Company") announces the unaudited consolidated results of'],
    [608, 'the Company and its subsidiaries (the "Group") for the six months'],
    [592, "ended 30 June 2026, together with the comparative figures for 2025."],
    [560, "Revenue was HK$1,284 million, an increase of 18.4% compared with"],
    [544, "HK$1,086 million for the same period in 2025. Profit attributable"],
    [528, "to owners of the Company fell to HK$146 million (2025: HK$163 million)."],
    [496, "The Board does not recommend an interim dividend (2025: HK2.5 cents)."],
  ] as const;
  for (const [y, text] of pageOne) first.drawText(text, { x: left, y, size: 11, font, color: ink });

  const second = doc.addPage([595.28, 841.89]);
  second.drawText("QUORUM HOLDINGS LIMITED", { x: left, y: 780, size: 11, font: bold, color: ink });
  second.drawText("Interim results announcement (continued)", { x: left, y: 762, size: 10, font, color: quiet });
  const pageTwo = [
    [720, "The rise in revenue came mainly from the property management segment."],
    [704, "Administrative expenses were HK$210 million (2025: HK$168 million),"],
    [688, "driven by staff costs. Cash and bank balances stood at HK$890 million"],
    [672, "(31 December 2025: HK$742 million)."],
    [640, "The current ratio was 1.8 times, against 2.1 times at the last year end."],
    [624, "No material change has occurred since 30 June 2026 that would require"],
    [608, "disclosure under the Listing Rules."],
    [560, "By order of the Board"],
    [544, "Quorum Holdings Limited"],
    [520, "Ada Chen"],
    [506, "Company Secretary"],
    [476, "Hong Kong, 28 August 2026"],
  ] as const;
  for (const [y, text] of pageTwo) {
    const face = y === 520 || y === 544 ? bold : font;
    second.drawText(text, { x: left, y, size: 11, font: face, color: ink });
  }

  return doc.save();
}

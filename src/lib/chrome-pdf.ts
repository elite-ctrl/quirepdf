export type ChromePdf = { name: string; bytes: Uint8Array };

type StreamInfo = {
  originalUrl?: string;
  streamUrl?: string;
  mimeType?: string;
};

type MimeHandlerApi = {
  getStreamInfo?: () => Promise<StreamInfo>;
  abortAndFallbackToNativeHandler?: () => void | Promise<void>;
};

function mimeHandler(): MimeHandlerApi | null {
  const host = globalThis as {
    chrome?: { mimeHandler?: MimeHandlerApi };
    browser?: { mimeHandler?: MimeHandlerApi };
  };
  return host.chrome?.mimeHandler ?? host.browser?.mimeHandler ?? null;
}

export function chromeMimeAvailable(): boolean {
  const path = typeof location === "undefined" ? "" : location.pathname;
  if (!path.endsWith("/viewer.html") && !path.endsWith("viewer.html")) return false;
  return !!mimeHandler()?.getStreamInfo;
}

function nameFrom(url: string | undefined): string {
  if (!url) return "Opened.pdf";
  try {
    const last = decodeURIComponent(new URL(url).pathname.split("/").pop() || "");
    if (last.toLowerCase().endsWith(".pdf")) return last;
  } catch {
    /* a file address with no path */
  }
  return "Opened.pdf";
}

let reading: Promise<ChromePdf | null> | null = null;

/** The PDF Chrome handed this page, if this tab replaced the built-in viewer. */
export function fetchChromePdf(): Promise<ChromePdf | null> {
  if (!reading) reading = readChromePdf();
  return reading;
}

async function readChromePdf(): Promise<ChromePdf | null> {
  const handler = mimeHandler();
  if (!handler?.getStreamInfo) return null;
  try {
    const info = await handler.getStreamInfo();
    if (!info?.streamUrl) return null;
    const response = await fetch(info.streamUrl);
    if (!response.ok) return null;
    return { name: nameFrom(info.originalUrl), bytes: new Uint8Array(await response.arrayBuffer()) };
  } catch {
    return null;
  }
}

export function fallbackToChromeViewer(): void {
  const handler = mimeHandler();
  if (!handler?.abortAndFallbackToNativeHandler) return;
  try {
    void handler.abortAndFallbackToNativeHandler();
  } catch {
    /* Chrome already left this page */
  }
}

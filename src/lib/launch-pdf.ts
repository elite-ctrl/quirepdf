export type LaunchedPdf = { name: string; token: string; bytes: Uint8Array };

let claimed = "";

export async function fetchLaunchedPdf(): Promise<LaunchedPdf | null> {
  if (typeof window === "undefined" || window.location.hash !== "#launch") return null;
  try {
    const info = await fetch("/__quire/launch.json", { cache: "no-store" });
    if (!info.ok) return null;
    const data = (await info.json()) as { name?: unknown; token?: unknown };
    const name = typeof data.name === "string" ? data.name : "";
    const token = data.token == null ? "" : String(data.token);
    if (!name || !token || claimed === token) return null;
    claimed = token;
    const pdf = await fetch("/__quire/launch.pdf", { cache: "no-store" });
    if (!pdf.ok) return null;
    return { name, token, bytes: new Uint8Array(await pdf.arrayBuffer()) };
  } catch {
    return null;
  }
}

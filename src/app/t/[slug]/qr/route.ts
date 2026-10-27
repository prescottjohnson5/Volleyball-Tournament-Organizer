import QRCode from "qrcode";
import { getAppUrl } from "@/lib/env";
import { jsonError } from "@/lib/http";

type Context = { params: Promise<{ slug: string }> };

/**
 * PNG QR code pointing at the tournament's registration page. Add ?download=1 to download it.
 * Needs no database access: it only encodes a URL, and an unknown slug just leads to a 404 page.
 */
export async function GET(request: Request, { params }: Context) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{3,80}$/.test(slug)) return jsonError(404, "Unknown tournament.");

  const url = new URL(request.url);
  const registrationUrl = `${getAppUrl(url.origin)}/t/${slug}/register`;
  const png = await QRCode.toBuffer(registrationUrl, { type: "png", width: 600, margin: 2, errorCorrectionLevel: "M" });

  const headers: Record<string, string> = {
    "Content-Type": "image/png",
    "Cache-Control": "public, max-age=3600",
  };
  if (url.searchParams.get("download")) {
    headers["Content-Disposition"] = `attachment; filename="${slug}-registration-qr.png"`;
  }
  return new Response(new Uint8Array(png), { headers });
}

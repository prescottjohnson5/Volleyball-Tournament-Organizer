import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const alt = "Volleyball Tournament Organizer: run your volleyball tournament from your phone";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Social preview image, rendered once at build time. Uses no external fonts or emoji. */
export default async function OpenGraphImage() {
  const icon = await readFile(path.join(process.cwd(), "src/app/icon.svg"), "utf8");
  const iconSrc = `data:image/svg+xml;base64,${Buffer.from(icon).toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #0d0b61 0%, #0d0b61 45%, #294669 100%)",
          color: "white",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- next/og renders plain img elements */}
          <img src={iconSrc} width={96} height={96} alt="" />
          <div style={{ fontSize: 36, color: "#e4d329" }}>Volleyball Tournament Organizer</div>
        </div>
        <div style={{ display: "flex", marginTop: 56, fontSize: 64, lineHeight: 1.2, maxWidth: 1040 }}>
          Run your volleyball tournament from your phone.
        </div>
        <div style={{ display: "flex", marginTop: 40, fontSize: 32, lineHeight: 1.35, color: "#c9cce6", maxWidth: 1040 }}>
          Team sign-up, automatic pools and brackets, live scores for everyone.
        </div>
      </div>
    ),
    size,
  );
}

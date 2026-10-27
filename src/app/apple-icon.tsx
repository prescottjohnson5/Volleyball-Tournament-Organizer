import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Home-screen icon for iPhones (they do not use SVG favicons), rendered from icon.svg at build time. */
export default async function AppleIcon() {
  const icon = await readFile(path.join(process.cwd(), "src/app/icon.svg"), "utf8");
  return new ImageResponse(
    // eslint-disable-next-line @next/next/no-img-element -- next/og renders plain img elements
    <img src={`data:image/svg+xml;base64,${Buffer.from(icon).toString("base64")}`} width={180} height={180} alt="" />,
    size,
  );
}

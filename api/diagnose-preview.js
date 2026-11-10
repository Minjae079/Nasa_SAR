// Temporary diagnostics for NASA NISAR browse imagery.
// Safe: only tests a known IIT scene; never reports credentials.
import { readFileSync } from "node:fs";

const catalog = JSON.parse(
  readFileSync(new URL("./data/iit_catalog.json", import.meta.url), "utf8")
);

const SCENE_DATE = "2026-10-22";
const TRUSTED_HOST = "nisar.asf.earthdatacloud.nasa.gov";

function getUrl(kind) {
  const feature = catalog.features.find(
    (f) =>
      f?.properties?.processingLevel === "GCOV" &&
      f.properties?.pathNumber === 148 &&
      f.properties?.frameNumber === 23 &&
      f.properties?.startTime?.startsWith(SCENE_DATE)
  );
  if (!feature) return null;
  const urls = feature.properties.browse || [];
  const suffix = kind === "thumbnail" ? "_LATLON_thumbnail.png" : "_LATLON.png";
  return urls.find((u) => typeof u === "string" && u.endsWith(suffix)) || null;
}

export async function GET(request) {
  const kind =
    new URL(request.url).searchParams.get("kind") === "full"
      ? "full"
      : "thumbnail";
  const nasaUrl = getUrl(kind);
  const json = (data, status = 200) =>
    Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
  if (!nasaUrl)
    return json(
      { error: "IIT sample browse URL was not found in the catalog." },
      404
    );
  const target = new URL(nasaUrl);
  if (target.hostname !== TRUSTED_HOST || target.protocol !== "https:")
    return json({ error: "Unexpected browse hostname" }, 400);
  const headers = { Accept: "image/png", Range: "bytes=0-63" };
  if (process.env.EARTHDATA_TOKEN)
    headers.Authorization = `Bearer ${process.env.EARTHDATA_TOKEN}`;
  try {
    const upstream = await fetch(target, {
      method: "GET",
      headers,
      redirect: "manual",
      signal: AbortSignal.timeout(12000),
    });
    const location = upstream.headers.get("location");
    let redirectHost = null;
    if (location) {
      try {
        redirectHost = new URL(location, target).hostname;
      } catch {}
    }
    const result = {
      sample: "IIT GCOV 2026-10-22, Path 148, Frame 23",
      kind,
      status: upstream.status,
      contentType: upstream.headers.get("content-type"),
      contentLength: upstream.headers.get("content-length"),
      contentRange: upstream.headers.get("content-range"),
      redirectHost,
      tokenConfigured: Boolean(process.env.EARTHDATA_TOKEN),
      interpretation:
        upstream.status >= 300 && upstream.status < 400
          ? "Redirect: likely a sign-in step or moved resource."
          : upstream.status === 401 || upstream.status === 403
          ? "Access denied; Earthdata permissions may be required."
          : upstream.status === 404
          ? "Image not found at the URL listed in metadata."
          : upstream.ok
          ? "Upstream responded; check response type and image size/preview.js validation."
          : "Upstream returned an error; inspect its HTTP status.",
    };
    await upstream.body?.cancel().catch(() => {});
    return json(result);
  } catch (error) {
    return json({
      kind,
      sample: "IIT GCOV 2026-10-22",
      error: error?.name || "FetchError",
      detail: error?.message || "Upstream connection failed",
      tokenConfigured: Boolean(process.env.EARTHDATA_TOKEN),
    });
  }
}

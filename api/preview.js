/**
 * SARSCOPE - NASA SAR Preview Proxy
 *
 * Fetches NASA/ASF NISAR GCOV browse images.
 * Retries alternative preview formats when unavailable.
 */

const NASA_HOST = "nisar.asf.earthdatacloud.nasa.gov";

function normalizeImageUrl(input) {
  try {
    const url = new URL(input);
    const parts = url.pathname.split("/");

    // Check whether the last two path segments
    // contain the same PNG filename.
    if (
      parts.length >= 3 &&
      parts.at(-1) === parts.at(-2) &&
      /\.png$/i.test(parts.at(-1))
    ) {
      // Remove the duplicated filename.
      url.pathname = parts.slice(0, -1).join("/");
    }

    return url.href;
  } catch (error) {
    console.error("Invalid image URL:", error);
    return input;
  }
}

const MAX_BYTES = 4 * 1024 * 1024;

// Alternative image filename formats
const SUFFIXES = [
  "_LATLON.png",
  ".png",
  "_NATIVE_A_HHHH.png",
  "_LATLON_thumbnail.png",
];

// Validate URL and generate fallback candidates
export function browseCandidates(input) {
  let url;

  try {
    const cleanedInput = normalizeImageUrl(input);
    url = new URL(cleanedInput);
  } catch {
    return [];
  }

  // Only allow requests to the NASA ASF host
  if (
    url.protocol !== "https:" ||
    url.hostname !== NASA_HOST ||
    url.port ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    return [];
  }

  const match = url.pathname.match(
    /^\/BROWSE\/(NISAR_L2_GCOV_(?:PROVISIONAL_V1|BETA_V1|V1))\/(NISAR_L2_PR_GCOV_[A-Z0-9_]+)\/([A-Z0-9_]+)\.png$/i
  );

  if (!match) return [];

  if (match[2] !== match[3] && !match[3].startsWith(match[2] + "_")) {
    return [];
  }

  const dir = `/BROWSE/${match[1]}/${match[2]}/`;
  const filename = match[2];

  const candidates = [
    url.href,
    ...SUFFIXES.map(
      (suffix) => `https://${NASA_HOST}${dir}${filename}${suffix}`
    ),
  ];

  return [...new Set(candidates)];
}

// Vercel Serverless API Handler
export async function GET(request) {
  const input = new URL(request.url).searchParams.get("url");

  if (!input || input.length > 2000) {
    return new Response("Missing or invalid URL.", {
      status: 400,
    });
  }

  const candidates = browseCandidates(input);

  if (!candidates.length) {
    return new Response("Invalid ASF NISAR browse URL.", {
      status: 400,
    });
  }

  const headers = {
    Accept: "image/png",
  };

  // Optional server-side Earthdata token
  if (process.env.EARTHDATA_TOKEN) {
    headers.Authorization = `Bearer ${process.env.EARTHDATA_TOKEN}`;
  }

  const statuses = [];

  // Try each candidate image
  for (const candidate of candidates) {
    let response;

    try {
      response = await fetch(candidate, {
        headers,
        redirect: "manual",
        signal: AbortSignal.timeout(5500),
      });
    } catch (err) {
      statuses.push(`network:${err?.name || "Error"}`);
      continue;
    }

    const fileName = new URL(candidate).pathname.split("/").pop();

    statuses.push(`${fileName}:HTTP${response.status}`);

    // Authentication / redirect detection
    if ([301, 302, 303, 307, 308, 401, 403].includes(response.status)) {
      await response.body?.cancel().catch(() => {});

      return new Response(
        `ASF image authentication/redirect (HTTP ${response.status}).`,
        { status: 401 }
      );
    }

    // Try next image if current one is unavailable
    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      continue;
    }

    const type = (response.headers.get("content-type") || "").toLowerCase();

    // Accept only PNG or binary responses
    if (
      !type.includes("image/png") &&
      !type.includes("application/octet-stream")
    ) {
      await response.body?.cancel().catch(() => {});
      continue;
    }

    const size = Number(response.headers.get("content-length") || 0);

    if (size > MAX_BYTES) {
      await response.body?.cancel().catch(() => {});
      continue;
    }

    let array;

    try {
      array = await response.arrayBuffer();
    } catch {
      continue;
    }

    const bytes = new Uint8Array(array);

    // Verify PNG signature and size
    const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];

    if (
      bytes.length > MAX_BYTES ||
      bytes.length < 8 ||
      !pngSignature.every((value, index) => bytes[index] === value)
    ) {
      continue;
    }

    // Successfully return NASA image
    return new Response(array, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        "X-SARSCOPE-Variant": fileName.slice(-60),
      },
    });
  }

  // All preview candidates failed
  const notFound =
    statuses.length > 0 &&
    statuses.every((status) => status.endsWith(":HTTP404"));

  return new Response(
    `No usable ASF Browse PNG. Attempts: ${statuses.join(" | ")}`,
    {
      status: notFound ? 404 : 502,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    }
  );
}

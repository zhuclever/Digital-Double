// --- Helper Function ---
// Both functions will use this
function guessContentType(name) {
  if (name.endsWith(".mp4")) return "video/mp4";
  if (name.endsWith(".webm")) return "video/webm";
  if (name.endsWith(".mov")) return "video/quicktime";
  if (name.endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
}

// --- HEAD Handler ---
// Handles requests from video players checking for file size/info
export async function onRequestHead(context) {
  const { env, params } = context;
  const segments = params.path || [];
  const key = segments.join("/");

  if (!key) {
    return new Response("Not found", { status: 404 });
  }

  const bucket = env["digital-double-videos"];
  const head = await bucket.head(key);

  if (!head) {
    return new Response("Not found", { status: 404 });
  }

  const headers = new Headers();
  head.writeHttpMetadata(headers);
  headers.set("Cache-Control", "public, max-age=3600");
  headers.set("Accept-Ranges", "bytes"); // Tell client we support ranges

  // force content-type if missing
  if (!headers.get("Content-Type")) {
    headers.set("Content-Type", guessContentType(key));
  }

  return new Response(null, { headers });
}

// --- GET Handler ---
// Handles the actual video data request (including streaming)
export async function onRequestGet(context) {
  const { request, env, params } = context;
  const segments = params.path || [];
  const key = segments.join("/");

  if (!key) {
    return new Response("Not found", { status: 404 });
  }

  const bucket = env["digital-double-videos"];

  // R2 will automatically handle Range parsing and conditional
  // requests (If-None-Match) when you pass the headers.
  const object = await bucket.get(key, {
    range: request.headers,   // Automatically handles Range
    onlyIf: request.headers,  // Automatically handles If-None-Match, etc.
  });

  if (!object) {
    return new Response("Not found", { status: 404 });
  }

  // Handle 304 Not Modified (for caching)
  if (object.status === 304) {
    return new Response(null, {
      status: 304,
      headers: {
        "Cache-Control": "public, max-age=3600",
        "ETag": object.httpEtag,
      },
    });
  }

  // --- Build the 200 (full) or 206 (partial) response ---
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Cache-Control", "public, max-age=3600");
  headers.set("Accept-Ranges", "bytes");

  // content-type fallback
  if (!headers.get("Content-Type")) {
    headers.set("Content-Type", guessContentType(key));
  }

  // R2 automatically sets object.range if a range was served
  const status = object.range ? 206 : 200;

  // Add Content-Range header if it was a partial request
  if (object.range) {
    const { offset, length, size } = object.range;
    headers.set(
      "Content-Range",
      `bytes ${offset}-${offset + length - 1}/${size}`
    );
  }

  return new Response(object.body, {
    status,
    headers,
  });
}
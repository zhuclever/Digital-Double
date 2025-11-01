export async function onRequest(context) {
  const { request, env, params } = context;
  const segments = params.path || [];
  const key = segments.join("/");

  if (!key) {
    return new Response("Not found", { status: 404 });
  }

  const bucket = env["digital-double-videos"];

  // HEAD: player might check size
  if (request.method === "HEAD") {
    const head = await bucket.head(key);
    if (!head) return new Response("Not found", { status: 404 });

    const headers = new Headers();
    head.writeHttpMetadata(headers);
    headers.set("Cache-Control", "public, max-age=3600");
    headers.set("Accept-Ranges", "bytes");

    // force content-type if missing
    if (!headers.get("Content-Type")) {
      headers.set("Content-Type", guessContentType(key));
    }

    return new Response(null, { headers });
  }

  // --- SIMPLIFIED GET REQUEST ---
  // R2 will automatically handle Range parsing and conditional
  // requests (If-None-Match) when you pass the headers.
  const object = await bucket.get(key, {
    range: request.headers,   // Automatically handles Range
    onlyIf: request.headers,  // Automatically handles If-None-Match, etc.
  });

  if (!object) {
    return new Response("Not found", { status: 404 });
  }

  // --- NEW: HANDLE 304 NOT MODIFIED ---
  // If `onlyIf` was passed and the ETag matches, R2 returns
  // an object with status 304. We must return a 304 response.
  if (object.status === 304) {
    return new Response(null, {
      status: 304,
      headers: {
        "Cache-Control": "public, max-age=3600",
        "ETag": object.httpEtag, // Pass back the ETag
      },
    });
  }

  // --- STANDARD RESPONSE (200 or 206) ---
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

  // The 'object' from R2 is already a complete Response
  // when a range is requested, but for clarity and to
  // ensure our headers are right, we construct a new one.
  
  // If R2 served a range, it populates object.range
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

  function guessContentType(name) {
    if (name.endsWith(".mp4")) return "video/mp4";
    if (name.endsWith(".webm")) return "video/webm";
    if (name.endsWith(".mov")) return "video/quicktime";
    if (name.endsWith(".webp")) return "image/webp";
    return "application/octet-stream";
  }
}
export async function onRequest(context) {
  const { request, env, params } = context;
  const segments = params.path || [];
  // e.g. /media/Parag/in-worlds_Compressed.mp4
  // -> ["Parag", "in-worlds_Compressed.mp4"]
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

  // --- handle Range ---
  const rangeHeader = request.headers.get("Range");
  let getOptions = {};
  if (rangeHeader && rangeHeader.startsWith("bytes=")) {
    // e.g. "bytes=0-" or "bytes=1000-2000"
    const [startStr, endStr] = rangeHeader.replace("bytes=", "").split("-");
    const start = Number(startStr);
    const end = endStr ? Number(endStr) : undefined;

    if (!Number.isNaN(start)) {
      if (typeof end === "number" && !Number.isNaN(end)) {
        // exact range
        getOptions = { range: { offset: start, length: end - start + 1 } };
      } else {
        // from start to end of file
        getOptions = { range: { offset: start } };
      }
    }
  }

  const object = await bucket.get(key, getOptions);
  if (!object) {
    return new Response("Not found", { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Cache-Control", "public, max-age=3600");
  headers.set("Accept-Ranges", "bytes");

  // content-type fallback
  if (!headers.get("Content-Type")) {
    headers.set("Content-Type", guessContentType(key));
  }

  // if R2 actually served a range, tell the browser
  if (object.range) {
    const { offset, length, size } = object.range;
    headers.set(
      "Content-Range",
      `bytes ${offset}-${offset + length - 1}/${size}`
    );
    headers.set("Content-Length", String(length));
    return new Response(object.body, {
      status: 206,
      headers,
    });
  }

  // full file case
  if (typeof object.size === "number") {
    headers.set("Content-Length", String(object.size));
  }

  return new Response(object.body, {
    status: 200,
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

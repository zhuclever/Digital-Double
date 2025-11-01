export async function onRequest(context) {
  const { request, env, params } = context;
  const segs = params.path || [];
  const key = segs.join("/"); // e.g. Parag/manufacturing-consciousness-pt2-Compressed.mp4

  if (!key) {
    return new Response("Not found", { status: 404 });
  }

  const bucket = env["digital-double-videos"];

  // 1) get HEAD first so we know size + metadata
  const head = await bucket.head(key);
  if (!head) {
    return new Response("Not found", { status: 404 });
  }

  // 2) get full object (no range)
  const object = await bucket.get(key);
  if (!object) {
    return new Response("Not found", { status: 404 });
  }

  const headers = new Headers();
  head.writeHttpMetadata(headers);              // pulls Content-Type from R2
  headers.set("Cache-Control", "public, max-age=3600");
  headers.set("Accept-Ranges", "bytes");        // tell browser we *could* do ranges
  if (!headers.get("Content-Type")) {
    headers.set("Content-Type", guessType(key));
  }
  if (typeof head.size === "number") {
    headers.set("Content-Length", String(head.size));
  }

  return new Response(object.body, {
    status: 200,
    headers,
  });

  function guessType(name) {
    if (name.endsWith(".mp4")) return "video/mp4";
    if (name.endsWith(".webm")) return "video/webm";
    if (name.endsWith(".mov")) return "video/quicktime";
    if (name.endsWith(".webp")) return "image/webp";
    return "application/octet-stream";
  }
}

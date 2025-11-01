export async function onRequest(context) {
  const { request, env, params } = context;

  // everything after /media/ → R2 key
  const segs = params.path || [];
  const key = segs.join("/"); // e.g. Parag/in-worlds_Compressed.mp4

  if (!key) {
    return new Response("Not found", { status: 404 });
  }

  const bucket = env["digital-double-videos"];

  // 1) handle HEAD (players sometimes do this)
  if (request.method === "HEAD") {
    const head = await bucket.head(key);
    if (!head) return new Response("Not found", { status: 404 });

    const h = new Headers();
    head.writeHttpMetadata(h);
    h.set("Cache-Control", "public, max-age=3600");
    h.set("Accept-Ranges", "bytes");
    if (!h.get("Content-Type")) {
      h.set("Content-Type", guessType(key));
    }
    return new Response(null, { headers: h });
  }

  // 2) see if browser asked for a range
  const rangeHeader = request.headers.get("Range");
  let getOpts = {};
  let wantedStart = null;
  let wantedEnd = null;

  if (rangeHeader && rangeHeader.startsWith("bytes=")) {
    const [startStr, endStr] = rangeHeader.slice("bytes=".length).split("-");
    const start = Number(startStr);
    const end = endStr ? Number(endStr) : undefined;
    if (!Number.isNaN(start)) {
      wantedStart = start;
      wantedEnd = end;
      if (typeof end === "number" && !Number.isNaN(end)) {
        getOpts = { range: { offset: start, length: end - start + 1 } };
      } else {
        getOpts = { range: { offset: start } };
      }
    }
  }

  // 3) get from R2
  const object = await bucket.get(key, getOpts);
  if (!object) {
    return new Response("Not found", { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Cache-Control", "public, max-age=3600");
  headers.set("Accept-Ranges", "bytes");
  if (!headers.get("Content-Type")) {
    headers.set("Content-Type", guessType(key));
  }

  // 4) if R2 actually returned a range, finish the 206 properly
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

  // 5) full object case
  if (typeof object.size === "number") {
    headers.set("Content-Length", String(object.size));
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

export async function onRequest(context) {
  const { request, env, params } = context;
  const segments = params.path || [];      // array of path parts after /media/
  const key = segments.join("/");          // "Parag/in-worlds_Compressed.mp4"

  if (!key) {
    return new Response("Not found", { status: 404 });
  }

  const bucket = env["digital-double-videos"];

  // HEAD: just metadata
  if (request.method === "HEAD") {
    const head = await bucket.head(key);
    if (!head) return new Response("Not found", { status: 404 });

    const headers = new Headers();
    head.writeHttpMetadata(headers);
    headers.set("Cache-Control", "public, max-age=3600");
    headers.set("Accept-Ranges", "bytes");
    return new Response(null, { headers });
  }

  // Parse simple Range: bytes=123-
  const rangeHeader = request.headers.get("Range");
  let getOptions = {};
  if (rangeHeader && rangeHeader.startsWith("bytes=")) {
    const [startStr] = rangeHeader.replace("bytes=", "").split("-");
    const start = Number(startStr);
    if (!Number.isNaN(start)) {
      getOptions = { range: { offset: start } };
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

  let status = 200;
  if (object.range) {
    const { offset, length, size } = object.range;
    headers.set(
      "Content-Range",
      `bytes ${offset}-${offset + length - 1}/${size}`
    );
    status = 206;
  }

  return new Response(object.body, { status, headers });
}

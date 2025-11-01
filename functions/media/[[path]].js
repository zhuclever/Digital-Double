export async function onRequest(context) {
  const { env, params } = context;

  // everything after /media/ → becomes the R2 key
  // e.g. /media/Parag/in-worlds_Compressed.mp4
  // -> ["Parag", "in-worlds_Compressed.mp4"]
  const segments = params.path || [];
  const key = segments.join("/");

  if (!key) {
    return new Response("Not found", { status: 404 });
  }

  // use your actual binding name
  const object = await env["digital-double-videos"].get(key);

  if (!object) {
    return new Response("Object Not Found", { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers); // pulls Content-Type etc
  headers.set("etag", object.httpEtag);

  return new Response(object.body, {
    headers,
  });
}
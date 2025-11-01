export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // /media/foo/bar.mp4  -> we only want the part after /media/
  const key = url.pathname.replace(/^\/media\/?/, "");

  const object = await env["digital-double-videos"].get(key);
  if (!object) return new Response("Not found", { status: 404 });

  return new Response(object.body, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType ?? "application/octet-stream",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
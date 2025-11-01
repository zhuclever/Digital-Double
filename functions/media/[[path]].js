// --- Helper Functions ---

function guessContentType(name) {
  if (name.endsWith(".mp4")) return "video/mp4";
  if (name.endsWith(".webm")) return "video/webm";
  if (name.endsWith(".mov")) return "video/quicktime";
  if (name.endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
}

// Helper to add CORS headers to a response
function addCorsHeaders(headers) {
  // Allow requests from any origin
  headers.set("Access-Control-Allow-Origin", "*");
  // Allow GET, HEAD, and OPTIONS methods
  headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  // Allow the 'Range' header, essential for video streaming
  headers.set("Access-Control-Allow-Headers", "Range");
  return headers;
}

// --- OPTIONS Handler (for Preflight Requests) ---
// Browsers send this "preflight" request first to ask for permission
export async function onRequestOptions(context) {
  const headers = new Headers();
  addCorsHeaders(headers);
  return new Response(null, { headers });
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

  if (!headers.get("Content-Type")) {
    headers.set("Content-Type", guessContentType(key));
  }
  
  // *** ADD CORS ***
  addCorsHeaders(headers);

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

  const object = await bucket.get(key, {
    range: request.headers,
    onlyIf: request.headers,
  });

  if (!object) {
    return new Response("Not found", { status: 404 });
  }

  // Handle 304 Not Modified (for caching)
  if (object.status === 304) {
    const headers = new Headers();
    headers.set("Cache-Control", "public, max-age=3600");
    headers.set("ETag", object.httpEtag);
    // *** ADD CORS ***
    addCorsHeaders(headers);
    return new Response(null, { status: 304, headers });
  }

  // --- Build the 200 (full) or 206 (partial) response ---
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Cache-Control", "public, max-age=3600");
  headers.set("Accept-Ranges", "bytes");

  if (!headers.get("Content-Type")) {
    headers.set("Content-Type", guessContentType(key));
  }

  const status = object.range ? 206 : 200;

  if (object.range) {
    const { offset, length, size } = object.range;
    headers.set(
      "Content-Range",
      `bytes ${offset}-${offset + length - 1}/${size}`
    );
  }
  
  // *** ADD CORS ***
  addCorsHeaders(headers);

  return new Response(object.body, {
    status,
    headers,
  });
}
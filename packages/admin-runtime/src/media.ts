import type { FieldstoneConfig } from "@fieldstone/schema";
import { assertSafeStorageKey, resolveStorage } from "@fieldstone/storage";

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  svg: "image/svg+xml",
  pdf: "application/pdf",
  mp4: "video/mp4",
  webm: "video/webm",
  txt: "text/plain; charset=utf-8",
};

function contentTypeForKey(key: string): string {
  const dot = key.lastIndexOf(".");
  const ext = dot >= 0 ? key.slice(dot + 1).toLowerCase() : "";
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}

// Content types that are safe to render inline in the app's own origin. Anything
// else — notably image/svg+xml, which can carry <script> — is served as a download
// so a navigated /media/<x>.svg can't execute script in the admin's origin.
const INLINE_SAFE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/avif",
  "video/mp4",
  "video/webm",
  "application/pdf",
]);

function weakEtag(key: string, size: number): string {
  let hash = 5381;
  for (let i = 0; i < key.length; i += 1)
    hash = ((hash << 5) + hash + key.charCodeAt(i)) >>> 0;
  return `W/"${size.toString(16)}-${hash.toString(16)}"`;
}

// Serves stored files for the scaffolded /media/[...path] route. Framework-
// agnostic: it takes a Request + the route's path segments and returns a Response,
// mirroring createFieldstoneRest.
export function createFieldstoneMedia({ config }: { config: FieldstoneConfig }) {
  const storage = resolveStorage(config);

  return {
    async handle(request: Request, segments: string[]): Promise<Response> {
      if (request.method !== "GET" && request.method !== "HEAD")
        return new Response("Method Not Allowed", {
          status: 405,
          headers: { allow: "GET, HEAD" },
        });

      // Segments arrive already URL-decoded (SvelteKit params); re-validate them
      // against traversal before they reach the filesystem. A bad key is a 404,
      // not a 400 — don't disclose why.
      let key: string;
      try {
        key = assertSafeStorageKey(segments.join("/"));
      } catch {
        return new Response("Not Found", { status: 404 });
      }

      const object = await storage.get(key);
      if (!object) return new Response("Not Found", { status: 404 });

      const contentType = object.contentType ?? contentTypeForKey(key);
      const etag = weakEtag(key, object.size);
      const headers = new Headers({
        "content-type": contentType,
        "content-length": String(object.size),
        // Conservative until the QC6 access model lands: never let a shared/CDN
        // cache hold a possibly-private file. The browser still revalidates via
        // the ETag (cheap 304s).
        "cache-control": "private, max-age=0, must-revalidate",
        // Never let the browser MIME-sniff a stored file into an executable type.
        "x-content-type-options": "nosniff",
        etag,
      });
      // Force a download for anything that could execute as markup in our origin
      // (SVG, HTML, …) rather than render inline.
      if (!INLINE_SAFE_TYPES.has(contentType))
        headers.set("content-disposition", "attachment");

      if (request.headers.get("if-none-match") === etag)
        return new Response(null, { status: 304, headers });

      // The runtime Response accepts a Uint8Array body; the cast only bridges the
      // DOM lib's generic BodyInit (ArrayBuffer- vs ArrayBufferLike-backed).
      const body =
        request.method === "HEAD"
          ? null
          : (object.body as unknown as BodyInit);
      return new Response(body, { status: 200, headers });
    },
  };
}

export type FieldstoneMedia = ReturnType<typeof createFieldstoneMedia>;

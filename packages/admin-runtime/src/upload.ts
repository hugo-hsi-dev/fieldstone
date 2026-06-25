import { randomUUID } from "node:crypto";

export type UploadFile = {
  name: string;
  type: string;
  bytes: Uint8Array;
};

export type UploadValidationOptions = {
  mimeTypes?: string[];
  maxFileSize?: number;
};

// Thrown for user-correctable upload problems (disallowed type, too large) so the
// remote can surface them as a form validation error rather than a 500.
export class UploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadError";
  }
}

export function isUploadError(value: unknown): value is UploadError {
  return value instanceof UploadError;
}

export function mimeAllowed(type: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => {
    if (pattern === "*/*" || pattern === type) return true;
    // "image/*" matches "image/png" etc.
    if (pattern.endsWith("/*")) return type.startsWith(pattern.slice(0, -1));
    return false;
  });
}

export function assertUploadAllowed(file: UploadFile, options: UploadValidationOptions): void {
  // An empty upload is never valid — reject it even on a collection with no
  // mimeTypes/maxFileSize set (a direct POST could otherwise persist a 0-byte file).
  if (file.bytes.byteLength === 0) throw new UploadError("File is empty");

  // Validate against the ACTUAL byte length, never a caller-supplied size, so a
  // mismatched UploadFile can't bypass the cap. Checked post-buffer (the form
  // transport materializes the whole body first); bodySizeLimit is the pre-buffer
  // guard.
  if (typeof options.maxFileSize === "number" && file.bytes.byteLength > options.maxFileSize)
    throw new UploadError(`File exceeds the maximum size of ${options.maxFileSize} bytes`);
  if (
    options.mimeTypes &&
    options.mimeTypes.length > 0 &&
    !mimeAllowed(file.type, options.mimeTypes)
  )
    throw new UploadError(`File type "${file.type}" is not allowed`);
}

function sanitizeFilename(name: string): string {
  const cleaned = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+/, "");
  return cleaned || "file";
}

// A unique, traversal-safe storage key: namespaced by collection, uuid-prefixed
// (so two "photo.jpg" uploads never collide and overwrite each other), with the
// original name sanitized + retained for readability.
export function buildStorageKey(collectionSlug: string, originalName: string): string {
  return `${collectionSlug}/${randomUUID()}-${sanitizeFilename(originalName)}`;
}

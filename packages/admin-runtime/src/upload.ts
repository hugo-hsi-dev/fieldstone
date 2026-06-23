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

export function assertUploadAllowed(
  file: UploadFile,
  options: UploadValidationOptions,
): void {
  // An empty upload is never valid — reject it even on a collection with no
  // mimeTypes/maxFileSize set (a direct POST could otherwise persist a 0-byte file).
  if (file.bytes.byteLength === 0) throw new UploadError("File is empty");

  // Validate against the ACTUAL byte length, never a caller-supplied size, so a
  // mismatched UploadFile can't bypass the cap. Checked post-buffer (the form
  // transport materializes the whole body first); bodySizeLimit is the pre-buffer
  // guard.
  if (
    typeof options.maxFileSize === "number" &&
    file.bytes.byteLength > options.maxFileSize
  )
    throw new UploadError(
      `File exceeds the maximum size of ${options.maxFileSize} bytes`,
    );
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
export function buildStorageKey(
  collectionSlug: string,
  originalName: string,
): string {
  return `${collectionSlug}/${randomUUID()}-${sanitizeFilename(originalName)}`;
}

function readUInt16BE(b: Uint8Array, o: number): number {
  return (b[o] << 8) | b[o + 1];
}
function readUInt16LE(b: Uint8Array, o: number): number {
  return b[o] | (b[o + 1] << 8);
}
function readUInt32BE(b: Uint8Array, o: number): number {
  return ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
}

// Best-effort pure-JS image dimensions for the common formats so the admin can
// show width/height before `sharp` (which gives authoritative dimensions for all
// formats) is installed. Returns null for anything it can't read.
export function probeImageDimensions(
  bytes: Uint8Array,
): { width: number; height: number } | null {
  if (bytes.length < 24) return null;

  // PNG: 8-byte signature, then an IHDR chunk with width/height at fixed offsets.
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return { width: readUInt32BE(bytes, 16), height: readUInt32BE(bytes, 20) };
  }

  // GIF: "GIF8" then little-endian width/height.
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return { width: readUInt16LE(bytes, 6), height: readUInt16LE(bytes, 8) };
  }

  // JPEG: scan segment markers for a Start-Of-Frame, which carries the size.
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset++;
        continue;
      }
      const marker = bytes[offset + 1];
      // SOF0-SOF15 (excluding the DHT/DAC/RST markers C4/C8/CC) carry dimensions.
      if (
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf)
      ) {
        return {
          height: readUInt16BE(bytes, offset + 5),
          width: readUInt16BE(bytes, offset + 7),
        };
      }
      // Standalone markers (SOI/EOI/RSTn) have no length payload.
      if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
        offset += 2;
        continue;
      }
      const length = readUInt16BE(bytes, offset + 2);
      if (length < 2) return null;
      offset += 2 + length;
    }
  }

  return null;
}

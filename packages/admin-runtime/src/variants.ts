import type { UploadImageSize } from "@fieldstone/schema";

// One generated image variant, stored as a row in the media doc's `sizes` array.
export type ImageVariant = {
  name: string;
  filename: string;
  width: number | null;
  height: number | null;
  mimeType: string;
  filesize: number;
};

// The minimal slice of sharp's surface we use. `sharp` is loaded as an optional
// dependency, so it's typed structurally rather than imported as a type.
type SharpInstance = {
  metadata(): Promise<{ width?: number; height?: number }>;
  resize(options: {
    width?: number;
    height?: number;
    fit?: string;
    position?: string;
    withoutEnlargement?: boolean;
  }): SharpInstance;
  toBuffer(): Promise<Uint8Array>;
};
export type SharpModule = (input: Uint8Array) => SharpInstance;

let sharpPromise: Promise<SharpModule | null> | undefined;

// sharp is an OPTIONAL peer dependency. If it isn't installed the import rejects
// and we degrade to originals-only — never throw. Memoized so the (heavy) native
// module loads at most once.
export function loadSharp(): Promise<SharpModule | null> {
  sharpPromise ??= import("sharp")
    .then((module) => ((module.default ?? module) as unknown) as SharpModule)
    .catch(() => null);
  return sharpPromise;
}

// Reset the memoized loader — tests only.
export function resetSharpForTests(): void {
  sharpPromise = undefined;
}

function variantKey(originalKey: string, sizeName: string): string {
  const dot = originalKey.lastIndexOf(".");
  const ext = dot >= 0 ? originalKey.slice(dot) : "";
  const stem = dot >= 0 ? originalKey.slice(0, dot) : originalKey;
  return `${stem}-${sizeName}${ext}`;
}

export type GenerateVariantsResult = {
  width: number | null;
  height: number | null;
  variants: ImageVariant[];
};

// Probe dimensions and generate the configured image variants. Returns
// originals-only (variants: [], width/height null) when sharp is absent, the file
// isn't an image, or sharp is installed-but-broken. EVERY sharp operation is
// guarded so a broken native binary (which throws on .resize()/.metadata(), not on
// import) degrades instead of failing the upload.
export async function generateVariants(options: {
  sharp: SharpModule | null;
  bytes: Uint8Array;
  mimeType: string;
  originalKey: string;
  imageSizes?: UploadImageSize[];
  put: (
    key: string,
    body: Uint8Array,
    meta: { contentType: string },
  ) => Promise<void>;
}): Promise<GenerateVariantsResult> {
  const { sharp, bytes, mimeType, originalKey, imageSizes, put } = options;
  if (!sharp || !mimeType.startsWith("image/"))
    return { width: null, height: null, variants: [] };

  // A broken sharp or unreadable image: keep the original, no dimensions/variants.
  const meta = await sharp(bytes)
    .metadata()
    .catch(() => null);
  if (!meta) return { width: null, height: null, variants: [] };
  const width = meta.width ?? null;
  const height = meta.height ?? null;

  const variants: ImageVariant[] = [];
  for (const size of imageSizes ?? []) {
    try {
      const resized = await sharp(bytes)
        .resize({
          ...(size.width ? { width: size.width } : {}),
          ...(size.height ? { height: size.height } : {}),
          fit: size.fit ?? "cover",
          // Never upscale past the original — a variant is at most the source size.
          withoutEnlargement: true,
        })
        .toBuffer();
      const body = new Uint8Array(resized);
      const key = variantKey(originalKey, size.name);
      await put(key, body, { contentType: mimeType });
      // Re-probe the actual variant dimensions (a `fit` may differ from the
      // requested box); fall back to the requested size if re-probing fails.
      const probe = await sharp(body)
        .metadata()
        .catch(() => ({}) as { width?: number; height?: number });
      variants.push({
        name: size.name,
        filename: key,
        width: probe.width ?? size.width ?? null,
        height: probe.height ?? size.height ?? null,
        mimeType,
        filesize: body.byteLength,
      });
    } catch {
      // Skip a single variant that fails rather than failing the whole upload.
      continue;
    }
  }

  return { width, height, variants };
}

import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { LocalDiskStorage } from "@hugo-hsi-dev/storage";

import { generateVariants, loadSharp } from "../src/index.ts";

async function makePng(width: number, height: number): Promise<Uint8Array> {
  const buffer = await sharp({
    create: { width, height, channels: 3, background: { r: 100, g: 150, b: 200 } },
  })
    .png()
    .toBuffer();
  return new Uint8Array(buffer);
}

describe("generateVariants", () => {
  it("resizes the configured sizes and probes dimensions with sharp", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "fs-variants-"));
    try {
      const storage = new LocalDiskStorage({ staticDir: dir });
      const sharpModule = await loadSharp();
      expect(sharpModule).not.toBeNull();

      const result = await generateVariants({
        sharp: sharpModule,
        bytes: await makePng(120, 90),
        mimeType: "image/png",
        originalKey: "media/abc-photo.png",
        imageSizes: [
          { name: "thumb", width: 32, height: 32, fit: "cover" },
          { name: "wide", width: 60 },
        ],
        put: (key, body, meta) => storage.put(key, body, meta),
      });

      expect(result.width).toBe(120);
      expect(result.height).toBe(90);
      expect(result.variants.map((variant) => variant.name)).toEqual(["thumb", "wide"]);

      const thumb = result.variants[0];
      expect(thumb.filename).toBe("media/abc-photo-thumb.png");
      expect(thumb.width).toBe(32);
      expect(thumb.height).toBe(32);
      await stat(path.join(dir, thumb.filename)); // bytes physically exist

      // A width-only size preserves aspect ratio (120x90 -> 60x45).
      const wide = result.variants[1];
      expect(wide.width).toBe(60);
      expect(wide.height).toBe(45);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("returns originals-only without sharp, and never writes for a non-image", async () => {
    const noSharp = await generateVariants({
      sharp: null,
      bytes: new Uint8Array([1, 2, 3]),
      mimeType: "image/png",
      originalKey: "media/x.png",
      imageSizes: [{ name: "thumb", width: 10 }],
      put: async () => {
        throw new Error("should not write without sharp");
      },
    });
    expect(noSharp).toEqual({ width: null, height: null, variants: [] });

    const notImage = await generateVariants({
      sharp: await loadSharp(),
      bytes: await makePng(20, 20),
      mimeType: "application/pdf",
      originalKey: "media/x.pdf",
      imageSizes: [{ name: "thumb", width: 10 }],
      put: async () => {
        throw new Error("should not write for a non-image");
      },
    });
    expect(notImage.variants).toEqual([]);
  });
});

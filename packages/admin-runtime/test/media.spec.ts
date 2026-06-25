import { createClient } from "@libsql/client";
import { mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { collection, text } from "@hugo-hsi-dev/schema";
import type { FieldstoneConfig, UploadOptions } from "@hugo-hsi-dev/schema";

import { createFieldstoneAdmin, createFieldstoneMedia } from "../src/index.js";

// A tiny fake GIF is enough for validation tests; dimension extraction is owned by sharp.
const GIF_3x2 = new Uint8Array(30);
GIF_3x2.set([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 3, 0, 2, 0]);

function mediaConfig(
  tempDir: string,
  upload: UploadOptions = {},
  denyCreate = false,
): FieldstoneConfig {
  return {
    db: { dialect: "sqlite", url: path.join(tempDir, "test.db") },
    storage: { staticDir: path.join(tempDir, "uploads") },
    collections: {
      media: {
        ...collection({
          fields: [text({ name: "alt" })],
          upload,
          ...(denyCreate ? { access: { create: () => false } } : {}),
        }),
        slug: "media",
      },
    },
  };
}

async function createMediaTable(dbPath: string) {
  const client = createClient({ url: `file:${dbPath}` });
  await client.executeMultiple(`
    create table media (
      id text primary key not null,
      alt text,
      filename text,
      mimeType text,
      filesize real,
      width real,
      height real,
      focalX real,
      focalY real,
      sizes text,
      created_at integer not null,
      updated_at integer not null
    );
  `);
  client.close();
}

function gifFile() {
  return { name: "Photo One.gif", type: "image/gif", bytes: GIF_3x2 };
}

async function makePng(width: number, height: number): Promise<Uint8Array> {
  const buffer = await sharp({
    create: { width, height, channels: 3, background: { r: 100, g: 150, b: 200 } },
  })
    .png()
    .toBuffer();
  return new Uint8Array(buffer);
}

describe("createFieldstoneAdmin.uploadMedia", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "fieldstone-media-"));
    await createMediaTable(path.join(tempDir, "test.db"));
  });

  afterEach(async () => {
    await rm(tempDir, { force: true, recursive: true });
  });

  it("stores the file and persists a media doc with derived metadata", async () => {
    const config = mediaConfig(tempDir);
    const admin = await createFieldstoneAdmin({ config });
    const bytes = await makePng(3, 2);

    const doc = (await admin.uploadMedia({
      collection: "media",
      file: { name: "Photo One.png", type: "image/png", bytes },
      data: { alt: "A photo" },
    })) as Record<string, unknown>;

    expect(doc.alt).toBe("A photo");
    expect(doc.mimeType).toBe("image/png");
    expect(doc.filesize).toBe(bytes.byteLength);
    expect(doc.width).toBe(3);
    expect(doc.height).toBe(2);
    // filename is the storage key: namespaced by collection, uuid-prefixed.
    expect(String(doc.filename)).toMatch(/^media\/[0-9a-f-]+-photo-one\.png$/);

    // The bytes physically landed under the configured staticDir.
    const onDisk = await stat(path.join(tempDir, "uploads", String(doc.filename)));
    expect(onDisk.size).toBe(bytes.byteLength);
  });

  it("generates and cleans up image variants when sharp is available", async () => {
    const config = mediaConfig(tempDir, {
      imageSizes: [{ name: "thumb", width: 16, height: 16 }],
    });
    const admin = await createFieldstoneAdmin({ config });
    const doc = (await admin.uploadMedia({
      collection: "media",
      file: { name: "big.png", type: "image/png", bytes: await makePng(64, 48) },
    })) as Record<string, unknown>;

    // sharp gives authoritative dimensions and generates the configured variant.
    expect(doc.width).toBe(64);
    expect(doc.height).toBe(48);
    const sizes = doc.sizes as { name: string; filename: string }[];
    expect(sizes).toHaveLength(1);
    expect(sizes[0].name).toBe("thumb");
    const variantPath = path.join(tempDir, "uploads", sizes[0].filename);
    await stat(variantPath); // the variant bytes exist

    // Deleting the media doc removes the original AND every variant.
    await admin.deleteDocument({ collection: "media", id: String(doc.id) });
    await expect(stat(variantPath)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("rejects disallowed mime types and oversize files", async () => {
    const admin = await createFieldstoneAdmin({
      config: mediaConfig(tempDir, { mimeTypes: ["image/png"] }),
    });
    await expect(admin.uploadMedia({ collection: "media", file: gifFile() })).rejects.toThrow(
      'File type "image/gif" is not allowed',
    );

    const admin2 = await createFieldstoneAdmin({
      config: mediaConfig(tempDir, { maxFileSize: 5 }),
    });
    await expect(admin2.uploadMedia({ collection: "media", file: gifFile() })).rejects.toThrow(
      "exceeds the maximum size",
    );

    // An empty file is rejected even with no mime/size limits set.
    const admin3 = await createFieldstoneAdmin({ config: mediaConfig(tempDir) });
    await expect(
      admin3.uploadMedia({
        collection: "media",
        file: { name: "empty.gif", type: "image/gif", bytes: new Uint8Array(0) },
      }),
    ).rejects.toThrow("File is empty");
  });

  it("rejects uploads to a non-upload collection", async () => {
    const config: FieldstoneConfig = {
      db: { dialect: "sqlite", url: path.join(tempDir, "test.db") },
      storage: { staticDir: path.join(tempDir, "uploads") },
      collections: {
        media: { ...collection({ fields: [text({ name: "alt" })] }), slug: "media" },
      },
    };
    const admin = await createFieldstoneAdmin({ config });
    await expect(admin.uploadMedia({ collection: "media", file: gifFile() })).rejects.toThrow(
      "is not an upload collection",
    );
  });

  it("removes the stored file when the media doc is deleted", async () => {
    const config = mediaConfig(tempDir);
    const admin = await createFieldstoneAdmin({ config });
    const doc = (await admin.uploadMedia({
      collection: "media",
      file: gifFile(),
    })) as Record<string, unknown>;
    const filePath = path.join(tempDir, "uploads", String(doc.filename));

    await stat(filePath); // exists after upload
    await admin.deleteDocument({ collection: "media", id: String(doc.id) });
    // The framework cleanup step (not a user hook) removed the bytes.
    await expect(stat(filePath)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("cleans up the stored file even when an afterDelete hook throws", async () => {
    const config: FieldstoneConfig = {
      db: { dialect: "sqlite", url: path.join(tempDir, "test.db") },
      storage: { staticDir: path.join(tempDir, "uploads") },
      collections: {
        media: {
          ...collection({
            fields: [text({ name: "alt" })],
            upload: {},
            hooks: {
              afterDelete: [
                () => {
                  throw new Error("hook boom");
                },
              ],
            },
          }),
          slug: "media",
        },
      },
    };
    const admin = await createFieldstoneAdmin({ config });
    const doc = (await admin.uploadMedia({
      collection: "media",
      file: gifFile(),
    })) as Record<string, unknown>;
    const filePath = path.join(tempDir, "uploads", String(doc.filename));

    await stat(filePath); // exists
    // The throwing hook surfaces, but the row is gone so the bytes are still cleaned up.
    await expect(admin.deleteDocument({ collection: "media", id: String(doc.id) })).rejects.toThrow(
      "hook boom",
    );
    await expect(stat(filePath)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("ignores user-supplied read-only metadata, preventing cross-record file deletion", async () => {
    const config = mediaConfig(tempDir);
    const admin = await createFieldstoneAdmin({ config });

    // A real upload owns a stored file.
    const victim = (await admin.uploadMedia({
      collection: "media",
      file: gifFile(),
    })) as Record<string, unknown>;
    const victimKey = String(victim.filename);
    const victimPath = path.join(tempDir, "uploads", victimKey);

    // A user tries to create a media doc pointing filename at the victim's file.
    const attacker = (await admin.createDocument({
      collection: "media",
      data: { alt: "evil", filename: victimKey } as Record<string, unknown>,
    })) as Record<string, unknown>;
    // The read-only filename was stripped — the doc never references the victim file.
    expect(attacker.filename).toBeNull();

    // Deleting the attacker's doc must not remove the victim's bytes.
    await admin.deleteDocument({ collection: "media", id: String(attacker.id) });
    await stat(victimPath); // still exists — no cross-record deletion
  });

  it("does not orphan the stored file when the doc write fails", async () => {
    const admin = await createFieldstoneAdmin({ config: mediaConfig(tempDir, {}, true) });
    await expect(admin.uploadMedia({ collection: "media", file: gifFile() })).rejects.toThrow();
    // The written bytes were cleaned up — no orphan file under the uploads dir
    // (the empty namespace directory may remain).
    const files = await readdir(path.join(tempDir, "uploads", "media")).catch(() => []);
    expect(files).toEqual([]);
  });
});

describe("createFieldstoneMedia serve handler", () => {
  let tempDir: string;
  let config: FieldstoneConfig;
  let key: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "fieldstone-serve-"));
    await createMediaTable(path.join(tempDir, "test.db"));
    config = mediaConfig(tempDir);
    const admin = await createFieldstoneAdmin({ config });
    const doc = (await admin.uploadMedia({
      collection: "media",
      file: gifFile(),
    })) as Record<string, unknown>;
    key = String(doc.filename);
  });

  afterEach(async () => {
    await rm(tempDir, { force: true, recursive: true });
  });

  it("serves stored bytes with content-type, length, and an etag", async () => {
    const media = createFieldstoneMedia({ config });
    const res = await media.handle(new Request("http://x/"), key.split("/"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/gif");
    expect(res.headers.get("content-length")).toBe(String(GIF_3x2.byteLength));
    expect(res.headers.get("cache-control")).toBeTruthy();
    expect(res.headers.get("etag")).toBeTruthy();
    // A raster image is safe to render inline, but still nosniff'd.
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("content-disposition")).toBeNull();
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(GIF_3x2);
  });

  it("nosniffs everything and forces a download for active types like svg", async () => {
    const admin = await createFieldstoneAdmin({ config });
    const svg = (await admin.uploadMedia({
      collection: "media",
      file: { name: "logo.svg", type: "image/svg+xml", bytes: new Uint8Array(24) },
    })) as Record<string, unknown>;

    const media = createFieldstoneMedia({ config });
    const res = await media.handle(new Request("http://x/"), String(svg.filename).split("/"));
    expect(res.headers.get("content-type")).toBe("image/svg+xml");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    // Served as a download so a navigated /media/<x>.svg can't execute script.
    expect(res.headers.get("content-disposition")).toBe("attachment");
  });

  it("304s a matching if-none-match and omits a HEAD body", async () => {
    const media = createFieldstoneMedia({ config });
    const first = await media.handle(new Request("http://x/"), key.split("/"));
    const etag = first.headers.get("etag")!;

    const cached = await media.handle(
      new Request("http://x/", { headers: { "if-none-match": etag } }),
      key.split("/"),
    );
    expect(cached.status).toBe(304);

    const head = await media.handle(new Request("http://x/", { method: "HEAD" }), key.split("/"));
    expect(head.status).toBe(200);
    expect(await head.text()).toBe("");
  });

  it("404s missing keys and traversal attempts, 405s non-GET", async () => {
    const media = createFieldstoneMedia({ config });
    expect((await media.handle(new Request("http://x/"), ["missing.gif"])).status).toBe(404);
    expect((await media.handle(new Request("http://x/"), ["..", "escape"])).status).toBe(404);
    expect(
      (await media.handle(new Request("http://x/", { method: "POST" }), key.split("/"))).status,
    ).toBe(405);
  });
});

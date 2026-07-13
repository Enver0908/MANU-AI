import sharp from "sharp";
import { beforeAll, describe, expect, it } from "vitest";
import {
  STAGE_4B3_MAX_STREAM_BYTES,
  validateAndSanitizeImageBytes,
} from "./phase-85-stage-4b3-image-admission";

let validJpeg: Buffer;
let validPng: Buffer;
let tinyJpeg: Buffer;
let exifJpeg: Buffer;

beforeAll(async () => {
  validJpeg = await sharp({
    create: {
      width: 640,
      height: 480,
      channels: 3,
      background: { r: 120, g: 180, b: 90 },
    },
  })
    .jpeg()
    .toBuffer();

  validPng = await sharp({
    create: {
      width: 400,
      height: 300,
      channels: 3,
      background: { r: 20, g: 40, b: 200 },
    },
  })
    .png()
    .toBuffer();

  tinyJpeg = await sharp({
    create: {
      width: 16,
      height: 16,
      channels: 3,
      background: "#ffffff",
    },
  })
    .jpeg()
    .toBuffer();

  exifJpeg = await sharp(validJpeg).withMetadata().jpeg().toBuffer();
});

describe("phase-85-stage-4b3-image-admission", () => {
  it("accepts valid jpeg and png inputs and strips exif from sanitized output", async () => {
    const jpegResult = await validateAndSanitizeImageBytes({
      bytes: exifJpeg,
      declaredMimeType: "image/jpeg",
    });
    expect(jpegResult.ok).toBe(true);
    if (!jpegResult.ok) return;

    const pngResult = await validateAndSanitizeImageBytes({
      bytes: validPng,
      declaredMimeType: "image/png",
    });
    expect(pngResult.ok).toBe(true);
    if (!pngResult.ok) return;

    const sanitizedMetadata = await sharp(jpegResult.artifacts.sanitizedFullBytes).metadata();
    expect(sanitizedMetadata.exif).toBeUndefined();
    expect(jpegResult.artifacts.detectedMimeType).toBe("image/jpeg");
    expect(jpegResult.artifacts.thumbnailBytes.byteLength).toBeGreaterThan(0);
    expect(jpegResult.artifacts.sanitizedFullBytes).not.toEqual(exifJpeg);
  });

  it("rejects mime spoof, unsupported mime, and executable payloads disguised as jpg", async () => {
    const spoof = await validateAndSanitizeImageBytes({
      bytes: validPng,
      declaredMimeType: "image/jpeg",
    });
    expect(spoof.ok).toBe(false);
    if (spoof.ok) return;
    expect(spoof.failureCode).toBe("mime_spoof");

    const unsupported = await validateAndSanitizeImageBytes({
      bytes: validJpeg,
      declaredMimeType: "image/webp",
    });
    expect(unsupported.ok).toBe(false);
    if (unsupported.ok) return;
    expect(unsupported.failureCode).toBe("unsupported_mime");

    const executable = await validateAndSanitizeImageBytes({
      bytes: Buffer.from("MZ executable payload"),
      declaredMimeType: "image/jpeg",
    });
    expect(executable.ok).toBe(false);
    if (executable.ok) return;
    expect(executable.failureCode).toBe("mime_spoof");
  });

  it("rejects oversize streams, tiny dimensions, and corrupt buffers", async () => {
    const oversize = await validateAndSanitizeImageBytes({
      bytes: Buffer.alloc(STAGE_4B3_MAX_STREAM_BYTES + 1),
      declaredMimeType: "image/jpeg",
    });
    expect(oversize.ok).toBe(false);
    if (oversize.ok) return;
    expect(oversize.failureCode).toBe("stream_too_large");

    const tiny = await validateAndSanitizeImageBytes({
      bytes: tinyJpeg,
      declaredMimeType: "image/jpeg",
    });
    expect(tiny.ok).toBe(false);
    if (tiny.ok) return;
    expect(tiny.failureCode).toBe("dimensions_too_small");

    const corrupt = await validateAndSanitizeImageBytes({
      bytes: Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x00]),
      declaredMimeType: "image/jpeg",
    });
    expect(corrupt.ok).toBe(false);
    if (corrupt.ok) return;
    expect(corrupt.failureCode).toBe("corrupt_image");
  });

  it("rejects hash mismatch when provider digest does not match bytes", async () => {
    const mismatch = await validateAndSanitizeImageBytes({
      bytes: validJpeg,
      declaredMimeType: "image/jpeg",
      expectedSha256: "0".repeat(64),
    });
    expect(mismatch.ok).toBe(false);
    if (mismatch.ok) return;
    expect(mismatch.failureCode).toBe("hash_mismatch");
  });
});

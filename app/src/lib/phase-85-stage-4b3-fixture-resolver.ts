import sharp from "sharp";
import {
  STAGE_4B3_VISION_FIXTURE_SCENE_IDS,
  type Stage4B3VisionFixtureSceneId,
} from "./phase-85-stage-4b3-vision-fixture-manifest";
import { hashMediaBytes } from "./phase-85-stage-4b3-image-admission";

export const STAGE_4B3_FIXTURE_RESOLVER_VERSION = "p85-stage-4b3-fixture-resolver-v1";
export const STAGE_4B3_FIXTURE_MEDIA_ID_PREFIX = "MOCK_MEDIA_";

const FIXTURE_MEDIA_ID_PATTERN = /^MOCK_MEDIA_([A-Z0-9_]+)$/i;

export function isAllowlistedFixtureMediaId(providerMediaId: string): boolean {
  const compact = providerMediaId.trim();
  if (!compact.startsWith(STAGE_4B3_FIXTURE_MEDIA_ID_PREFIX)) {
    return false;
  }
  if (compact.startsWith("MOCK_MEDIA_UPLOAD_")) {
    return false;
  }
  return FIXTURE_MEDIA_ID_PATTERN.test(compact);
}

export function resolveFixtureSceneIdFromMediaId(providerMediaId: string): Stage4B3VisionFixtureSceneId | null {
  const match = providerMediaId.trim().match(FIXTURE_MEDIA_ID_PATTERN);
  if (!match) {
    return null;
  }
  const rawScene = match[1].toLowerCase();
  const sceneId = STAGE_4B3_VISION_FIXTURE_SCENE_IDS.find((entry) => entry === rawScene);
  return sceneId ?? null;
}

export async function buildDeterministicFixtureJpeg(sceneId: Stage4B3VisionFixtureSceneId): Promise<Buffer> {
  const index = STAGE_4B3_VISION_FIXTURE_SCENE_IDS.indexOf(sceneId);
  const channel = (index + 1) * 17;
  return sharp({
    create: {
      width: 640,
      height: 480,
      channels: 3,
      background: { r: channel, g: 64, b: 192 },
    },
  })
    .jpeg()
    .toBuffer();
}

export async function resolveAllowlistedFixtureBytes(providerMediaId: string): Promise<{
  bytes: Buffer;
  mimeType: "image/jpeg";
  sha256: string;
  sceneId: Stage4B3VisionFixtureSceneId;
} | null> {
  if (!isAllowlistedFixtureMediaId(providerMediaId)) {
    return null;
  }
  const sceneId = resolveFixtureSceneIdFromMediaId(providerMediaId);
  if (!sceneId) {
    return null;
  }
  const bytes = await buildDeterministicFixtureJpeg(sceneId);
  return {
    bytes,
    mimeType: "image/jpeg",
    sha256: hashMediaBytes(bytes),
    sceneId,
  };
}

export function isMetaProviderMediaFetch(providerMediaId: string): boolean {
  const compact = providerMediaId.trim().toLowerCase();
  return (
    compact.startsWith("http://") ||
    compact.startsWith("https://") ||
    compact.includes("graph.facebook.com") ||
    compact.includes("lookaside.fbsbx.com")
  );
}

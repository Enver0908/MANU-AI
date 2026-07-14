import type { SupabaseClient } from "@supabase/supabase-js";

export const STAGE_4B4_AUDIO_BUCKET_ID = "p85-stage-4b4-audio";

export type Stage4B4AudioStoragePort = {
  uploadObject(objectKey: string, bytes: Buffer, contentType: string): Promise<void>;
  downloadObject(objectKey: string): Promise<{ bytes: Buffer; contentType: string } | null>;
  deleteObject(objectKey: string): Promise<void>;
};

export function buildStage4B4AudioObjectKey(tenantId: string, assetId: string) {
  return `${tenantId}/${assetId}/voice.wav`;
}

export function createInMemoryStage4B4AudioStorage(): Stage4B4AudioStoragePort & {
  objects: Map<string, { bytes: Buffer; contentType: string }>;
} {
  const objects = new Map<string, { bytes: Buffer; contentType: string }>();
  return {
    objects,
    async uploadObject(objectKey, bytes, contentType) {
      objects.set(objectKey, { bytes: Buffer.from(bytes), contentType });
    },
    async downloadObject(objectKey) {
      const entry = objects.get(objectKey);
      if (!entry) {
        return null;
      }
      return { bytes: Buffer.from(entry.bytes), contentType: entry.contentType };
    },
    async deleteObject(objectKey) {
      objects.delete(objectKey);
    },
  };
}

export function createSupabaseStage4B4AudioStorage(supabase: SupabaseClient): Stage4B4AudioStoragePort {
  return {
    async uploadObject(objectKey, bytes, contentType) {
      const { error } = await supabase.storage.from(STAGE_4B4_AUDIO_BUCKET_ID).upload(objectKey, bytes, {
        contentType,
        upsert: true,
      });
      if (error) {
        throw new Error(`storage_upload_failed:${error.message}`);
      }
    },
    async downloadObject(objectKey) {
      const { data, error } = await supabase.storage.from(STAGE_4B4_AUDIO_BUCKET_ID).download(objectKey);
      if (error || !data) {
        return null;
      }
      const objectBytes = Buffer.from(await data.arrayBuffer());
      return { bytes: objectBytes, contentType: data.type || "audio/wav" };
    },
    async deleteObject(objectKey) {
      const { error } = await supabase.storage.from(STAGE_4B4_AUDIO_BUCKET_ID).remove([objectKey]);
      if (error) {
        throw new Error(`storage_delete_failed:${error.message}`);
      }
    },
  };
}

import type { SupabaseClient } from "@supabase/supabase-js";
import { STAGE_4B3_MEDIA_BUCKET_ID, type Stage4B3MediaStoragePort } from "./phase-85-stage-4b3-media-storage";
import type { Stage4B3PaginatedMediaStoragePort } from "./phase-85-stage-4b3-media-lifecycle-saga";

export const STAGE_4B3_SUPABASE_MEDIA_STORAGE_VERSION = "p85-stage-4b3-supabase-media-storage-v2";

export function createSupabaseStage4B3MediaStorage(supabase: SupabaseClient): Stage4B3PaginatedMediaStoragePort {
  return {
    async uploadObject(objectKey, bytes, contentType) {
      const { error } = await supabase.storage.from(STAGE_4B3_MEDIA_BUCKET_ID).upload(objectKey, bytes, {
        contentType,
        upsert: true,
      });
      if (error) {
        throw new Error(`storage_upload_failed:${error.message}`);
      }
    },
    async downloadObject(objectKey) {
      const { data, error } = await supabase.storage.from(STAGE_4B3_MEDIA_BUCKET_ID).download(objectKey);
      if (error || !data) {
        return null;
      }
      const bytes = Buffer.from(await data.arrayBuffer());
      return { bytes, contentType: data.type || "image/jpeg" };
    },
    async deleteObject(objectKey) {
      const { error } = await supabase.storage.from(STAGE_4B3_MEDIA_BUCKET_ID).remove([objectKey]);
      if (error) {
        throw new Error(`storage_delete_failed:${error.message}`);
      }
    },
    async listObjectKeys(prefix, input = {}) {
      const limit = input.limit ?? 256;
      const offset = input.offset ?? 0;
      const { data, error } = await supabase.storage.from(STAGE_4B3_MEDIA_BUCKET_ID).list(prefix, {
        limit,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
      if (error) {
        throw new Error(`storage_list_failed:${error.message}`);
      }
      return (data ?? [])
        .filter((entry) => entry.id)
        .map((entry) => (prefix.endsWith("/") ? `${prefix}${entry.name}` : `${prefix}/${entry.name}`));
    },
  } satisfies Stage4B3MediaStoragePort & Stage4B3PaginatedMediaStoragePort;
}

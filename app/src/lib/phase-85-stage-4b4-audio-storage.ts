import type { SupabaseClient } from "@supabase/supabase-js";

export const STAGE_4B4_AUDIO_BUCKET_ID = "p85-stage-4b4-audio";

export type Stage4B4ObjectByteRange = {
  start: number;
  end: number;
};

export type Stage4B4ObjectStat = {
  totalSize: number;
  contentType: string;
};

export type Stage4B4ObjectRangeReadResult = Stage4B4ObjectStat & {
  bytes: Buffer;
};

export type Stage4B4AudioStoragePort = {
  uploadObject(objectKey: string, bytes: Buffer, contentType: string): Promise<void>;
  downloadObject(objectKey: string): Promise<{ bytes: Buffer; contentType: string } | null>;
  statObject(objectKey: string): Promise<Stage4B4ObjectStat | null>;
  downloadObjectRange(
    objectKey: string,
    range: Stage4B4ObjectByteRange | null,
  ): Promise<Stage4B4ObjectRangeReadResult | null>;
  deleteObject(objectKey: string): Promise<void>;
};

export function buildStage4B4AudioObjectKey(tenantId: string, assetId: string) {
  return `${tenantId}/${assetId}/voice.wav`;
}

function sliceStoredObject(
  entry: { bytes: Buffer; contentType: string },
  range: Stage4B4ObjectByteRange | null,
): Stage4B4ObjectRangeReadResult {
  const totalSize = entry.bytes.byteLength;
  if (!range) {
    return {
      bytes: Buffer.from(entry.bytes),
      totalSize,
      contentType: entry.contentType,
    };
  }
  return {
    bytes: entry.bytes.subarray(range.start, range.end + 1),
    totalSize,
    contentType: entry.contentType,
  };
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
    async statObject(objectKey) {
      const entry = objects.get(objectKey);
      if (!entry) {
        return null;
      }
      return {
        totalSize: entry.bytes.byteLength,
        contentType: entry.contentType,
      };
    },
    async downloadObjectRange(objectKey, range) {
      const entry = objects.get(objectKey);
      if (!entry) {
        return null;
      }
      return sliceStoredObject(entry, range);
    },
    async deleteObject(objectKey) {
      objects.delete(objectKey);
    },
  };
}

async function readSupabaseObjectRange(
  signedUrl: string,
  range: Stage4B4ObjectByteRange | null,
): Promise<Stage4B4ObjectRangeReadResult | null> {
  const headers: Record<string, string> = {};
  if (range) {
    headers.Range = `bytes=${range.start}-${range.end}`;
  }

  const response = await fetch(signedUrl, { headers });
  if (!response.ok) {
    return null;
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  const contentRange = response.headers.get("content-range");
  const totalSize = contentRange
    ? Number.parseInt(contentRange.split("/")[1] ?? "", 10)
    : Number.parseInt(response.headers.get("content-length") ?? String(bytes.byteLength), 10);
  const contentType = response.headers.get("content-type") || "audio/wav";
  if (!Number.isFinite(totalSize) || totalSize < 0) {
    return null;
  }

  return {
    bytes,
    totalSize,
    contentType,
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
      const ranged = await this.downloadObjectRange(objectKey, null);
      if (!ranged) {
        return null;
      }
      return { bytes: ranged.bytes, contentType: ranged.contentType };
    },
    async statObject(objectKey) {
      const { data, error } = await supabase.storage
        .from(STAGE_4B4_AUDIO_BUCKET_ID)
        .createSignedUrl(objectKey, 60);
      if (error || !data?.signedUrl) {
        return null;
      }
      const head = await fetch(data.signedUrl, { method: "HEAD" });
      if (!head.ok) {
        return null;
      }
      const totalSize = Number.parseInt(head.headers.get("content-length") ?? "0", 10);
      const contentType = head.headers.get("content-type") || "audio/wav";
      if (!Number.isFinite(totalSize) || totalSize < 0) {
        return null;
      }
      return { totalSize, contentType };
    },
    async downloadObjectRange(objectKey, range) {
      const { data, error } = await supabase.storage
        .from(STAGE_4B4_AUDIO_BUCKET_ID)
        .createSignedUrl(objectKey, 60);
      if (error || !data?.signedUrl) {
        return null;
      }
      return readSupabaseObjectRange(data.signedUrl, range);
    },
    async deleteObject(objectKey) {
      const { error } = await supabase.storage.from(STAGE_4B4_AUDIO_BUCKET_ID).remove([objectKey]);
      if (error) {
        throw new Error(`storage_delete_failed:${error.message}`);
      }
    },
  };
}

export const STAGE_4B3_MEDIA_BUCKET_ID = "p85-stage-4b3-media";

export type Stage4B3MediaStoragePort = {
  uploadObject(objectKey: string, bytes: Buffer, contentType: string): Promise<void>;
  deleteObject(objectKey: string): Promise<void>;
};

export function createInMemoryStage4B3MediaStorage(): Stage4B3MediaStoragePort & {
  objects: Map<string, { bytes: Buffer; contentType: string }>;
} {
  const objects = new Map<string, { bytes: Buffer; contentType: string }>();
  return {
    objects,
    async uploadObject(objectKey, bytes, contentType) {
      objects.set(objectKey, { bytes: Buffer.from(bytes), contentType });
    },
    async deleteObject(objectKey) {
      objects.delete(objectKey);
    },
  };
}

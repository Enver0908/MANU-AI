import { createCipheriv, randomBytes } from "node:crypto";

export const WHATSAPP_REAL_AES_GCM_VERSION = "aes-256-gcm-v1";

export type WhatsAppEncryptedPayload = {
  algorithm: typeof WHATSAPP_REAL_AES_GCM_VERSION;
  keyVersion: string;
  iv: string;
  ciphertext: string;
  authTag: string;
};

export function encryptWhatsAppServerPayload(input: {
  plaintext: string;
  aad: string;
  masterKeyBase64: string | undefined;
  keyVersion: string | undefined;
}): WhatsAppEncryptedPayload | null {
  const key = decodeMasterKey(input.masterKeyBase64);
  if (!key || !input.keyVersion) {
    return null;
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(input.aad, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(input.plaintext, "utf8"), cipher.final()]);

  return {
    algorithm: WHATSAPP_REAL_AES_GCM_VERSION,
    keyVersion: input.keyVersion,
    iv: iv.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

function decodeMasterKey(masterKeyBase64: string | undefined) {
  if (!masterKeyBase64) return null;
  const key = Buffer.from(masterKeyBase64, "base64");
  return key.length === 32 ? key : null;
}

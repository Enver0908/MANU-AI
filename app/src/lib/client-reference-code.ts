const CROCKFORD_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const CROCKFORD_DECODE: Record<string, number> = Object.fromEntries(
  CROCKFORD_ALPHABET.split("").map((char, index) => [char, index]),
);
for (const [alias, target] of Object.entries({ O: "0", I: "1", L: "1" })) {
  CROCKFORD_DECODE[alias] = CROCKFORD_DECODE[target]!;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string) {
  return UUID_PATTERN.test(value.trim());
}

function encodeCrockfordBase32(bytes: Uint8Array) {
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += CROCKFORD_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += CROCKFORD_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

function decodeCrockfordBase32(value: string) {
  const normalized = value.trim().toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (!normalized) return null;

  let bits = 0;
  let buffer = 0;
  const bytes: number[] = [];

  for (const char of normalized) {
    const digit = CROCKFORD_DECODE[char];
    if (digit == null) return null;
    buffer = (buffer << 5) | digit;
    bits += 5;
    if (bits >= 8) {
      bytes.push((buffer >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  if (bytes.length !== 16) return null;
  return Buffer.from(bytes);
}

export function encodeClientReferenceCode(clientId: string) {
  const normalized = clientId.trim().toLowerCase();
  if (!isUuid(normalized)) {
    throw new Error("invalid_client_uuid");
  }

  const bytes = Buffer.from(normalized.replace(/-/g, ""), "hex");
  return encodeCrockfordBase32(bytes);
}

export function decodeClientReferenceCode(value: string) {
  const normalized = value.trim();
  if (!normalized) return null;
  if (isUuid(normalized)) return normalized.toLowerCase();

  const bytes = decodeCrockfordBase32(normalized);
  if (!bytes) return null;

  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function formatClientReferenceShort(referenceCode: string) {
  const normalized = referenceCode.trim().toUpperCase();
  return normalized.slice(0, 8);
}

export function clientReferenceMatchesQuery(referenceCode: string, query: string) {
  const normalizedQuery = query.trim().toUpperCase();
  if (!normalizedQuery) return true;
  return referenceCode.toUpperCase().includes(normalizedQuery);
}

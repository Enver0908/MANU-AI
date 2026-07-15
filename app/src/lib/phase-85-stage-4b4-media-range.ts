export type ParsedHttpByteRange =
  | { kind: "full" }
  | { kind: "partial"; start: number; end: number }
  | { kind: "unsatisfied" };

export function buildRangeNotSatisfiableHeaders(totalSize: number): Record<string, string> {
  return {
    "Content-Range": `bytes */${Math.max(totalSize, 0)}`,
    "Accept-Ranges": "bytes",
  };
}

export function buildAudioStreamEtag(etagToken: string | null | undefined): string | undefined {
  const normalized = etagToken?.trim();
  if (!normalized) {
    return undefined;
  }
  return normalized.startsWith('"') ? normalized : `"${normalized}"`;
}

export function parseHttpByteRangeHeader(
  rangeHeader: string | null | undefined,
  totalSize: number,
): ParsedHttpByteRange {
  if (!rangeHeader?.trim()) {
    return { kind: "full" };
  }
  const normalized = rangeHeader.trim();
  if (!normalized.startsWith("bytes=")) {
    return { kind: "unsatisfied" };
  }

  const rangeValue = normalized.slice("bytes=".length);
  if (rangeValue.includes(",")) {
    return { kind: "unsatisfied" };
  }

  const spec = rangeValue.trim();
  const dashIndex = spec.indexOf("-");
  if (dashIndex === -1) {
    return { kind: "unsatisfied" };
  }
  const startRaw = spec.slice(0, dashIndex);
  const endRaw = spec.slice(dashIndex + 1);

  if (startRaw && endRaw) {
    const start = Number.parseInt(startRaw, 10);
    const end = Number.parseInt(endRaw, 10);
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || start >= totalSize) {
      return { kind: "unsatisfied" };
    }
    return { kind: "partial", start, end: Math.min(end, totalSize - 1) };
  }

  if (startRaw && !endRaw) {
    const start = Number.parseInt(startRaw, 10);
    if (!Number.isInteger(start) || start < 0 || start >= totalSize) {
      return { kind: "unsatisfied" };
    }
    return { kind: "partial", start, end: totalSize - 1 };
  }

  if (!startRaw && endRaw) {
    const suffixLength = Number.parseInt(endRaw, 10);
    if (!Number.isInteger(suffixLength) || suffixLength <= 0) {
      return { kind: "unsatisfied" };
    }
    const start = Math.max(totalSize - suffixLength, 0);
    return { kind: "partial", start, end: totalSize - 1 };
  }

  return { kind: "unsatisfied" };
}

export function sliceBufferForRange(body: Buffer, range: Extract<ParsedHttpByteRange, { kind: "partial" }>) {
  return body.subarray(range.start, range.end + 1);
}

export function buildAudioStreamResponseHeaders(input: {
  contentType: string;
  totalSize: number;
  range: ParsedHttpByteRange;
  cacheControl: string;
  filename?: string;
  etag?: string;
}) {
  const headers: Record<string, string> = {
    "Cache-Control": input.cacheControl,
    "X-Content-Type-Options": "nosniff",
    "Content-Type": input.contentType,
    "Accept-Ranges": "bytes",
    "Content-Disposition": `inline; filename="${input.filename ?? "voice.wav"}"`,
  };

  if (input.etag) {
    headers.ETag = input.etag;
  }

  if (input.range.kind === "partial") {
    const chunkSize = input.range.end - input.range.start + 1;
    headers["Content-Range"] = `bytes ${input.range.start}-${input.range.end}/${input.totalSize}`;
    headers["Content-Length"] = String(chunkSize);
  } else {
    headers["Content-Length"] = String(input.totalSize);
  }

  return headers;
}

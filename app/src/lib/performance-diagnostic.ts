type TimingValue = number | undefined;

export function addPerformanceServerTiming(
  response: Response,
  timings: Record<string, TimingValue>,
) {
  if (process.env.AIYA_PERF_DIAGNOSTIC !== "1") return response;

  const headerValue = Object.entries(timings)
    .filter((entry): entry is [string, number] =>
      typeof entry[1] === "number" && Number.isFinite(entry[1]),
    )
    .map(([name, duration]) => `${name};dur=${Math.max(0, duration).toFixed(2)}`)
    .join(", ");

  if (headerValue) response.headers.set("Server-Timing", headerValue);
  return response;
}

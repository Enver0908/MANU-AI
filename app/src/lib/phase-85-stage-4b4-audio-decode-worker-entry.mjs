import { isMainThread, parentPort, workerData } from "node:worker_threads";
import waveResampler from "wave-resampler";
import wavefile from "wavefile";

const { resample } = waveResampler;
const { WaveFile } = wavefile;

const CANONICAL_SAMPLE_RATE_HZ = 16_000;

function floatToPcm16(samples) {
  const pcm = new Int16Array(samples.length);
  for (let index = 0; index < samples.length; index += 1) {
    const value = samples[index];
    pcm[index] = Math.max(-32768, Math.min(32767, Math.round(value * 32767)));
  }
  return pcm;
}

async function runDecodeJob(request) {
  const { OggOpusDecoder } = await import("ogg-opus-decoder");
  const decoder = new OggOpusDecoder();
  try {
    await decoder.ready;
    const decoded = await decoder.decode(Buffer.from(request.bytes));
    if (!decoded || decoded.channelData.length === 0 || decoded.samplesDecoded <= 0) {
      return { ok: false, failureCode: "corrupt_ogg" };
    }
    if (decoded.channelData.length !== 1) {
      return { ok: false, failureCode: "stereo_not_allowed" };
    }
    if (decoded.samplesDecoded > request.maxDecodeSamples) {
      return { ok: false, failureCode: "decode_sample_limit_exceeded" };
    }

    const mono = decoded.channelData[0];
    const sourceSampleRate = Number(decoded.sampleRate);
    const resampled =
      sourceSampleRate === CANONICAL_SAMPLE_RATE_HZ
        ? mono
        : resample(mono, sourceSampleRate, CANONICAL_SAMPLE_RATE_HZ);

    if (resampled.length > request.maxDecodeSamples) {
      return { ok: false, failureCode: "decode_sample_limit_exceeded" };
    }

    const wav = new WaveFile();
    wav.fromScratch(1, CANONICAL_SAMPLE_RATE_HZ, "16", floatToPcm16(Float32Array.from(resampled)));
    const wavBytes = Buffer.from(wav.toBuffer());
    const durationMs = Math.round((resampled.length / CANONICAL_SAMPLE_RATE_HZ) * 1000);

    return {
      ok: true,
      wavBytes,
      durationMs,
    };
  } catch {
    return { ok: false, failureCode: "decode_failed" };
  } finally {
    decoder.free();
  }
}

if (!isMainThread && parentPort) {
  runDecodeJob(workerData)
    .then((result) => {
      parentPort.postMessage(result);
    })
    .catch(() => {
      parentPort.postMessage({ ok: false, failureCode: "decode_failed" });
    });
}

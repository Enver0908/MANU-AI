class AiChatPcmRecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = [];
    this._recording = false;
    this.port.onmessage = (event) => {
      if (event.data?.type === "start") {
        this._buffer = [];
        this._recording = true;
      }
      if (event.data?.type === "stop") {
        this._recording = false;
        const merged = this._merge(this._buffer);
        this.port.postMessage({ type: "complete", samples: merged, sampleRate });
        this._buffer = [];
      }
    };
  }

  _merge(chunks) {
    const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const merged = new Float32Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    return merged;
  }

  process(inputs) {
    if (!this._recording) return true;
    const input = inputs[0]?.[0];
    if (!input) return true;
    this._buffer.push(new Float32Array(input));
    return true;
  }
}

registerProcessor("ai-chat-pcm-recorder", AiChatPcmRecorderProcessor);

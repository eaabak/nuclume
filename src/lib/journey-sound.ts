export type SoundMix = {
  air: number;
  mechanical: number;
  water: number;
  steam: number;
  drive: number;
  speed: number;
};

export function fadeAudio(
  param: AudioParam,
  value: number,
  now: number,
  duration = 0.3,
) {
  if (typeof param.cancelAndHoldAtTime === "function") {
    param.cancelAndHoldAtTime(now);
  } else {
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
  }
  param.linearRampToValueAtTime(value, now + duration);
}

function makeTexture(context: AudioContext, seconds: number, decay = false) {
  const buffer = context.createBuffer(
    2,
    context.sampleRate * seconds,
    context.sampleRate,
  );
  let seed = 235;
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    let body = 0;
    for (let i = 0; i < data.length; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const white = seed / 2147483648 - 1;
      body = body * 0.985 + white * 0.015;
      const envelope = decay
        ? Math.exp((-7 * i) / data.length) * Math.min(1, i / 180)
        : Math.min(1, i / 512, (data.length - 1 - i) / 512);
      data[i] = (body * 2.2 + white * 0.025) * envelope;
    }
  }
  return buffer;
}

export function createJourneySound() {
  const context = new AudioContext({ latencyHint: "playback" });
  const output = context.createGain();
  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = -20;
  compressor.knee.value = 16;
  compressor.ratio.value = 2.5;
  compressor.attack.value = 0.015;
  compressor.release.value = 0.3;
  output.gain.value = 0;
  output.connect(compressor).connect(context.destination);

  const room = context.createConvolver();
  room.buffer = makeTexture(context, 0.42, true);
  const roomTone = context.createBiquadFilter();
  roomTone.type = "lowpass";
  roomTone.frequency.value = 1800;
  const roomLevel = context.createGain();
  roomLevel.gain.value = 0.1;
  room.connect(roomTone).connect(roomLevel).connect(output);

  const nodes: AudioNode[] = [output, compressor, room, roomTone, roomLevel];
  const sources = new Set<AudioBufferSourceNode>();
  const requests = new AbortController();
  let disposed = false;

  function layer(highpass: number, lowpass: number, pan: number) {
    const high = context.createBiquadFilter();
    high.type = "highpass";
    high.frequency.value = highpass;
    high.Q.value = 0.5;
    const low = context.createBiquadFilter();
    low.type = "lowpass";
    low.frequency.value = lowpass;
    low.Q.value = 0.5;
    const gain = context.createGain();
    gain.gain.value = 0;
    const position = context.createStereoPanner();
    position.pan.value = pan;
    high.connect(low).connect(gain).connect(position);
    position.connect(output);
    position.connect(room);
    nodes.push(high, low, gain, position);
    let buffer: AudioBuffer | null = null;
    let source: AudioBufferSourceNode | null = null;
    let stopTimer: ReturnType<typeof setTimeout> | undefined;
    let level = 0;
    let speed = 1;

    const update = () => {
      if (disposed) return;
      const now = context.currentTime;
      if (level > 0 && buffer) {
        clearTimeout(stopTimer);
        stopTimer = undefined;
        if (!source) {
          source = context.createBufferSource();
          source.buffer = buffer;
          source.loop = true;
          source.playbackRate.value = speed;
          source.connect(high);
          sources.add(source);
          source.start();
        }
      }
      fadeAudio(gain.gain, level, now, 0.55);
      if (source) fadeAudio(source.playbackRate, speed, now, 0.8);
      if (level === 0 && source && !stopTimer) {
        stopTimer = setTimeout(() => {
          if (source) {
            source.stop();
            source.disconnect();
            source.buffer = null;
            sources.delete(source);
            source = null;
          }
          stopTimer = undefined;
        }, 650);
      }
    };

    return {
      set(next: number, rate = 1) {
        if (level === next && speed === rate) return;
        level = next;
        speed = rate;
        update();
      },
      load(next: AudioBuffer) {
        if (disposed) return;
        buffer = next;
        update();
      },
      dispose() {
        clearTimeout(stopTimer);
        buffer = null;
      },
    };
  }

  const air = layer(45, 850, 0);
  const mechanical = layer(35, 1900, -0.12);
  const water = layer(170, 1800, -0.2);
  const steam = layer(650, 6200, 0.24);
  const drive = layer(240, 2300, 0.02);
  const layers = [air, mechanical, water, steam, drive];
  air.load(makeTexture(context, 7));
  let loading: Promise<void> | null = null;
  const hits = new Map<
    AudioBufferSourceNode,
    { gain: GainNode; cleanup: () => void }
  >();
  const impact = makeTexture(context, 0.9, true);

  return {
    context,
    output,
    prepareIndustrial() {
      if (!loading) {
        loading = Promise.all(
          ["mechanical", "water", "steam"].map(async (name) => {
            const response = await fetch(`/audio/${name}.wav`, {
              signal: requests.signal,
            });
            if (!response.ok) throw new Error(`Audio unavailable: ${name}`);
            const buffer = await context.decodeAudioData(
              await response.arrayBuffer(),
            );
            if (disposed) return;
            if (name === "mechanical") {
              mechanical.load(buffer);
              drive.load(buffer);
            } else if (name === "water") water.load(buffer);
            else steam.load(buffer);
          }),
        )
          .then(() => {})
          .catch((error: unknown) => {
            loading = null;
            throw error;
          });
      }
      return loading;
    },
    mix(value: SoundMix) {
      air.set(value.air);
      mechanical.set(value.mechanical, value.speed);
      water.set(value.water);
      steam.set(value.steam);
      drive.set(value.drive, 0.82);
    },
    stopHits() {
      const now = context.currentTime;
      for (const [source, { gain }] of hits) {
        fadeAudio(gain.gain, 0, now, 0.025);
        source.stop(now + 0.035);
      }
    },
    hit() {
      if (disposed) return;
      const source = context.createBufferSource();
      const gain = context.createGain();
      const tone = context.createBiquadFilter();
      tone.type = "lowpass";
      tone.frequency.value = 1200;
      source.buffer = impact;
      gain.gain.value = 0.48;
      source.connect(tone).connect(gain);
      gain.connect(output);
      gain.connect(room);
      const cleanup = () => {
        source.onended = null;
        source.disconnect();
        source.buffer = null;
        tone.disconnect();
        gain.disconnect();
        hits.delete(source);
      };
      hits.set(source, { gain, cleanup });
      source.onended = cleanup;
      source.start();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      requests.abort();
      for (const item of layers) item.dispose();
      for (const source of sources) {
        source.stop();
        source.disconnect();
        source.buffer = null;
      }
      sources.clear();
      for (const [source, { cleanup }] of hits) {
        source.stop();
        cleanup();
      }
      for (const node of nodes) node.disconnect();
      room.buffer = null;
      void context.close().catch(() => {});
    },
  };
}

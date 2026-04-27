export class SoundEngine {
  constructor() {
    this.enabled = true;
    this.context = null;
    this.master = null;
    this.wakePromise = null;
    this.unlocked = false;
    this.masterVolume = 0.42;
    this.fallbackCache = new Map();
    this.lastFallbackAt = 0;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (this.master) {
      this.master.gain.value = enabled ? this.masterVolume : 0;
    }
  }

  async wake() {
    if (!this.enabled) {
      return false;
    }

    if (this.wakePromise) {
      return this.wakePromise;
    }

    this.wakePromise = this.createContext();
    try {
      return await this.wakePromise;
    } finally {
      this.wakePromise = null;
    }
  }

  async createContext() {
    if (!this.context) {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) {
        return false;
      }
      this.context = new AudioCtor();
      this.master = this.context.createGain();
      this.master.gain.value = this.enabled ? this.masterVolume : 0;
      this.master.connect(this.context.destination);
    }

    if (this.context.state === "suspended") {
      await this.context.resume();
    }

    this.unlocked = this.context.state === "running";
    return true;
  }

  playTone({ frequency, duration = 0.1, type = "triangle", gain = 0.08, delay = 0 }) {
    if (!this.enabled) {
      return;
    }

    if (delay === 0) {
      this.playFallbackTone(frequency, duration, gain);
    }

    if (!this.context || !this.master || this.context.state !== "running") {
      this.wake().then((ready) => {
        if (ready) {
          this.playToneNow({ frequency, duration, type, gain, delay });
        }
      }).catch(() => {});
      return;
    }

    this.playToneNow({ frequency, duration, type, gain, delay });
  }

  playToneNow({ frequency, duration = 0.1, type = "triangle", gain = 0.08, delay = 0 }) {
    if (!this.context || !this.master || this.context.state !== "running") {
      return;
    }

    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    const now = this.context.currentTime + delay;

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(gain, now + 0.01);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    oscillator.connect(envelope);
    envelope.connect(this.master);

    oscillator.start(now);
    oscillator.stop(now + duration + 0.04);
  }

  playFallbackTone(frequency, duration = 0.1, gain = 0.08) {
    if (typeof Audio === "undefined") {
      return;
    }

    const now = Date.now();
    if (now - this.lastFallbackAt < 28) {
      return;
    }
    this.lastFallbackAt = now;

    const key = `${Math.round(frequency)}:${Math.round(duration * 1000)}:${Math.round(gain * 100)}`;
    if (!this.fallbackCache.has(key)) {
      this.fallbackCache.set(key, this.createWavDataUrl(frequency, duration, gain));
    }

    const audio = new Audio(this.fallbackCache.get(key));
    audio.volume = Math.min(1, Math.max(0.08, gain * 4));
    audio.play().catch(() => {});
  }

  createWavDataUrl(frequency, duration, gain) {
    const sampleRate = 22050;
    const sampleCount = Math.max(1, Math.floor(sampleRate * duration));
    const headerSize = 44;
    const dataSize = sampleCount * 2;
    const buffer = new ArrayBuffer(headerSize + dataSize);
    const view = new DataView(buffer);

    this.writeAscii(view, 0, "RIFF");
    view.setUint32(4, 36 + dataSize, true);
    this.writeAscii(view, 8, "WAVE");
    this.writeAscii(view, 12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    this.writeAscii(view, 36, "data");
    view.setUint32(40, dataSize, true);

    for (let i = 0; i < sampleCount; i += 1) {
      const t = i / sampleRate;
      const fadeIn = Math.min(1, i / Math.max(1, sampleRate * 0.01));
      const fadeOut = Math.min(1, (sampleCount - i) / Math.max(1, sampleRate * 0.03));
      const envelope = Math.min(fadeIn, fadeOut);
      const sample = Math.sin(2 * Math.PI * frequency * t) * envelope * Math.min(0.9, gain * 2.8);
      view.setInt16(headerSize + i * 2, Math.max(-1, Math.min(1, sample)) * 32767, true);
    }

    let binary = "";
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    return `data:audio/wav;base64,${btoa(binary)}`;
  }

  writeAscii(view, offset, value) {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  }

  playSwap() {
    this.playTone({ frequency: 480, duration: 0.1, type: "triangle", gain: 0.12 });
    this.playTone({ frequency: 660, duration: 0.12, type: "triangle", gain: 0.09, delay: 0.04 });
  }

  playInvalid() {
    this.playTone({ frequency: 220, duration: 0.12, type: "sawtooth", gain: 0.1 });
    this.playTone({ frequency: 180, duration: 0.14, type: "triangle", gain: 0.08, delay: 0.03 });
  }

  playClear(tileCount, combo) {
    const base = 360 + Math.min(tileCount, 8) * 18 + Math.max(0, combo - 1) * 36;
    this.playTone({ frequency: base, duration: 0.08, type: "triangle", gain: 0.07 });
    this.playTone({ frequency: base * 1.24, duration: 0.1, type: "triangle", gain: 0.05, delay: 0.04 });
  }

  playBlocker() {
    this.playTone({ frequency: 210, duration: 0.08, type: "square", gain: 0.04 });
    this.playTone({ frequency: 160, duration: 0.06, type: "square", gain: 0.03, delay: 0.03 });
  }

  playSpecial(type) {
    if (type === "row") {
      this.playTone({ frequency: 520, duration: 0.1, type: "triangle", gain: 0.06 });
      this.playTone({ frequency: 690, duration: 0.14, type: "triangle", gain: 0.05, delay: 0.04 });
      this.playTone({ frequency: 860, duration: 0.08, type: "sine", gain: 0.04, delay: 0.08 });
      return;
    }

    if (type === "col") {
      this.playTone({ frequency: 470, duration: 0.08, type: "triangle", gain: 0.05 });
      this.playTone({ frequency: 620, duration: 0.12, type: "triangle", gain: 0.05, delay: 0.03 });
      this.playTone({ frequency: 780, duration: 0.16, type: "sine", gain: 0.04, delay: 0.07 });
      return;
    }

    if (type === "bomb") {
      this.playTone({ frequency: 260, duration: 0.12, type: "sawtooth", gain: 0.05 });
      this.playTone({ frequency: 180, duration: 0.16, type: "square", gain: 0.04, delay: 0.03 });
      this.playTone({ frequency: 340, duration: 0.18, type: "triangle", gain: 0.05, delay: 0.07 });
      return;
    }

    if (type === "color") {
      [420, 540, 680, 840].forEach((frequency, index) => {
        this.playTone({
          frequency,
          duration: 0.14,
          type: index % 2 ? "triangle" : "sine",
          gain: 0.045,
          delay: index * 0.04,
        });
      });
      return;
    }

    this.playTone({ frequency: 440, duration: 0.12, type: "sine", gain: 0.06 });
    this.playTone({ frequency: 660, duration: 0.16, type: "triangle", gain: 0.05, delay: 0.03 });
  }

  playHint() {
    this.playTone({ frequency: 720, duration: 0.14, type: "sine", gain: 0.12 });
    this.playTone({ frequency: 960, duration: 0.12, type: "triangle", gain: 0.08, delay: 0.06 });
  }

  playUnlock() {
    this.playTone({ frequency: 660, duration: 0.12, type: "sine", gain: 0.1 });
  }

  playResult(stars) {
    const notes = stars === 3 ? [440, 554, 659] : stars === 2 ? [392, 494, 587] : [349, 440, 523];
    notes.forEach((frequency, index) => {
      this.playTone({ frequency, duration: 0.16, type: "triangle", gain: 0.06, delay: index * 0.08 });
    });
  }
}

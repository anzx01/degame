export class SoundEngine {
  constructor() {
    this.enabled = true;
    this.context = null;
    this.master = null;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (this.master) {
      this.master.gain.value = enabled ? 0.18 : 0;
    }
  }

  async wake() {
    if (!this.enabled) {
      return false;
    }

    if (!this.context) {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) {
        return false;
      }
      this.context = new AudioCtor();
      this.master = this.context.createGain();
      this.master.gain.value = 0.18;
      this.master.connect(this.context.destination);
    }

    if (this.context.state === "suspended") {
      await this.context.resume();
    }

    return true;
  }

  playTone({ frequency, duration = 0.1, type = "triangle", gain = 0.08, delay = 0 }) {
    if (!this.enabled || !this.context || !this.master) {
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

  playSwap() {
    this.playTone({ frequency: 480, duration: 0.08, type: "triangle", gain: 0.06 });
    this.playTone({ frequency: 620, duration: 0.09, type: "triangle", gain: 0.04, delay: 0.03 });
  }

  playInvalid() {
    this.playTone({ frequency: 220, duration: 0.09, type: "sawtooth", gain: 0.05 });
    this.playTone({ frequency: 180, duration: 0.1, type: "triangle", gain: 0.04, delay: 0.02 });
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
    const mapping = {
      row: [510, 640],
      col: [510, 700],
      bomb: [280, 360],
      color: [420, 620],
    };
    const [a, b] = mapping[type] || [440, 660];
    this.playTone({ frequency: a, duration: 0.12, type: "sine", gain: 0.06 });
    this.playTone({ frequency: b, duration: 0.16, type: "triangle", gain: 0.05, delay: 0.03 });
  }

  playHint() {
    this.playTone({ frequency: 540, duration: 0.06, type: "triangle", gain: 0.04 });
  }

  playResult(stars) {
    const notes = stars === 3 ? [440, 554, 659] : stars === 2 ? [392, 494, 587] : [349, 440, 523];
    notes.forEach((frequency, index) => {
      this.playTone({ frequency, duration: 0.16, type: "triangle", gain: 0.06, delay: index * 0.08 });
    });
  }
}

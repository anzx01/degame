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
    this.playTone({ frequency: 540, duration: 0.06, type: "triangle", gain: 0.04 });
  }

  playResult(stars) {
    const notes = stars === 3 ? [440, 554, 659] : stars === 2 ? [392, 494, 587] : [349, 440, 523];
    notes.forEach((frequency, index) => {
      this.playTone({ frequency, duration: 0.16, type: "triangle", gain: 0.06, delay: index * 0.08 });
    });
  }
}

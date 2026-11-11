export class GameAudio {
  constructor() {
    this.context = null;
    this.master = null;
    this.musicBus = null;
    this.muted = false;
    this.musicEnabled = true;
    this.unlocked = false;
    this.timer = null;
    this.step = 0;
    this.nextBeat = 0;
  }

  async unlock() {
    if (this.unlocked) {
      try {
        if (this.context?.state === 'suspended') await this.context.resume();
      } catch (_) {}
      return;
    }
    try {
      const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AudioContextClass) return;
      this.context = new AudioContextClass();
      this.master = this.context.createGain();
      this.master.gain.value = this.muted ? 0 : 0.48;
      this.master.connect(this.context.destination);
      this.musicBus = this.context.createGain();
      this.musicBus.gain.value = this.musicEnabled ? 0.3 : 0;
      this.musicBus.connect(this.master);
      await this.context.resume();
      this.unlocked = true;
      this.nextBeat = this.context.currentTime + 0.08;
      this.timer = globalThis.setInterval(() => this._scheduleMusic(), 180);
      this._scheduleMusic();
    } catch (_) {
      this._stopMusicTimer();
      this.context = this.master = this.musicBus = null;
      this.unlocked = false;
    }
  }

  setMuted(bool) {
    this.muted = Boolean(bool);
    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.48, this.context.currentTime, 0.035);
    }
  }

  setMusic(bool) {
    this.musicEnabled = Boolean(bool);
    if (this.musicBus && this.context) {
      this.musicBus.gain.setTargetAtTime(this.musicEnabled ? 0.3 : 0, this.context.currentTime, 0.06);
    }
  }

  event(event) {
    if (!this.unlocked || !this.context || !this.master || this.muted) return;
    const type = typeof event === 'string' ? event : event?.type;
    if (!type) return;
    try {
      switch (type.toLowerCase()) {
        case 'jump': case 'boing': this._boing(); break;
        case 'serve': this._serve(); break;
        case 'score': case 'point': this._score(); break;
        case 'win': case 'victory': case 'finish': this._win(); break;
        case 'menu': case 'click': case 'select': this._menu(); break;
        case 'dash': this._noise(.17, .13, 1100); this._tone(480, this.context.currentTime, .16, 'triangle', this.master, .07, 95); break;
        case 'smash': this._noise(.2, .09, 1700); this._tone(110, this.context.currentTime, .2, 'triangle', this.master, .12, 45); break;
        case 'net': this._tone(180, this.context.currentTime, .24, 'sine', this.master, .09, 65); break;
        case 'hit': case 'impact': case 'bump': case 'spike': this._impact(event?.power ?? event?.strength); break;
        default: break;
      }
    } catch (_) {
      // Audio is decorative; gameplay continues if a browser rejects a sound.
    }
  }

  _scheduleMusic() {
    const ctx = this.context;
    if (!ctx || !this.musicBus || ctx.state !== 'running' || !this.musicEnabled) return;
    const now = ctx.currentTime;
    if (this.nextBeat < now - 0.1) this.nextBeat = now + 0.03;
    const beatLength = 0.52;
    while (this.nextBeat < now + 0.55) {
      const beat = this.step % 8;
      const chord = [0, 5, 3, 4][Math.floor(this.step / 8) % 4];
      const notes = [60, 64, 67, 71];
      const note = notes[beat % 4] + chord;
      this._tone(this._midi(note), this.nextBeat, beat % 2 ? 0.09 : 0.12, 'sine', this.musicBus, 0.13);
      if (beat === 0 || beat === 4) {
        this._tone(this._midi(48 + chord), this.nextBeat, 0.26, 'triangle', this.musicBus, 0.07);
      }
      this.nextBeat += beatLength;
      this.step += 1;
    }
  }

  _tone(frequency, start, duration, wave, destination, volume, endFrequency) {
    const ctx = this.context;
    if (!ctx || !destination) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(Math.max(30, frequency), start);
    if (endFrequency) osc.frequency.exponentialRampToValueAtTime(Math.max(30, endFrequency), start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(volume, start + Math.min(0.025, duration * 0.25));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  _midi(note) { return 440 * Math.pow(2, (note - 69) / 12); }

  _boing() {
    const t = this.context.currentTime + 0.005;
    this._tone(520, t, 0.24, 'sine', this.master, 0.22, 205);
  }

  _serve() {
    const t = this.context.currentTime + 0.005;
    this._tone(190, t, 0.12, 'triangle', this.master, 0.15, 520);
    this._tone(660, t + 0.045, 0.08, 'sine', this.master, 0.08, 420);
  }

  _impact(strength = 1) {
    const t = this.context.currentTime + 0.005;
    const amount = Math.max(0.45, Math.min(1.2, Number(strength) || 1));
    this._tone(270, t, .11, 'triangle', this.master, .16 * amount, 75);
    this._tone(85, t, .16, 'sine', this.master, .13 * amount, 38);
    this._noise(.11, .12 * amount, 1200);
  }

  _noise(duration, volume, cutoff) {
    const ctx = this.context;
    if (!ctx || !this.master) return;
    const source = ctx.createBufferSource();
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / samples.length, 2);
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter(); filter.type = 'highpass'; filter.frequency.value = cutoff;
    const gain = ctx.createGain(); gain.gain.value = volume;
    source.connect(filter); filter.connect(gain); gain.connect(this.master);
    source.start(); source.stop(ctx.currentTime + duration);
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
  }

  _score() {
    const t = this.context.currentTime + 0.005;
    this._tone(660, t, 0.16, 'sine', this.master, 0.13);
    this._tone(880, t + 0.11, 0.2, 'sine', this.master, 0.14);
  }

  _win() {
    const t = this.context.currentTime + 0.005;
    [0, 0.13, 0.26, 0.4].forEach((offset, i) => {
      this._tone(this._midi([72, 76, 79, 84][i]), t + offset, 0.24, 'sine', this.master, 0.14);
    });
  }

  _menu() {
    this._tone(740, this.context.currentTime + 0.005, 0.07, 'sine', this.master, 0.08, 620);
  }

  _stopMusicTimer() {
    if (this.timer !== null) globalThis.clearInterval(this.timer);
    this.timer = null;
  }

  dispose() {
    this._stopMusicTimer();
    if (this.context) {
      try { this.context.close(); } catch (_) {}
    }
    this.context = this.master = this.musicBus = null;
    this.unlocked = false;
  }
}

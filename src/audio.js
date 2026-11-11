/** Gesture-unlocked, bounded Web Audio voices and a quiet plucked meadow tune. */
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
    this._unlockPromise = null;
    this._disposed = false;
    this._generation = 0;
    this._liveNodes = new Set();
    this._noiseBuffers = new Map();
  }

  unlock() {
    if (this._disposed) return Promise.resolve(false);
    if (this._unlockPromise) return this._unlockPromise;
    const generation = this._generation;
    const operation = this._openContext(generation);
    const pending = operation.finally(() => {
      if (this._unlockPromise === pending) this._unlockPromise = null;
    });
    this._unlockPromise = pending;
    return pending;
  }

  async _openContext(generation) {
    let context = this.context;
    try {
      if (this.unlocked && context) {
        if (context.state === 'suspended') await context.resume();
        return !this._disposed && generation === this._generation && this.context === context;
      }
      const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AudioContextClass) return false;
      context = new AudioContextClass();
      this.context = context;
      this.master = context.createGain();
      this.master.gain.value = this.muted ? 0 : .48;
      this.master.connect(context.destination);
      this.musicBus = context.createGain();
      this.musicBus.gain.value = this.musicEnabled ? .3 : 0;
      this.musicBus.connect(this.master);
      await context.resume();
      // A pending permission/resume request can complete after HMR or teardown.
      if (this._disposed || generation !== this._generation || this.context !== context) {
        this._closeContext(context);
        return false;
      }
      this.unlocked = true;
      this.nextBeat = context.currentTime + .08;
      this._stopMusicTimer();
      this.timer = globalThis.setInterval(() => this._scheduleMusic(), 180);
      this._scheduleMusic();
      return true;
    } catch {
      if (this.context === context) {
        this._stopMusicTimer();
        this._clearVoices();
        this._noiseBuffers.clear();
        this.context = this.master = this.musicBus = null;
        this.unlocked = false;
      }
      this._closeContext(context);
      return false;
    }
  }

  setMuted(value) {
    this.muted = Boolean(value);
    if (this.master && this.context && !this._disposed) this.master.gain.setTargetAtTime(this.muted ? 0 : .48, this.context.currentTime, .035);
  }

  setMusic(value) {
    this.musicEnabled = Boolean(value);
    if (this.musicBus && this.context && !this._disposed) this.musicBus.gain.setTargetAtTime(this.musicEnabled ? .3 : 0, this.context.currentTime, .06);
  }

  event(event) {
    if (this._disposed || !this.unlocked || !this.context || !this.master || this.muted) return;
    const type = typeof event === 'string' ? event : event?.type;
    if (!type) return;
    try {
      switch (type.toLowerCase()) {
        case 'jump': case 'boing': this._boing(); break;
        case 'serve': this._serve(); break;
        case 'score': case 'point': this._score(); break;
        case 'win': case 'victory': case 'finish': this._win(); break;
        case 'menu': case 'click': case 'select': this._menu(); break;
        case 'dash':
          this._noise(.13, .075, 1100);
          this._tone(380, this.context.currentTime, .13, 'triangle', this.master, .045, 95);
          break;
        // A swing can miss. Keep its airy anticipation separate from impact bass.
        case 'smash': case 'swing': this._noise(.09, event?.player === 0 ? .045 : .018, 1700); break;
        case 'net': this._tone(180, this.context.currentTime, .21, 'sine', this.master, .065, 65); break;
        case 'hit': case 'impact': case 'bump': case 'spike': this._impact(event?.power ?? event?.strength); break;
        default: break;
      }
    } catch {
      // Browsers may suspend audio while tab focus changes. Gameplay continues.
    }
  }

  _scheduleMusic() {
    const context = this.context;
    if (this._disposed || !context || !this.musicBus || context.state !== 'running' || !this.musicEnabled) return;
    const now = context.currentTime;
    if (this.nextBeat < now - .1) this.nextBeat = now + .03;
    const beatLength = .52;
    while (this.nextBeat < now + .55) {
      const beat = this.step % 8;
      const chord = [0, 5, 3, 4][Math.floor(this.step / 8) % 4];
      const note = [60, 64, 67, 71][beat % 4] + chord;
      this._tone(this._midi(note), this.nextBeat, beat % 2 ? .13 : .19, 'triangle', this.musicBus, .075);
      if (beat === 0 || beat === 4) this._tone(this._midi(48 + chord), this.nextBeat, .28, 'sine', this.musicBus, .065);
      this.nextBeat += beatLength;
      this.step++;
    }
  }

  _trackVoice(source, nodes) {
    for (const node of nodes) this._liveNodes.add(node);
    source.onended = () => {
      source.onended = null;
      for (const node of nodes) {
        try { node.disconnect(); } catch {}
        this._liveNodes.delete(node);
      }
    };
  }

  _tone(frequency, start, duration, wave, destination, volume, endFrequency) {
    const context = this.context;
    if (this._disposed || !context || !destination) return;
    const oscillator = context.createOscillator(), gain = context.createGain();
    start = Math.max(context.currentTime, start);
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(Math.max(30, frequency), start);
    if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, endFrequency), start + duration);
    gain.gain.setValueAtTime(.0001, start);
    gain.gain.linearRampToValueAtTime(volume, start + Math.min(.012, duration * .15));
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    oscillator.connect(gain); gain.connect(destination);
    this._trackVoice(oscillator, [oscillator, gain]);
    oscillator.start(start); oscillator.stop(start + duration + .02);
  }

  _midi(note) { return 440 * Math.pow(2, (note - 69) / 12); }

  _boing() {
    this._tone(520, this.context.currentTime + .005, .21, 'sine', this.master, .17, 205);
  }

  _serve() {
    const time = this.context.currentTime + .005;
    this._tone(190, time, .12, 'triangle', this.master, .13, 520);
    this._tone(660, time + .045, .08, 'sine', this.master, .065, 420);
  }

  _impact(strength = .6) {
    const time = this.context.currentTime + .005;
    const amount = Math.max(.25, Math.min(1.2, Number.isFinite(strength) ? strength : .6));
    this._tone(270, time, .10, 'triangle', this.master, .15 * amount, 75);
    this._tone(85, time, .13, 'sine', this.master, .11 * amount, 38);
    this._noise(.11, .095 * amount, 1200);
  }

  _noise(duration, volume, cutoff) {
    const context = this.context;
    if (this._disposed || !context || !this.master) return;
    const sampleCount = Math.ceil(context.sampleRate * duration);
    let buffer = this._noiseBuffers.get(sampleCount);
    if (!buffer) {
      buffer = context.createBuffer(1, sampleCount, context.sampleRate);
      const samples = buffer.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / samples.length, 2);
      this._noiseBuffers.set(sampleCount, buffer);
    }
    const source = context.createBufferSource(), filter = context.createBiquadFilter(), gain = context.createGain();
    source.buffer = buffer;
    filter.type = 'highpass'; filter.frequency.value = cutoff;
    gain.gain.value = volume;
    source.connect(filter); filter.connect(gain); gain.connect(this.master);
    this._trackVoice(source, [source, filter, gain]);
    source.start(); source.stop(context.currentTime + duration);
  }

  _score() {
    const time = this.context.currentTime + .005;
    this._tone(660, time, .14, 'sine', this.master, .10);
    this._tone(880, time + .11, .18, 'sine', this.master, .11);
  }

  _win() {
    const time = this.context.currentTime + .005;
    [0, .13, .26, .4].forEach((offset, i) => this._tone(this._midi([72, 76, 79, 84][i]), time + offset, .22, 'sine', this.master, .11));
  }

  _menu() {
    this._tone(740, this.context.currentTime + .005, .055, 'sine', this.master, .065, 620);
  }

  _stopMusicTimer() {
    if (this.timer !== null) globalThis.clearInterval(this.timer);
    this.timer = null;
  }

  _clearVoices() {
    for (const node of this._liveNodes) {
      node.onended = null;
      try { node.stop?.(); } catch {}
      try { node.disconnect(); } catch {}
    }
    this._liveNodes.clear();
  }

  _closeContext(context) {
    try { context?.close()?.catch?.(() => {}); } catch {}
  }

  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    this._generation++;
    this._stopMusicTimer();
    this._clearVoices();
    this._noiseBuffers.clear();
    this._closeContext(this.context);
    this.context = this.master = this.musicBus = null;
    this.unlocked = false;
  }
}

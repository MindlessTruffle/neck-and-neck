import { assetUrl } from './assets.js';

const STOCK_EFFECTS = {
  click: 'click.wav', bump: 'bump.wav', set: 'set.wav', spike: 'spike.wav',
  block: 'block.wav', dive: 'dive.wav', point: 'point.wav', ability: 'ability.wav',
};
const EFFECT_IDS = ['click', 'bump', 'set', 'spike', 'block', 'dive', 'point', 'ability', 'jump', 'dash', 'roll', 'win'];
const MUSIC_SCENES = new Set(['lobby', 'shop', 'abilities', 'match', 'results']);
const ABILITY_NOTES = { feather: 79, spring: 76, magnet: 71, rocket: 83, shield: 67 };

/** Local CC0 stock audio, gesture-safe Web Audio, and a procedural fallback. */
export class GameAudio {
  constructor({ fetcher = globalThis.window ? globalThis.fetch?.bind(globalThis) : null, resolveAsset = assetUrl } = {}) {
    this.context = null;
    this.master = null;
    this.musicBus = null;
    this.fallbackBus = null;
    this.muted = false;
    this.musicEnabled = true;
    this.unlocked = false;
    this.timer = null;
    this.step = 0;
    this.nextBeat = 0;
    this._rallyCount = 0;
    this._unlockPromise = null;
    this._disposed = false;
    this._generation = 0;
    this._liveNodes = new Set();
    this._noiseBuffers = new Map();
    this._fetcher = fetcher;
    this._resolveAsset = resolveAsset;
    this._assetPromises = new Map();
    this._stockBuffers = new Map();
    this._stockTimes = new Map();
    this._anticipationTimes = new Map();
    this._loadController = null;
    this._assetsReady = null;
    this._musicPromise = null;
    this._stockMusicSource = null;
    this._musicVoice = null;
    this._fadingMusicVoice = null;
    this._sceneRequest = 0;
    this.scene = 'lobby';
    this.musicStatus = 'locked';
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
      this.fallbackBus = context.createGain();
      this.fallbackBus.gain.value = 1;
      this.fallbackBus.connect(this.musicBus);
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
      this._loadStockAssets();
      return true;
    } catch {
      if (this.context === context) {
        this._stopMusicTimer();
        this._clearVoices();
        this._noiseBuffers.clear();
        this._loadController?.abort(); this._loadController = null;
        this._assetPromises.clear(); this._stockBuffers.clear();
        this._assetsReady = this._musicPromise = this._stockMusicSource = null;
        this.context = this.master = this.musicBus = this.fallbackBus = null;
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
    if (this.musicEnabled && this.unlocked) this._loadStockMusic();
  }

  setScene(scene) {
    if (!MUSIC_SCENES.has(scene) || this._disposed) return Promise.resolve(false);
    if (this.scene === scene && this._musicPromise) return this._musicPromise;
    this.scene = scene;
    return this.unlocked ? this._loadStockMusic() : Promise.resolve(false);
  }

  _loadBuffer(key, filename) {
    if (!this._fetcher || !this.context || this._disposed) return Promise.resolve(null);
    if (this._assetPromises.has(key)) return this._assetPromises.get(key);
    const context = this.context, generation = this._generation;
    this._loadController ||= new AbortController();
    const signal = this._loadController.signal;
    const promise = (async () => {
      try {
        const response = await this._fetcher(this._resolveAsset(`audio/${filename}`), { signal });
        if (!response.ok) return null;
        const bytes = await response.arrayBuffer();
        if (signal.aborted || this._disposed || this.context !== context) return null;
        const buffer = await context.decodeAudioData(bytes);
        if (signal.aborted || this._disposed || generation !== this._generation || this.context !== context) return null;
        this._stockBuffers.set(key, buffer);
        return buffer;
      } catch { return null; }
    })();
    this._assetPromises.set(key, promise);
    return promise;
  }

  _loadStockAssets() {
    if (this._assetsReady || !this._fetcher || this._disposed) return this._assetsReady;
    const requests = EFFECT_IDS.map(async key => {
      const generatedName = key === 'point' ? 'score' : key;
      const buffer = await this._loadBuffer(`generated-${key}`, `elevenlabs/sfx-${generatedName}.mp3`) || (STOCK_EFFECTS[key] ? await this._loadBuffer(`fallback-${key}`, STOCK_EFFECTS[key]) : null);
      if (buffer && !this._disposed) this._stockBuffers.set(key, buffer);
      return buffer;
    });
    if (this.musicEnabled) requests.push(this._loadStockMusic());
    this._assetsReady = Promise.all(requests);
    return this._assetsReady;
  }

  _loadStockMusic() {
    if (!this._fetcher || this._disposed || !this.context) return Promise.resolve(false);
    const scene = this.scene, request = ++this._sceneRequest;
    this.musicStatus = 'loading';
    this._musicPromise = (async () => {
      const buffer = await this._loadBuffer(`music-${scene}`, `elevenlabs/music-${scene}.mp3`) || await this._loadBuffer('music-ogg', 'adventure-stage1.ogg') || await this._loadBuffer('music-mp3', 'adventure-stage1.mp3');
      if (this._disposed || request !== this._sceneRequest) return false;
      if (!buffer) { this.musicStatus = 'procedural'; return false; }
      this._stockBuffers.set('music', buffer);
      this._startStockMusic(buffer, scene);
      this.musicStatus = 'ready';
      return true;
    })();
    return this._musicPromise;
  }

  _startStockMusic(buffer, scene) {
    const context = this.context;
    if (this._disposed || !context || !this.musicBus || (this._musicVoice?.scene === scene && this._musicVoice?.source.buffer === buffer)) return;
    const previous = this._musicVoice, now = context.currentTime;
    // Rapid menu navigation keeps at most one outgoing crossfade alive.
    if (this._fadingMusicVoice) {
      try { this._fadingMusicVoice.source.stop(now); } catch {}
      this._fadingMusicVoice.source.onended?.();
      this._fadingMusicVoice = null;
    }
    if (previous) {
      previous.gain.gain.cancelScheduledValues(now);
      previous.gain.gain.setTargetAtTime(0, now, .18);
      try { previous.source.stop(now + .9); } catch {}
      this._fadingMusicVoice = previous;
    }
    const source = context.createBufferSource(), gain = context.createGain();
    source.buffer = buffer; source.loop = true;
    gain.gain.value = 0;
    source.connect(gain); gain.connect(this.musicBus);
    this._trackVoice(source, [source, gain]);
    this._stockMusicSource = source;
    this._musicVoice = { source, gain, scene };
    source.start(context.currentTime + .02);
    gain.gain.setTargetAtTime(.36, context.currentTime + .02, .14);
    this.fallbackBus?.gain.setTargetAtTime(0, context.currentTime, .1);
  }

  _stockSound(key, volume = .5, rate = 1) {
    const buffer = this._stockBuffers.get(key), context = this.context;
    if (!buffer || !context || this._disposed || this.muted) return false;
    const last = this._stockTimes.get(key) ?? -Infinity;
    if (context.currentTime - last < (key === 'point' ? .25 : .035) || this._liveNodes.size > 54) return true;
    this._stockTimes.set(key, context.currentTime);
    const source = context.createBufferSource(), gain = context.createGain();
    source.buffer = buffer;
    if (source.playbackRate) source.playbackRate.value = rate;
    gain.gain.value = volume;
    source.connect(gain); gain.connect(this.master);
    this._trackVoice(source, [source, gain]);
    source.start(context.currentTime);
    return true;
  }

  event(event) {
    if (this._disposed || !this.unlocked || !this.context || !this.master || this.muted) return;
    const type = typeof event === 'string' ? event : event?.type;
    if (!type) return;
    try {
      switch (type.toLowerCase()) {
        case 'jump': case 'boing': this._stockSound('jump', .4) || this._boing(); break;
        case 'serve': this._rallyCount = 0; this._serve(); break;
        case 'score': case 'point': this._rallyCount = 0; this._score(); break;
        case 'win': case 'victory': case 'finish': this._rallyCount = 0; this._win(); break;
        case 'menu': case 'click': case 'select': this._menu(); break;
        case 'roll': if (!this._stockSound('roll', .38)) this._ability({ ability: 'magnet' }); break;
        case 'round': this._rallyCount = 0; break;
        case 'toss': this._stockSound('set', .35) || this._serve(); break;
        case 'ability': this._ability(event); break;
        case 'dive':
          if (!this._stockSound('dive', .55)) this._noise(.16, .075, 650);
          break;
        case 'action': this._anticipate(event); break;
        case 'dash':
          if (this._stockSound('dash', .35)) break;
          this._noise(.13, .075, 1100);
          this._tone(380, this.context.currentTime, .13, 'triangle', this.master, .045, 95);
          break;
        // A swing can miss. Keep its airy anticipation separate from impact bass.
        case 'smash': case 'swing': this._anticipate(event); break;
        case 'net': this._tone(180, this.context.currentTime, .21, 'sine', this.master, .065, 65); break;
        case 'hit': case 'impact': case 'bump': case 'spike':
          this._impact(event?.power ?? event?.strength, event?.action);
          this._rallyCount = Number.isFinite(event?.rallyHits) ? Math.max(1, Math.floor(event.rallyHits)) : this._rallyCount + 1;
          this._rallyNote(this._rallyCount, event?.assisted || event?.softContact);
          break;
        default: break;
      }
    } catch {
      // Browsers may suspend audio while tab focus changes. Gameplay continues.
    }
  }

  _scheduleMusic() {
    const context = this.context;
    if (this._disposed || !context || !this.musicBus || context.state !== 'running' || !this.musicEnabled || this._stockMusicSource) return;
    const now = context.currentTime;
    if (this.nextBeat < now - .1) this.nextBeat = now + .03;
    const beatLength = .52;
    while (this.nextBeat < now + .55) {
      const beat = this.step % 8;
      const chord = [0, 5, 3, 4][Math.floor(this.step / 8) % 4];
      const note = [60, 64, 67, 71][beat % 4] + chord;
      this._tone(this._midi(note), this.nextBeat, beat % 2 ? .13 : .19, 'triangle', this.fallbackBus || this.musicBus, .075);
      if (beat === 0 || beat === 4) this._tone(this._midi(48 + chord), this.nextBeat, .28, 'sine', this.fallbackBus || this.musicBus, .065);
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
    if (this._disposed || !context || !destination || this._liveNodes.size > 62) return;
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

  _impact(strength = .6, action = 'bump') {
    const time = this.context.currentTime + .005;
    const amount = Math.max(.25, Math.min(1.2, Number.isFinite(strength) ? strength : .6));
    const key = ['set', 'spike', 'block'].includes(action) ? action : 'bump';
    if (this._stockSound(key, .38 + amount * .24, action === 'spike' ? 1.05 : 1)) return;
    this._tone(270, time, .10, 'triangle', this.master, .15 * amount, 75);
    this._tone(85, time, .13, 'sine', this.master, .11 * amount, 38);
    this._noise(.11, .095 * amount, 1200);
  }

  _rallyNote(count, saved) {
    const degrees = [0, 2, 4, 5, 7, 9, 11, 12];
    const note = 65 + degrees[Math.min(degrees.length - 1, Math.max(0, count - 1))];
    const time = this.context.currentTime + .012;
    this._tone(this._midi(note), time, saved ? .22 : .17, 'sine', this.master, .095);
    if (count >= 4) this._tone(this._midi(note - 5), time + .035, .13, 'triangle', this.master, .04);
  }

  _anticipate(event) {
    const key = event?.player ?? 0, now = this.context.currentTime;
    if (now - (this._anticipationTimes.get(key) ?? -Infinity) < .075) return;
    this._anticipationTimes.set(key, now);
    const action = event?.action || 'spike';
    if (action === 'dive') return;
    if (action === 'set' || action === 'block') this._tone(action === 'set' ? 420 : 230, now, .07, 'sine', this.master, .025, 330);
    else {
      // A crisp, short neck-swing cue is audible even on a miss; actual contact
      // still gets the heavier bump/spike sound in _impact.
      if (!this._stockSound('click', event?.player === 0 ? .34 : .2, .88)) this._noise(.09, event?.player === 0 ? .07 : .035, 1250);
    }
  }

  _ability(event) {
    const note = ABILITY_NOTES[event?.ability] ?? 76;
    if (!this._stockSound('ability', .32)) this._tone(this._midi(note), this.context.currentTime, .16, 'sine', this.master, .09);
    this._tone(this._midi(note + 7), this.context.currentTime + .08, .15, 'triangle', this.master, .05);
  }

  _noise(duration, volume, cutoff) {
    const context = this.context;
    if (this._disposed || !context || !this.master || this._liveNodes.size >= 62) return;
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
    if (this._stockSound('point', .38)) return;
    const time = this.context.currentTime + .005;
    this._tone(660, time, .14, 'sine', this.master, .10);
    this._tone(880, time + .11, .18, 'sine', this.master, .11);
  }

  _win() {
    if (this._stockSound('win', .42)) return;
    if (this._stockSound('point', .42, .94)) return;
    const time = this.context.currentTime + .005;
    [0, .13, .26, .4].forEach((offset, i) => this._tone(this._midi([72, 76, 79, 84][i]), time + offset, .22, 'sine', this.master, .11));
  }

  _menu() {
    if (this._stockSound('click', .38)) return;
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
    this._loadController?.abort();
    this._loadController = null;
    this._stopMusicTimer();
    this._clearVoices();
    this._noiseBuffers.clear();
    this._stockBuffers.clear(); this._assetPromises.clear();
    this._stockTimes.clear(); this._anticipationTimes.clear();
    // Promise.all retains its decoded AudioBuffers unless its owner releases it.
    this._assetsReady = this._musicPromise = this._unlockPromise = null;
    this._stockMusicSource = null;
    this._musicVoice = null;
    this._fadingMusicVoice = null;
    this._sceneRequest++;
    this.musicStatus = 'disposed';
    this._closeContext(this.context);
    this.context = this.master = this.musicBus = this.fallbackBus = null;
    this.unlocked = false;
  }
}

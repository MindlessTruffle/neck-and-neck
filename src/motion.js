const STEP = 1 / 120;
const ACTIONS = ['jump', 'dash', 'swing', 'smash', 'serve'];
const lerp = (a, b, t) => a + (b - a) * t;
const angle = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;

function copyPoint(target, source) {
  Object.assign(target, source);
  return target;
}

function copyPose(target, source) {
  target.x = source.x; target.y = source.y; target.z = source.z;
  target.bodyYaw = source.bodyYaw; target.swing = source.swing;
  target.head ||= {};
  copyPoint(target.head, source.head);
  target.neckPoints ||= [];
  source.neckPoints.forEach((point, i) => copyPoint(target.neckPoints[i] ||= {}, point));
  target.neckPoints.length = source.neckPoints.length;
  return target;
}

/** Fixed physics clock with one-tick pose interpolation, independent of display Hz. */
export class SmoothSimulation {
  constructor(game) {
    this.game = game;
    this.previous = { players: [], ball: {} };
    this.renderState = { players: [], ball: {} };
    this.reset();
  }

  reset() {
    this.accumulator = 0;
    this.pending = {};
    this.game.clearBufferedInput();
    this.capture();
    return this.sample(1);
  }

  capture() {
    this.game.players.forEach((p, i) => copyPose(this.previous.players[i] ||= {}, p));
    this.previous.players.length = this.game.players.length;
    copyPoint(this.previous.ball, this.game.ball);
  }

  advance(dt, input = {}) {
    const game = this.game;
    if (game.paused || game.phase === 'finished') return this.reset();
    for (const key of ACTIONS) if (input[key]) this.pending[key] = true;
    this.accumulator += Math.max(0, Math.min(Number(dt) || 0, .1));
    while (this.accumulator + 1e-10 >= STEP) {
      this.capture();
      const phase = game.phase;
      game.update(STEP, { ...input, ...this.pending });
      for (const key of ACTIONS) this.pending[key] = false;
      this.accumulator = Math.max(0, this.accumulator - STEP);
      // Serves/reset positions are teleports, not trajectories to blend through.
      if (phase !== game.phase) this.capture();
      if (game.paused || game.phase === 'finished') {
        this.accumulator = 0;
        this.capture();
        break;
      }
    }
    return this.sample(this.accumulator / STEP);
  }

  sample(alpha) {
    const game = this.game, state = this.renderState;
    state.phase = game.phase; state.paused = game.paused;
    state.score = game.score; state.rally = game.rally; state.hits = game.hits;
    game.players.forEach((p, i) => {
      const out = state.players[i] ||= { head: {}, neckPoints: [] };
      const head = out.head, neckPoints = out.neckPoints;
      Object.assign(out, p, { head, neckPoints });
      const old = this.previous.players[i];
      const t = !old || Math.hypot(p.x - old.x, p.z - old.z) > 2 ? 1 : alpha;
      for (const key of ['x', 'y', 'z', 'swing']) out[key] = lerp(old?.[key] ?? p[key], p[key], t);
      out.jump = out.y;
      out.bodyYaw = angle(old?.bodyYaw ?? p.bodyYaw, p.bodyYaw, t);
      copyPoint(out.head, p.head);
      for (const key of ['x', 'y', 'z']) out.head[key] = lerp(old?.head[key] ?? p.head[key], p.head[key], t);
      p.neckPoints.forEach((point, j) => {
        const q = copyPoint(out.neckPoints[j] ||= {}, point);
        for (const key of ['x', 'y', 'z']) q[key] = lerp(old?.neckPoints[j]?.[key] ?? point[key], point[key], t);
      });
      out.neckPoints.length = p.neckPoints.length;
    });
    state.players.length = game.players.length;
    copyPoint(state.ball, game.ball);
    for (const key of ['x', 'y', 'z']) state.ball[key] = lerp(this.previous.ball[key], game.ball[key], alpha);
    return state;
  }
}

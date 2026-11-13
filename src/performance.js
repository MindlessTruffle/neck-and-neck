/** Device budgets and conservative downward-only dynamic resolution. */
export function createRenderPerformance({ coarse = false, nativeDpr = 1, hardwareConcurrency = 8, deviceMemory = 8 } = {}) {
  const lowPower = hardwareConcurrency <= 4 || deviceMemory <= 3;
  const profile = coarse ? 'mobile' : lowPower ? 'compact' : 'desktop';
  const cap = coarse ? 1.25 : lowPower ? 1.4 : 1.75;
  const budget = Object.freeze({
    grass: coarse ? 3200 : lowPower ? 8000 : 15000,
    trees: coarse ? 14 : lowPower ? 23 : 31,
    fansPerStand: coarse ? 6 : lowPower ? 10 : 16,
    flowersPerSide: coarse ? 6 : lowPower ? 11 : 17,
    clouds: coarse ? 4 : 7,
    birds: coarse ? 2 : 5,
    hills: coarse ? 8 : 13,
    flagsPerSide: coarse ? 8 : lowPower ? 13 : 19,
    shadowSize: coarse ? 512 : lowPower ? 1024 : 2048,
    antialias: !coarse || !lowPower,
  });
  let deviceDpr = Math.max(.5, Number(nativeDpr) || 1), elapsed = 0, slowSeconds = 0, cooldown = 0, frameAverage = 1 / 60;
  const initial = Math.min(cap, deviceDpr), minimum = Math.min(initial, coarse ? .75 : .8);
  const state = { profile, coarse, lowPower, qualityLevel: 0, pixelRatio: initial, minimumPixelRatio: minimum, maxPixelRatio: cap, shadowSize: budget.shadowSize, decorationScale: 1, averageFps: 60 };
  function apply() {
    state.pixelRatio = Math.max(state.minimumPixelRatio, Math.round((Math.min(cap, deviceDpr) - state.qualityLevel * .15) * 100) / 100);
    state.decorationScale = Math.max(.45, 1 - state.qualityLevel * .12);
    state.shadowSize = state.qualityLevel >= 3 ? (coarse ? 512 : 1024) : budget.shadowSize;
  }
  function update(dt) {
    // Background tabs and long browser interruptions are not GPU measurements.
    if (!Number.isFinite(dt) || dt <= 0 || dt > .25) return false;
    elapsed += dt; cooldown = Math.max(0, cooldown - dt);
    frameAverage += (dt - frameAverage) * (1 - Math.exp(-dt * 2));
    state.averageFps = Math.round(10 / Math.max(.001, frameAverage)) / 10;
    if (elapsed < 2 || cooldown > 0 || state.qualityLevel >= 7) return false;
    const slowLimit = coarse ? 1 / 43 : 1 / 49;
    slowSeconds = frameAverage > slowLimit ? slowSeconds + dt : Math.max(0, slowSeconds - dt * 2);
    if (slowSeconds < 2.5) return false;
    slowSeconds = 0; cooldown = 4; state.qualityLevel++; apply(); return true;
  }
  function resize(nextDpr) {
    if (!Number.isFinite(nextDpr) || nextDpr <= 0 || nextDpr === deviceDpr) return false;
    deviceDpr = Math.max(.5, nextDpr); state.minimumPixelRatio = Math.min(Math.min(cap, deviceDpr), coarse ? .75 : .8); apply(); return true;
  }
  return { budget, state, update, resize };
}

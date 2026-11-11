/** Both requests must run inside the same gesture, pointer lock before fullscreen. */
export function requestGameCapture({ canvas, stage, documentRef = document, coarse = false, onError = () => {} }) {
  canvas?.focus();
  let pending = Promise.resolve();
  if (!coarse && documentRef.pointerLockElement !== canvas) {
    try {
      if (!canvas?.requestPointerLock) throw new Error('Pointer lock is unavailable in this browser.');
      pending = Promise.resolve(canvas.requestPointerLock()).catch(onError);
    } catch (error) { onError(error); }
  }
  // Do not await pointer lock: fullscreen still needs this gesture's activation.
  if (!documentRef.fullscreenElement && stage?.requestFullscreen) {
    try { Promise.resolve(stage.requestFullscreen()).catch(() => {}); } catch {}
  }
  return pending;
}

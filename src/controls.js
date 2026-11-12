const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** Mouse steers the physical neck target; the renderer follows its actual pose. */
export function steerLook(view, neck, dx, dy, touch = false) {
  const sensitivity = touch ? .007 : .007;
  neck.yaw += dx * sensitivity;
  neck.pitch = clamp(neck.pitch - dy * sensitivity, -.9, 1.25);
  view.yaw = neck.yaw;
  view.pitch = clamp((neck.pitch - .15) / 3, -.2, .3);
}

export function cameraRelativeMovement(forward, strafe, yaw) {
  const length = Math.max(1, Math.hypot(forward, strafe));
  return {
    x: (forward * Math.cos(yaw) - strafe * Math.sin(yaw)) / length,
    z: (forward * Math.sin(yaw) + strafe * Math.cos(yaw)) / length,
  };
}

export function stickMovement(dx, dy, radius = 48) {
  const distance = Math.hypot(dx, dy);
  if (distance < 5) return { x: 0, z: 0 };
  const scale = Math.min(1, distance / radius) / distance;
  return { x: dx * scale, z: dy * scale };
}

/** One movement pointer owns the stick until release; other fingers remain free to aim. */
export function applyWalk(state, vector, owner) {
  if (state.walkOwner != null && state.walkOwner !== owner) return;
  state.walk = vector;
  state.walkOwner = vector.x || vector.z ? owner : null;
}

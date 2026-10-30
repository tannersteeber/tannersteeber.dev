// Air-relative drag and simplified Magnus lift; no prediction or theme enters here.
import { BALL_RADIUS as RADIUS } from './CupPhysics.js?v=20261026-touch-9';
export function airAcceleration(v, wind, spin, sideSpin = 0) {
  const x = v.x - wind.x,
    y = v.y,
    z = v.z - wind.z,
    speed = Math.hypot(x, y, z),
    horizontal = Math.hypot(x, z);
  if (speed < .001) return { x: 0, y: -9.81, z: 0 };
  const ratio = Math.abs(spin) * Math.PI / 30 * RADIUS / speed;
  const lift = .0185 * Math.min(.24, .65 * ratio) * speed * speed * Math.sign(spin);
  const drag = .0031 * speed, curve = .0185 * .075 * sideSpin * speed;
  // Lift perpendicular to airflow rather than an arbitrary upward acceleration.
  return {
    x: -drag * x - (horizontal ? lift * y * x / (speed * horizontal) : 0) + curve * z,
    y: -9.81 - drag * y + lift * horizontal / speed,
    z: -drag * z - (horizontal ? lift * y * z / (speed * horizontal) : 0) - curve * x,
  };
}

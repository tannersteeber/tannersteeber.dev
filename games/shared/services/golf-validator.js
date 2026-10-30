// Shared pure validator: the browser supplies decisions, never positions, scores or outcomes.
import { Course } from '../../ripagolf/Course.js';
import { BallPhysics } from '../../ripagolf/BallPhysics.js';
import { predictions, predictionWon, reward, scoreName } from '../../ripagolf/rules.js';
export const GOLF_VERSION = 'golf-v1';
export function golfCourse(seed, index) {
  return new Course((Number(seed) + Math.imul(index, 0x9e3779b9)) >>> 0, index);
}
export function validateGolf(session, request) {
  const state = structuredClone(session.state), metrics = {};
  if (!Number.isInteger(state.holeIndex) || state.holeIndex < 1 || state.holeIndex > 10000) {
    throw new Error('Invalid course state');
  }
  const course = golfCourse(session.seed, state.holeIndex);
  if (request.operation === 'prediction') {
    if (state.prediction || state.result) throw new Error('Prediction is already locked');
    if (!predictions(course.par).some((p) => p.id === request.prediction)) {
      throw new Error('Invalid prediction');
    }
    state.prediction = request.prediction;
  } else if (request.operation === 'next') {
    if (!state.result?.won) throw new Error('Win the current hole before continuing');
    state.holeIndex++;
    state.strokes = 0;
    state.prediction = null;
    state.ball = null;
    state.windTime = 0;
    state.result = null;
  } else if (request.operation === 'shot') {
    if (!state.prediction || state.result) throw new Error('Lock a prediction before shooting');
    if (state.strokes >= 30) throw new Error('Stroke limit reached. Start a new run.');
    const spec = request.spec;
    if (!spec || !Number.isInteger(spec.club) || spec.club < 0 || spec.club > 8) {
      throw new Error('Invalid club');
    }
    for (
      const [key, lo, hi] of [
        ['power', .005, 1],
        ['aim', -Math.PI, Math.PI],
        ['error', -1, 1],
        ['spin', -1, 1],
        ['shape', -1, 1],
        ['loft', -10, 10],
      ]
    ) {
      if (!Number.isFinite(spec[key]) || spec[key] < lo || spec[key] > hi) {
        throw new Error('Invalid ' + key);
      }
    }
    const wait = request.wait ?? 0;
    if (!Number.isFinite(wait) || wait < 0 || wait > 120) throw new Error('Invalid shot timing');
    const ball = new BallPhysics(course);
    if (state.ball) ball.restore(state.ball);
    const windStart = (state.windTime || 0) + wait;
    if (!ball.launch(spec)) throw new Error('Ball is not ready');
    state.strokes++;
    let event, time = windStart, steps = 0;
    for (; steps < 120 * 60; steps++) {
      time += 1 / 120;
      event = ball.update(1 / 120, time);
      if (event?.type === 'penalty' || ball.status === 'rest' || ball.status === 'holed') break;
    }
    if (steps === 120 * 60) throw new Error('Shot did not settle within the simulation limit');
    state.windTime = time;
    state.ball = ball.snapshot();
    state.lastShot = { spec, windStart, steps: steps + 1, event: event?.type ?? null };
    if (event?.type === 'penalty') state.strokes += event.penalty;
    metrics.strokes = 1 + (event?.type === 'penalty' ? event.penalty : 0);
    if (ball.status === 'holed') {
      const won = predictionWon(state.prediction, course.par, state.strokes);
      state.streak = won ? state.streak + 1 : 0;
      const points = won ? reward(state.prediction, state.streak) : 0;
      state.score += points;
      state.result = {
        won,
        points,
        streak: state.streak,
        score: state.score,
        name: scoreName(course.par, state.strokes),
      };
      Object.assign(metrics, {
        holes: 1,
        game_points: points,
        relative_over: Math.max(0, state.strokes - course.par),
        relative_under: Math.max(0, course.par - state.strokes),
        birdies: Number(state.strokes - course.par === -1),
        eagles: Number(state.strokes - course.par === -2),
        aces: Number(state.strokes === 1),
        won: Number(won),
        lost: Number(!won),
        streak: state.streak,
        score: state.score,
      });
    }
  } else throw new Error('Unknown golf operation');
  return { state, metrics, finished: !!state.result && !state.result.won };
}

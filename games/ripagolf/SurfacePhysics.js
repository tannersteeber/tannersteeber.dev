// Metres, seconds and m/s². Keep contact tuning separate from the simulation.
export const SURFACE_PHYSICS = Object.freeze({
  green:   { restitution:.16, contactFriction:.38, landingDrag:.035, rolling:.22, grip:.25, launch:1 },
  fairway: { restitution:.34, contactFriction:.11, rolling:.85, speedDrag:.02, grip:1.05, launch:1 },
  tee:     { restitution:.32, contactFriction:.10, rolling:.8, speedDrag:.02, grip:1, launch:1 },
  rough:   { restitution:.13, contactFriction:.36, rolling:2.25, speedDrag:.03, grip:2.7, launch:.8 },
  sand:    { restitution:.04, contactFriction:.72, rolling:4.8, speedDrag:.04, grip:5.5, launch:.65 },
  water:   { restitution:0, contactFriction:1, rolling:8, grip:8, launch:0 }
});
export const surfacePhysics=lie=>SURFACE_PHYSICS[lie]||SURFACE_PHYSICS.rough;

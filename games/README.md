# Portfolio Arcade: Cruise, Cutup & RipaGolf

Open `arcade.html`, then choose **Play**. Games also have independent static URLs:

- `games/cruise/` — endless winding backroads, scenery, distance and time; optional car-part pickups with a parts counter and collection score.
- `games/cutup/` — four-lane traffic weaving, close passes, combos and a saved personal best.
- `games/ripagolf/` — procedural golf, physical cups, swipe/timing swings, prediction streaks and saved runs.

## Run locally and deploy

From the repository root:

```sh
python3 -m http.server 8000
```

Visit `http://localhost:8000/arcade.html`. ES modules require HTTP rather than opening HTML with `file://`. Deploy the repository unchanged to GitHub Pages or another static host. There is **no build step, backend, package installation, or CDN dependency**. All game URLs and imports are relative, including under a project subdirectory. HTTPS is needed for motion permissions on phones (localhost is suitable for desktop testing).

The only runtime dependency is **Three.js r160 / 0.160.0**, already vendored at `vendor/three.module.js`, under the MIT license in `vendor/LICENSE`. The site's vanilla HTML/CSS/JavaScript architecture is preserved. Vehicles, scenery, terrain, textures, and synthesized sounds are generated locally; no third-party game assets are used.

## Controls

- **A/D or left/right arrows:** gradual steering.
- **W/S or up/down arrows:** adjust Cruise automatic speed, accelerate/brake in manual Cruise, boost/brake in Cutup.
- **Escape:** pause/resume. The pause button also works on touchscreens.
- **Mouse mode:** hold the left/right half of the viewport; movement alone never steers.
- **Touch mode:** hold the left/right half. Opposite simultaneous touches cancel. Cutup provides boost/brake pedals; Cruise shows pedals with automatic speed off.
- **Tilt mode:** select in mobile settings, tap **Enable Tilt Steering**, then calibrate neutral. Denied, missing, invalid or stale sensor readings allow touch fallback. There is no sensor requirement to play.

All games disable text selection, touch callouts and browser dragging across the game screen so held controls cannot highlight labels or open a long-press menu. Mobile controls, menus and settings reserve 64–96 px above the bottom edge plus the device safe area to stay clear of browser toolbars. Settings inputs and scrolling menus remain interactive.

Speed, cruising settings, distances and records are displayed in mph and miles. Physics and existing saved distances retain their original metre-based units internally. Each Arcade card has an expandable **Info & updates** section; update its `info` data in `library.js` to maintain the history. Genre tabs stay hidden until categories are assigned to future entries.

Drive over a piston to earn 100 points or a brake rotor to earn 150. Parts and score reset when starting a new drive. The world recycles a fixed pickup pool, and collection checks the path traveled between frames.

In both games, rear lights brighten when braking. Signature adds a **Car color** picker under Settings → Appearance; the selected paint is saved and shared between the two games. Retro and Digital Rain keep their theme colors.

Settings include steering sensitivity/inversion, tilt dead zone/range, camera, graphics quality, sound, traffic density, weather/time, and the portfolio's page themes. Signature inherits light/dark appearance; Retro and Digital Rain use their own palettes, just as on the portfolio. Digital Rain renders falling 0/1 sprites in the selected hue; other themes retain normal rain streaks when rainy weather is selected. Appearance preferences share the site's existing storage keys. Driving preferences and records use `tsd.arcade.settings.v1`; invalid or unavailable storage falls back to defaults.

Low/Medium/High adjust resolution, scenery density and draw distance immediately. High antialiasing is selected when the renderer is created and needs a reload. Sustained low frame rates reduce resolution automatically. Leaving the tab pauses a live run; returning requires Resume. The scene uses merged meshes, shared geometry/materials, recycled road chunks and pooled traffic. Settings and personal records are local to the browser.

## Modules and extending

`shared/engine/DrivingGame.js` owns the common state machine, input, rendering, audio, camera, vehicle and UI. Each game supplies the road, decoration, HUD and rules. `RoadGenerator` maintains bounded centre-line data and chunk meshes; restart regenerates the start rather than accessing discarded samples. `TrafficSystem` reuses a fixed mesh pool, maintains same-lane spacing and leaves gaps on spawn. Vehicles can be extended through `registerCarType()` in `AssetManager.js`.

Add independent games to `library.js` with an `href`, or use the existing `Arcade.register({ create(...) })` API in `js/arcade.js` for canvas games. The original canvas player and registry remain available.

## Verification

Run logic regressions with Node.js 22+:

```sh
node --test games/tests/engine.test.mjs
```

The suite covers index buffers/normals; 30 km of road generation, boundary continuity and restart after pruning; steering at different frame rates; traffic spacing/pooling; settings/records; held pointer input; simulated orientation/calibration and denied permission; collisions/combos; and both scenery generators.

Open `games/tests/browser.html` on the local server for actual WebGL checks at desktop, portrait, and landscape sizes. This exercises both games with simulated keyboard/mouse/touch events, pause/resume, settings fit, all themes/cameras/quality presets, restart after pruning, and Cutup collision/game-over. Test preferences are restored afterward. `games/tests/library.html` checks the five navigation menus, release history, and Arcade info expansion and descriptions at desktop/mobile widths in all appearances.

Manual browser checks should cover title → play → pause → settings → resume/restart → Arcade, both games, keyboard/mouse, all themes and cameras, weather, resolution changes, portrait/landscape and narrow layouts. Observe console errors and visual continuity during extended drives. Test best-score persistence after reload and no automatic resumption after switching tabs.

**Physical mobile testing remains required.** Simulated orientation events verify calculations and permission flow, not the behavior of real iOS/Android sensors. On an iPhone/iPad and an Android phone, verify touch/multitouch, grant/deny motion access, flat rotation versus upright steering, left/right direction, neutral recalibration, screen rotation, sensor fallback, audio unlock, scrolling settings, and performance. Do not infer mobile Safari or hardware validation from the logic tests.

## RipaGolf

`games/ripagolf/` is a standalone 3D golf/prediction game, lazy-loaded from its Arcade link. It reuses the vendored Three.js renderer and animation loop; no dependency or build step was added. Its code separates seeded courses, fixed-step physics, rules, virtual predictions, persistence, theme adaptation, input, audio and interface.

**Play:** Review a par 3, 4 or 5, choose a chip and lock the prediction. Choose one of nine clubs, adjust aim/power and use the bold, outlined shot preview. RG monogram plaques mark the tee. On mobile, swipe upward in the dedicated swing zone. Aim/power sliders and tap buttons are always available; spin, shape and flight use always-visible button rows without scrolling. Club selection stays in a dropdown. Aim sliders and tap buttons support 0.1° steps; the preview turns immediately between physics refreshes. The course renders across the entire screen behind translucent controls. Portrait uses lower-left aim/power controls and a lower-right swipe area; landscape keeps them at the sides. The camera frames the ball and target into the clear screen area while keeping the world visible behind the HUD. On desktop, set Power and click Time swing / press Space and strike when the accuracy needle reaches the center. A/D adjust aim (hold Shift for precision), 1–9 select clubs, course dragging adjusts the camera/aim, and wheel/trackpad scrolling zooms. Putter power is tuned for short, precise rolls. Escape pauses; saved runs can be resumed from the main menu.

**Scoring:** Every shot adds a stroke. Water adds one penalty stroke and safe fairway relief. Out of bounds adds one penalty stroke and returns to the previous lie. These are documented arcade simplifications, not a complete implementation of tournament golf rules. One world unit is one metre: the ball is 42.67 mm across, the cup is 108 mm across and 101.6 mm deep. The terrain has an actual opening, rim, inner wall and bottom. Swept contact tests distinguish a slow entry, fast pass and glancing rim deflection. A separate falling state settles the ball inside before scoring; there are no prediction-based magnets or changes to physics. Predictions use the final stroke count including penalties. Par 3s omit eagle predictions that duplicate a hole-in-one; hole-in-one chips are offered on par 3s. Exact predictions must match; or-better predictions include better scores.

**Virtual points:** Base rewards are 500 / 1,000 / 1,500 / 2,000 / 3,000 / 5,000 / 8,000 / 20,000 points by prediction, with a capped streak bonus. A failed prediction ends the run. No purchases, real money, transfers or cash-equivalent rewards exist. Streak milestones award local cosmetic badges only.

**Persistence:** `tsd.ripagolf.v1` stores validated settings, records, lifetime statistics and the current hole/ball state. Stroke totals include started shots and penalties; completed-hole counts and average vs par include only finished holes. Settling a hole is idempotent, so reloading a result cannot award it twice. Starting a new run replaces the unfinished run. Mute, separate effects/music volume, reduced motion, graphics and input sensitivities are configurable. Sound is generated locally after a gesture.

**Themes:** `ThemeAdapter.js` reads existing website tokens and observes changes and shared storage keys. Signature supplies an adaptable emerald/gold identity; Retro, Digital Rain and future CSS themes inherit their typography and accents. Optional `--golf-bg`, `--golf-surface`, `--golf-text`, `--golf-accent` and related semantic tokens override defaults. Changing themes updates existing colors/materials/lights without regenerating geometry or altering ball state, course seed, wind, scoring or the locked prediction.

**Verification:** `node --test games/tests/ripagolf.test.mjs` checks generation, club distances, fixed-step consistency, wind/spin/lie/slope effects, putting, penalties, scoring/predictions, records and resume state. Open `games/tests/ripagolf.html` on the local server for actual WebGL and complete-loop checks at desktop, portrait and landscape sizes, including existing/future themes. These use simulated input and known short-putt fixtures; they do not establish real phone/trackpad performance. Physical mobile and extended hardware playtesting remain useful for tuning.


### RipaGolf gameplay implementation and tuning

- `CupPhysics.js` owns metre-scale dimensions, swept opening tests and rim contact. `BallPhysics.js` integrates at 120 Hz, interpolates rendering positions, and handles flight, contact, roll, cup descent and shot measurements. `Aerodynamics.js` uses air-relative drag and simplified Magnus lift/curve; `SurfacePhysics.js` centralizes restitution, contact energy loss, rolling resistance and lie-dependent launch resistance. This is a deterministic custom golf model, not a certified sports simulator.
- `Course.js` combines seeded broad elevation, local contours, raised tees/greens and bunker/water shaping. A 1.5 m heightfield is authoritative: rendering and collision use the same triangular interpolation. The cup surround is planar at the pin and cut to the opening. Seed validation checks safe routes, pin placement and slopes, with deterministic terrain-strength reduction when required. `TerrainGeometry.js` builds these meshes without a separate collision approximation.
- `SwingGesture.js` uses normalized displacement, velocity, duration and club-specific response. Short putt swipes have finer power response. A real-time themed SVG trail follows coalesced pointer samples; power, estimated range, speed and directional deviation follow the gesture. Returning to the starting area, moving outside the zone, a tiny tap, pointer cancellation, blur or resize cannot launch a shot. Camera/club/power controls are locked during an active swipe. Desktop retains the power slider and Space/button timing swing.
- `GolfCamera.js` handles overview, aiming, flight, landing and putting framing with interpolated focus/position and ground clearance. Camera movement stops during gesture input. The real-size ball has a separate visual locator; its collision dimensions stay unchanged. Putting provides slope information and an optional green-reading grid under Settings → Putting slope grid.
- Ground contact records carry; rest records total displacement, final lie and remaining pin distance. The last-shot summary is shown in shot controls. Speed up to next shot switches to visible 8× playback, with an option to return to normal speed. Each animation frame advances the same fixed-step simulation; it does not teleport to the result. Fine distances near the cup use feet; club ranges remain yards and wind uses mph.
- Existing save keys and statistics remain. Version 2 ball snapshots retain fixed-step remainder, wind clock, shot measurements and cup-fall state. Legacy oversized-ball snapshots resume at the same horizontal lie on the new terrain without adding a stroke. Theme changes only recolor existing presentation resources.

Run both logic suites with `node --test games/tests/ripagolf.test.mjs games/tests/engine.test.mjs`. The golf checks include metre-scale cup entry and misses, airborne chips, rim contact, uphill rollback, downhill acceleration, cross-slope break, wind, terrain/mesh agreement, input cancellation, frame-rate independence, short/long putting and seeded par 3/4/5 playthroughs from the tee. Browser checks add six viewport sizes, emulated safe areas, pointer trails, cancellation, camera isolation, guide settings, live themes, saved runs and the normal prediction/result loop. The test-only shot planner searches legal club/power/aim inputs; it never teleports a ball or changes physics. Physical phone, sensor and sustained frame-time measurements still require real hardware.


Open `games/tests/startup.html` to exercise the actual game HTML and shared boot loader at desktop and mobile sizes, without clearing saved preferences. RipaGolf declares `data-game-version` in its HTML and uses matching `?v=` tags for its module graph, boot script and CSS. Bump these tags together when changing module interfaces so an older cached module cannot be mixed into a newer game build. Startup failures retain a diagnostic message in `#game-root[data-startup-error]` and log the original error in the console.


RipaGolf also has Main, Hole and Course camera buttons. Main uses a low position near the ball; Hole frames the whole green and fringe; Course shows the whole hole without changing the shot. The Contours toggle adds an elevation tint, 8 cm contour bands and downhill arrows over the green and its runoffs. It is also available in Settings. Texture maps distinguish rough grass, mown fairway, fine green grain, raked sand and water. Full shots lose more energy on green contact; the original putting rolling resistance and calibrated short-putt response remain. `SurfaceTextures.js` generates reusable detail maps without downloads or new dependencies.

All games keep Arcade at the upper left and a 44px Pause button at the upper right, including title, pause and settings screens. On driving title/results screens, Pause opens a compact game menu. `games/tests/ripagolf.html?ui=1` runs the responsive UI checks without repeating the longer tee-to-cup shot search.

# Portfolio Arcade: Cruise & Cutup

Open `arcade.html`, then choose **Play**. Games also have independent static URLs:

- `games/cruise/` — endless winding backroads, scenery, distance and time; no scoring objective.
- `games/cutup/` — four-lane traffic weaving, close passes, combos and a saved personal best.

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

Speed, cruising settings, distances and records are displayed in mph and miles. Physics and existing saved distances retain their original metre-based units internally. Each Arcade card has an expandable **Info & updates** section; update its `info` data in `library.js` to maintain the history. Genre tabs stay hidden until categories are assigned to future entries.

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

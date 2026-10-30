/* Game changelogs live here, newest first; website release notes stay in projects.html.
 * Use Feature / Update / Patch labels and dates when known. Game history is independent
 * of website version numbers. Add future categories with genre. */
Arcade.register({
  id: 'cruise',
  title: 'Cruise',
  icon: 'games/cruise/mark.svg',
  releaseDate: '2026-10-24',
  description:
    'Relax into winding backroads, rolling hills and forests. Collect car parts as you drive. No timer.',
  href: 'games/cruise/',
  info: {
    about: [
      'An endless, relaxed 3D drive through procedural countryside, with forests, open fields and changing elevation. There is no finish line or time pressure. Optional piston and brake-rotor pickups add a small collection challenge.',
      'Choose automatic cruising or manual acceleration, enable optional road assistance, and make the drive your own with four camera views, time of day and weather. Drive over pistons for 100 points and brake rotors for 150; the HUD tracks your parts and session score. Your longest drive is saved in this browser.',
    ],
    controls:
      'A/D or arrow keys to steer. W/S or up/down to adjust speed. Choose held mouse, touch or optional calibrated tilt steering in Settings. Gas and Brake buttons are available in every camera and speed mode. Escape or Pause opens the menu.',
    updates: [{
      title: 'Controls & mobile polish',
      date: '2026-10-26',
      items: [
        'Update — Gas and Brake buttons stay available in every camera, on desktop and mobile, with automatic or manual speed.',
        'Update — Added a scenic-road logo and persistent Arcade and Pause buttons.',
        'Patch — Fixed the game page in place and suppressed text selection, copy menus and long-press callouts; settings menus still scroll.',
      ],
    }, {
      title: 'Driving & collection improvements',
      items: [
        'Feature — Collect pistons for 100 points and brake rotors for 150, with Parts and Score counters.',
        'Update — Added braking lights, saved Signature car colors, mph/miles and binary Digital Rain.',
        'Patch — Matched the compact site menu and raised mobile controls above browser toolbars.',
      ],
    }, {
      title: 'First release',
      date: '2026-10-24',
      items: [
        'Feature — Endless countryside, four cameras, weather, sound and graphics settings.',
        'Feature — Automatic or manual speed, road assistance, keyboard/mouse/touch/tilt steering and saved driving preferences and distance records.',
      ],
    }],
  },
});
Arcade.register({
  id: 'cutup',
  title: 'Cutup',
  icon: 'games/cutup/mark.svg',
  releaseDate: '2026-10-24',
  description: 'Find your line through four lanes, thread close passes and build your best combo.',
  href: 'games/cutup/',
  info: {
    about: [
      'An endless 3D highway game built around traffic weaving. Keep moving, find gaps between cars and earn bonuses for close passes. Consecutive near misses build a score multiplier.',
      'Traffic includes sedans, SUVs, vans and trucks, with adjustable density. A collision ends the run; restart to challenge your personal best, saved in this browser.',
    ],
    controls:
      'A/D or arrow keys to steer. W/S or up/down to boost or brake. Mouse, touch and optional calibrated tilt steering share the same settings as Cruise. Escape or the pause button opens the menu.',
    updates: [{
      title: 'Controls & mobile polish',
      date: '2026-10-26',
      items: [
        'Update — Added a car-and-lanes logo and persistent Arcade and Pause buttons.',
        'Patch — Kept the game page fixed and blocked text selection, copy menus and long-press callouts while retaining menu scrolling.',
      ],
    }, {
      title: 'Driving improvements',
      items: [
        'Update — Added braking lights and saved Signature car colors; speed uses mph and run distance uses miles.',
        'Update — Digital Rain uses falling 1s and 0s in the selected theme color.',
        'Patch — Matched the compact site pause menu and raised mobile hold controls above browser toolbars.',
      ],
    }, {
      title: 'First release',
      date: '2026-10-24',
      items: [
        'Feature — Four-lane traffic, close-pass combos, collisions and saved personal bests.',
        'Feature — Four cameras, adjustable traffic, weather, sound, graphics settings and keyboard/mouse/touch/tilt controls.',
      ],
    }],
  },
});

Arcade.register({
  id: 'ripagolf',
  title: 'RipaGolf',
  icon: 'games/ripagolf/mark.svg',
  releaseDate: '2026-10-24',
  description:
    'Swing. Predict. Survive. Read each golf hole, lock in a prediction and build your virtual-point streak.',
  href: 'games/ripagolf/',
  info: {
    about: [
      'Endless seeded par 3, 4 and 5 holes with nine clubs, wind, slopes, sand, water and putting. Choose your performance prediction before each hole; a win extends the streak and a miss ends the run.',
      'Free virtual points only, with no money, purchases or prizes. Your statistics, milestone badges, settings and current run are saved in this browser. Website themes transform the table and course accents without resetting play.',
    ],
    controls:
      'On mobile, swipe upward in the dedicated swing zone. On desktop, set Power and use Time swing / Space and strike at the center. A/D aim (Shift for precision), 1–9 select clubs, drag the course to adjust the view, and use the mouse wheel to zoom. Escape pauses.',
    updates: [{
      title: 'Shot controls & course views',
      date: '2026-10-26',
      items: [
        'Update — Mobile aim, power, spin, shape and flight fit without scrolling; selected options highlight immediately.',
        'Update — Added 0.1° aim steps, fine touch dragging and a brighter preview that turns smoothly with aim.',
        'Update — Main stays near the ball, Hole frames the full green and fringe, and Course shows the whole hole.',
        'Feature — Added green contours, downhill arrows, detailed surface textures and RG tee ornaments.',
        'Update — Reduced full-shot rollout on greens and added visible 8× fast-forward playback.',
        'Patch — Anchored Pause upper-right, centered Arcade text and blocked page movement and long-press callouts.',
      ],
    }, {
      title: 'Physics & swing overhaul',
      items: [
        'Feature — Added physical cup drops, swept ball entry, rim deflections, putting guides and shot summaries.',
        'Update — Unified terrain and collision heights, with rolling hills, depressed bunkers, wind/spin flight and surface-specific bounce and roll.',
        'Update — Added swipe trails and cancellation, clearer club distances, smoother desktop timing and a larger mobile swipe area over full-screen scenery.',
        'Patch — Raised mobile UI above browser toolbars and versioned startup files to prevent mixed cached modules.',
      ],
    }, {
      title: 'First release',
      date: '2026-10-24',
      items: [
        'Feature — Seeded par 3/4/5 courses, nine clubs, mobile swipe swings and desktop timing controls.',
        'Feature — Prediction chips, virtual-point streak rewards, statistics, milestone badges and saved-run resume.',
        'Update — Integrated website themes, sound, graphics settings and saved preferences.',
      ],
    }],
  },
});

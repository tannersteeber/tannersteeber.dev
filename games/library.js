/* Add future categories with genre, and append release entries to info.updates. */
Arcade.register({
  id: 'cruise', title: 'Cruise', releaseDate: '2026-10-24',
  description: 'Relax into winding backroads, rolling hills and forests. Collect car parts as you drive. No timer.',
  href: 'games/cruise/',
  info: {
    about: [
      'An endless, relaxed 3D drive through procedural countryside, with forests, open fields and changing elevation. There is no finish line or time pressure. Optional piston and brake-rotor pickups add a small collection challenge.',
      'Choose automatic cruising or manual acceleration, enable optional road assistance, and make the drive your own with four camera views, time of day and weather. Drive over pistons for 100 points and brake rotors for 150; the HUD tracks your parts and session score. Your longest drive is saved in this browser.'
    ],
    controls: 'A/D or arrow keys to steer. W/S or up/down to adjust speed. Choose held mouse, touch or optional calibrated tilt steering in Settings. Escape or the pause button opens the menu.',
    updates: [{
      title: 'Current build',
      items: [
        'Feature — Endless countryside, four camera views, weather, sound and saved driving preferences.',
        'Feature — Collectible pistons and brake rotors with a parts counter and collection score.',
        'Update — Speed and cruising settings display mph; distances and records display miles.',
        'Update — Digital Rain surrounds the drive with falling 1s and 0s, tinted by the theme hue.',
        'Update — Brake lights brighten while braking, and Signature includes a saved car-color picker.',
        'Patch — Pause menu now matches the compact site popup and fits desktop and mobile screens.'
      ]
    }]
  }
});
Arcade.register({
  id: 'cutup', title: 'Cutup', releaseDate: '2026-10-24',
  description: 'Find your line through four lanes, thread close passes and build your best combo.',
  href: 'games/cutup/',
  info: {
    about: [
      'An endless 3D highway game built around traffic weaving. Keep moving, find gaps between cars and earn bonuses for close passes. Consecutive near misses build a score multiplier.',
      'Traffic includes sedans, SUVs, vans and trucks, with adjustable density. A collision ends the run; restart to challenge your personal best, saved in this browser.'
    ],
    controls: 'A/D or arrow keys to steer. W/S or up/down to boost or brake. Mouse, touch and optional calibrated tilt steering share the same settings as Cruise. Escape or the pause button opens the menu.',
    updates: [{
      title: 'Current build',
      items: [
        'Feature — Four-lane traffic, close-pass combos, collisions and saved personal best scores.',
        'Update — Speed displays mph and the run summary displays distance in miles.',
        'Update — Digital Rain uses falling 1s and 0s in the selected theme color.',
        'Update — Brake lights brighten while braking, and Signature includes a saved car-color picker.',
        'Patch — Pause menu now matches the compact site popup and fits desktop and mobile screens.'
      ]
    }]
  }
});

Arcade.register({
  id: 'ripagolf', title: 'RipaGolf', icon: 'games/ripagolf/mark.svg', releaseDate: '2026-10-24',
  description: 'Swing. Predict. Survive. Read each golf hole, lock in a prediction and build your virtual-point streak.',
  href: 'games/ripagolf/',
  info: {
    about: [
      'Endless seeded par 3, 4 and 5 holes with nine clubs, wind, slopes, sand, water and putting. Choose your performance prediction before each hole; a win extends the streak and a miss ends the run.',
      'Free virtual points only, with no money, purchases or prizes. Your statistics, milestone badges, settings and current run are saved in this browser. Website themes transform the table and course accents without resetting play.'
    ],
    controls: 'On mobile, swipe upward in the dedicated swing zone. On desktop, set Power and use Time swing / Space and strike at the center. A/D aim, 1–9 select clubs, drag the course to adjust the view, and use the mouse wheel to zoom. Escape pauses.',
    updates: [{ title: 'Gameplay improvements', items: [
      'Feature — Recessed cups with swept ball entry, rim deflections and a physical drop before scoring.',
      'Update — Shared terrain collision, rolling hills, bunker depressions, air-relative flight and surface-specific bounce and roll.',
      'Update — Live swipe trails, usable mobile aim/power controls, full-screen scenery and Main/Hole/Course cameras.',
      'Update — Green contours and runoff arrows, distinct surface textures, restrained green rollout and animated 8× shot playback.'
    ] }, { title: 'First release', items: [
      'Feature — Procedural golf, fixed-step shot physics, nine clubs and precision putting.',
      'Feature — Prediction chips, streak rewards, local statistics and milestone badges.',
      'Update — Live website themes, mobile swipe controls and saved-run resume.'
    ] }]
  }
});

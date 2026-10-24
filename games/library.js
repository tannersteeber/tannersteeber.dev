/* Add future categories with genre, and append release entries to info.updates. */
Arcade.register({
  id: 'cruise', title: 'Cruise',
  description: 'Relax into winding backroads, rolling hills and forests. No timer. Just the road ahead.',
  href: 'games/cruise/',
  info: {
    about: [
      'An endless, relaxed 3D drive through procedural countryside, with forests, open fields and changing elevation. There is no finish line or score to chase.',
      'Choose automatic cruising or manual acceleration, enable optional road assistance, and make the drive your own with four camera views, time of day and weather. Your longest drive is saved in this browser.'
    ],
    controls: 'A/D or arrow keys to steer. W/S or up/down to adjust speed. Choose held mouse, touch or optional calibrated tilt steering in Settings. Escape or the pause button opens the menu.',
    updates: [{
      title: 'Current build',
      items: [
        'Feature — Endless countryside, four camera views, weather, sound and saved driving preferences.',
        'Update — Speed and cruising settings display mph; distances and records display miles.',
        'Update — Digital Rain surrounds the drive with falling 1s and 0s, tinted by the theme hue.',
        'Patch — Pause menu now matches the compact site popup and fits desktop and mobile screens.'
      ]
    }]
  }
});
Arcade.register({
  id: 'cutup', title: 'Cutup',
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
        'Patch — Pause menu now matches the compact site popup and fits desktop and mobile screens.'
      ]
    }]
  }
});

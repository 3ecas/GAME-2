/* Hop — tuning, characters and biomes. Everything a designer would want to touch lives here.

   tuning (px, seconds; logical width is 390 px):
     D_MIN / D_MAX      horizontal jump distance at zero / full charge (flat landing)
     T_MAX              seconds of holding for a full charge
     G                  gravity
     T_FLIGHT_MIN/ADD   flight time = MIN + ADD * charge; longer jumps float higher
     PERFECT_R          half-width of the dead-center zone on a pad
     FROG_SCREEN_X      where the character rests on screen
     W_START / W_END    pad width range at the start of a run and after RAMP pads
     GAP_MARGIN         minimum clear space between two pads
     H_MIN / H_MAX      pad heights above the water
     H_VAR_END          max height change between consecutive pads after RAMP pads
     MOVE_FROM          pad index from which moving pads can appear
     MOVE_CHANCE_END    chance of a moving pad after RAMP pads (ramps from 0)
     BIOME_LEN          pads per biome before the scenery changes

   characters: cubes. `body` is the cube color, `face` is 'happy' | 'sleepy' | 'star',
     `acc` is 'none' | 'sprout' | 'bow' | 'glasses' | 'crown'. `unlock` is the best score needed.

   biomes: pastel scenery. `scene` is 'hills' | 'skyline' | 'planets'. `sun.low` puts the sun
     just above the hills. `water: null` means a void below the pads instead of water.
*/
window.HOP_DATA = {
  tuning: {
    D_MIN: 44, D_MAX: 270, T_MAX: 1.1, G: 1800, T_FLIGHT_MIN: 0.5, T_FLIGHT_ADD: 0.25,
    PERFECT_R: 6, FROG_SCREEN_X: 100,
    W_START: [72, 106], W_END: [38, 64], RAMP: 60, GAP_MARGIN: 34,
    H_MIN: 70, H_MAX: 150, H_VAR_END: 40,
    MOVE_FROM: 30, MOVE_CHANCE_END: 0.35, MOVE_AMP: [10, 22], MOVE_PERIOD: [2.0, 3.0],
    BIOME_LEN: 25,
  },
  ink: '#4a3f5c',
  cream: '#fff7ee',
  pastels: ['#ffc9d6', '#bfeedd', '#fff0a6', '#bfe0ff', '#dcccff', '#ffd4b8'],
  characters: [
    { id: 'mochi', name: 'Mochi', unlock: 0, body: '#ffc9d6', face: 'happy', acc: 'none' },
    { id: 'mint', name: 'Mint', unlock: 25, body: '#bfeedd', face: 'happy', acc: 'sprout' },
    { id: 'butter', name: 'Butter', unlock: 75, body: '#fff0a6', face: 'happy', acc: 'bow' },
    { id: 'sky', name: 'Sky', unlock: 150, body: '#bfe0ff', face: 'sleepy', acc: 'none' },
    { id: 'lavender', name: 'Lavender', unlock: 300, body: '#dcccff', face: 'star', acc: 'none' },
    { id: 'peach', name: 'Peach', unlock: 600, body: '#ffd4b8', face: 'happy', acc: 'glasses' },
    { id: 'cloud', name: 'Cloud', unlock: 1200, body: '#ffffff', face: 'happy', acc: 'crown' },
  ],
  biomes: [
    { id: 'meadow', name: 'Meadow', sky: ['#cfe9ff', '#fff3e2'], clouds: '#ffffff', sun: { color: '#fff1b0', x: 300, y: 118, r: 30, low: false }, moon: false, stars: false, scene: 'hills',
      far: '#cfeccf', near: '#a9dcae', water: '#b3dcf7', waterDeep: '#8ec2ea', padTop: '#f6dfc8', padSide: '#e5bfa3', padRim: '#fff5ea', marker: '#8d6f95' },
    { id: 'dusk', name: 'Dusk', sky: ['#ffc8b8', '#fff2d9'], clouds: '#fff0ea', sun: { color: '#ffd9a0', x: 230, y: 0, r: 42, low: true }, moon: false, stars: false, scene: 'hills',
      far: '#e2c3e6', near: '#c9a4d6', water: '#f6c5b5', waterDeep: '#e9a48f', padTop: '#f9e3ee', padSide: '#e6c3d5', padRim: '#fff6fa', marker: '#7d5b7b' },
    { id: 'twilight', name: 'Twilight', sky: ['#4b4a80', '#9b8fcf'], clouds: null, sun: null, moon: true, stars: true, scene: 'skyline',
      far: '#5f5a9a', near: '#4a4680', water: '#7d8fd0', waterDeep: '#5c6bb0', padTop: '#c9c0f0', padSide: '#9d92d6', padRim: '#eae4ff', marker: '#fff0b8' },
    { id: 'cosmos', name: 'Cosmos', sky: ['#2f2a52', '#6b4d86'], clouds: null, sun: null, moon: false, stars: true, scene: 'planets',
      far: '#4a3d6d', near: '#3a2f58', water: null, waterDeep: null, padTop: '#d9cdf2', padSide: '#a99bd6', padRim: '#f4eeff', marker: '#ffcfa3' },
  ],
};

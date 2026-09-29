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
  characters: [
    { id: 'frog', name: 'Frog', unlock: 0, body: '#4cc26b', belly: '#bff0c4', acc: 'none' },
    { id: 'toad', name: 'Toad', unlock: 25, body: '#e8893a', belly: '#ffd9a8', acc: 'none' },
    { id: 'ghost', name: 'Ghost', unlock: 75, body: '#f2f4ff', belly: '#ffffff', acc: 'sheet' },
    { id: 'cat', name: 'Cat', unlock: 150, body: '#8d8fa5', belly: '#e6e7f2', acc: 'ears' },
    { id: 'ninja', name: 'Ninja', unlock: 300, body: '#2b2f45', belly: '#3d4260', acc: 'band' },
    { id: 'astro', name: 'Astronaut', unlock: 600, body: '#f4f4f4', belly: '#dfe6f5', acc: 'helmet' },
    { id: 'king', name: 'King', unlock: 1200, body: '#4cc26b', belly: '#bff0c4', acc: 'crown' },
  ],
  biomes: [
    { id: 'pond', name: 'Pond', sky: ['#7fcdff', '#dff4ff'], far: '#9ad3a0', near: '#5fae6a', water: '#3a9ad8', waterDeep: '#2a6fb0', padTop: '#d2a465', padSide: '#8b5a2b', marker: '#2b1b0e', sun: '#fff1a8' },
    { id: 'sunset', name: 'Sunset', sky: ['#ff8a5c', '#ffd08a'], far: '#9b5f9b', near: '#5e3a6e', water: '#d9785a', waterDeep: '#8f3e3e', padTop: '#c8ccd6', padSide: '#7a7f8c', marker: '#2a2d36', sun: '#ffd27a' },
    { id: 'night', name: 'Night', sky: ['#070b22', '#1a2a5e'], far: '#0d1533', near: '#070b1c', water: '#123a6e', waterDeep: '#071a36', padTop: '#4d63a8', padSide: '#222c52', marker: '#8ff6ff', sun: '#fff6d0' },
    { id: 'space', name: 'Space', sky: ['#020108', '#1b0a33'], far: '#2a1747', near: '#120a22', water: null, waterDeep: null, padTop: '#a39cb3', padSide: '#5e5670', marker: '#ff9f43', sun: null },
  ],
};

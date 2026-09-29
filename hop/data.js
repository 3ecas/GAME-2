/* Hop — tuning, shapes and themes. Everything a designer would want to touch lives here.

   tuning (px, seconds; logical width is 390 px):
     D_MIN / D_MAX      horizontal jump distance at zero / full charge (flat landing)
     T_MAX              seconds of holding for a full charge
     G                  gravity
     T_FLIGHT_MIN/ADD   flight time = MIN + ADD * charge; longer jumps float higher
     PERFECT_R          half-width of the dead-center zone on a pad
     FROG_SCREEN_X      where the character rests on screen
     W_START / W_END    pad width range at the start of a run and after RAMP pads
     GAP_MARGIN         minimum clear space between two pads
     H_MIN / H_MAX      pad heights above the baseline
     H_VAR_END          max height change between consecutive pads after RAMP pads
     MOVE_FROM          pad index from which moving pads can appear
     MOVE_CHANCE_END    chance of a moving pad after RAMP pads (ramps from 0)
     BIOME_LEN          pads per theme before the palette changes

   characters: the player is a plain shape. `shape` is square | circle | triangle | diamond |
     hexagon | star | plus. `color` is its accent, also used for the glow, the charge ring and
     the perfect popups. `unlock` is the best score needed.

   themes: one palette per 25 pads, light to dark and back. `pad` is [top, bottom] of the pad
     gradient. `orb` tints the soft background circles that give the scene depth. `dark` flips the
     UI text to light.
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
    { id: 'square', name: 'Square', unlock: 0, shape: 'square', color: '#f25f5c' },
    { id: 'circle', name: 'Circle', unlock: 25, shape: 'circle', color: '#4aa3df' },
    { id: 'triangle', name: 'Triangle', unlock: 75, shape: 'triangle', color: '#f2b134' },
    { id: 'diamond', name: 'Diamond', unlock: 150, shape: 'diamond', color: '#3cb371' },
    { id: 'hexagon', name: 'Hexagon', unlock: 300, shape: 'hexagon', color: '#9b6bdf' },
    { id: 'star', name: 'Star', unlock: 600, shape: 'star', color: '#f28c28' },
    { id: 'plus', name: 'Plus', unlock: 1200, shape: 'plus', color: '#2bb5a8' },
  ],
  themes: [
    { id: 'paper', name: 'Paper', dark: false, bg: '#f7f4ee', bg2: '#ece7df', ink: '#2b2b2b', muted: '#9c968e', pad: ['#ffffff', '#efeae2'], padShadow: 'rgba(40,30,20,.16)', base: 'rgba(43,43,43,.14)', void: '#ebe6dd', marker: '#2b2b2b', orb: '#f3c9a6' },
    { id: 'mist', name: 'Mist', dark: false, bg: '#eef2f6', bg2: '#dfe6ee', ink: '#26303a', muted: '#8f9aa6', pad: ['#ffffff', '#e4ebf2'], padShadow: 'rgba(20,40,60,.16)', base: 'rgba(38,48,58,.14)', void: '#dfe6ee', marker: '#26303a', orb: '#a9c7e3' },
    { id: 'night', name: 'Night', dark: true, bg: '#23262e', bg2: '#181a20', ink: '#f2f2f0', muted: '#8d919c', pad: ['#3d414c', '#2b2e37'], padShadow: 'rgba(0,0,0,.4)', base: 'rgba(242,242,240,.16)', void: '#1b1d23', marker: '#f2f2f0', orb: '#4f5670' },
    { id: 'ink', name: 'Ink', dark: true, bg: '#141c30', bg2: '#0b1020', ink: '#eef1f8', muted: '#7f89a3', pad: ['#2b3653', '#1f2841'], padShadow: 'rgba(0,0,0,.45)', base: 'rgba(238,241,248,.16)', void: '#0f1526', marker: '#eef1f8', orb: '#3a4e85' },
  ],
};

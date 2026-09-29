/* Hop — tuning and palettes. Everything a designer would want to touch lives here.

   tuning (px, seconds; logical width is 390 px, y grows downward):
     G                 gravity
     V_MAX             launch speed at a full pull
     DRAG_MAX          pull length (px on screen) that gives a full-power launch
     DEADZONE          pulls shorter than this are ignored (a tap is not a launch)
     SIZE              side of the square
     BOUNCE            vertical restitution when landing on a platform
     BOUNCE_FRICTION   horizontal speed kept on each bounce
     BOUNCE_MIN_VY     below this landing speed the square slides instead of bouncing
     SLIDE_DECEL       sliding friction on a platform
     STEP              fixed physics step, so 60 Hz and 120 Hz phones play the same launch
     BALL_SCREEN_X     where the resting square sits on screen, from the left
     BALL_SCREEN_Y     where the resting square sits on screen, as a fraction of the height
     PLAT_TH           platform thickness
     W_START / W_END   platform width range at the start and after RAMP platforms
     GAP_START/GAP_END horizontal gap between platform edges, start and after RAMP platforms
     DY_START / DY_END change in platform height (negative is higher), start and after RAMP platforms
     TOP_RANGE         platforms stay within this many px above or below the first one
     FALL_MARGIN       how far below the platforms the square must drop to count as a fall
     RAMP              platforms over which difficulty ramps
     THEME_LEN         platforms per palette

   themes: flat colors only. `dark` flips the UI to light text.
*/
window.HOP_DATA = {
  tuning: {
    G: 1800, V_MAX: 820, DRAG_MAX: 140, DEADZONE: 12, SIZE: 26,
    BOUNCE: 0.3, BOUNCE_FRICTION: 0.5, BOUNCE_MIN_VY: 80, SLIDE_DECEL: 480, STEP: 1 / 240,
    BALL_SCREEN_X: 96, BALL_SCREEN_Y: 0.6,
    PLAT_TH: 18, W_START: [84, 124], W_END: [46, 72],
    GAP_START: [50, 130], GAP_END: [100, 190],
    DY_START: [-30, 30], DY_END: [-90, 80],
    TOP_RANGE: 320, FALL_MARGIN: 340,
    RAMP: 50, THEME_LEN: 25,
  },
  square: '#f28b82',
  themes: [
    { id: 'cream', name: 'Cream', dark: false, bg: '#f7f1e6', plat: '#c9d6e3', ink: '#3b3a4a', muted: '#9a978f' },
    { id: 'mint', name: 'Mint', dark: false, bg: '#e9f4ea', plat: '#c2cfe0', ink: '#334138', muted: '#8fa094' },
    { id: 'lilac', name: 'Lilac', dark: false, bg: '#efe9f7', plat: '#cfd7c4', ink: '#3d3a55', muted: '#9a97ac' },
    { id: 'dusk', name: 'Dusk', dark: true, bg: '#4f4c72', plat: '#8b8ec0', ink: '#f3efe8', muted: '#b6b3c9' },
  ],
};

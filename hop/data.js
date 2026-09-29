/* Hop — tuning and palettes. Everything a designer would want to touch lives here.

   tuning (px, seconds, degrees; logical width is 390 px, y grows downward, 1 px = 0.1 m):
     G                 gravity
     V_MAX             launch speed at a full pull
     DRAG_MAX          pull length (px on screen) that gives a full-power launch
     DEADZONE          pulls shorter than this are ignored (a tap is not a launch)
     SIZE              side of the square
     BOUNCE            restitution of a corner hitting the mountain (0 = dead, 1 = perfect bounce)
     BOUNCE_V          impacts slower than this do not bounce at all, so resting contacts stay still
     MU                Coulomb friction at the contact corners
     FACE_DAMP         fraction of spin kept per step while lying on a face (a block slides, it does not roll)
     FACE_SNAP         how fast a face is pulled flush with the surface it lies on
     SPIN_DRAG         per-second decay of spin while any corner touches the ground (a tumbling block dies fast)
     SPIN              spin given on launch, as a fraction of speed over half the side
     SLOP / CORR       penetration tolerance and the fraction corrected per step (keeps corners out of the rock)
     REST_V / REST_W   linear and angular speed below which the square counts as still
     REST_TIME         seconds of stillness in contact before it is asleep and can be launched again
     AIR_TIMEOUT       seconds without touching anything before the run counts as a fall (safety net)
     STEP              fixed physics step; rendering interpolates between steps so motion stays smooth at any frame rate
     CAM_X / CAM_Y     where the square sits on screen, as fractions of width and height
     M_PER_PX          meters of height per world pixel
     RAMP_M            meters of climb over which difficulty ramps
     LEDGE             flat ledge length, [[min,max] at start, [min,max] at full difficulty]
     WALL_H            height of a step up
     RAMP_H            height of a diagonal ramp up
     RAMP_DEG          angle of every diagonal, ramps and descents alike (45: rise equals run)
     HOLE_W            crevasse width
     HOLE_DEPTH        how far down a crevasse goes before the fall counts
     HOLE_FROM_M       no crevasses below this height, so the first climb cannot end in one
     DROP              height of the occasional step down or diagonal descent (rare: the mountain goes up)
     LEDGE_P           chance that only one obstacle separates two ledges, start and full difficulty
     MAX_GAIN          height one launch can be asked to gain between two ledges
     THEME_M           meters per palette

   The mountain is straight lines only: flat ledges, vertical steps, 45° diagonals and crevasses, with no acute
   corner anywhere. Every ledge is proven reachable from the middle of the one before it by test-flying launches
   with the real physics while it is generated.

   themes: flat colors only. `dark` flips the UI to light text.
*/
window.HOP_DATA = {
  tuning: {
    G: 1800, V_MAX: 820, DRAG_MAX: 140, DEADZONE: 12, SIZE: 26,
    BOUNCE: 0.2, BOUNCE_V: 40, MU: 0.6, FACE_DAMP: 0.2, FACE_SNAP: 0.35, SPIN_DRAG: 25, SPIN: 0.12, SLOP: 0.2, CORR: 0.85,
    REST_V: 14, REST_W: 0.7, REST_TIME: 0.25, AIR_TIMEOUT: 12, STEP: 1 / 240,
    CAM_X: 0.42, CAM_Y: 0.62,
    M_PER_PX: 0.1, RAMP_M: 300,
    LEDGE: [[60, 120], [44, 90]],
    WALL_H: [[20, 50], [40, 100]], RAMP_H: [[20, 60], [40, 110]], RAMP_DEG: 45,
    HOLE_W: [[30, 60], [50, 110]], HOLE_DEPTH: 150, HOLE_FROM_M: 50, DROP: [16, 40],
    LEDGE_P: [0.95, 0.6], MAX_GAIN: 135, THEME_M: 60,
  },
  square: '#f28b82',
  themes: [
    { id: 'cream', name: 'Cream', dark: false, bg: '#f7f1e6', mount: '#c9d6e3', ledge: '#a9bccf', ink: '#3b3a4a', muted: '#9a978f' },
    { id: 'mint', name: 'Mint', dark: false, bg: '#e9f4ea', mount: '#c2cfe0', ledge: '#9fb3cc', ink: '#334138', muted: '#8fa094' },
    { id: 'lilac', name: 'Lilac', dark: false, bg: '#efe9f7', mount: '#cfd7c4', ledge: '#aebb9f', ink: '#3d3a55', muted: '#9a97ac' },
    { id: 'dusk', name: 'Dusk', dark: true, bg: '#4f4c72', mount: '#8b8ec0', ledge: '#a9abd6', ink: '#f3efe8', muted: '#b6b3c9' },
  ],
};

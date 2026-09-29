/* Hop — tuning and palettes. Everything a designer would want to touch lives here.

   tuning (px, seconds, degrees; logical width is 390 px, y grows downward, 1 px = 0.1 m):
     G                 gravity
     V_MAX             launch speed at a full pull
     DRAG_MAX          pull length (px on screen) that gives a full-power launch
     DEADZONE          pulls shorter than this are ignored (a tap is not a launch)
     SIZE              side of the square
     BOUNCE            restitution along the surface normal when landing
     BOUNCE_FRICTION   speed along the surface kept on each bounce
     BOUNCE_MIN_V      below this impact speed the square sticks and slides instead of bouncing
     MU_K / MU_S       sliding and static friction; the square rests on slopes up to atan(MU_S), about 23°
     WALL_DEG          surfaces steeper than this act as walls (bounce back instead of landing)
     STEP              fixed physics step; rendering interpolates between steps so motion stays smooth at any frame rate
     CAM_X / CAM_Y     where the square sits on screen, as fractions of width and height
     M_PER_PX          meters of height per world pixel
     RAMP_M            meters of climb over which difficulty ramps
     LEDGE             flat safe ledge length, [[min,max] at start, [min,max] at full difficulty]
     SLOPE_DEG         slope steepness
     GAIN              height gained by one slope
     WALL_H            height of a vertical step
     HOLE_W            crevasse width
     HOLE_DEPTH        how far down a crevasse goes before the fall counts
     DROP              height lost by an occasional descent
     LEDGE_P           chance of a ledge after an obstacle, start and full difficulty
     MAX_GAIN          height one launch can be asked to gain between two ledges
     REACH             fraction of the theoretical full-pull range the course may demand
     THEME_M           meters per palette

   themes: flat colors only. `dark` flips the UI to light text.
*/
window.HOP_DATA = {
  tuning: {
    G: 1800, V_MAX: 820, DRAG_MAX: 140, DEADZONE: 12, SIZE: 26,
    BOUNCE: 0.3, BOUNCE_FRICTION: 0.55, BOUNCE_MIN_V: 90, MU_K: 0.35, MU_S: 0.42, WALL_DEG: 65, STEP: 1 / 240,
    CAM_X: 0.42, CAM_Y: 0.62,
    M_PER_PX: 0.1, RAMP_M: 300,
    LEDGE: [[60, 120], [34, 80]], SLOPE_DEG: [[18, 34], [26, 56]], GAIN: [[30, 80], [60, 130]],
    WALL_H: [[20, 45], [40, 100]], HOLE_W: [[30, 60], [50, 110]], HOLE_DEPTH: 200, DROP: [20, 70],
    LEDGE_P: [0.95, 0.6], MAX_GAIN: 135, REACH: 0.8, THEME_M: 60,
  },
  square: '#f28b82',
  themes: [
    { id: 'cream', name: 'Cream', dark: false, bg: '#f7f1e6', mount: '#c9d6e3', ledge: '#a9bccf', ink: '#3b3a4a', muted: '#9a978f' },
    { id: 'mint', name: 'Mint', dark: false, bg: '#e9f4ea', mount: '#c2cfe0', ledge: '#9fb3cc', ink: '#334138', muted: '#8fa094' },
    { id: 'lilac', name: 'Lilac', dark: false, bg: '#efe9f7', mount: '#cfd7c4', ledge: '#aebb9f', ink: '#3d3a55', muted: '#9a97ac' },
    { id: 'dusk', name: 'Dusk', dark: true, bg: '#4f4c72', mount: '#8b8ec0', ledge: '#a9abd6', ink: '#f3efe8', muted: '#b6b3c9' },
  ],
};

/* Hop — tuning, shapes and palettes. Everything a designer would want to touch lives here.

   tuning (px, seconds, degrees; logical width is 390 px):
     G                 gravity
     ANGLE             launch angle of every hit
     V_MIN / V_MAX     launch speed at zero / full charge
     T_MAX             seconds of holding for a full charge
     BALL_R            radius of the shape
     BOUNCE            vertical restitution on landing
     BOUNCE_FRICTION   horizontal speed kept on each bounce (the surface "checks" the ball)
     BOUNCE_MIN_VY     below this landing speed the ball rolls instead of bouncing
     ROLL_DECEL        rolling friction
     CUP_R             half-width of the cup
     CUP_V             rolling speed below which the ball drops into the cup
     CUP_V_AIR         landing speed below which a ball landing on the cup drops straight in
     STEP              fixed physics step, so 60 Hz and 120 Hz phones play the same shot
     BALL_SCREEN_X     where the resting ball sits on screen
     CHANNEL_W         water channel after every green, [start, after RAMP holes]
     FAIRWAY_LEN       fairway between the channel and the next green
     GREEN_W           green width, [[min,max] at start, [min,max] after RAMP holes]
     CUP_FRAC          where the cup sits along the green
     HAZARD_FROM       hole index from which a water hazard can cut the fairway
     HAZARD_CHANCE_END chance of a hazard after RAMP holes (ramps from 0)
     HAZARD_W          hazard width
     MAX_STROKES       strokes allowed per hole before the run ends
     RAMP              holes over which difficulty ramps
     THEME_LEN         holes per palette

   characters: the player is a plain shape: square | circle | triangle | diamond | hexagon | star | plus.
     `color` is its pastel, also used for the flag, the charge ring and the perfect popups.

   themes: flat pastel palettes. `dark` flips the UI to light text.
*/
window.HOP_DATA = {
  tuning: {
    G: 1800, ANGLE: 52, V_MIN: 300, V_MAX: 690, T_MAX: 1.1,
    BALL_R: 12, BOUNCE: 0.32, BOUNCE_FRICTION: 0.5, BOUNCE_MIN_VY: 60, ROLL_DECEL: 320,
    CUP_R: 9, CUP_V: 160, CUP_V_AIR: 220, STEP: 1 / 240,
    BALL_SCREEN_X: 64,
    CHANNEL_W: [30, 56], FAIRWAY_LEN: [40, 80], GREEN_W: [[70, 110], [46, 72]], CUP_FRAC: [0.35, 0.65],
    HAZARD_FROM: 6, HAZARD_CHANCE_END: 0.6, HAZARD_W: [30, 60],
    MAX_STROKES: 3, RAMP: 50, THEME_LEN: 15,
  },
  characters: [
    { id: 'square', name: 'Square', unlock: 0, shape: 'square', color: '#f28b82' },
    { id: 'circle', name: 'Circle', unlock: 25, shape: 'circle', color: '#7fb8e0' },
    { id: 'triangle', name: 'Triangle', unlock: 75, shape: 'triangle', color: '#f2cf6b' },
    { id: 'diamond', name: 'Diamond', unlock: 150, shape: 'diamond', color: '#7fcfa4' },
    { id: 'hexagon', name: 'Hexagon', unlock: 300, shape: 'hexagon', color: '#b39ddb' },
    { id: 'star', name: 'Star', unlock: 600, shape: 'star', color: '#f2a86b' },
    { id: 'plus', name: 'Plus', unlock: 1200, shape: 'plus', color: '#6fc3c3' },
  ],
  themes: [
    { id: 'meadow', name: 'Meadow', dark: false, sky: '#f7f1e6', ground: '#cfe6c8', groundTop: '#b9d9b1', green: '#a3d3ab', water: '#b9dcf3', ink: '#3b3a4a', muted: '#9a978f', sun: '#f7dfae' },
    { id: 'peach', name: 'Peach', dark: false, sky: '#fbe8dd', ground: '#f1d3ba', groundTop: '#e6c1a3', green: '#e3b393', water: '#c4d9f2', ink: '#4a3b3a', muted: '#a89890', sun: '#f9c9b0' },
    { id: 'lilac', name: 'Lilac', dark: false, sky: '#ede7f8', ground: '#cfd6ee', groundTop: '#bfc8e7', green: '#b1bde3', water: '#c6e6ea', ink: '#3d3a55', muted: '#9a97ac', sun: '#e7d3f5' },
    { id: 'dusk', name: 'Dusk', dark: true, sky: '#514e75', ground: '#6b6c98', groundTop: '#5f6090', green: '#8b8ec0', water: '#5f80ab', ink: '#f3efe8', muted: '#b6b3c9', sun: '#f2c9a3' },
  ],
};

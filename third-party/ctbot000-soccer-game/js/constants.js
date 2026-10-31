// Pitch geometry and gameplay tuning. All distances are in world units;
// the renderer scales the world to fit whatever the screen gives it.

const MARGIN = 60;

export const FIELD = {
  left: MARGIN,
  top: MARGIN,
  w: 1080,
  h: 640,
  right: MARGIN + 1080,
  bottom: MARGIN + 640,
  cx: MARGIN + 540,
  cy: MARGIN + 320,
};

export const WORLD = { w: FIELD.right + MARGIN, h: FIELD.bottom + MARGIN };

export const GOAL = { halfHeight: 74, depth: 44, postR: 5 };
export const PENALTY_AREA = { depth: 172, halfHeight: 176 };
export const GOAL_AREA = { depth: 62, halfHeight: 92 };
export const PENALTY_SPOT = 116;
export const CENTER_CIRCLE_R = 88;
export const CORNER_R = 16;

export const PLAYER_R = 11;
export const BALL_R = 7;

// Movement. Velocity chases the desired velocity exponentially, so the
// response is identical at any frame rate.
export const RUN_SPEED = 205;
export const SPRINT_MULT = 1.3;
export const ACCEL_K = 9;
export const STAMINA_MAX = 1;
export const STAMINA_DRAIN = 0.28;   // per second while sprinting
export const STAMINA_REGEN = 0.16;   // per second otherwise

// Ball
export const BALL_DRAG = 0.92;       // exponential decay per second
export const BALL_STOP = 5;          // below this speed the ball is at rest
export const WALL_BOUNCE = 0.7;
export const POST_BOUNCE = 0.62;
export const PLAYER_BOUNCE = 0.55;

// Kicking
export const CONTROL_RADIUS = 26;
export const GK_REACH = 1.5;         // a keeper's reach, as a multiple of the above
export const DRIBBLE_DIST = PLAYER_R + BALL_R + 6;
export const KICK_COOLDOWN = 0.34;   // seconds before the kicker may retake it
export const SHOT_MIN = 400;
export const SHOT_MAX = 780;
export const CHARGE_TIME = 0.6;      // seconds to a full-power shot
export const PASS_MIN = 260;
export const PASS_MAX = 620;
export const ARRIVAL_SPEED = 165;    // how fast a weighted pass should still be on arrival

// Duels
export const TACKLE_RANGE = 30;
export const TACKLE_INTERVAL = 0.3;  // a duel is rolled per decision, not per tick
export const STUN_TIME = 0.45;

// Match flow (seconds of simulated time)
export const KICKOFF_PAUSE = 1.6;
export const GOAL_PAUSE = 3.0;
export const DEFAULT_HALF_LENGTH = 100;

export const DIFFICULTY = {
  easy:   { label: 'Easy',   speed: 0.9,  decide: 0.34, tackle: 0.2,  aim: 46, shootRange: 300, press: 0.75 },
  normal: { label: 'Normal', speed: 0.98, decide: 0.24, tackle: 0.34, aim: 30, shootRange: 350, press: 0.9 },
  hard:   { label: 'Hard',   speed: 1.05, decide: 0.17, tackle: 0.46, aim: 18, shootRange: 400, press: 1.05 },
};

// The player's own team-mates play at a fixed, competent level so that the
// difficulty dial only ever moves the opposition.
export const ALLY_SKILL = { speed: 0.99, decide: 0.22, tackle: 0.34, aim: 28, shootRange: 350, press: 0.92 };

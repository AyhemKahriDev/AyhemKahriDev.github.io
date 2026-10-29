window.SD = window.SD || {};

(function () {
  'use strict';

  window.SD.Config = {
    LANES: [-2.2, 0, 2.2],
    LANE_W: 2.2,
    ROAD_HALF: 3.3,

    CAM_H: 2.4,
    HORIZON_RATIO: 0.4,
    FOCAL_RATIO: 0.85,
    FOCAL_RATIO_W: 1.0,
    SCENE_SCALE_W: 1280,
    SCENE_SCALE_MIN: 0.45,
    NEAR_Z: 0.55,
    FAR_Z: 120,
    PLAYER_Z: 4.5,

    START_SPEED: 16,
    MAX_SPEED: 42,
    ACCEL: 0.32,

    JUMP_V: 9.8,
    GRAVITY: 24,
    SLIDE_TIME: 0.85,
    LANE_LERP: 11,

    PLAYER_HEIGHT: 1.75,
    SLIDE_HEIGHT: 0.85,
    PLAYER_DEPTH: 0.55,

    COIN_VALUE: 10,
    COIN_GAP: 2.3,

    POWERUP_CHANCE: 0.14,
    POWERUP_Y: 0.9,
    POWERUP_WEIGHTS: {
      magnet: 15,
      shield: 15,
      dash: 12,
      doubleCoins: 15,
      slowmo: 12,
      spring: 12,
      coinShower: 14,
      extraLife: 5
    },
    FX_MAGNET: 8,
    FX_DASH: 3,
    FX_2X: 10,
    FX_SLOWMO: 4,
    FX_SPRING: 10,
    DASH_SPEED: 1.5,
    SLOWMO_SPEED: 0.6,
    SPRING_JUMP: 1.4,
    SMASH_SCORE: 5,

    MONSTER_SCALE_MIN: 0.5,
    MONSTER_SCALE_MAX: 0.7,
    MONSTER_FEET_MIN: 0.93,
    MONSTER_FEET_MAX: 1.0,

    SPAWN_BASE: 0.95,
    SPAWN_MIN: 0.42,
    SPAWN_Z: 116,

    BEST_KEY: 'subway-dash-best',
    TOTAL_KEY: 'subway-dash-coins'
  };

  window.SD.lerp = function (a, b, t) {
    return a + (b - a) * t;
  };

  window.SD.clamp = function (v, a, b) {
    return Math.max(a, Math.min(b, v));
  };

  window.SD.rand = function (a, b) {
    return a + Math.random() * (b - a);
  };
})();

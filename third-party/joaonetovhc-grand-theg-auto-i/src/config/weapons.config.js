// ═══════════════════════════════════════════════════════════
//  THEG I — Weapon Definitions
// ═══════════════════════════════════════════════════════════

export const WEAPONS = [
  { name: 'UNARMED',  ammo: -1, res: -1,  dmg: 30,  fr: 600,  rng: 4,   speed: 0,   color: '#fff'     },
  { name: 'PISTOLA',  ammo: 17, res: 136, dmg: 40,  fr: 350,  rng: 80,  speed: 80,  color: '#f5c518'  },
  { name: 'AK-47',    ammo: 30, res: 300, dmg: 28,  fr: 100,  rng: 120, speed: 120, color: '#aaa'     },
  { name: 'SNIPER',   ammo: 6,  res: 30,  dmg: 250, fr: 1200, rng: 600, speed: 300, color: '#00ffee'  },
];

export const DEFAULT_AMMO = [null, 17, 30, 6];
export const DEFAULT_RESERVE = [null, 136, 300, 30];

// What's Poppin — Core Logic Tests
// Coverage for scanRuns, textStyle/TEXT_PRESETS, and SafeStorage
// These are critical paths that power match detection, UI consistency, and data integrity

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Constants mirrored from game.js ──────────────────────────
const MIN_MATCH = 3;
const UI_FONT = '"Segoe UI", system-ui, sans-serif';

// ── scanRuns (extracted from game.js) ────────────────────────
function scanRuns(grid, outerLen, innerLen, cellAt, coordOf) {
  const matched = new Set();
  for (let o = 0; o < outerLen; o++) {
    for (let i = 0; i <= innerLen - MIN_MATCH; i++) {
      const color = cellAt(o, i)?.getData('colorIdx');
      if (color === undefined) continue;
      const run = [coordOf(o, i)];
      for (let k = 1; i + k < innerLen; k++) {
        if (cellAt(o, i + k)?.getData('colorIdx') === color) run.push(coordOf(o, i + k));
        else break;
      }
      if (run.length >= MIN_MATCH) run.forEach(p => matched.add(`${p.r},${p.c}`));
    }
  }
  return matched;
}

// ── TEXT_PRESETS + textStyle (extracted from game.js) ─────────
const TEXT_PRESETS = {
  heading: { fontFamily: UI_FONT, fontStyle: 'bold', stroke: '#000000', strokeThickness: 4, fontSize: '28px', color: '#ffffff' },
  stat:    { fontFamily: UI_FONT, fontSize: '14px', color: '#aaaaaa', align: 'center' },
  label:   { fontFamily: UI_FONT, fontSize: '10px', color: '#666666', letterSpacing: 2 },
  muted:   { fontFamily: UI_FONT, fontSize: '12px', color: '#444444' },
  accent:  { fontFamily: UI_FONT, fontStyle: 'bold', fontSize: '20px', color: '#f1c40f', stroke: '#000000', strokeThickness: 3 },
  body:    { fontFamily: UI_FONT, fontSize: '14px', color: '#bbbbbb', align: 'center', lineSpacing: 6 },
  popup:   { fontFamily: UI_FONT, fontStyle: 'bold', stroke: '#000000', strokeThickness: 4 },
  badge:   { fontFamily: UI_FONT, fontSize: '13px', fontStyle: 'bold', stroke: '#000000', strokeThickness: 2 },
};

function textStyle(preset, overrides) {
  const base = TEXT_PRESETS[preset];
  if (!base) throw new Error(`Unknown text preset: "${preset}"`);
  return overrides ? { ...base, ...overrides } : { ...base };
}

// ── SafeStorage (extracted from init.js) ─────────────────────
function createSafeStorage(mockStorage = {}) {
  return {
    _salt: null,
    _store: mockStorage,
    _getSalt() {
      if (this._salt) return this._salt;
      const stored = this._store['_wp_sid'];
      if (stored && /^[0-9a-f]{16}$/.test(stored)) { this._salt = stored; return this._salt; }
      this._salt = 'a1b2c3d4e5f60718'; // deterministic for tests
      this._store['_wp_sid'] = this._salt;
      return this._salt;
    },
    _checksum(key, val) {
      const material = this._getSalt() + ':' + key + ':' + val;
      let h = 0x811c9dc5;
      for (let i = 0; i < material.length; i++) {
        h ^= material.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
      }
      return (h >>> 0).toString(36);
    },
    get(key, fallback) {
      const raw = this._store[key] ?? null;
      if (raw === null) return fallback;
      const check = this._store[key + '_c'] ?? null;
      if (check && check !== this._checksum(key, raw)) return fallback;
      return raw;
    },
    getInt(key, fallback) {
      const raw = this.get(key, null);
      if (raw === null) return fallback;
      if (!/^\d{1,10}$/.test(raw)) return fallback;
      const n = parseInt(raw, 10);
      return Number.isFinite(n) ? Math.max(0, n) : fallback;
    },
    set(key, value) {
      const str = String(value);
      this._store[key] = str;
      this._store[key + '_c'] = this._checksum(key, str);
    },
  };
}

// ── Test helper ──────────────────────────────────────────────
function makeBubble(row, col, colorIdx) {
  const data = { row, col, colorIdx };
  return { getData: (key) => data[key] };
}

function makeRow(cols, colorPattern) {
  return colorPattern.map((c, i) => c === null ? null : makeBubble(0, i, c));
}

// ══════════════════════════════════════════════════════════════
// scanRuns — low-level match detection powering all gameplay
// ══════════════════════════════════════════════════════════════
describe('scanRuns — horizontal scan', () => {
  const hScan = (grid) => scanRuns(
    grid, grid.length, grid[0].length,
    (r, c) => grid[r][c],
    (r, c) => ({ r, c }),
  );

  it('detects a 3-match at the start of a row', () => {
    const row = makeRow(5, [0, 0, 0, 1, 2]);
    const result = hScan([row]);
    expect(result).toContain('0,0');
    expect(result).toContain('0,1');
    expect(result).toContain('0,2');
    expect(result.size).toBe(3);
  });

  it('detects a 3-match at the end of a row', () => {
    const row = makeRow(5, [1, 2, 3, 3, 3]);
    const result = hScan([row]);
    expect(result).toContain('0,2');
    expect(result).toContain('0,3');
    expect(result).toContain('0,4');
  });

  it('returns empty for no matches', () => {
    const row = makeRow(5, [0, 1, 0, 1, 0]);
    expect(hScan([row]).size).toBe(0);
  });

  it('returns empty for exactly 2 of the same color', () => {
    const row = makeRow(4, [0, 0, 1, 2]);
    expect(hScan([row]).size).toBe(0);
  });

  it('detects a full-row match', () => {
    const row = makeRow(6, [3, 3, 3, 3, 3, 3]);
    expect(hScan([row]).size).toBe(6);
  });

  it('skips null cells (holes from pops)', () => {
    const row = makeRow(5, [0, null, 0, 0, 0]);
    const result = hScan([row]);
    // The three 0s at positions 2,3,4 should match; the null breaks the run
    expect(result).toContain('0,2');
    expect(result).toContain('0,3');
    expect(result).toContain('0,4');
    expect(result).not.toContain('0,0');
  });

  it('detects two separate matches in the same row', () => {
    const row = makeRow(8, [1, 1, 1, 2, 3, 3, 3, 0]);
    const result = hScan([row]);
    expect(result.size).toBe(6); // 3 + 3
  });

  it('handles single-cell row without crashing', () => {
    // innerLen (1) < MIN_MATCH (3), so the inner loop never runs
    const row = makeRow(1, [0]);
    expect(hScan([row]).size).toBe(0);
  });
});

describe('scanRuns — vertical scan', () => {
  const vScan = (grid) => scanRuns(
    grid, grid[0].length, grid.length,
    (c, r) => grid[r]?.[c],
    (c, r) => ({ r, c }),
  );

  it('detects a vertical 3-match', () => {
    const grid = [[makeBubble(0,0,2)], [makeBubble(1,0,2)], [makeBubble(2,0,2)]];
    const result = vScan(grid);
    expect(result.size).toBe(3);
    expect(result).toContain('0,0');
    expect(result).toContain('1,0');
    expect(result).toContain('2,0');
  });

  it('ignores vertical runs of 2', () => {
    const grid = [[makeBubble(0,0,1)], [makeBubble(1,0,1)], [makeBubble(2,0,4)]];
    expect(vScan(grid).size).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════
// textStyle — typography preset system
// ══════════════════════════════════════════════════════════════
describe('textStyle preset system', () => {
  it('returns a copy, not the original preset object', () => {
    const a = textStyle('heading');
    const b = textStyle('heading');
    expect(a).toEqual(b);
    expect(a).not.toBe(b); // must be a new object each call
  });

  it('merges overrides without mutating the preset', () => {
    const custom = textStyle('heading', { fontSize: '48px', color: '#ff0000' });
    expect(custom.fontSize).toBe('48px');
    expect(custom.color).toBe('#ff0000');
    expect(custom.fontStyle).toBe('bold'); // inherited
    // Original preset is untouched
    expect(TEXT_PRESETS.heading.fontSize).toBe('28px');
    expect(TEXT_PRESETS.heading.color).toBe('#ffffff');
  });

  it('throws on unknown preset name', () => {
    expect(() => textStyle('nonexistent')).toThrow('Unknown text preset: "nonexistent"');
  });

  it('every preset includes fontFamily', () => {
    for (const [name, preset] of Object.entries(TEXT_PRESETS)) {
      expect(preset.fontFamily, `${name} missing fontFamily`).toBe(UI_FONT);
    }
  });

  it('all 8 expected presets exist', () => {
    const expected = ['heading', 'stat', 'label', 'muted', 'accent', 'body', 'popup', 'badge'];
    expect(Object.keys(TEXT_PRESETS).sort()).toEqual(expected.sort());
  });
});

// ══════════════════════════════════════════════════════════════
// SafeStorage — tamper-resistant persistence
// ══════════════════════════════════════════════════════════════
describe('SafeStorage', () => {
  let storage;
  beforeEach(() => { storage = createSafeStorage({}); });

  it('round-trips a string value', () => {
    storage.set('name', 'Kira');
    expect(storage.get('name', 'fallback')).toBe('Kira');
  });

  it('round-trips an integer value', () => {
    storage.set('highscore', 4200);
    expect(storage.getInt('highscore', 0)).toBe(4200);
  });

  it('returns fallback for missing key', () => {
    expect(storage.get('ghost', 'nope')).toBe('nope');
    expect(storage.getInt('ghost', -1)).toBe(-1);
  });

  it('detects tampered values (returns fallback)', () => {
    storage.set('score', '1000');
    // Simulate manual localStorage edit
    storage._store['score'] = '9999';
    expect(storage.get('score', 'tampered')).toBe('tampered');
  });

  it('detects cross-key replay (copying value+checksum between keys)', () => {
    storage.set('score', '500');
    // Copy value AND checksum to a different key
    storage._store['hacked'] = storage._store['score'];
    storage._store['hacked_c'] = storage._store['score_c'];
    // Should fail because checksum binds the key name
    expect(storage.get('hacked', 'blocked')).toBe('blocked');
  });

  it('rejects scientific notation in getInt', () => {
    storage.set('score', '1e5');
    expect(storage.getInt('score', 0)).toBe(0);
  });

  it('rejects hex notation in getInt', () => {
    storage.set('score', '0xff');
    expect(storage.getInt('score', 0)).toBe(0);
  });

  it('rejects negative numbers in getInt', () => {
    storage.set('score', '-100');
    expect(storage.getInt('score', 0)).toBe(0);
  });

  it('rejects floats in getInt', () => {
    storage.set('score', '3.14');
    expect(storage.getInt('score', 0)).toBe(0);
  });

  it('rejects values exceeding 10 digits in getInt', () => {
    storage.set('score', '12345678901'); // 11 digits
    expect(storage.getInt('score', 0)).toBe(0);
  });

  it('accepts max 10-digit number in getInt', () => {
    storage.set('score', '9999999999');
    expect(storage.getInt('score', 0)).toBe(9999999999);
  });

  it('checksum is deterministic for same salt+key+value', () => {
    const a = storage._checksum('k', 'v');
    const b = storage._checksum('k', 'v');
    expect(a).toBe(b);
  });

  it('checksum differs for different values', () => {
    expect(storage._checksum('k', 'a')).not.toBe(storage._checksum('k', 'b'));
  });

  it('checksum differs for different keys (same value)', () => {
    expect(storage._checksum('x', 'v')).not.toBe(storage._checksum('y', 'v'));
  });

  it('salt is cached after first generation', () => {
    const first = storage._getSalt();
    const second = storage._getSalt();
    expect(first).toBe(second);
  });

  it('reuses existing salt from storage', () => {
    const store = { '_wp_sid': 'deadbeef01234567' };
    const s = createSafeStorage(store);
    expect(s._getSalt()).toBe('deadbeef01234567');
  });

  it('ignores invalid salt format in storage', () => {
    const store = { '_wp_sid': 'not-hex!' };
    const s = createSafeStorage(store);
    // Should generate a new one, not use the invalid one
    expect(s._getSalt()).not.toBe('not-hex!');
  });
});

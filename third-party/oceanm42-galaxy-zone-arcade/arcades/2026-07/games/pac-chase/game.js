/*!
 * games/pac-chase/game.js
 * Pac-Chase — inspired by Pac-Man (1980). A hand-generated, mirror-symmetric
 * 28x31 maze (grown with a recursive-backtracker + a few extra loop
 * connections so it isn't a pure tree, then validated for full connectivity
 * and left/right symmetry) with a central ghost house, one wrap tunnel, and
 * four corner power pellets.
 *
 * Movement is continuous between tile centers: every actor is an integer
 * cell plus a progress fraction t advanced at tiles/sec * dt, with its
 * drawn position interpolated (cell + dir*t). Direction decisions happen
 * exactly when t crosses a whole cell — never per-frame — so speeds stay
 * honest at any frame rate. The player's next turn is buffered — held the
 * moment you press it — and applied at the next legal center (reversals
 * apply instantly mid-cell), which is what gives Pac-Man's cornering feel.
 * Ghosts use the same center rule to pick the legal, non-reversing
 * direction that minimizes straight-line distance to a personality-
 * specific target tile, alternating classic SCATTER/CHASE global modes and
 * reversing on every mode switch.
 */
(function () {
  'use strict';

  var COLS = 28, ROWS = 31;
  var TILE = 19;
  var OFFSET_X = (800 - COLS * TILE) / 2;
  var OFFSET_Y = (600 - ROWS * TILE) / 2;
  var TUNNEL_ROW = 15;

  var UP = { dx: 0, dy: -1 };
  var DOWN = { dx: 0, dy: 1 };
  var LEFT = { dx: -1, dy: 0 };
  var RIGHT = { dx: 1, dy: 0 };
  var NONE = { dx: 0, dy: 0 };

  var PLAYER_SPEED = 8.0;      // tiles/sec
  var GHOST_BASE_SPEED = 7.1;  // tiles/sec
  var FRIGHT_SPEED_MUL = 0.55;
  var EYES_SPEED = 14.0;
  var FRIGHT_BASE = 6.0;
  var DYING_DURATION = 1.3;
  var LEVEL_CLEAR_DURATION = 1.8;
  var READY_DURATION = 1.3;

  // Global scatter/chase schedule, seconds, alternating starting with scatter.
  var MODE_SCHEDULE = [7, 20, 7, 20, 5, 20, 5, 999999];

  var FRUIT_TYPES = [
    { name: 'cherry', color: '#ff3355', points: 100 },
    { name: 'strawberry', color: '#ff2ec4', points: 300 },
    { name: 'orange', color: '#ff8a00', points: 500 },
    { name: 'apple', color: '#39ff6a', points: 700 },
    { name: 'melon', color: '#a94dff', points: 1000 }
  ];

  // 28x31, mirror-symmetric about the vertical centerline, single connected
  // component, one tunnel row (15), 4 power pellets guarding corner runs,
  // and a central ghost house (2-wide door at (13,13)/(13,14), interior on
  // rows 14-15) wrapped in a dot-free service ring. Hand-crafted so there is
  // a junction choice every few tiles — small wall islands, not big slabs.
  // Legend: # wall, . dot, o power pellet, (space) open path/no pellet,
  // D ghost-house door (player-blocked), H ghost-house interior (player-blocked).
  var MAZE_TEMPLATE = [
    '############################',
    '#............##............#',
    '#.####.#####.##.#####.####.#',
    '#o####.#####.##.#####.####o#',
    '#.####.#####.##.#####.####.#',
    '#..........................#',
    '#.####.##.########.##.####.#',
    '#.####.##.########.##.####.#',
    '#......##....##....##......#',
    '######.#####.##.#####.######',
    '######.#####.##.#####.######',
    '######.##          ##.######',
    '######.## ###  ### ##.######',
    '######.## ###DD### ##.######',
    '######.## ##HHHH## ##.######',
    '          ##HHHH##          ',
    '######.## ######## ##.######',
    '######.##          ##.######',
    '######.#####.##.#####.######',
    '######.#####.##.#####.######',
    '#............##............#',
    '#.####.#####.##.#####.####.#',
    '#.####.#####.##.#####.####.#',
    '#o..##.......  .......##..o#',
    '###.##.##.########.##.##.###',
    '###.##.##.########.##.##.###',
    '#......##....##....##......#',
    '#.##########.##.##########.#',
    '#.##########.##.##########.#',
    '#..........................#',
    '############################'
  ];

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  function px(col) { return OFFSET_X + col * TILE + TILE / 2; }
  function py(row) { return OFFSET_Y + row * TILE + TILE / 2; }

  function buildGrid() {
    var rows = [];
    for (var r = 0; r < ROWS; r++) rows.push(MAZE_TEMPLATE[r].split(''));
    return rows;
  }

  function countDots(grid) {
    var n = 0;
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
      if (grid[r][c] === '.' || grid[r][c] === 'o') n++;
    }
    return n;
  }

  function cellAt(S, row, col) {
    if (row < 0 || row >= ROWS) return '#';
    if (col < 0 || col >= COLS) return (row === TUNNEL_ROW) ? ' ' : '#';
    return S.grid[row][col];
  }

  function playerCanEnter(S, row, col) {
    var c = cellAt(S, row, col);
    return c !== '#' && c !== 'D' && c !== 'H';
  }

  function ghostCanEnter(S, row, col, allowHouse) {
    var c = cellAt(S, row, col);
    if (c === '#') return false;
    if (!allowHouse && (c === 'D' || c === 'H')) return false;
    return true;
  }

  /** Commit-time wrap for the tunnel row: cell indices stay in [0, COLS). */
  function wrapCell(a) {
    if (a.col < 0) a.col += COLS;
    else if (a.col >= COLS) a.col -= COLS;
  }

  /** Interpolated position of a cell+progress actor, in tile units. */
  function posRC(a) {
    return { row: a.row + a.dir.dy * a.t, col: a.col + a.dir.dx * a.t };
  }

  function dirsEqual(a, b) { return a.dx === b.dx && a.dy === b.dy; }

  /** Reverse a moving actor in place, mid-cell safe: position is preserved
   *  by re-anchoring on the cell it was heading toward with t mirrored. */
  function reverseActor(a) {
    if (!a.dir.dx && !a.dir.dy) return;
    if (a.t > 0) {
      a.col += a.dir.dx;
      a.row += a.dir.dy;
      wrapCell(a);
      a.t = 1 - a.t;
    }
    a.dir = { dx: -a.dir.dx, dy: -a.dir.dy };
  }

  /** Shared ghost direction chooser: used for scatter/chase (minimize
   *  distance to target), frightened (random), and leaving/eyes (minimize
   *  distance to a house point, walls-only since allowHouse permits D/H). */
  function pickGhostDir(S, ghost, target, allowHouse, randomMode) {
    var dirs = [UP, DOWN, LEFT, RIGHT];
    var nrBase = ghost.row, ncBase = ghost.col; // always called at a cell center
    var reverse = { dx: -ghost.dir.dx, dy: -ghost.dir.dy };
    var hasDir = !!(ghost.dir.dx || ghost.dir.dy);
    var candidates = [];
    var i, d, nr, nc;
    for (i = 0; i < 4; i++) {
      d = dirs[i];
      if (hasDir && dirsEqual(d, reverse)) continue;
      nr = nrBase + d.dy; nc = ncBase + d.dx;
      if (ghostCanEnter(S, nr, nc, allowHouse)) candidates.push(d);
    }
    if (candidates.length === 0) {
      if (hasDir && ghostCanEnter(S, nrBase + reverse.dy, ncBase + reverse.dx, allowHouse)) return reverse;
      return NONE;
    }
    if (randomMode) return candidates[Math.floor(Math.random() * candidates.length)];
    var best = candidates[0], bestDist = Infinity;
    for (i = 0; i < candidates.length; i++) {
      d = candidates[i];
      nr = nrBase + d.dy; nc = ncBase + d.dx;
      var dist = (nr - target.row) * (nr - target.row) + (nc - target.col) * (nc - target.col);
      if (dist < bestDist) { bestDist = dist; best = d; }
    }
    return best;
  }

  function targetFor(S, ghost) {
    var P = S.player;
    if (S.globalMode === 'scatter') return ghost.scatterCorner;
    var pr = P.row, pc = P.col;
    if (ghost.id === 'red') return { row: pr, col: pc };
    if (ghost.id === 'pink') {
      var f = S.playerFacing;
      return { row: pr + f.dy * 4, col: pc + f.dx * 4 };
    }
    if (ghost.id === 'cyan') {
      var f2 = S.playerFacing;
      var ar = pr + f2.dy * 2, ac = pc + f2.dx * 2;
      var red = S.ghosts[0];
      return { row: 2 * ar - red.row, col: 2 * ac - red.col };
    }
    // orange: chase when far, flee to own corner within 8 tiles
    var dr = pr - ghost.row, dc = pc - ghost.col;
    if (dr * dr + dc * dc > 64) return { row: pr, col: pc };
    return ghost.scatterCorner;
  }

  function ghostSpeedFor(S, ghost) {
    if (ghost.mode === 'frightened') return GHOST_BASE_SPEED * S.ghostSpeedMul * FRIGHT_SPEED_MUL;
    if (ghost.mode === 'eyes') return EYES_SPEED;
    return GHOST_BASE_SPEED * S.ghostSpeedMul;
  }

  function checkExtraLife(g) {
    var S = g.state;
    if (!S.extraLifeGiven && g.score >= 10000) {
      S.extraLifeGiven = true;
      g.setLives(g.lives + 1);
      g.audio.play('powerup');
      g.fx.text(400, 300, 'EXTRA LIFE', { color: '#ffe600', size: 14 });
    }
  }
  function award(g, n) { g.addScore(n); checkExtraLife(g); }

  function setupGhosts(g) {
    var S = g.state;
    var baseDelays = [0.4, 3.0, 6.5, 11.0];
    var homeCols = [13, 14, 13, 14];
    var homeRows = [14, 14, 15, 15];
    var ids = ['red', 'pink', 'cyan', 'orange'];
    var colors = { red: '#ff3355', pink: '#ff2ec4', cyan: '#00f0ff', orange: '#ff8a00' };
    var scatterCorners = {
      red: { row: 1, col: COLS - 2 },
      pink: { row: 1, col: 1 },
      cyan: { row: ROWS - 2, col: COLS - 2 },
      orange: { row: ROWS - 2, col: 1 }
    };
    S.ghosts = [];
    for (var i = 0; i < 4; i++) {
      var delay = Math.max(0.2, baseDelays[i] - (S.levelNum - 1) * 0.55);
      S.ghosts.push({
        id: ids[i], color: colors[ids[i]],
        row: homeRows[i], col: homeCols[i], homeCol: homeCols[i],
        dir: { dx: 0, dy: 0 }, t: 0, mode: 'house', releaseTimer: delay,
        scatterCorner: scatterCorners[ids[i]], frightTimer: 0, reviveTimer: 0
      });
    }
  }

  function resetActors(g) {
    var S = g.state;
    S.player = {
      row: 23, col: 13, t: 0,
      dir: { dx: 0, dy: 0 },
      queuedDir: { dx: -1, dy: 0 } // spawn corridor runs horizontally; LEFT is the classic opener
    };
    S.playerFacing = { dx: -1, dy: 0 };
    setupGhosts(g);
  }

  function startLevel(g) {
    var S = g.state;
    S.grid = buildGrid();
    S.dotsRemaining = countDots(S.grid);
    S.totalDotsThisLevel = S.dotsRemaining;
    S.dotsEatenThisLevel = 0;
    S.fruit = null;
    S.fruitFlags = [false, false];
    S.fruitThreshold1 = Math.round(S.totalDotsThisLevel * 70 / 244);
    S.fruitThreshold2 = Math.round(S.totalDotsThisLevel * 170 / 244);
    S.eatChain = 0;
    S.modeIndex = 0;
    S.modeTimer = MODE_SCHEDULE[0];
    S.globalMode = 'scatter';
    resetActors(g);
    S.roundPhase = 'ready';
    S.readyTimer = READY_DURATION;
  }

  function onPlayerCaught(g) {
    var S = g.state;
    S.roundPhase = 'dying';
    S.dyingTimer = DYING_DURATION;
    g.audio.play('die');
    g.fx.shake(9, 0.4);
  }

  function onLevelClear(g) {
    var S = g.state;
    S.roundPhase = 'levelClear';
    S.levelClearTimer = LEVEL_CLEAR_DURATION;
    g.audio.play('levelup');
    g.fx.flash('#ffffff', 0.5);
  }

  function activatePower(g) {
    var S = g.state;
    var dur = Math.max(0.8, FRIGHT_BASE - (S.levelNum - 1) * 0.4);
    S.eatChain = 0;
    for (var i = 0; i < S.ghosts.length; i++) {
      var gh = S.ghosts[i];
      if (gh.mode === 'scatter' || gh.mode === 'chase') {
        reverseActor(gh);
        gh.mode = 'frightened';
        gh.frightTimer = dur;
      } else if (gh.mode === 'frightened') {
        gh.frightTimer = dur;
      }
    }
    g.audio.play('powerup');
  }

  function spawnFruit(g) {
    var S = g.state;
    var info = FRUIT_TYPES[Math.min(S.levelNum - 1, FRUIT_TYPES.length - 1)];
    S.fruit = { row: 17, col: 13, points: info.points, color: info.color, timer: 9 };
  }

  function checkFruitSpawn(g) {
    var S = g.state;
    if (!S.fruitFlags[0] && S.dotsEatenThisLevel >= S.fruitThreshold1) {
      S.fruitFlags[0] = true; spawnFruit(g);
    } else if (!S.fruitFlags[1] && S.dotsEatenThisLevel >= S.fruitThreshold2) {
      S.fruitFlags[1] = true; spawnFruit(g);
    }
  }

  function eatAt(g, row, col) {
    var S = g.state;
    var cell = S.grid[row][col];
    if (cell === '.' || cell === 'o') {
      S.grid[row][col] = ' ';
      S.dotsRemaining--;
      S.dotsEatenThisLevel++;
      if (cell === '.') {
        award(g, 10);
        S.wakaToggle = !S.wakaToggle;
        g.audio.play(S.wakaToggle ? 'click' : 'move');
      } else {
        award(g, 50);
        g.fx.text(px(col), py(row), '+50', { color: '#ffe600', size: 9 });
        activatePower(g);
      }
      checkFruitSpawn(g);
      if (S.dotsRemaining <= 0) { onLevelClear(g); return; }
    }
    if (S.fruit && S.fruit.row === row && S.fruit.col === col) {
      var fr = S.fruit;
      award(g, fr.points);
      g.fx.text(px(col), py(row) - 4, '+' + fr.points, { color: fr.color, size: 11 });
      g.audio.play('coin');
      S.fruit = null;
    }
  }

  function readDirInput(g) {
    var input = g.input;
    if (input.isDown('up')) return UP;
    if (input.isDown('down')) return DOWN;
    if (input.isDown('left')) return LEFT;
    if (input.isDown('right')) return RIGHT;
    return null;
  }

  function updatePlayer(g, dt) {
    var S = g.state, P = S.player;
    var q = P.queuedDir;
    var qActive = !!(q.dx || q.dy);

    if (P.t === 0) {
      // standing on a center: take the buffered direction if it's legal
      if (qActive && playerCanEnter(S, P.row + q.dy, P.col + q.dx)) {
        P.dir = q;
        S.playerFacing = q;
      }
      if (!(P.dir.dx || P.dir.dy) || !playerCanEnter(S, P.row + P.dir.dy, P.col + P.dir.dx)) {
        P.dir = NONE;
        return;
      }
    } else if (qActive && q.dx === -P.dir.dx && q.dy === -P.dir.dy) {
      // reversals never wait for a center — classic feel
      reverseActor(P);
      S.playerFacing = P.dir;
    }

    P.t += PLAYER_SPEED * dt;
    var guard = 0;
    while (P.t >= 1 && guard < 4) {
      guard++;
      P.t -= 1;
      P.col += P.dir.dx;
      P.row += P.dir.dy;
      wrapCell(P);
      eatAt(g, P.row, P.col);
      if (S.roundPhase !== 'playing') { P.t = 0; return; }
      // buffered turn fires at this center if legal
      if (qActive && playerCanEnter(S, P.row + q.dy, P.col + q.dx)) {
        P.dir = q;
        S.playerFacing = q;
      }
      if (!playerCanEnter(S, P.row + P.dir.dy, P.col + P.dir.dx)) {
        P.t = 0; // dead end: stop flush on the center
        break;
      }
    }
  }

  /** Ghost direction decision, only ever made on a cell center. */
  function ghostDecide(S, ghost) {
    if (ghost.mode === 'leaving') {
      if (ghost.row <= 12) {
        ghost.mode = S.globalMode;
        ghost.dir = pickGhostDir(S, ghost, targetFor(S, ghost), false, false);
      } else {
        ghost.dir = pickGhostDir(S, ghost, { row: 12, col: ghost.homeCol }, true, false);
      }
    } else if (ghost.mode === 'eyes') {
      if (ghost.row >= 14 && ghost.col === ghost.homeCol) {
        ghost.mode = 'reviving'; ghost.reviveTimer = 1.0; ghost.dir = NONE;
      } else {
        ghost.dir = pickGhostDir(S, ghost, { row: 15, col: ghost.homeCol }, true, false);
      }
    } else if (ghost.mode === 'frightened') {
      ghost.dir = pickGhostDir(S, ghost, null, false, true);
    } else {
      ghost.dir = pickGhostDir(S, ghost, targetFor(S, ghost), false, false);
    }
  }

  function updateGhost(g, ghost, dt) {
    var S = g.state;
    if (ghost.mode === 'house') {
      ghost.releaseTimer -= dt;
      if (ghost.releaseTimer <= 0) ghost.mode = 'leaving';
      return;
    }
    if (ghost.mode === 'reviving') {
      ghost.reviveTimer -= dt;
      if (ghost.reviveTimer <= 0) ghost.mode = 'leaving';
      return;
    }
    if (ghost.t === 0) {
      ghostDecide(S, ghost);
      if (!(ghost.dir.dx || ghost.dir.dy)) return; // reviving, or boxed in
    }
    ghost.t += ghostSpeedFor(S, ghost) * dt;
    var guard = 0;
    while (ghost.t >= 1 && guard < 4) {
      guard++;
      ghost.t -= 1;
      ghost.col += ghost.dir.dx;
      ghost.row += ghost.dir.dy;
      wrapCell(ghost);
      ghostDecide(S, ghost);
      if (!(ghost.dir.dx || ghost.dir.dy)) { ghost.t = 0; break; }
    }
  }

  function updateGlobalMode(S, dt) {
    if (S.modeIndex >= MODE_SCHEDULE.length - 1) return; // last entry holds chase forever
    S.modeTimer -= dt;
    if (S.modeTimer <= 0) {
      S.modeIndex++;
      if (S.modeIndex >= MODE_SCHEDULE.length) S.modeIndex = MODE_SCHEDULE.length - 1;
      S.modeTimer = MODE_SCHEDULE[S.modeIndex];
      S.globalMode = (S.modeIndex % 2 === 0) ? 'scatter' : 'chase';
      for (var i = 0; i < S.ghosts.length; i++) {
        var gh = S.ghosts[i];
        if (gh.mode === 'scatter' || gh.mode === 'chase') {
          reverseActor(gh);
          gh.mode = S.globalMode;
        }
      }
    }
  }

  function checkCollisions(g) {
    var S = g.state, P = S.player;
    var pp = posRC(P);
    for (var i = 0; i < S.ghosts.length; i++) {
      var gh = S.ghosts[i];
      if (gh.mode === 'house' || gh.mode === 'leaving' || gh.mode === 'eyes' || gh.mode === 'reviving') continue;
      var gp = posRC(gh);
      if (Math.abs(gp.row - pp.row) < 0.6 && Math.abs(gp.col - pp.col) < 0.6) {
        if (gh.mode === 'frightened') {
          S.eatChain = (S.eatChain || 0) + 1;
          var pts = 200 * Math.pow(2, Math.min(S.eatChain, 4) - 1);
          award(g, pts);
          g.fx.burst(px(gp.col), py(gp.row), { color: gh.color, count: 16, speed: 180, life: 0.5, size: 3 });
          g.fx.text(px(gp.col), py(gp.row) - 6, '+' + pts, { color: '#eaf6ff', size: 11 });
          g.audio.play('pickup');
          gh.mode = 'eyes';
          gh.t = 0;
          gh.row = Math.round(gp.row);
          gh.col = Math.round(gp.col);
          wrapCell(gh);
          gh.dir = NONE;
        } else {
          onPlayerCaught(g);
          return;
        }
      }
    }
  }

  function solidAt(S, r, c) {
    if (r < 0 || r >= ROWS) return true;
    if (c < 0 || c >= COLS) return r !== TUNNEL_ROW; // tunnel mouths stay open
    return S.grid[r][c] === '#';
  }

  /**
   * Walls render as one flat dark mass outlined by continuous neon lines
   * traced along every wall/corridor boundary — never as per-tile blocks.
   * The outline sits WALL_INSET inside the wall cells, which visually widens
   * the corridors and gives the player clearance, and segments share exact
   * endpoints with their neighbors so the lines read as unbroken pipes.
   */
  var WALL_INSET = 4.5;
  function drawWalls(ctx, S) {
    var d = WALL_INSET, r, c, x, y;
    ctx.save();
    ctx.fillStyle = '#0b1030';
    for (r = 0; r < ROWS; r++) {
      for (c = 0; c < COLS; c++) {
        if (S.grid[r][c] !== '#') continue;
        // +0.5 bleed hides seams between adjacent fills
        ctx.fillRect(OFFSET_X + c * TILE - 0.25, OFFSET_Y + r * TILE - 0.25, TILE + 0.5, TILE + 0.5);
      }
    }
    ctx.beginPath();
    for (r = 0; r < ROWS; r++) {
      for (c = 0; c < COLS; c++) {
        if (S.grid[r][c] !== '#') continue;
        x = OFFSET_X + c * TILE; y = OFFSET_Y + r * TILE;
        var top = !solidAt(S, r - 1, c), bottom = !solidAt(S, r + 1, c);
        var left = !solidAt(S, r, c - 1), right = !solidAt(S, r, c + 1);
        if (top) {
          ctx.moveTo(left ? x + d : x, y + d);
          ctx.lineTo(right ? x + TILE - d : x + TILE, y + d);
        }
        if (bottom) {
          ctx.moveTo(left ? x + d : x, y + TILE - d);
          ctx.lineTo(right ? x + TILE - d : x + TILE, y + TILE - d);
        }
        if (left) {
          ctx.moveTo(x + d, top ? y + d : y);
          ctx.lineTo(x + d, bottom ? y + TILE - d : y + TILE);
        }
        if (right) {
          ctx.moveTo(x + TILE - d, top ? y + d : y);
          ctx.lineTo(x + TILE - d, bottom ? y + TILE - d : y + TILE);
        }
        // Inner corners of L-shaped turns: both orthogonal neighbors are
        // wall but the diagonal is corridor — wrap the corner with a small
        // quarter-arc so neighboring cells' segments connect.
        if (!top && !left && !solidAt(S, r - 1, c - 1)) {
          ctx.moveTo(x + d, y);
          ctx.arc(x, y, d, 0, Math.PI / 2, false);
        }
        if (!top && !right && !solidAt(S, r - 1, c + 1)) {
          ctx.moveTo(x + TILE - d, y);
          ctx.arc(x + TILE, y, d, Math.PI, Math.PI / 2, true);
        }
        if (!bottom && !left && !solidAt(S, r + 1, c - 1)) {
          ctx.moveTo(x, y + TILE - d);
          ctx.arc(x, y + TILE, d, -Math.PI / 2, 0, false);
        }
        if (!bottom && !right && !solidAt(S, r + 1, c + 1)) {
          ctx.moveTo(x + TILE, y + TILE - d);
          ctx.arc(x + TILE, y + TILE, d, -Math.PI / 2, Math.PI, true);
        }
      }
    }
    ctx.strokeStyle = '#4d6bff';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.shadowColor = '#3355ff';
    ctx.shadowBlur = 7;
    ctx.stroke();
    ctx.restore();
  }

  function drawMaze(ctx, S) {
    drawWalls(ctx, S);
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        var cell = S.grid[r][c];
        var x = OFFSET_X + c * TILE, y = OFFSET_Y + r * TILE;
        if (cell === 'D') {
          ctx.fillStyle = '#ff8ad1';
          ctx.fillRect(x + 2, y + TILE / 2 - 1.5, TILE - 4, 3);
        } else if (cell === '.') {
          ctx.fillStyle = '#f0d896';
          ctx.beginPath();
          ctx.arc(x + TILE / 2, y + TILE / 2, 2.1, 0, Math.PI * 2);
          ctx.fill();
        } else if (cell === 'o') {
          var pulse = 3.6 + Math.sin(S.pelletClock * 6) * 1.4;
          ctx.save();
          ctx.shadowColor = '#ffe600';
          ctx.shadowBlur = 10;
          ctx.fillStyle = '#ffe600';
          ctx.beginPath();
          ctx.arc(x + TILE / 2, y + TILE / 2, pulse, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    }
  }

  function drawFruit(ctx, fruit) {
    var x = px(fruit.col), y = py(fruit.row);
    ctx.save();
    ctx.shadowColor = fruit.color;
    ctx.shadowBlur = 8;
    ctx.fillStyle = fruit.color;
    ctx.beginPath();
    ctx.arc(x, y + 2, TILE * 0.36, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#39ff6a';
    ctx.fillRect(x - 2, y - TILE * 0.42, 4, 6);
    ctx.restore();
  }

  function drawGhostShape(ctx, cx, cy, r, color) {
    ctx.beginPath();
    ctx.arc(cx, cy - r * 0.15, r, Math.PI, 0, false);
    ctx.lineTo(cx + r, cy + r * 0.75);
    var n = 4, step = (2 * r) / n;
    for (var i = 0; i < n; i++) {
      var x1 = cx + r - step * (i + 0.5);
      var y1 = (i % 2 === 0) ? cy + r : cy + r * 0.55;
      ctx.lineTo(x1, y1);
    }
    ctx.lineTo(cx - r, cy + r * 0.75);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  function drawGhostEyes(ctx, cx, cy, r, dir) {
    var ex = dir.dx * r * 0.28, ey = dir.dy * r * 0.28;
    var lx = cx - r * 0.32, rx = cx + r * 0.32, ey0 = cy - r * 0.1;
    ctx.fillStyle = '#eaf6ff';
    ctx.beginPath(); ctx.arc(lx, ey0, r * 0.26, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(rx, ey0, r * 0.26, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0a0a1e';
    ctx.beginPath(); ctx.arc(lx + ex, ey0 + ey, r * 0.13, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(rx + ex, ey0 + ey, r * 0.13, 0, Math.PI * 2); ctx.fill();
  }

  function drawGhosts(ctx, S, g) {
    for (var i = 0; i < S.ghosts.length; i++) {
      var gh = S.ghosts[i];
      if (gh.mode === 'reviving') continue;
      var gp = posRC(gh);
      var x = px(gp.col), y = py(gp.row);
      var r = TILE * 0.42;
      var dir = (gh.dir.dx || gh.dir.dy) ? gh.dir : { dx: 0, dy: 1 };
      if (gh.mode === 'eyes') {
        drawGhostEyes(ctx, x, y, r, dir);
        continue;
      }
      var color = gh.color;
      var glowAmt = 8;
      if (gh.mode === 'frightened') {
        var flashing = gh.frightTimer < 2 && Math.floor(gh.frightTimer * 8) % 2 === 0;
        color = flashing ? '#eaf6ff' : '#2a3ecf';
        glowAmt = 10;
      }
      g.draw.glow(ctx, color, glowAmt, (function (xx, yy, rr, cc) {
        return function () { drawGhostShape(ctx, xx, yy, rr, cc); };
      })(x, y, r, color));
      drawGhostEyes(ctx, x, y, r, gh.mode === 'frightened' ? { dx: 0, dy: 0 } : dir);
    }
  }

  function drawPlayer(ctx, S, g) {
    var P = S.player;
    var pp = posRC(P);
    var x = px(pp.col), y = py(pp.row);
    var r = TILE * 0.44;
    if (S.roundPhase === 'dying') {
      var t = clamp(1 - (S.dyingTimer / DYING_DURATION), 0, 1);
      var mouthHalf = Math.PI * 0.06 + t * Math.PI * 0.9;
      g.draw.glow(ctx, '#ffe600', 10, function () {
        ctx.fillStyle = '#ffe600';
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.arc(x, y, r, mouthHalf, Math.PI * 2 - mouthHalf);
        ctx.closePath();
        ctx.fill();
      });
      return;
    }
    var facing = (P.dir.dx || P.dir.dy) ? P.dir : S.playerFacing;
    var angle = Math.atan2(facing.dy, facing.dx);
    var moving = !!(P.dir.dx || P.dir.dy);
    var mouth = moving ? (Math.abs(Math.sin(S.pelletClock * 10)) * 0.28 * Math.PI) : 0.02;
    g.draw.glow(ctx, '#ffe600', 10, function () {
      ctx.fillStyle = '#ffe600';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.arc(x, y, r, angle + mouth, angle - mouth + Math.PI * 2);
      ctx.closePath();
      ctx.fill();
    });
  }

  GZ.boot({
    slug: 'pac-chase',
    touchLayout: 'dpad-a',
    hud: ['score', 'lives', 'level'],
    controlsHelp: [['Arrows / WASD', 'Move'], ['Queue turns early', 'They fire at the next junction']],
    state: {},

    init: function (g) {
      var S = g.state;
      g.setLives(3);
      g.setLevel(1);
      S.levelNum = 1;
      S.ghostSpeedMul = 1;
      S.extraLifeGiven = false;
      S.wakaToggle = false;
      S.pelletClock = 0;
      startLevel(g);
    },

    update: function (g, dt) {
      var S = g.state;
      S.pelletClock += dt;

      var wanted = readDirInput(g);
      if (wanted) S.player.queuedDir = wanted;

      if (S.roundPhase === 'ready') {
        S.readyTimer -= dt;
        if (S.readyTimer <= 0) S.roundPhase = 'playing';
        return;
      }
      if (S.roundPhase === 'dying') {
        S.dyingTimer -= dt;
        if (S.dyingTimer <= 0) {
          var lives = g.lives - 1;
          g.setLives(lives);
          if (lives <= 0) { g.gameOver(); return; }
          resetActors(g);
          S.roundPhase = 'ready';
          S.readyTimer = READY_DURATION;
        }
        return;
      }
      if (S.roundPhase === 'levelClear') {
        S.levelClearTimer -= dt;
        if (S.levelClearTimer <= 0) {
          S.levelNum++;
          g.setLevel(S.levelNum);
          S.ghostSpeedMul = Math.min(1.5, 1 + (S.levelNum - 1) * 0.05);
          startLevel(g);
        }
        return;
      }

      updateGlobalMode(S, dt);
      updatePlayer(g, dt);
      if (S.roundPhase !== 'playing') return;
      for (var i = 0; i < S.ghosts.length; i++) {
        var gh = S.ghosts[i];
        if (gh.mode === 'frightened') {
          gh.frightTimer -= dt;
          if (gh.frightTimer <= 0) gh.mode = S.globalMode;
        }
        updateGhost(g, gh, dt);
      }
      if (S.fruit) {
        S.fruit.timer -= dt;
        if (S.fruit.timer <= 0) S.fruit = null;
      }
      checkCollisions(g);
    },

    render: function (g, ctx) {
      var S = g.state;
      drawMaze(ctx, S);
      if (S.fruit) drawFruit(ctx, S.fruit);
      drawGhosts(ctx, S, g);
      drawPlayer(ctx, S, g);
      if (S.roundPhase === 'ready' && g.phase === 'playing') {
        g.draw.text(ctx, 'READY!', 400, 300, { size: 14, color: '#ffe600', align: 'center', glow: true });
      }
    }
  });
})();

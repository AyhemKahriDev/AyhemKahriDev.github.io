/**
 * arcadefork UI runtime — deliberately tiny, dependency-free.
 *
 * 1. Lights on/off: the theme is set before paint by an inline head script;
 *    this file only flips and persists it.
 * 2. Scroll reveals, with a hard fallback so content can never stay hidden.
 * 3. Games page: instant search, category chips, A→Z sorting, URL sync.
 * 4. Recently played, rendered from localStorage with the shared sprite.
 * 5. "Random game" — one button, every page.
 * 6. Ticker marquee duplication for a seamless CSS loop.
 * 7. Offline shell: registers the service worker on https only.
 *
 * Every feature is isolated in its own try/catch: a broken one can never take
 * the page down.
 */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------- theme */
  try {
    var themeBtn = document.getElementById('btn-theme');
    var themePop = document.getElementById('theme-pop');
    var themeItems = Array.prototype.slice.call(
      document.querySelectorAll('[data-theme-id]'),
    );

    /* One source of truth: the menu markup. A new coat is a THEMES entry in
       the builder, and the switcher labels itself from the DOM. */
    var themeLabels = {};
    themeItems.forEach(function (el) {
      var nm = el.querySelector('.nm');
      themeLabels[el.getAttribute('data-theme-id')] = nm
        ? (nm.textContent || '').split('\n')[0].replace(/\s+/g, ' ').trim()
        : el.getAttribute('data-theme-id');
    });

    function paintTheme(id) {
      root.setAttribute('data-theme', id);
      var item = themeItems.filter(function (el) {
        return el.getAttribute('data-theme-id') === id;
      })[0];
      root.setAttribute(
        'data-chrome',
        item && item.getAttribute('data-light') ? 'light' : 'dark',
      );
      themeItems.forEach(function (el) {
        el.setAttribute('aria-checked', String(el.getAttribute('data-theme-id') === id));
      });
      if (themeBtn) themeBtn.setAttribute('aria-label', 'Theme: ' + (themeLabels[id] || id));
      var meta = document.getElementById('meta-theme');
      if (meta) {
        var bg = getComputedStyle(root).getPropertyValue('--ink').trim();
        if (bg) meta.setAttribute('content', bg);
      }
    }

    function openPop() {
      if (!themePop) return;
      themePop.hidden = false;
      themeBtn.setAttribute('aria-expanded', 'true');
      var current =
        themePop.querySelector('[aria-checked="true"]') || themeItems[0];
      if (current) current.focus();
    }

    function closePop(focusBack) {
      if (!themePop || themePop.hidden) return;
      themePop.hidden = true;
      if (themeBtn) {
        themeBtn.setAttribute('aria-expanded', 'false');
        if (focusBack) themeBtn.focus();
      }
    }

    paintTheme(root.getAttribute('data-theme') || 'signal');

    if (themeBtn && themePop) {
      themeBtn.addEventListener('click', function () {
        if (themePop.hidden) openPop();
        else closePop(false);
      });

      themeItems.forEach(function (el, i) {
        el.addEventListener('click', function () {
          var id = el.getAttribute('data-theme-id');
          paintTheme(id);
          try {
            localStorage.setItem('af_theme', id);
          } catch (e) {
            /* private mode: the coat just will not persist */
          }
          closePop(true);
        });
        el.addEventListener('keydown', function (e) {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            var next = themeItems[(i + (e.key === 'ArrowDown' ? 1 : -1) + themeItems.length) % themeItems.length];
            if (next) next.focus();
          } else if (e.key === 'Home' || e.key === 'End') {
            e.preventDefault();
            themeItems[e.key === 'Home' ? 0 : themeItems.length - 1].focus();
          }
        });
      });

      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && !themePop.hidden) {
          e.preventDefault();
          closePop(true);
        }
      });

      document.addEventListener('click', function (e) {
        if (themePop.hidden) return;
        if (themePop.contains(e.target) || themeBtn.contains(e.target)) return;
        closePop(false);
      });
    }
  } catch (e) {
    /* a theme picker that fails leaves the default coat on */
  }

  /* ---------------------------------------------------- reveals */
  try {
    var reveals = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
    if (!('IntersectionObserver' in window) || reduceMotion) {
      reveals.forEach(function (el) {
        el.classList.add('in');
      });
    } else {
      var io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (en) {
            if (en.isIntersecting) {
              en.target.classList.add('in');
              io.unobserve(en.target);
            }
          });
        },
        { rootMargin: '0px 0px 120px 0px', threshold: 0.01 },
      );
      reveals.forEach(function (el) {
        io.observe(el);
      });
      // Anything already on screen is shown immediately; the observer only
      // animates what the user scrolls into.
      requestAnimationFrame(function () {
        reveals.forEach(function (el) {
          var r = el.getBoundingClientRect();
          if (r.top < window.innerHeight) el.classList.add('in');
        });
      });
    }
  } catch (e) {
    Array.prototype.slice
      .call(document.querySelectorAll('.reveal'))
      .forEach(function (el) {
        el.classList.add('in');
      });
  }

  /* ------------------------------------------------ recently played */
  var KEY = 'af_recent';
  var MAX = 14;

  function readList() {
    try {
      var raw = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(raw) ? raw : [];
    } catch (e) {
      return [];
    }
  }

  function writeList(list) {
    try {
      localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
    } catch (e) {
      /* private mode etc. — recents are a bonus */
    }
  }

  try {
    var b = document.body;
    if (b.dataset.game) {
      var entry = {
        i: b.dataset.game,
        t: b.dataset.gtitle || '',
        c: b.dataset.gcat || b.dataset.gcategory || '',
        a: b.dataset.gaccent || '#c9f94b',
      };
      if (entry.i) {
        var list = readList().filter(function (r) {
          return r && r.i !== entry.i;
        });
        list.unshift(entry);
        writeList(list);
      }
    }
  } catch (e) {
    /* recording is optional */
  }

  function hueForId(id) {
    var x = 5381;
    var s = String(id);
    for (var i = 0; i < s.length; i++) x = ((x * 33) ^ s.charCodeAt(i)) >>> 0;
    return x % 360;
  }

  var GLYPHS = {
    word: 'a-word',
    puzzle: 'a-puzzle',
    arcade: 'a-pad',
    brain: 'a-bulb',
    strategy: 'a-flag',
    sandbox: 'a-blocks',
  };

  // Hand-drawn games get their own sprite glyph in recently-played rows.
  // Mirrors CLIENT_SPECIAL in scripts/icons.mjs — keep the two in sync.
  var GAME_GLYPHS = {
    wordsearch: 'a-search',
    merge: 'a-merge',
    snake: 'a-snake',
    memory: 'a-memory',
    trust: 'a-trust',
    loopy: 'a-loopy',
  };

  function escHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function recentTile(r) {
    var h = hueForId(r.i);
    var h2 = (h + 42) % 360;
    var sym = GAME_GLYPHS[r.i] || GLYPHS[r.c] || 'a-spark';
    var gradId = 'gxr-' + String(r.i).toLowerCase().replace(/[^a-z0-9-]/g, '');
    return (
      '<a class="recent-tile" href="/games/' + encodeURIComponent(r.i) + '/">' +
      '<svg viewBox="0 0 96 96" aria-hidden="true">' +
      '<defs><linearGradient id="' + gradId + '" x1="0" y1="0" x2="0.85" y2="1">' +
      '<stop offset="0" stop-color="hsl(' + h + ' 72% 54%)"/>' +
      '<stop offset="1" stop-color="hsl(' + h2 + ' 76% 38%)"/>' +
      '</linearGradient></defs>' +
      '<rect x="0" y="0" width="96" height="96" rx="22" fill="url(#' + gradId + ')"/>' +
      '<rect x="0" y="0" width="96" height="96" rx="22" fill="url(#af-sheen)"/>' +
      '<use href="#' + sym + '" x="21" y="21" width="54" height="54"/>' +
      '</svg>' +
      '<span>' + escHtml(r.t || r.i) + '</span>' +
      '</a>'
    );
  }

  try {
    var box = document.getElementById('recent-section');
    if (box) {
      var shown = readList().slice(0, 10);
      if (shown.length) {
        var row = box.querySelector('.hscroll');
        if (row) {
          row.innerHTML = shown.map(recentTile).join('');
          box.classList.add('has');
        }
      }
    }
  } catch (e) {
    /* rendering recents is optional */
  }

  /* -------------------------------------------------- random game */
  function randomHref(scope) {
    var pool = [];
    var data = document.getElementById('af-catalog-json');
    if (data) {
      try {
        pool = JSON.parse(data.textContent)
          .filter(function (e) {
            return !scope || e.c === scope;
          })
          .map(function (e) {
            return '/games/' + encodeURIComponent(e.i || e) + '/';
          });
      } catch (err) {
        pool = [];
      }
    }
    if (!pool.length) {
      pool = Array.prototype.slice
        .call(document.querySelectorAll('a.tile[href^="/games/"]'))
        .filter(function (a) {
          return !scope || a.getAttribute('data-cat') === scope;
        })
        .map(function (a) {
          return a.getAttribute('href');
        });
    }
    var here = location.pathname;
    pool = pool.filter(function (h) {
      return h && h !== here;
    });
    return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
  }

  try {
    var rand = document.getElementById('btn-random');
    if (rand) {
      rand.addEventListener('click', function () {
        // A category page scopes by its own button; the games index scopes by
        // whichever chip is currently pressed.
        var chip = document.querySelector('[data-cat-chip][aria-pressed="true"]');
        var chipCat = chip && chip.getAttribute('data-cat-chip');
        var scope =
          rand.getAttribute('data-scope') || (chipCat && chipCat !== 'all' ? chipCat : null);
        var href = randomHref(scope);
        if (href) location.href = href;
      });
    }
  } catch (e) {
    /* random button is optional */
  }

  /* ------------------------------------------------- game browser */
  try {
    var input = document.getElementById('game-filter');
    var blocks = Array.prototype.slice.call(document.querySelectorAll('.cat-block'));
    if (input && blocks.length) {
      var status = document.getElementById('filter-status');
      var empty = document.getElementById('filter-empty');
      var chips = Array.prototype.slice.call(document.querySelectorAll('[data-cat-chip]'));
      var sortSel = document.getElementById('sort-games');
      var tiles = [];
      var expanded = {};
      var COLLAPSE_AT = 12;
      var flat = document.createElement('div');
      flat.className = 'grid';
      flat.id = 'sorted-grid';
      flat.hidden = true;

      blocks.forEach(function (block, bi) {
        block.__bi = bi;
        var grid = block.querySelector('.grid');
        var own = Array.prototype.slice.call(block.querySelectorAll('.tile'));
        own.forEach(function (t, i) {
          t.__home = grid;
          t.__idx = bi * 1000 + i;
          t.__bi = bi;
          t.__extra = i >= COLLAPSE_AT;
          tiles.push(t);
        });
        if (own.length > COLLAPSE_AT) {
          var more = document.createElement('button');
          more.type = 'button';
          more.className = 'more-btn';
          more.textContent = 'Show all ' + own.length;
          more.addEventListener('click', function () {
            expanded[bi] = true;
            render();
          });
          grid.parentNode.insertBefore(more, grid.nextSibling);
        }
      });

      var state = { q: '', cat: 'all', sort: 'default' };

      function matches(t) {
        if (state.cat !== 'all' && t.getAttribute('data-cat') !== state.cat) return false;
        if (!state.q) return true;
        var hay = (t.getAttribute('data-name') || '') + ' ' + (t.getAttribute('data-kw') || '');
        return state.q.split(/\s+/).every(function (word) {
          return hay.indexOf(word) !== -1;
        });
      }

      function render() {
        var hits = 0;
        if (state.sort === 'default') {
          if (flat.parentNode) flat.parentNode.removeChild(flat);
          blocks.forEach(function (block) {
            var grid = block.querySelector('.grid');
            var visible = 0;
            var filtering = Boolean(state.q) || state.cat !== 'all';
            tiles.forEach(function (t) {
              if (t.__home !== grid) return;
              var hit = matches(t);
              if (hit) hits++;
              var hidden = !hit || (!filtering && !expanded[t.__bi] && t.__extra);
              t.hidden = hidden;
              if (!hidden) visible++;
            });
            block.hidden = visible === 0;
            var moreBtn = block.querySelector('.more-btn');
            if (moreBtn) moreBtn.hidden = filtering || Boolean(expanded[block.__bi]);
          });
          // put every tile back in its original order
          blocks.forEach(function (block) {
            var grid = block.querySelector('.grid');
            tiles
              .filter(function (t) {
                return t.__home === grid;
              })
              .sort(function (a, b) {
                return a.__idx - b.__idx;
              })
              .forEach(function (t) {
                grid.appendChild(t);
              });
          });
        } else {
          blocks.forEach(function (block) {
            block.hidden = true;
          });
          if (!flat.parentNode) document.getElementById('game-sections').appendChild(flat);
          flat.hidden = false;
          var out = tiles.filter(matches);
          out.sort(function (a, b) {
            var an = a.getAttribute('data-name') || '';
            var bn = b.getAttribute('data-name') || '';
            return state.sort === 'az' ? an.localeCompare(bn) : bn.localeCompare(an);
          });
          hits = out.length;
          out.forEach(function (t) {
            t.hidden = false;
            flat.appendChild(t);
          });
        }

        if (empty) empty.hidden = hits !== 0;
        if (status) {
          var bits = [];
          if (state.q || state.cat !== 'all') {
            bits.push(hits + ' game' + (hits === 1 ? '' : 's'));
            if (state.q) bits.push('matching “' + input.value.trim() + '”');
            if (state.cat !== 'all') bits.push('in ' + state.cat);
          }
          status.textContent = bits.join(' ');
        }
        chips.forEach(function (c) {
          var on = c.getAttribute('data-cat-chip') === state.cat;
          c.setAttribute('aria-pressed', String(on));
          c.classList.toggle('is-on', on);
        });
        try {
          var url = new URL(location.href);
          if (state.q) url.searchParams.set('q', input.value.trim());
          else url.searchParams.delete('q');
          if (state.cat !== 'all') url.searchParams.set('cat', state.cat);
          else url.searchParams.delete('cat');
          history.replaceState(null, '', url);
        } catch (e) {
          /* history is a nicety */
        }
      }

      input.addEventListener('input', function () {
        state.q = input.value.trim().toLowerCase();
        render();
      });

      chips.forEach(function (c) {
        c.addEventListener('click', function () {
          state.cat = c.getAttribute('data-cat-chip');
          render();
        });
      });

      if (sortSel) {
        sortSel.addEventListener('change', function () {
          state.sort = sortSel.value;
          render();
        });
      }

      // Deep link: /games/?q=snake&cat=arcade
      try {
        var params = new URLSearchParams(location.search);
        var q0 = params.get('q');
        var cat0 = params.get('cat');
        if (q0) {
          input.value = q0;
          state.q = q0.trim().toLowerCase();
        }
        if (cat0 && chips.some(function (c) { return c.getAttribute('data-cat-chip') === cat0; })) {
          state.cat = cat0;
        }
      } catch (e) {
        /* no URL API, no deep link */
      }

      // Always paint once: this is what applies the 12-per-category collapse
      // on a cold load, not only when a filter is present.
      render();
    }
  } catch (e) {
    /* the page still lists every game without filtering */
  }

  /* ---------------------------------------------------- shortcuts */
  try {
    document.addEventListener('keydown', function (e) {
      var tag = (e.target && e.target.tagName) || '';
      var typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      if (e.key === '/' && !typing) {
        var target =
          document.getElementById('game-filter') ||
          document.querySelector('.search input');
        if (target) {
          e.preventDefault();
          target.focus();
          if (target.select) target.select();
        }
      }
      if (e.key === 'Escape' && typing) {
        var field = document.getElementById('game-filter');
        if (field && field === e.target && field.value) {
          field.value = '';
          field.dispatchEvent(new Event('input'));
        } else {
          e.target.blur();
        }
      }
    });
  } catch (e) {
    /* shortcuts are a bonus */
  }

  /* ------------------------------------------------ ticker duplication */
  try {
    var tracks = document.querySelectorAll('.ticker-track');
    Array.prototype.forEach.call(tracks, function (t) {
      var set = t.querySelector('.ticker-set');
      if (!set) return;
      var html = set.outerHTML;
      // Four identical sets: translating -50% lands exactly two sets later,
      // which is an identical frame — a seamless loop.
      t.innerHTML = html + html + html + html;
    });
  } catch (e) {
    /* ticker is decorative */
  }

  /* -------------------------------------------------------- offline */
  try {
    if ('serviceWorker' in navigator && location.protocol === 'https:') {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('/sw.js').catch(function () {});
      });
    }
  } catch (e) {
    /* no worker, the site still works */
  }

  /* ------------------------------------------------------ prefetch */
  /**
   * A game page is one HTML file; the game itself is a lazy iframe inside it.
   * Fetching that HTML when the pointer lands on a tile (or the tile takes
   * focus) takes the network wait out of the click without spending a byte on
   * someone who is only scrolling. Capped, and skipped on metered or slow
   * connections.
   */
  try {
    var saveData = navigator.connection && navigator.connection.saveData;
    var et = (navigator.connection && navigator.connection.effectiveType) || '';
    var slow = et === 'slow-2g' || et === '2g';
    if (!saveData && !slow) {
      var seen = {};
      var spent = 0;
      var warm = function (a) {
        if (!a || spent >= 14) return;
        var href = a.getAttribute('href') || '';
        if (href.indexOf('/games/') !== 0 || href.indexOf('#') !== -1) return;
        if (seen[href]) return;
        seen[href] = 1;
        spent++;
        var link = document.createElement('link');
        link.rel = 'prefetch';
        link.as = 'document';
        link.href = href;
        document.head.appendChild(link);
      };
      document.addEventListener(
        'pointerover',
        function (e) {
          var a = e.target && e.target.closest ? e.target.closest('a[href^="/games/"]') : null;
          if (a) warm(a);
        },
        { passive: true },
      );
      document.addEventListener(
        'focusin',
        function (e) {
          var a = e.target && e.target.closest ? e.target.closest('a[href^="/games/"]') : null;
          if (a) warm(a);
        },
        { passive: true },
      );
    }
  } catch (e) {
    /* prefetch is an optimisation; nothing depends on it */
  }

  /* ------------------------------------------- embedded game splash */
  try {
    Array.prototype.forEach.call(document.querySelectorAll('.embed-stage'), function (stage) {
      var frame = stage.querySelector('iframe');
      if (!frame) return;
      var done = function () {
        stage.classList.add('is-loaded');
      };
      frame.addEventListener('load', done);
      // A frame restored from the back/forward cache can finish loading
      // before this script runs, and its load event never fires again.
      try {
        if (frame.contentDocument && frame.contentDocument.readyState === 'complete') done();
      } catch (e) {
        /* cross-origin: the load event is the only signal */
      }
      // A lazy frame far below the fold never loads; do not leave a spinner
      // turning forever.
      setTimeout(done, 15000);
    });
  } catch (e) {
    /* the splash is decoration; the frame still loads underneath it */
  }
})();

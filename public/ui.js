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

  /* The page ships its own locale: the URL prefix for in-tree links, and the
     handful of strings this file owns. Without it (an older cached document)
     English at the root is the safe default. */
  var AF = { locale: 'en', prefix: '', strings: {} };
  try {
    var afNode = document.getElementById('af-i18n');
    if (afNode) AF = JSON.parse(afNode.textContent) || AF;
  } catch (e) {
    /* keep English */
  }
  var PREFIX = AF.prefix || '';
  var STR = AF.strings || {};

  /** A site path in this page's language tree. */
  function lp(path) {
    return PREFIX + path;
  }

  /** {name} interpolation, same contract as the builder's t(). */
  function fill(template, vars) {
    return String(template).replace(/\{(\w+)\}/g, function (whole, name) {
      return Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : whole;
    });
  }
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
      '<a class="recent-tile" href="' + lp('/games/' + encodeURIComponent(r.i) + '/') + '">' +
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

  /* -------------------------------------------------- catalogue data */
  /**
   * The compact catalogue behind search: /games/catalog.json.
   *
   * It used to be inlined in the page, so every visitor - and every crawler -
   * downloaded all 465 titles to type one letter. It is fetched on the first
   * keystroke instead (never on load), kept in memory for the session, and a
   * failure is survivable: the caller falls back to the tiles on this page.
   */
  var catalogCache = null;
  var catalogRequest = null;
  var catalogBroken = false;

  function catalogUrl() {
    var host = document.getElementById('game-sections');
    return (host && host.getAttribute('data-catalog')) || '/games/catalog.json';
  }

  function loadCatalog() {
    if (catalogCache) return Promise.resolve(catalogCache);
    if (catalogRequest) return catalogRequest;
    if (catalogBroken || !window.fetch) {
      catalogBroken = true;
      return Promise.reject(new Error('no catalogue'));
    }
    catalogRequest = fetch(catalogUrl(), { credentials: 'same-origin' })
      .then(function (res) {
        if (!res.ok) throw new Error('catalogue ' + res.status);
        return res.json();
      })
      .then(function (list) {
        if (!Array.isArray(list)) throw new Error('catalogue is not a list');
        catalogCache = list;
        catalogRequest = null;
        return list;
      })
      .catch(function (err) {
        catalogBroken = true;
        catalogRequest = null;
        throw err;
      });
    return catalogRequest;
  }

  /** Hand the catalogue to `done`, or null when it cannot be had. */
  function withCatalog(done) {
    if (catalogCache) return done(catalogCache);
    if (catalogBroken) return done(null);
    loadCatalog().then(done, function () {
      done(null);
    });
  }

  /* -------------------------------------------------- random game */
  function randomHref(scope, entries) {
    var pool = [];
    if (entries && entries.length) {
      pool = entries
        .filter(function (e) {
          return !scope || e.c === scope;
        })
        .map(function (e) {
          return lp('/games/' + encodeURIComponent(e.i) + '/');
        });
    }
    if (!pool.length) {
      pool = Array.prototype.slice
        .call(document.querySelectorAll('a.tile[href^="' + lp('/games/') + '"]'))
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
        // The page holds 60 tiles, the arcade holds hundreds: ask the
        // catalogue first, so "Random" is random across everything. If it is
        // already in memory this is synchronous; if the fetch fails, the
        // visible tiles are still a fair pool.
        withCatalog(function (entries) {
          var href = randomHref(scope, entries);
          if (href) location.href = href;
        });
      });
    }
  } catch (e) {
    /* random button is optional */
  }

  /* ------------------------------------------------- game browser */
  /**
   * Search, category chips and sort over the whole catalogue.
   *
   * The document now holds one page of tiles (60), so a filter that only hid
   * nodes would quietly stop finding anything past page 1 - the one thing a
   * search box must never do. Matching runs over the fetched catalogue, and
   * the result set is drawn into a grid of its own: a hit that is already on
   * this page is cloned (real icon, real tagline), a hit from another page
   * gets a compact result tile that links to the same game.
   *
   * With JavaScript off none of this runs and the pager still reaches every
   * page. With the catalogue unreachable the browser degrades to filtering
   * this page's tiles and says so in the status line.
   */
  try {
    var input = document.getElementById('game-filter');
    var host = document.getElementById('game-sections');
    if (input && host) {
      var status = document.getElementById('filter-status');
      var empty = document.getElementById('filter-empty');
      var chips = Array.prototype.slice.call(document.querySelectorAll('[data-cat-chip]'));
      var sortSel = document.getElementById('sort-games');
      var pageSection = document.getElementById('index-tiles');
      var pageGrid = pageSection && pageSection.querySelector('.grid');
      var pagers = Array.prototype.slice.call(document.querySelectorAll('[data-pager]'));
      var pageTiles = pageGrid ? Array.prototype.slice.call(pageGrid.querySelectorAll('.tile')) : [];

      // Category id -> the word a player reads on the chip.
      var catName = {};
      chips.forEach(function (c) {
        var id = c.getAttribute('data-cat-chip');
        var label = c.getAttribute('data-cat-title');
        if (!label) {
          var b = c.querySelector('b');
          label = c.textContent;
          if (b) label = label.replace(b.textContent, '');
        }
        catName[id] = String(label || id).replace(/\s+/g, ' ').trim();
      });

      // This page's tiles by href, so a hit that is already here can be cloned
      // instead of re-drawn, and the served order can be restored after a sort.
      var tileByHref = {};
      pageTiles.forEach(function (t) {
        var href = t.getAttribute('href');
        if (href) tileByHref[href] = t;
      });

      var flat = document.getElementById('sorted-grid');
      if (!flat) {
        flat = document.createElement('div');
        flat.className = 'grid';
        flat.id = 'sorted-grid';
        flat.hidden = true;
        host.appendChild(flat);
      }

      var state = { q: '', cat: 'all', sort: 'default' };
      var pageSorted = false;

      function hrefFor(id) {
        return lp('/games/' + encodeURIComponent(id) + '/');
      }

      function everyWord(hay) {
        return state.q.split(/\s+/).every(function (word) {
          return !word || hay.indexOf(word) !== -1;
        });
      }

      function matchesEntry(e) {
        if (state.cat !== 'all' && e.c !== state.cat) return false;
        if (!state.q) return true;
        return everyWord((e.t + ' ' + e.c + ' ' + (catName[e.c] || '')).toLowerCase());
      }

      function matchesTile(t) {
        if (state.cat !== 'all' && t.getAttribute('data-cat') !== state.cat) return false;
        if (!state.q) return true;
        return everyWord(
          (t.getAttribute('data-name') || '') + ' ' + (t.getAttribute('data-kw') || ''),
        );
      }

      function byTitle(a, b) {
        return state.sort === 'az' ? a.localeCompare(b) : b.localeCompare(a);
      }

      /**
       * A result tile for a game whose full tile is on another page.
       *
       * Built with DOM calls rather than innerHTML: the catalogue is fetched
       * data, and a title must never be able to inject markup here.
       */
      function remoteTile(e) {
        var a = document.createElement('a');
        a.className = 'tile tile-remote';
        a.setAttribute('href', hrefFor(e.i));
        a.setAttribute('data-cat', e.c || '');
        a.setAttribute('data-name', String(e.t || '').toLowerCase());
        if (e.a) {
          a.style.setProperty('--tile-accent', e.a);
          a.style.setProperty('--glow', e.a);
        }
        var thumb = document.createElement('div');
        thumb.className = 'thumb';
        thumb.setAttribute('aria-hidden', 'true');
        var initial = document.createElement('span');
        initial.className = 'tile-initial';
        initial.textContent = String(e.t || '?').charAt(0).toUpperCase();
        thumb.appendChild(initial);
        var title = document.createElement('h3');
        title.textContent = e.t || e.i;
        var tag = document.createElement('span');
        tag.className = 'tag';
        tag.textContent = catName[e.c] || e.c || '';
        a.appendChild(thumb);
        a.appendChild(title);
        a.appendChild(tag);
        return a;
      }

      function drawResults(list) {
        var frag = document.createDocumentFragment();
        list.forEach(function (e) {
          var here = tileByHref[hrefFor(e.i)];
          var node = here ? here.cloneNode(true) : remoteTile(e);
          node.hidden = false;
          // The clone is drawn immediately; it must not wait for a reveal
          // observer that only ever watched the original.
          node.classList.remove('reveal');
          node.classList.remove('in');
          frag.appendChild(node);
        });
        flat.innerHTML = '';
        flat.appendChild(frag);
        flat.hidden = list.length === 0;
      }

      function render() {
        var filtering = Boolean(state.q) || state.cat !== 'all';
        var crossPage = filtering && Boolean(catalogCache);
        var hits = 0;

        if (crossPage) {
          var list = catalogCache.filter(matchesEntry);
          if (state.sort !== 'default') {
            list = list.slice().sort(function (a, b) {
              return byTitle(String(a.t || ''), String(b.t || ''));
            });
          }
          drawResults(list);
          hits = list.length;
          if (pageSection) pageSection.hidden = true;
        } else {
          flat.innerHTML = '';
          flat.hidden = true;
          if (pageSection) pageSection.hidden = false;

          var shown = filtering ? pageTiles.filter(matchesTile) : pageTiles;
          pageTiles.forEach(function (t) {
            t.hidden = filtering && shown.indexOf(t) === -1;
          });

          // The served order by default, A to Z on request. Only touched when
          // it has to change: a name filter just hides tiles.
          if (pageGrid) {
            var order = (filtering ? shown : pageTiles).slice();
            var sorting = state.sort !== 'default';
            if (sorting) {
              order.sort(function (a, b) {
                return byTitle(
                  a.getAttribute('data-name') || '',
                  b.getAttribute('data-name') || '',
                );
              });
              pageSorted = true;
            }
            if (sorting || (pageSorted && !filtering)) {
              order.forEach(function (t) {
                pageGrid.appendChild(t);
              });
              if (!sorting) pageSorted = false;
            }
          }
          hits = filtering ? shown.length : pageTiles.length;
        }

        // Page links browse the unfiltered catalogue; a filtered result set
        // already spans every page, so the pager would be a dead end.
        pagers.forEach(function (p) {
          p.hidden = crossPage;
        });
        if (empty) empty.hidden = hits !== 0;

        if (status) {
          var bits = [];
          if (filtering) {
            bits.push(fill(hits === 1 ? STR.one : STR.many, { count: hits }));
            if (state.q) bits.push(fill(STR.match, { q: input.value.trim() }));
            if (state.cat !== 'all')
              bits.push(fill(STR.in, { category: catName[state.cat] || state.cat }));
            if (crossPage) bits.push(fill(STR.all, { count: catalogCache.length }));
            else if (catalogBroken) bits.push(STR.broken);
            else bits.push(STR.page);
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

      // The page draws first, then the catalogue completes it. One keystroke
      // paints instantly from the 60 tiles here and re-paints once the whole
      // arcade arrives - no spinner, no waiting on the network to type.
      function refresh() {
        render();
        if (state.q || state.cat !== 'all') {
          withCatalog(function () {
            render();
          });
        }
      }

      input.addEventListener('input', function () {
        state.q = input.value.trim().toLowerCase();
        refresh();
      });

      chips.forEach(function (c) {
        c.addEventListener('click', function () {
          state.cat = c.getAttribute('data-cat-chip');
          refresh();
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
        if (cat0 && Object.prototype.hasOwnProperty.call(catName, cat0)) {
          state.cat = cat0;
        }
      } catch (e) {
        /* no URL API, no deep link */
      }

      // Always paint once: the pager and the chips reflect the served page,
      // not only a filtered one.
      refresh();

      // On a phone the number strip is narrower than eight pills, so page 8
      // would start life scrolled out of view. Centre the current page; the
      // strip is still swipeable, this only saves the first gesture.
      pagers.forEach(function (nav) {
        var here = nav.querySelector('[aria-current="page"]');
        var list = nav.querySelector('.pager-list');
        if (!here || !list) return;
        var lr = list.getBoundingClientRect();
        var hr = here.getBoundingClientRect();
        if (hr.left < lr.left || hr.right > lr.right) {
          list.scrollLeft += hr.left - lr.left - (lr.width - hr.width) / 2;
        }
      });
    }
  } catch (e) {
    /* the page still lists a page of games, and the pager still works */
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
        if (href.indexOf(lp('/games/')) !== 0 || href.indexOf('#') !== -1) return;
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
          var a = e.target && e.target.closest
            ? e.target.closest('a[href^="' + lp('/games/') + '"]')
            : null;
          if (a) warm(a);
        },
        { passive: true },
      );
      document.addEventListener(
        'focusin',
        function (e) {
          var a = e.target && e.target.closest
            ? e.target.closest('a[href^="' + lp('/games/') + '"]')
            : null;
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

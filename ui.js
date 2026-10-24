/**
 * arcadefork UI runtime — deliberately tiny, dependency-free.
 *
 * 1. Swaps `no-js` for `js` so scroll reveals only hide content when JS runs.
 * 2. IntersectionObserver reveals (once, unobserved after).
 * 3. Recently played: records game-page visits, renders home rows.
 * 4. "Play a random game" button.
 * 5. Ticker marquee duplication for a seamless CSS loop.
 *
 * Everything is fail-soft: each feature is isolated so a broken one can't
 * take the page down.
 */
(function () {
  'use strict';

  var root = document.documentElement;
  root.classList.remove('no-js');
  root.classList.add('js');

  /* ------------------------------------------------ scroll reveals */
  try {
    var reveals = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (en) {
            if (en.isIntersecting) {
              en.target.classList.add('in');
              io.unobserve(en.target);
            }
          });
        },
        { rootMargin: '0px 0px -8% 0px', threshold: 0.04 }
      );
      reveals.forEach(function (el) {
        io.observe(el);
      });
    } else {
      reveals.forEach(function (el) {
        el.classList.add('in');
      });
    }
  } catch (e) {
    /* reveals are decorative; never block the rest */
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

  // Record a game-page visit. Game pages carry these attrs on <body>.
  try {
    var b = document.body;
    if (b.dataset.game) {
      var entry = {
        i: b.dataset.game,
        t: b.dataset.gtitle || '',
        c: b.dataset.gcat || b.dataset.gcategory || '',
        a: b.dataset.gaccent || '#2fe6ff',
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

  function escHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function recentTile(r) {
    var h = hueForId(r.i);
    var h2 = (h + 42) % 360;
    var sym = GLYPHS[r.c] || 'a-spark';
    var gradId = 'gxr-' + String(r.i).toLowerCase().replace(/[^a-z0-9-]/g, '');
    return (
      '<a class="recent-tile" href="/games/' + encodeURIComponent(r.i) + '/"' +
      ' style="--tile-accent:hsl(' + h + ' 80% 64%)">' +
      '<svg viewBox="0 0 96 96" aria-hidden="true">' +
      '<defs><linearGradient id="' + gradId + '" x1="0" y1="0" x2="0.85" y2="1">' +
      '<stop offset="0" stop-color="hsl(' + h + ' 76% 56%)"/>' +
      '<stop offset="1" stop-color="hsl(' + h2 + ' 84% 40%)"/>' +
      '</linearGradient></defs>' +
      '<rect x="0" y="0" width="96" height="96" rx="22" fill="url(#' + gradId + ')"/>' +
      '<use href="#' + sym + '" x="22" y="22" width="52" height="52"/>' +
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

  /* ------------------------------------------------ random game */
  try {
    var btn = document.getElementById('btn-random');
    if (btn) {
      btn.addEventListener('click', function () {
        var pool = [];
        var data = document.getElementById('af-catalog-json');
        if (data) {
          try {
            pool = JSON.parse(data.textContent).map(function (e) {
              return '/games/' + encodeURIComponent(e.i || e) + '/';
            });
          } catch (err) {
            pool = [];
          }
        }
        if (!pool.length) {
          pool = Array.prototype.slice.call(document.querySelectorAll('a.tile[href^="/games/"]')).map(function (a) {
            return a.getAttribute('href');
          });
        }
        var here = location.pathname;
        pool = pool.filter(function (h) {
          return h && h !== here;
        });
        if (pool.length) location.href = pool[Math.floor(Math.random() * pool.length)];
      });
    }
  } catch (e) {
    /* random button is optional */
  }

  /* ------------------------------------------------ ticker duplication */
  try {
    var tracks = document.querySelectorAll('.ticker-track');
    Array.prototype.forEach.call(tracks, function (t) {
      var set = t.querySelector('.ticker-set');
      if (!set) return;
      var html = set.outerHTML;
      // four identical sets: translating -50% lands exactly two sets later,
      // which is an identical frame — a seamless loop.
      t.innerHTML = html + html + html + html;
    });
  } catch (e) {
    /* ticker is decorative */
  }
})();

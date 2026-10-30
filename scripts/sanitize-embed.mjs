/**
 * Sanitizer for vendored third-party HTML.
 *
 * Vendored games are served from our own origin, so a page that navigates the
 * top frame would replace spielkunst with a stranger's site (we shipped one
 * like that once - a personal blog with a "Fork on GitHub" button). The
 * iframe sandbox in shell.mjs is the hard stop; this removes the sharp edges
 * so a click can never leave the arcade:
 *
 *   - meta refresh redirects are dropped
 *   - target="_top" becomes target="_blank" (opens a tab, never replaces us)
 *   - window.top / parent navigation is rewritten to stay in the frame
 *   - external links get rel="noopener noreferrer"
 *   - a third-party comment widget is dropped: its SDK cannot load under our
 *     content policy, so it only produces a console error on every visit
 *
 * Pure text transforms: no parsing, no rewriting of the original sources on
 * disk - this runs on the copy that ships to dist/.
 */

const REFRESH = /<meta\s+http-equiv=["']?refresh["']?[^>]*>/gi;

/**
 * A meta refresh is only dangerous when it points somewhere else. A
 * relative one ("url=tetris3d.html") is how some games hand over to their
 * real page - keep it.
 */
export function refreshIsExternal(tag) {
  const url = (tag.match(/content\s*=\s*["'][^"']*?url\s*=\s*([^"';]+)/i) || [])[1];
  if (!url) return false;
  const target = url.trim();
  if (/^javascript:/i.test(target)) return true;
  if (!/^https?:\/\//i.test(target)) return false; // relative -> same site
  try {
    const host = new URL(target).hostname.replace(/^www\./, '');
    return host !== 'spielkunst.pages.dev' && host !== 'ayhemkahridev.github.io';
  } catch {
    return true;
  }
}
/**
 * Comment widgets. A vendored game may bolt on a third-party comment drawer
 * (Diversity Comments, giscus, Disqus, Utterances, Commento...). None of them
 * can work here: the site's CSP is `script-src 'self'`, so the SDK load fails
 * and the page logs an error on every visit - which the smoke gate reads, quite
 * correctly, as a broken page. The widget is not part of the game, it never
 * appears in the play area, and it phones a host we do not allow, so the
 * include is dropped. A tag naming the widget directly (https://giscus.app/...)
 * is dropped too; a plain CDN script is *not* - that is a different problem and
 * not this rule's business.
 */
const WIDGET_SCRIPT = /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>\s*<\/script\s*>/gi;
const WIDGET_HOST = /^https?:\/\/(?:[\w.-]*\.)?(?:giscus\.app|disqus\.com|cusdis\.com|utteranc\.es|commento\.io|huazie\.github\.io)\//i;
const WIDGET_FILE = /^comments?(?:[-_.][\w-]+)*?(?:\.min)?\.js$/i;

/** Is this <script src> a comment widget we refuse to load? */
export function isCommentWidget(src) {
  const clean = src.split(/[?#]/)[0];
  if (WIDGET_HOST.test(src)) return true;
  const base = clean.slice(clean.lastIndexOf('/') + 1);
  return WIDGET_FILE.test(base);
}

/** The globals a widget's inline initialiser calls. */
const WIDGET_GLOBAL = /\b(?:FleaComments|DiversityComments)\b/;

const TOP_TARGET = /target\s*=\s*(["'])_top\1/gi;
// Only real navigations are rewritten. `window.top.location !== window.self`
// is a frame check, not a hijack, and must survive untouched.
const TOP_NAV = [
  [/window\s*\.\s*top\s*\.\s*location\s*\.\s*href\s*=(?!=)/g, 'window.location.href='],
  [/window\s*\.\s*top\s*\.\s*location\s*=(?!=)/g, 'window.location='],
  [/window\s*\.\s*parent\s*\.\s*location\s*=(?!=)/g, 'window.location='],
  [/\bparent\s*\.\s*location\s*=(?!=)/g, 'window.location='],
  [/\btop\s*\.\s*location\s*=(?!=)/g, 'window.location='],
  [/window\s*\.\s*top\s*\.\s*href\s*=(?!=)/g, 'window.location.href='],
];

/** Anchors that open a new tab get rel="noopener noreferrer". */
function hardenBlankTargets(html) {
  return html.replace(/<a\b([^>]*?)target\s*=\s*(["'])_blank\2([^>]*)>/gi, (m, before, q, after) => {
    const attrs = `${before} ${after}`;
    if (/rel\s*=/i.test(attrs)) {
      return m.replace(/rel\s*=\s*(["'])([^"']*)\1/i, (mm, qq, val) => {
        const parts = val.split(/\s+/).filter(Boolean);
        if (!parts.includes('noopener')) parts.push('noopener');
        if (!parts.includes('noreferrer')) parts.push('noreferrer');
        return `rel=${qq}${parts.join(' ')}${qq}`;
      });
    }
    return `<a${before} target=${q}_blank${after} rel="noopener noreferrer">`;
  });
}

export function sanitizeHtml(html) {
  const changes = { refresh: 0, topTarget: 0, topNav: 0, rel: 0, widget: 0 };
  let out = html;

  out = out.replace(REFRESH, (tag) => {
    if (!refreshIsExternal(tag)) return tag;
    changes.refresh++;
    return '';
  });
  out = out.replace(TOP_TARGET, () => {
    changes.topTarget++;
    return 'target="_blank"';
  });
  for (const [re, to] of TOP_NAV) {
    out = out.replace(re, () => {
      changes.topNav++;
      return to;
    });
  }
  let widgetSeen = false;
  out = out.replace(WIDGET_SCRIPT, (tag, src) => {
    if (!isCommentWidget(src)) return tag;
    changes.widget++;
    widgetSeen = true;
    return '';
  });
  // The page's inline initialiser (`FleaComments.init('shudu')`) would now throw
  // "FleaComments is not defined" - a console error the smoke gate correctly
  // fails - so it goes with the module it calls.
  if (widgetSeen) {
    out = out.replace(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script\s*>/gi, (tag, body) => {
      if (!WIDGET_GLOBAL.test(body)) return tag;
      changes.widget++;
      return '';
    });
  }
  const before = out;
  out = hardenBlankTargets(out);
  if (out !== before) changes.rel++;

  return { html: out, changes };
}

export default { sanitizeHtml };

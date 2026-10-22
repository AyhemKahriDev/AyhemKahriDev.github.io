/**
 * Sanitizer for vendored third-party HTML.
 *
 * Vendored games are served from our own origin, so a page that navigates the
 * top frame would replace arcadefork with a stranger's site (we shipped one
 * like that once - a personal blog with a "Fork on GitHub" button). The
 * iframe sandbox in shell.mjs is the hard stop; this removes the sharp edges
 * so a click can never leave the arcade:
 *
 *   - meta refresh redirects are dropped
 *   - target="_top" becomes target="_blank" (opens a tab, never replaces us)
 *   - window.top / parent navigation is rewritten to stay in the frame
 *   - external links get rel="noopener noreferrer"
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
    return host !== 'arcadefork.pages.dev' && host !== 'ayhemkahridev.github.io';
  } catch {
    return true;
  }
}
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
  const changes = { refresh: 0, topTarget: 0, topNav: 0, rel: 0 };
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
  const before = out;
  out = hardenBlankTargets(out);
  if (out !== before) changes.rel++;

  return { html: out, changes };
}

export default { sanitizeHtml };

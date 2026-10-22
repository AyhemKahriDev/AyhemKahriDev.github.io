/**
 * Detects landing pages that are a person's presence rather than a game.
 *
 * We shipped one of these by accident: a repo whose index page was the
 * author's personal blog (with a "Fork on GitHub" button) wrapped around a
 * canvas game. Players clicked through to a stranger's homepage instead of
 * an arcade. The harvest validator and the audit tool both use this so the
 * class of repo never gets in again.
 *
 * Shared by the harvest pipeline (scripts/harvest-games.mjs) and the audit
 * (scripts/audit-embeds.mjs) so the rules cannot drift apart.
 */

/** Hosts that represent a person, not a game. */
const IDENTITY_HOSTS = [
  'github.com',
  'gitee.com',
  'gitlab.com',
  'linkedin.com',
  'twitter.com',
  'x.com',
  'facebook.com',
  'instagram.com',
  'youtube.com',
  'weibo.com',
  'zhihu.com',
  'bilibili.com',
  'medium.com',
  'patreon.com',
  'paypal.me',
  'paypal.com',
  'buymeacoffee.com',
  'ko-fi.com',
  'opencollective.com',
  't.me',
  'telegram.me',
  'whatsapp.com',
  'api.whatsapp.com',
  'strava.com',
  'dev.to',
  'mastodon.social',
  'reddit.com',
  'discord.com',
  'discord.gg',
  'steamcommunity.com',
  'itch.io',
];

/** Share endpoints are not a personal presence - they are just a widget. */
const SHARE_PATH = /\/(sharer|share|intent|submit|send|sharer\.php|share\?)/i;

const PAYMENT_RE =
  /\b(usdt|bitcoin|ethereum|crypto\.com|coinbase|binance|metamask|ledger\.com|donate\s+now|buy\s+me\s+a\s+coffee|sberbank|sbp\b|qiwi|webmoney|perfect money)/i;

/** Essay / bio phrasing that marks a personal page. */
const PERSONAL_TEXT = [
  'my projects',
  'my portfolio',
  'personal website',
  'personal site',
  'about me',
  'contact me',
  'my blog',
  'my resume',
  'my bio',
  'i am a web',
  'i am a front',
  'welcome to my',
  'this is my personal',
  'visit my website',
  'my github',
  'follow me',
  'my projects',
  '我的项目',
  '我的博客',
  '个人主页',
  '个人网站',
  '欢迎访问我的',
  '我是',
  '联系我',
  '简历',
  '关于我',
];

const CJK_NAV = /(项目|文字|摄影|留言|关于|随笔|照片)/g;

/** Extract anchors with their href. */
export function anchors(html) {
  const out = [];
  const re = /<a\b([^>]*)>/gi;
  let m;
  while ((m = re.exec(html))) {
    const attrs = m[1];
    const href = (attrs.match(/href\s*=\s*(["'])(.*?)\1/i) || [])[2] || '';
    out.push({ href, attrs, tag: m[0] });
  }
  return out;
}

/** Visible text, roughly. */
export function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Is this href a link to somebody's identity page (not to a game repo)? */
export function isIdentityLink(href) {
  if (!/^https?:\/\//i.test(href)) return false;
  let url;
  try {
    url = new URL(href);
  } catch {
    return false;
  }
  const host = url.hostname.replace(/^www\./, '');
  if (!IDENTITY_HOSTS.some((h) => host === h || host.endsWith('.' + h))) return false;
  if (SHARE_PATH.test(url.pathname + url.search)) return false;
  // A link to a repository is "source code", not a personal presence.
  if (host === 'github.com' || host === 'gitlab.com' || host === 'gitee.com') {
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length >= 2) {
      // /user/repo  -> repo link (fine). /user alone -> profile (not fine).
      if (parts.length === 2 && !/fork|star|sponsor|follow/i.test(url.pathname + url.search)) {
        return false;
      }
      if (/fork|star|sponsor|follow/i.test(url.pathname + url.search)) return true;
      if (parts.length >= 2) return false;
    }
    return true;
  }
  return true;
}

/**
 * Analyse a landing page.
 * @returns {{identityLinks:string[], personalLinks:string[], essay:number,
 *            payment:boolean, personalText:string[], verdict:string}}
 */
export function personalPageSignals(html) {
  const links = anchors(html);
  const text = visibleText(html);
  const lower = text.toLowerCase();

  const identityLinks = links
    .filter((a) => isIdentityLink(a.href))
    .map((a) => a.href.replace(/^https?:\/\//, '').slice(0, 60));

  // Links to a personal domain (the author's own site), not a game page.
  const personalLinks = links
    .filter((a) => /^https?:\/\//i.test(a.href))
    .filter((a) => {
      try {
        const u = new URL(a.href);
        return !IDENTITY_HOSTS.some((h) => u.hostname.replace(/^www\./, '').endsWith(h));
      } catch {
        return false;
      }
    })
    .map((a) => a.href.replace(/^https?:\/\//, '').slice(0, 60));

  const personalText = PERSONAL_TEXT.filter((w) => lower.includes(w));
  const cjkNav = (text.match(CJK_NAV) || []).length;
  const payment = PAYMENT_RE.test(html);
  const essay = text.length;

  let verdict = 'game';
  if (payment) verdict = 'payment-chrome';
  else if (identityLinks.length >= 4) verdict = 'identity-hub';
  else if (personalText.length >= 1 && identityLinks.length >= 3 && essay < 700) {
    verdict = 'identity-hub';
  } else if (cjkNav >= 2 && essay < 1200) verdict = 'personal-nav';

  return { identityLinks, personalLinks, essay, payment, personalText, verdict };
}

export default { personalPageSignals, isIdentityLink, anchors, visibleText };

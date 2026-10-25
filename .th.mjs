import puppeteer from 'puppeteer-core';
const chrome='/home/ayhem/.cache/hyperframes/chrome/chrome-headless-shell/linux-152.0.7977.30/chrome-headless-shell-linux64/chrome-headless-shell';
const b=await puppeteer.launch({executablePath:chrome,args:['--no-sandbox','--disable-gpu','--hide-scrollbars']});
const p=await b.newPage(); await p.setViewport({width:1440,height:1000});
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://127.0.0.1:4178/',{waitUntil:'networkidle0'});
console.log('default:', await p.evaluate(()=>document.documentElement.dataset.theme));

await p.click('#btn-theme');
console.log('open:', await p.evaluate(()=>!document.getElementById('theme-pop').hidden),
            '| focused item:', await p.evaluate(()=>document.activeElement.getAttribute('data-theme-id')));
// arrow navigation
await p.keyboard.press('ArrowDown');
console.log('after ArrowDown focus:', await p.evaluate(()=>document.activeElement.getAttribute('data-theme-id')));
await p.keyboard.press('Escape');
console.log('after Esc hidden:', await p.evaluate(()=>document.getElementById('theme-pop').hidden),
            '| focus back on button:', await p.evaluate(()=>document.activeElement.id));

const themes=['signal','lights','coinop','ice','dmg','vapor'];
const stats=[];
for (const t of themes) {
  await p.click('#btn-theme');
  await p.click(`[data-theme-id="${t}"]`);
  await new Promise(r=>setTimeout(r,220));
  const s = await p.evaluate(()=>{
    const cs=getComputedStyle(document.documentElement);
    const g=n=>cs.getPropertyValue(n).trim();
    return {attr:document.documentElement.dataset.theme, ink:g('--ink'), paper:g('--paper'), signal:g('--signal'),
            meta:document.getElementById('meta-theme').content,
            checked:[...document.querySelectorAll('[data-theme-id]')].filter(e=>e.getAttribute('aria-checked')==='true').map(e=>e.dataset.themeId)};
  });
  stats.push([t,s]);
  await p.screenshot({path:`/tmp/af-shots/theme-${t}.png`});
}
for (const [t,s] of stats) console.log(t.padEnd(7), s.attr===t?'✓':'✗', s.ink, s.paper, s.signal, 'meta='+s.meta, 'checked='+s.checked.join(','));
// persistence
await p.reload({waitUntil:'networkidle0'});
console.log('after reload:', await p.evaluate(()=>document.documentElement.dataset.theme));
console.log('errors:', errs.length?errs:'none');
await b.close();

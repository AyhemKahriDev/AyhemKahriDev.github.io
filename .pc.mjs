import puppeteer from 'puppeteer-core';
const chrome='/home/ayhem/.cache/hyperframes/chrome/chrome-headless-shell/linux-152.0.7977.30/chrome-headless-shell-linux64/chrome-headless-shell';
const b=await puppeteer.launch({executablePath:chrome,args:['--no-sandbox','--disable-gpu']});
const p=await b.newPage(); await p.setViewport({width:1440,height:800});
await p.evaluateOnNewDocument(()=>localStorage.setItem('af_theme','lights'));
await p.goto('http://127.0.0.1:4178/',{waitUntil:'networkidle0'});
console.log(await p.evaluate(()=>{
  const sels=['.mini-grid span','.ticket','.lede','.tile p','.stats-strip i','.kicker','.trust','h1 em','.btn-primary'];
  const out={};
  for (const s of sels){ const e=document.querySelector(s); if(!e){out[s]='—';continue;}
    const c=getComputedStyle(e); out[s]=c.color+' / bg '+c.backgroundColor+' / '+c.fontSize; }
  out.theme=document.documentElement.dataset.theme;
  return out;
}));
await b.close();

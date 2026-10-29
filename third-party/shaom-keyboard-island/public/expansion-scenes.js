"use strict";
function expansionScene(ch, phaseIndex, beat) {
  const w = WORLDS[ch.world],
    p = Math.min(1, beat / ch.phases[phaseIndex].keys.length),
    total = (phaseIndex + p) / 3,
    e = ch.episode,
    theme = ch.world - 6;
  const many = (n, fn) => Array.from({ length: n }, (_, i) => fn(i)).join("");
  const label = (s, x, y, size = 38) =>
    `<text x="${x}" y="${y}" font-size="${size}" text-anchor="middle" font-family="sans-serif">${escapeText(s)}</text>`;
  const shape = (x, y, content) =>
    `<g transform="translate(${x} ${y})">${content}</g>`;
  const line = (d, c = "#8f9671", width = 6) =>
    `<path d="${d}" stroke="${c}" stroke-width="${width}" fill="none" stroke-linecap="round"/>`;
  const choices = [
    ["🥚", "🌿", "🪨", "💌", "🐾", "📸"],
    ["🛷", "🐧", "🧣", "🔔", "🐻‍❄️", "🏰"],
    ["☁️", "🍭", "🍪", "🍮", "🍩", "🎁"],
    ["🐥", "🥕", "🥛", "🌾", "🎃", "🧺"],
    ["🗺️", "🦜", "🥥", "🪸", "🔐", "💎"],
    ["🐒", "🐸", "📦", "🌉", "🦋", "🌳"],
    ["🫖", "🪧", "🌵", "📮", "🔭", "💌"],
    ["📦", "🛗", "🌸", "🚙", "🔧", "🏙️"],
    ["🔖", "🌙", "🧪", "✈️", "🖋️", "📚"],
    ["🌌", "🌟", "💌", "📸", "🎫", "🎓"],
  ];
  const colors = [
    "#8fc270",
    "#b9e3f0",
    "#efa4cf",
    "#eac56f",
    "#81bcb5",
    "#80bb85",
    "#eac987",
    "#9ac4d8",
    "#bd9fd5",
    "#aab2e8",
  ];
  let bg = `<rect width="1200" height="360" fill="${w.color}"/><path d="M0 296Q180 252 390 291T1200 279V360H0Z" fill="${w.ground}"/>`;
  if (theme === 0 || theme === 5)
    bg += tree(1090, 285, 1.5) + tree(580, 285, 0.9);
  if (theme === 1)
    bg += many(13, (i) => label("❄", 570 + i * 47, 45 + (i % 4) * 48, 17));
  if (theme === 2)
    bg += many(
      4,
      (i) =>
        `<path d="M${560 + i * 170} ${100 + (i % 2) * 40}q-10 -30 30 -25q20 -45 50 -5q40 -10 35 30Z" fill="#fff6e7"/>`,
    );
  if (theme === 3)
    bg += `<path d="M560 320L710 290L1150 315M560 335L720 310L1150 330" fill="none" stroke="#88a353" stroke-width="8"/><circle cx="1080" cy="60" r="27" fill="#fff0a8"/>`;
  if (theme === 4)
    bg += `<path d="M500 275Q700 235 900 265T1200 250V360H500Z" fill="#73b6c2"/>`;
  if (theme === 6)
    bg += `<path d="M510 285Q700 100 900 285Q1070 135 1200 285" fill="#eec77d"/><circle cx="1060" cy="50" r="31" fill="#ffefaa"/>`;
  if (theme === 7)
    bg += many(
      7,
      (i) =>
        `<rect x="${570 + i * 84}" y="${155 - (i % 3) * 35}" width="65" height="150" rx="12" fill="#a3bdcd"/>`,
    );
  if (theme >= 8)
    bg += many(18, (i) =>
      label("✦", 540 + i * 35, 30 + ((i * 37) % 190), 8 + (i % 3) * 3),
    );
  if (theme === 9)
    bg += `<path d="M500 110Q700 ${10 + p * 40} 900 110T1200 110" fill="none" stroke="#a8edcd" stroke-width="35" opacity=".35"/><path d="M500 75Q700 170 900 75T1200 75" fill="none" stroke="#ddb3f3" stroke-width="25" opacity=".35"/>`;
  let main = "";
  // Six distinct visual actions inside every world: hatch, fill, build, travel, discover, celebrate.
  if (e === 0) {
    const items = [
      `<g transform="translate(850 196)"><ellipse rx="95" ry="105" fill="${colors[theme]}" stroke="#fff3ca" stroke-width="9"/><path d="M-90 -5l30 18 30 -25 30 27 30 -30 30 22 28 -12" stroke="#fff4d4" stroke-width="${3 + total * 10}" fill="none"/>${label(total > 0.6 ? "🦖" : "🥚", 0, 35 - total * 25, 65)}</g>`,
      `<g transform="translate(${650 + total * 330} 235)"><path d="M-85 40Q0 70 100 35M-70 -10V40M65 -10V42" fill="none" stroke="#bc8158" stroke-width="10"/><rect x="-90" y="-15" width="180" height="22" rx="8" fill="#f0c97f"/>${label("🛷", 0, -10, 90)}${many(Math.ceil(total * 6), (i) => label("❄", -120 - i * 20, 40 - i * 12, 18))}</g>`,
      `<g transform="translate(850 185) scale(${0.6 + total * 0.4})"><path d="M-140 60Q-200 -10 -110 -25Q-110 -140 -25 -90Q50 -160 90 -60Q200 -65 145 55Z" fill="#fff2f6" stroke="#edb1cf" stroke-width="7"/>${label("🍭", 0, 35, 90)}</g>`,
      `<ellipse cx="850" cy="285" rx="180" ry="35" fill="#c5a35f"/>${many(3, (i) => label(i < Math.ceil(total * 3) ? "🐥" : "🥚", 745 + i * 100, 260, 70))}`,
      `<rect x="660" y="85" width="380" height="220" rx="20" fill="#fff0c0" stroke="#bd975f" stroke-width="8"/>${line("M710 255Q720 150 835 200T995 125", "#d29469", 5)}${label("🏝️", 750, 170, 70)}${label("❌", 970, 160, 45)}<circle cx="${710 + total * 280}" cy="${240 - total * 90}" r="13" fill="#e89666"/>`,
      `${line("M850 45Q820 150 855 300", "#6d9460", 12)}${label("🐒", 850, 265 - total * 150, 110)}${label("🏷️", 970, 210, 60)}`,
      `<path d="M780 110V75H890V110Q925 120 925 160V295H745V160Q745 120 780 110Z" fill="#e7c37d" stroke="#a78d5b" stroke-width="8"/><path d="M760 ${280 - total * 130}H910V282H760Z" fill="#8bc8cd"/>${label("💧", 835, 205, 65)}`,
      `${line("M620 285H1080", "#6c8f9f", 16)}${many(10, (i) => `<circle cx="${640 + i * 45}" cy="285" r="10" fill="#aac4d3"/>`)}<g transform="translate(${650 + total * 330} 205)"><rect x="-55" y="-45" width="110" height="100" rx="12" fill="#d8b47e"/>${label("📦", 0, 35, 90)}</g>`,
      `<rect x="690" y="95" width="300" height="210" rx="14" fill="#fff2d0" stroke="#c0a1ce" stroke-width="7"/><path d="M815 75H875V220L845 195L815 220Z" fill="#d6a2c0" transform="translate(${Math.sin(total * 6) * 30} ${-total * 55})"/>${many(Math.ceil(total * 6), (i) => label("✦", 710 + i * 45, 260, 22))}`,
      `<g transform="translate(840 200)">${line("M0 0L-70 115M0 0L70 115", "#d4c8a5", 9)}<g transform="rotate(${-20 - total * 22})"><rect x="-70" y="-30" width="190" height="60" rx="15" fill="#c0b7df"/><rect x="100" y="-39" width="28" height="78" rx="8" fill="#8e8bb6"/></g></g>${many(Math.ceil(total * 7), (i) => label("✦", 630 + i * 65, 55 + (i % 2) * 30, 25))}`,
    ];
    main = items[theme];
  } else if (e === 1) {
    main =
      `<path d="M700 210H1030L1000 310H730Z" fill="${colors[theme]}" stroke="#fff3cb" stroke-width="8"/>` +
      many(Math.ceil(total * 9), (i) =>
        label(
          choices[theme][e],
          745 + (i % 4) * 75,
          210 - Math.floor(i / 4) * 50,
          53,
        ),
      );
  } else if (e === 2) {
    main = many(
      9,
      (i) =>
        `<g opacity="${i < Math.ceil(total * 9) ? 1 : 0.14}"><rect x="${680 + (i % 3) * 120}" y="${275 - Math.floor(i / 3) * 65}" width="112" height="58" rx="12" fill="${colors[theme]}" stroke="#fff0c8" stroke-width="4"/>${label(choices[theme][e], 735 + (i % 3) * 120, 315 - Math.floor(i / 3) * 65, 35)}</g>`,
    );
  } else if (e === 3) {
    main =
      line("M600 285Q850 220 1110 280", "#fff5cf", 10) +
      `<g transform="translate(${610 + total * 440} ${220 - Math.sin(total * Math.PI) * 80})"><rect x="-65" y="-40" width="130" height="80" rx="25" fill="${colors[theme]}" stroke="#fff0c8" stroke-width="7"/>${label(choices[theme][e], 0, 15, 65)}<circle cx="-35" cy="45" r="15" fill="#677e78"/><circle cx="35" cy="45" r="15" fill="#677e78"/></g>`;
  } else if (e === 4) {
    main = many(
      6,
      (i) =>
        `<g transform="translate(${655 + (i % 3) * 180} ${130 + Math.floor(i / 3) * 130})"><circle r="52" fill="${colors[theme]}" opacity="${i < Math.ceil(total * 6) ? 1 : 0.25}" stroke="#fff1cf" stroke-width="5"/>${label(i < Math.ceil(total * 6) ? choices[theme][e] : "?", 0, 18, 50)}</g>`,
    );
  } else {
    main =
      `<path d="M690 280V115H1030V280" fill="${colors[theme]}" stroke="#fff1c6" stroke-width="8"/><path d="M670 115L860 40L1050 115Z" fill="#f0cd83"/>${label(choices[theme][e], 860, 215, 95)}` +
      many(Math.ceil(total * 12), (i) =>
        label(
          ["⭐", "✨", "🎉"][i % 3],
          635 + (i % 6) * 85,
          60 + Math.floor(i / 6) * 230,
          25,
        ),
      );
  }
  main += label(ch.motif, 1100, 260, 70);
  const collectibles = many(
    6,
    (i) =>
      `<g opacity="${i < Math.ceil(p * 6) ? 1 : 0.15}">${label(["✦", "●", "♥"][phaseIndex], 620 + i * 86, 335, 23)}</g>`,
  );
  const actor = otter(theme === 2 || theme === 3).replace(
    "<svg",
    '<svg x="310" y="100" width="220" height="235"',
  );
  return svg(
    bg +
      `<g id="scene-object" data-kind="${ch.kind}" data-phase="${phaseIndex}" data-progress="${beat}" class="expansion-object">${main}${collectibles}</g><g id="actor">${actor}</g>`,
    "240 -25 960 400",
    "campaign-art",
  );
}

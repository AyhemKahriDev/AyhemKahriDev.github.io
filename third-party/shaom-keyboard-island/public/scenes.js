"use strict";
function campaignScene(ch, phaseIndex, beat) {
  if (ch.expansion) return expansionScene(ch, phaseIndex, beat);
  const world = {
      ...WORLDS[ch.world],
      color: playColors[ch.world][0],
      ground: playColors[ch.world][1],
    },
    phase = ch.phases[phaseIndex],
    p = Math.min(1, beat / phase.keys.length),
    n = Math.ceil(p * 6),
    hue = ["#edbd6c", "#8fbf9e", "#a8b4d4"][phaseIndex];
  const dots = (count, fn) =>
    Array.from({ length: count }, (_, i) => fn(i)).join("");
  const sprite = (content, x, y, w = 150, h = w) =>
    content.replace(
      "<svg",
      `<svg x="${x}" y="${y}" width="${w}" height="${h}"`,
    );
  const line = (d, color = "#a5855f", width = 7) =>
    `<path d="${d}" stroke="${color}" stroke-width="${width}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  const text = (t, x, y, size = 26, color = world.accent) =>
    `<text x="${x}" y="${y}" font-size="${size}" fill="${color}" text-anchor="middle" font-family="sans-serif">${t}</text>`;
  const star = (x, y, r = 12, color = "#f3cd72") =>
    `<path d="M${x} ${y - r}l${r * 0.3} ${r * 0.65} ${r * 0.7} ${r * 0.12} -${r * 0.5} ${r * 0.48} ${r * 0.14} ${r * 0.75} -${r * 0.64} -${r * 0.34} -${r * 0.64} ${r * 0.34} ${r * 0.14} -${r * 0.75} -${r * 0.5} -${r * 0.48} ${r * 0.7} -${r * 0.12}Z" fill="${color}"/>`;
  const fruit = (x, y, color = "#d58a68") =>
    `<circle cx="${x}" cy="${y}" r="17" fill="${color}"/>${line(`M${x} ${y - 15}q0 -12 10 -15`, "#6b8d58", 4)}`;
  const flower = (x, y, s = 1) =>
    `<g transform="translate(${x} ${y}) scale(${s})">${line("M0 0V-55", "#7e9c69", 6)}${dots(6, (i) => `<ellipse cx="0" cy="-65" rx="12" ry="25" fill="${hue}" transform="rotate(${i * 60} 0 -48)"/>`)}<circle cy="-48" r="14" fill="#9b7848"/></g>`;
  const envelope = (x, y, s = 1) =>
    `<g transform="translate(${x} ${y}) scale(${s})"><rect width="95" height="62" rx="9" fill="#fff4d1" stroke="#c6a973" stroke-width="3"/>${line("M0 0L47 36L95 0", "#c6a973", 3)}</g>`;
  let bg = `<rect width="1200" height="360" fill="${world.color}"/><path d="M0 300Q210 265 450 295T1200 285V360H0Z" fill="${world.ground}"/>`;
  if (ch.world === 0 || ch.kind === "submarine" || ch.kind === "fish")
    bg += `<path d="M0 262Q260 240 550 270T1200 260V360H0Z" fill="#abd2c6"/>${dots(8, (i) => line(`M${i * 170} ${300 + (i % 2) * 30}q35 10 70 0`, "#87baa8", 2))}`;
  if (ch.world === 1)
    bg +=
      tree(1040, 295, 1.5) +
      tree(530, 290, 1) +
      `<circle cx="1090" cy="65" r="28" fill="#f5dda0"/>`;
  if (ch.world === 2)
    bg += dots(
      5,
      (i) =>
        `<path d="M${440 + i * 180} ${60 + (i % 2) * 80}q5 -25 30 -17q15 -28 40 -1q25 -3 28 18Z" fill="#fff9e8" opacity=".75"/>`,
    );
  if (ch.world === 3 || ch.world === 5)
    bg += dots(20, (i) =>
      star(
        370 + i * 43,
        30 + ((i * 37) % 200),
        3 + (i % 3),
        i % 2 ? "#fdf7dc" : "#b1bed3",
      ),
    );
  let object = "";
  switch (ch.kind) {
    case "glow":
      object =
        dots(
          8,
          (i) =>
            `<g transform="translate(${620 + i * 62} ${130 + (i % 2) * 55})" opacity="${i < n + phaseIndex ? 1 : 0.36}" class="bug-friend ${i < n + phaseIndex ? "bug-awake" : ""}"><ellipse cx="-16" cy="-3" rx="15" ry="10" fill="#fff9d0" transform="rotate(-25)"/><ellipse cx="16" cy="-3" rx="15" ry="10" fill="#fff9d0" transform="rotate(25)"/><ellipse cy="12" rx="15" ry="23" fill="${i < n + phaseIndex ? "#ffe476" : "#98bcb2"}"/><ellipse cy="-10" rx="15" ry="13" fill="#5c876f"/><circle cx="-5" cy="-12" r="3" fill="#fff7d0"/><circle cx="5" cy="-12" r="3" fill="#fff7d0"/>${line("M-6 -22L-11 -31M6 -22L11 -31", "#6f9673", 3)}<path d="M-5 4Q0 10 5 4" fill="none" stroke="#b79747" stroke-width="2"/></g>`,
        ) +
        dots(
          4,
          (i) =>
            `<ellipse cx="${650 + i * 115}" cy="${270 + (i % 2) * 25}" rx="35" ry="10" fill="#5da985"/><path d="M${640 + i * 115} ${270 + (i % 2) * 25}q10 -25 20 0" fill="#f2c0ba"/>`,
        ) +
        line(
          `M610 240Q800 ${220 - p * 100} 1080 170`,
          "#fff0a5",
          phaseIndex === 2 ? 5 : 0,
        );
      break;
    case "sail":
      object = `<g transform="translate(${550 + phaseIndex * 80 + p * 80} 50)">${sprite(boatIcon(), 0, 80, 240)}${phaseIndex > 0 ? `<path d="M120 118V15L205 111Z" fill="${hue}" opacity="${0.25 + p * 0.75}"/>` : ""}${phaseIndex === 2 ? star(120, 20, 25) : ""}</g><path d="M990 285V190M1090 285V190M970 217H1110" stroke="#b39465" stroke-width="13"/>`;
      break;
    case "bridge":
      object = `<path d="M530 290Q820 350 1120 290" stroke="#6eb4ab" stroke-width="70" fill="none"/>${line("M545 200Q820 255 1110 200", "#a58b64", 9)}${dots(10, (i) => `<path d="M${555 + i * 59} 225v65" stroke="${phaseIndex === 2 || (phaseIndex === 1 && i < Math.ceil(p * 10)) ? "#dcb985" : "#c0cdb6"}" stroke-width="39" stroke-linecap="round"/>`)}${phaseIndex === 0 ? dots(n, (i) => `<path d="M570 ${300 - i * 9}h120" stroke="#d5ad76" stroke-width="7"/>`) : ""}${phaseIndex === 2 ? sprite(otter(), 550 + p * 400, 160, 100) : ""}`;
      break;
    case "drum":
      object = dots(
        3,
        (i) =>
          `<g transform="translate(${600 + i * 165} ${230 - (i % 2) * 30})"><path d="M0 0V75Q55 105 110 75V0" fill="${["#b98761", "#869d9b", "#b29bbc"][i]}"/><ellipse cx="55" rx="55" ry="18" fill="#f4d896"/>${line("M0 7L25 72L55 7L80 72L110 7", "#f5dfa8", 3)}${i <= phaseIndex ? text("♪", 60, -24 - Math.round(p * 12), 40) : ""}</g>`,
      );
      break;
    case "kite":
      object =
        line(
          `M710 300Q860 200 ${850 + phaseIndex * 40 + p * 40} ${170 - phaseIndex * 30 - p * 30}`,
          "#b29472",
          3,
        ) +
        `<g transform="translate(${850 + phaseIndex * 40 + p * 40} ${170 - phaseIndex * 30 - p * 30}) rotate(10)"><path d="M0 -70L55 0L0 70L-55 0Z" fill="${hue}"/>${line("M0 -70V70M-55 0H55", "#b39467", 3)}${dots(phaseIndex + 2, (i) => `<path d="M0 ${75 + i * 23}l-12 10 24 0Z" fill="${["#e7a17c", "#a9bf8c", "#a5c4cd"][i % 3]}"/>`)}</g>`;
      break;
    case "lighthouse":
      object = `<g transform="translate(790 65)"><path d="M0 240L25 50H115L140 240Z" fill="#fff1cf"/>${dots(4, (i) => `<path d="M${10 + i * 3} ${210 - i * 40}H${130 - i * 3}" stroke="#d9a67d" stroke-width="20" opacity="${phaseIndex > 0 || i < n ? 1 : 0.2}"/>`)}<rect x="22" y="15" width="96" height="55" rx="8" fill="#6e9686"/><path d="M8 15L70 -25L132 15Z" fill="#c58d5a"/><circle cx="70" cy="43" r="20" fill="${phaseIndex === 2 ? "#ffdc78" : "#b8cc9e"}"/><path d="M70 43L-180 -30V115Z" fill="#ffe899" opacity="${phaseIndex === 2 ? 0.12 + p * 0.3 : 0.04}"/></g>`;
      break;
    case "garden":
      object = dots(
        5,
        (i) =>
          `<g opacity="${i < Math.ceil(p * 5) ? 1 : 0.18}">${phaseIndex === 0 ? `<ellipse cx="${620 + i * 105}" cy="285" rx="25" ry="8" fill="#977958"/><ellipse cx="${620 + i * 105}" cy="280" rx="7" ry="11" fill="#dab67e"/>` : phaseIndex === 1 ? line(`M${620 + i * 105} 285v-${35 + i * 7}`, "#7b9e67", 9) + `<ellipse cx="${632 + i * 105}" cy="${255 - i * 7}" rx="20" ry="9" fill="#90b176"/>` : flower(620 + i * 105, 285, 0.8)}</g>`,
      );
      break;
    case "sunflower":
      object =
        dots(3, (i) =>
          flower(
            670 + i * 165,
            305,
            phaseIndex === 0
              ? 0.3 + p * 0.35
              : phaseIndex === 1
                ? 0.7 + p * 0.3
                : 1,
          ),
        ) + `<circle cx="${730 + p * 300}" cy="60" r="30" fill="#f5cf75"/>`;
      break;
    case "water":
      object = `<g transform="translate(760 175)"><path d="M-32 130L-15 -40H15L32 130Z" fill="#c8b17f"/><g style="transform:rotate(${p * 180 + phaseIndex * 180}deg);transform-box:fill-box;transform-origin:center">${dots(4, (i) => `<path d="M0 0L-20 -15L-34 -115L10 -100Z" fill="${i % 2 ? "#d7be84" : "#f2db9d"}" transform="rotate(${i * 90})"/>`)}</g><circle r="16" fill="#9a7f57"/></g>${line(`M790 300H${790 + p * 290}V330`, "#82b9b2", phaseIndex > 0 ? 14 : 0)}`;
      break;
    case "bee":
      object =
        dots(4, (i) => flower(640 + i * 140, 300, 0.65)) +
        `<g transform="translate(${620 + p * 440} ${140 - phaseIndex * 14})"><ellipse cx="-8" cy="-17" rx="15" ry="22" fill="#fff7da" transform="rotate(-20)"/><ellipse cx="15" cy="-17" rx="15" ry="22" fill="#fff7da" transform="rotate(20)"/><ellipse rx="30" ry="20" fill="#ecc771"/><path d="M-10 -18V18M5 -19V19" stroke="#827245" stroke-width="8"/><circle cx="22" cy="-5" r="4" fill="#4a5340"/></g>${phaseIndex === 2 ? `<path d="M1020 110q70 -100 115 5l-20 70h-80Z" fill="#d8b16b"/>${line("M1045 122h54m-60 -26h65", "#b58e51", 5)}` : ""}`;
      break;
    case "fruit":
      object =
        tree(800, 290, 1.8) +
        dots(6, (i) =>
          fruit(
            735 + (i % 3) * 65,
            130 +
              Math.floor(i / 3) * 65 +
              (phaseIndex === 1 && i < n ? p * 80 : 0),
            phaseIndex === 0 ? "#b7bd7e" : "#d68d68",
          ),
        ) +
        `<path d="M960 245H1100L1085 310H975Z" fill="#bb945b"/>${phaseIndex === 2 ? dots(n, (i) => fruit(978 + (i % 3) * 35, 255 + Math.floor(i / 3) * 22)) : ""}`;
      break;
    case "rainbow":
      object =
        dots(
          6,
          (i) =>
            `<path d="M${620 + i * 20} 295A${240 - i * 20} ${220 - i * 18} 0 0 1 ${1100 - i * 20} 295" stroke="${["#dba185", "#e7bb7e", "#e7d493", "#a8bd91", "#91b9b8", "#b4adcd"][i]}" stroke-width="19" opacity="${i < n ? 1 : 0.15}" fill="none"/>`,
        ) +
        `${phaseIndex === 2 ? sprite(otter(), 580 + p * 450, 220, 100) : ""}`;
      break;
    case "balloon":
      object = dots(
        3,
        (i) =>
          `<g transform="translate(${650 + i * 170} ${170 - (phaseIndex * 45 + p * 45)})"><ellipse rx="55" ry="65" fill="${["#e6b18d", "#a6bd97", "#b4b4d6"][i]}"/>${line("M0 65V135", "#a58b6b", 3)}${phaseIndex > 0 ? `<rect x="-27" y="130" width="54" height="40" rx="6" fill="#d5b785"/>` : ""}</g>`,
      );
      break;
    case "train":
      object = `<path d="M540 310H1140" stroke="#9f9d91" stroke-width="5"/>${dots(12, (i) => line(`M${550 + i * 50} 303v15`, "#b0a58b", 5))}<g transform="translate(${550 + phaseIndex * 50 + p * 50} 205)">${dots(phaseIndex + 1, (i) => `<g transform="translate(${i * 140} 0)"><rect width="125" height="75" rx="12" fill="${["#829c92", "#cea37a", "#a89db7"][i]}"/><rect x="15" y="10" width="30" height="30" rx="5" fill="#f9edcb"/><circle cx="25" cy="82" r="16" fill="#6c7d74"/><circle cx="100" cy="82" r="16" fill="#6c7d74"/></g>`)}<path d="M15 0V-45H65V0" fill="#829c92"/>${dots(n, (i) => `<circle cx="${42 - i * 20}" cy="${-65 - i * 18}" r="${9 + i * 3}" fill="#faf7e5" opacity=".6"/>`)}</g>`;
      break;
    case "fish":
      object =
        dots(
          3,
          (i) =>
            `<g transform="translate(${650 + i * 150 + p * 40} ${200 + (i % 2) * 40})"><ellipse rx="35" ry="20" fill="${["#e2b17e", "#97b8b4", "#b7b0ce"][i]}"/><path d="M-28 0L-55 -25V25Z" fill="${hue}"/><circle cx="20" cy="-5" r="4" fill="#4a6659"/></g>`,
        ) +
        dots(
          n,
          (i) =>
            `<circle cx="${700 + i * 60}" cy="${200 - (i % 3) * 35 - phaseIndex * 20}" r="${8 + (i % 3) * 5}" fill="none" stroke="#f9f3d9" stroke-width="3"/>`,
        ) +
        `${phaseIndex === 2 ? `<g transform="translate(950 ${300 - p * 140})"><path d="M-35 10Q-48 -50 0 -15Q48 -50 35 10Z" fill="#e2bdab" stroke="#cba591" stroke-width="3"/><circle cy="-2" r="9" fill="#fff4cf"/></g>` : ""}`;
      break;
    case "snow":
      object =
        dots(
          7,
          (i) =>
            `<g transform="translate(${625 + i * 70} ${80 + (i % 3) * 65 + p * 30})" opacity="${i < n + 1 ? 1 : 0.2}">${dots(3, (j) => line("M0 -22V22M-5 -15L0 -10L5 -15M-5 15L0 10L5 15", "#fffaf0", 4).replace("<path", `<path transform="rotate(${j * 60})"`))}</g>`,
        ) + `${phaseIndex > 0 ? envelope(830, 235, 1.4) : ""}`;
      break;
    case "telescope":
      object = `<g transform="translate(770 210)">${line("M0 0L-60 100M0 0L60 100", "#9d8d70", 8)}<g transform="rotate(${-20 - p * 20})"><rect x="-50" y="-25" width="175" height="55" rx="14" fill="#91adb8"/><rect x="110" y="-33" width="25" height="70" rx="7" fill="#698b9b"/><circle cx="-50" r="22" fill="#a8c9c7"/></g></g>${dots(n, (i) => star(930 + (i % 3) * 55, 60 + Math.floor(i / 3) * 70, 12))}`;
      break;
    case "mail":
      object =
        dots(4, (i) =>
          envelope(640 + i * 110, 210 - p * (i < n ? 65 : 0), 0.9),
        ) +
        `<g transform="translate(1000 130)"><rect width="95" height="130" rx="45" fill="#8eafb0"/><path d="M0 45H95M15 65H80" stroke="#f8e9c2" stroke-width="7"/><path d="M45 130V180" stroke="#ab916a" stroke-width="12"/></g>` +
        text(["CAT", "DOG", "SUN"][phaseIndex], 850, 100, 34);
      break;
    case "melody":
    case "concert":
      object =
        dots(
          8,
          (i) =>
            `<rect x="${610 + i * 58}" y="${210 - i * 9}" width="48" height="${60 + i * 9}" rx="8" fill="${["#dda184", "#e5b775", "#e7cf89", "#b9c78f", "#91b69e", "#94b9c4", "#a6afca", "#bfacc8"][i]}"/>`,
        ) +
        dots(n, (i) =>
          text(["♪", "♫", "♬"][i % 3], 650 + i * 76, 110 + (i % 2) * 30, 34),
        ) +
        `${ch.kind === "concert" ? sprite(frog(), 980, 145, 150) : phaseIndex > 0 ? sprite(otter(), 1070, 165, 100) : ""}`;
      break;
    case "gear":
      object =
        dots(
          phaseIndex === 0 ? 3 : 2,
          (i) =>
            `<g transform="translate(${680 + i * 160} ${190 + (i % 2) * 45})"><g style="transform:rotate(${p * 150 + i * 25}deg);transform-box:fill-box;transform-origin:center"><circle r="${48 + i * 5}" fill="${["#a4b6aa", "#d7bc88", "#b5acc9"][i]}"/>${dots(8, (j) => `<rect x="-10" y="-63" width="20" height="30" rx="4" fill="${["#a4b6aa", "#d7bc88", "#b5acc9"][i]}" transform="rotate(${j * 45})"/>`)}<circle r="15" fill="${world.color}"/></g>${text([1, 2, 9][i], 0, 7, 19)}</g>`,
        ) +
        `${phaseIndex === 1 ? `<path d="M1040 100L${1040 + Math.sin(p * 6) * 45} 250" stroke="#9e8765" stroke-width="8"/><circle cx="${1040 + Math.sin(p * 6) * 45}" cy="250" r="28" fill="#dbbd7a"/>` : phaseIndex === 2 ? `<circle cx="1040" cy="190" r="75" fill="#fff0cf" stroke="#c0a67b" stroke-width="10"/><path d="M1040 190V140M1040 190L${1040 + Math.sin(p * 6) * 50} ${190 - Math.cos(p * 6) * 50}" stroke="#8c927b" stroke-width="6" stroke-linecap="round"/>` : ""}`;
      break;
    case "rocket":
    case "finale":
      object = `<g transform="translate(${820 + phaseIndex * 20} ${170 - (ch.kind === "finale" ? p * 100 : p * 30)})">${phaseIndex > 0 ? `<path d="M-25 100Q0 ${160 + p * 65} 25 100" fill="#efbd73"/><path d="M-12 100Q0 ${140 + p * 30} 12 100" fill="#fae7ab"/>` : ""}<path d="M-45 80V-40Q0 -130 45 -40V80Z" fill="#fff1d0"/><path d="M-45 -40Q0 -130 45 -40Z" fill="#d69e79"/><path d="M-45 30L-80 95L-40 80M45 30L80 95L40 80" fill="#8facab"/><circle cy="-15" r="24" fill="#a7c8d0" stroke="#79989e" stroke-width="8"/></g>${dots(10, (i) => `<circle cx="${620 + i * 50}" cy="320" r="7" fill="${i < Math.ceil(p * 10) ? "#e8ca7b" : "#bacaca"}"/>`)}`;
      break;
    case "star":
      object =
        dots(7, (i) =>
          star(
            650 + i * 65,
            150 + (i % 3) * 48,
            16,
            i < n + 1 ? "#f7d58c" : "#c4bfd2",
          ),
        ) +
        `${phaseIndex > 0 ? line("M650 150L715 198L780 246L845 150L910 198L975 246L1040 150", "#f7df9b", 3) : ""}`;
      break;
    case "rain":
      object =
        dots(
          12,
          (i) =>
            `<path d="M${620 + i * 40} ${100 + (i % 3) * 20}q-12 18 0 25q12 -7 0 -25" fill="#9ebecd" opacity="${i < n * 2 ? 1 : 0.2}"/>`,
        ) +
        dots(
          n,
          (i) =>
            `<ellipse cx="${670 + i * 67}" cy="${270 + (i % 2) * 25}" rx="${12 + p * 15}" ry="7" fill="none" stroke="#90b5bc" stroke-width="3"/>`,
        ) +
        `${phaseIndex === 2 ? `<path d="M650 240A180 140 0 0 1 1010 240" stroke="#e6c58d" stroke-width="16" fill="none"/>` : ""}`;
      break;
    case "record":
      object = `<g transform="translate(800 185)"><circle r="110" fill="#67837d"/><circle r="90" fill="none" stroke="#94a89a" stroke-width="2"/><circle r="70" fill="none" stroke="#94a89a" stroke-width="2"/><circle r="45" fill="${hue}"/><circle r="9" fill="#f6e8c7"/>${line(`M${-p * 80} -100L${p * 80} 100`, "#d0d5b8", 3)}</g><path d="M1010 110L950 180L940 245" stroke="#aa8f65" stroke-width="13" stroke-linecap="round" fill="none"/>${dots(n, (i) => text("♪", 630 + i * 80, 70 + (i % 2) * 15, 24))}`;
      break;
    case "soup":
      object = `<path d="M700 210H1010Q1000 325 855 325Q710 325 700 210" fill="#80a18b"/><ellipse cx="855" cy="210" rx="155" ry="28" fill="#d5b77b"/>${dots(n, (i) => fruit(755 + (i % 4) * 65, 202 + Math.floor(i / 4) * 10, ["#d9a06a", "#9db674", "#e5cd83"][i % 3]))}${dots(3, (i) => line(`M${785 + i * 75} 155q-20 -25 0 -50t0 -40`, "#fff8df", 6))}`;
      break;
    case "cake":
      object =
        dots(
          phaseIndex + 1,
          (i) =>
            `<g transform="translate(${700 + i * 35} ${260 - i * 65})"><rect width="${300 - i * 70}" height="65" rx="15" fill="${["#d6ae80", "#e5c6a5", "#e9d4b3"][i]}"/><path d="M0 15q25 30 50 0t50 0t50 0t50 0t50 0t50 0" fill="none" stroke="#fff1d5" stroke-width="13"/></g>`,
        ) +
        dots(n, (i) => fruit(725 + i * 43, 250 - phaseIndex * 65, "#d39488")) +
        `${phaseIndex === 2 ? `<path d="M850 95V55" stroke="#8dacaf" stroke-width="9"/><path d="M850 48q-15 -25 0 -35q15 10 0 35" fill="#f0ca76"/>` : ""}`;
      break;
    case "repair":
    case "robot":
      object =
        ch.kind === "repair"
          ? dots(
              4,
              (i) =>
                `<rect x="${660 + i * 95}" y="190" width="78" height="85" rx="18" fill="${i === 3 ? "#d1b2a3" : "#dfbb87"}" opacity="${i === 3 && beat > phase.keys.indexOf("BACKSPACE") ? 0.1 : i < beat ? 1 : 0.25}"/>${text(phase.keys[i], 699 + i * 95, 245, 28, "#9e784c")}`,
            )
          : `<g transform="translate(830 190)"><rect x="-65" y="-80" width="130" height="120" rx="25" fill="#97b5b0"/><path d="M-45 40V115M45 40V115" stroke="#78968c" stroke-width="24" stroke-linecap="round"/>${line(`M-65 -15L${-110 - p * 25} ${-20 - phaseIndex * 15}M65 -15L${110 + p * 25} ${-20 - phaseIndex * 15}`, "#78968c", 22)}<circle cx="-25" cy="-38" r="10" fill="#f6e9bb"/><circle cx="25" cy="-38" r="10" fill="#f6e9bb"/>${line(`M-24 5Q0 ${phaseIndex === 2 ? 28 : 5} 24 5`, "#567b72", 5)}<path d="M0 -80V-110" stroke="#78968c" stroke-width="6"/><circle cy="-115" r="12" fill="${p > 0.5 ? "#efcb78" : "#bbccab"}"/></g>`;
      break;
    case "serve":
      object = `<path d="M610 280H1110" stroke="#c6a67b" stroke-width="20"/>${dots(3, (i) => `<ellipse cx="${700 + i * 150}" cy="260" rx="65" ry="20" fill="#fff2d4"/><path d="M${650 + i * 150} 250q50 -${i < phaseIndex || (i === phaseIndex && p > 0.6) ? 80 : 10} 100 0Z" fill="${i < phaseIndex || (i === phaseIndex && p > 0.6) ? hue : "#c5c9b5"}"/>`)}${sprite(otter(), 930, 70, 140)}`;
      break;
    case "bake":
      object = `<rect x="680" y="100" width="335" height="220" rx="25" fill="#9f9c84"/><rect x="700" y="135" width="295" height="155" rx="18" fill="#6f7965"/>${dots(3, (i) => `<path d="M${725 + i * 85} 245v-30q35 -70 70 0v30Z" fill="${i <= phaseIndex ? "#d9ab6b" : "#a9a580"}"/>${line(`M${740 + i * 85} 205l15 -20m0 30l15 -20`, "#f6daa5", 5)}`)}${dots(n, (i) => `<circle cx="${715 + i * 50}" cy="115" r="5" fill="#f7d88c"/>`)}`;
      break;
    case "festival":
      object =
        dots(
          5,
          (i) =>
            `<g transform="translate(${630 + i * 110} ${90 + (i % 2) * 35})">${line("M0 -50V-10", "#a08c6b", 3)}<ellipse cy="40" rx="37" ry="48" fill="${["#d9a17e", "#b1ba86", "#d6b879", "#a6b6bd", "#c0a8ba"][i]}" opacity="${i < n ? 1 : 0.25}"/><path d="M-13 -7H13M-13 87H13M0 88V110" stroke="#c39c5b" stroke-width="6"/></g>`,
        ) +
        `${phaseIndex === 2 ? dots(n, (i) => star(650 + i * 80, 250 + (i % 2) * 30, 16)) : ""}`;
      break;
    case "submarine":
      object = `<g transform="translate(${680 + p * 200} ${165 + Math.sin(p * 3) * 30})"><rect x="-70" y="-40" width="220" height="95" rx="45" fill="#d7ba79"/><path d="M-65 -15L-110 -35V45L-65 25" fill="#8aaea6"/><path d="M15 -40V-65H55" fill="none" stroke="#c4a05e" stroke-width="14"/><circle cx="90" cy="7" r="26" fill="#a4cccd" stroke="#f0dca5" stroke-width="8"/>${dots(n, (i) => `<circle cx="${-120 - i * 18}" cy="${-10 - i * 9}" r="${4 + i}" fill="none" stroke="#e6f0df" stroke-width="2"/>`)}</g>${dots(4, (i) => line(`M${630 + i * 150} 350v-45m0 20l-20 -20m20 4l20 -30`, "#be9c97", 10))}`;
      break;
    case "planet":
      object = dots(
        3,
        (i) =>
          `<g transform="translate(${680 + i * 160} ${180 + (i % 2) * 55})"><circle r="${40 + i * 8}" fill="${["#c5ac92", "#9cbbb4", "#a9add2"][i]}"/><ellipse rx="${68 + i * 9}" ry="18" fill="none" stroke="#ead4a4" stroke-width="9" transform="rotate(-20)"/>${
            phaseIndex >= i
              ? text(
                  phase.keys
                    .slice(0, 2)
                    .map((k) => k.replace("SHIFT+", ""))
                    .join(""),
                  0,
                  7,
                  22,
                  "#fff8df",
                )
              : ""
          }${i < n ? star(45, -50, 12) : ""}</g>`,
      );
      break;
    case "story":
      object = `<g transform="translate(710 60)"><rect width="290" height="250" rx="14" fill="#fff3d4"/>${dots(n + 1, (i) => line(`M25 ${40 + i * 27}H${70 + p * 170}`, "#a3b79c", 6))}${phaseIndex > 0 ? `<rect x="215" y="20" width="48" height="55" rx="6" fill="#ddbd86"/>${star(239, 46, 14, "#fff0c4")}` : ""}</g>${phaseIndex === 2 ? `<path d="M${700 + p * 250} 65l90 -35 -35 65 -12 -25Z" fill="#faf5de" stroke="#a9bbaa" stroke-width="2"/>` : ""}`;
      break;
    default:
      object = star(850, 170, 70);
  }
  const companion =
    ch.kind === "drum" || ch.kind === "melody" || ch.kind === "concert"
      ? frog()
      : otter(ch.world === 4);
  const accent =
    typeof game !== "undefined" && game?.choice === 1
      ? "#c4a4c9"
      : world.accent;
  const footer = text(ch.props[phaseIndex], 860, 345, 12, "#678474");
  return svg(
    bg +
      `<g id="scene-object" data-kind="${ch.kind}" data-phase="${phaseIndex}" data-progress="${beat}" style="--scene-accent:${accent}">${object}</g>` +
      `<g id="actor">${sprite(companion, 310, 100, 220, 235)}</g>`,
    "240 -25 960 400",
    "campaign-art",
  );
}

"use strict";
const ROOM_CATEGORIES = [
  ["plant", "🌿", "绿植"],
  ["floor", "🧶", "地毯"],
  ["light", "💡", "灯光"],
  ["window", "🪟", "窗景"],
  ["table", "🍰", "点心"],
  ["toy", "🧸", "玩具"],
];
const ROOM_ITEMS = [
  ["plant", "🪴", "窗边小绿植", 10, "plant"],
  ["fern", "🌿", "雨林蕨叶", 20, "plant"],
  ["cactus", "🌵", "沙漠仙人掌", 25, "plant"],
  ["sunflower-pot", "🌻", "向日葵盆栽", 30, "plant"],
  ["mushroom", "🍄", "童话蘑菇", 45, "plant"],
  ["bonsai", "🌳", "森林小树", 55, "plant"],
  ["rug", "🧶", "软软毛线球", 20, "floor"],
  ["leaf-mat", "🍃", "树叶小地毯", 25, "floor"],
  ["shell-mat", "🐚", "海贝地毯", 35, "floor"],
  ["rainbow-mat", "🌈", "彩虹地毯", 45, "floor"],
  ["cloud-mat", "☁️", "云朵软垫", 55, "floor"],
  ["star-mat", "⭐", "星星地毯", 65, "floor"],
  ["lamp", "🏮", "温暖小夜灯", 30, "light"],
  ["candle", "🕯️", "故事小烛灯", 20, "light"],
  ["moon-lamp", "🌙", "月牙小灯", 40, "light"],
  ["mushroom-lamp", "🍄", "蘑菇灯", 45, "light"],
  ["crystal-lamp", "💎", "冰晶灯", 60, "light"],
  ["sun-lamp", "☀️", "太阳小灯", 65, "light"],
  ["telescope", "🔭", "小小望远镜", 45, "window"],
  ["windchime", "🎐", "晴天风铃", 25, "window"],
  ["snow-window", "❄️", "雪花窗贴", 30, "window"],
  ["rainbow-window", "🌈", "彩虹窗景", 40, "window"],
  ["planet-window", "🪐", "星球窗景", 55, "window"],
  ["aurora-window", "🌌", "极光窗景", 75, "window"],
  ["cake", "🎂", "朋友的蛋糕", 55, "table"],
  ["donut", "🍩", "彩糖甜甜圈", 20, "table"],
  ["cookies", "🍪", "字母小饼干", 25, "table"],
  ["tea", "🫖", "温暖下午茶", 35, "table"],
  ["fruit-bowl", "🍎", "丰收水果篮", 40, "table"],
  ["pudding", "🍮", "摇摇果冻布丁", 45, "table"],
  ["piano", "🎹", "窗边小钢琴", 65, "toy"],
  ["teddy", "🧸", "抱抱小熊", 25, "toy"],
  ["dino-toy", "🦕", "小恐龙玩偶", 35, "toy"],
  ["robot-toy", "🤖", "微笑机器人", 45, "toy"],
  ["rocket-toy", "🚀", "星光号模型", 60, "toy"],
  ["train-toy", "🚂", "环岛小火车", 75, "toy"],
].map(([id, emoji, name, cost, slot]) => ({ id, emoji, name, cost, slot }));
let roomCategory = "plant";
function normalizeRoom() {
  if (
    !state.roomLayout ||
    typeof state.roomLayout !== "object" ||
    Array.isArray(state.roomLayout)
  )
    state.roomLayout = {};
  for (const [slot] of ROOM_CATEGORIES) {
    if (
      !ROOM_ITEMS.some(
        (x) =>
          x.slot === slot &&
          x.id === state.roomLayout[slot] &&
          state.owned.includes(x.id),
      )
    ) {
      const item = ROOM_ITEMS.find(
        (x) => x.slot === slot && state.owned.includes(x.id),
      );
      if (item) state.roomLayout[slot] = item.id;
      else delete state.roomLayout[slot];
    }
  }
}
function buyRoomItem(id) {
  const item = ROOM_ITEMS.find((x) => x.id === id);
  if (!item) return;
  if (!state.owned.includes(id)) {
    if (state.shells < item.cost) {
      toast(`再收集 ${item.cost - state.shells} 个贝壳，就能带回家。`);
      return;
    }
    state.shells -= item.cost;
    state.owned.push(id);
  }
  state.roomLayout[item.slot] = id;
  save();
  render();
  IslandAudio.collect(2);
  toast("已经放进豆豆的小屋！");
}
function roomView() {
  normalizeRoom();
  const badges = CHAPTERS.filter((c) => state.completed[c.id]);
  badgePage = Math.min(
    badgePage,
    Math.max(0, Math.ceil(badges.length / 6) - 1),
  );
  const visible = badges.slice(badgePage * 6, badgePage * 6 + 6),
    equipped = ROOM_ITEMS.filter(
      (x) => state.roomLayout[x.slot] === x.id && state.owned.includes(x.id),
    );
  return `<div class="toy-room expanded-room"><div class="room-scene" data-window-theme="${state.roomLayout.window || "plain"}"><div class="room-window"></div><div class="room-pet float" data-tickle role="button" tabindex="0" aria-label="摸摸豆豆">${otter()}</div>${equipped.map((x) => `<div class="room-furniture slot-${x.slot}" data-equipped="${x.id}" aria-label="${x.name}">${x.emoji}</div>`).join("")}<div class="room-sticker">${state.sticker || "🌟"}</div><div class="room-wallet">🐚 ${state.shells}</div><div class="room-owned-count" aria-label="已收集装扮">🎁 ${ROOM_ITEMS.filter((x) => state.owned.includes(x.id)).length} / ${ROOM_ITEMS.length}</div></div><div class="badge-shelf">${visible.length ? visible.map((ch) => `<button data-preview="${ch.id}" aria-label="${ch.badge}">${sceneThumb(ch)}<small>${"★".repeat(state.completed[ch.id].stars)}</small></button>`).join("") : `<div class="empty-treasure">${playIcon("treasure")}<span>★</span></div>`}${badges.length > 6 ? `<button class="badge-next round-action" data-badges aria-label="更多纪念章">➜</button>` : ""}</div><div class="room-categories" aria-label="装扮分类">${ROOM_CATEGORIES.map(([slot, emoji, label]) => `<button data-room-category="${slot}" class="${slot === roomCategory ? "selected" : ""}" aria-label="${label}" aria-pressed="${slot === roomCategory}"><span>${emoji}</span><small>${label}</small></button>`).join("")}</div><div class="shop">${ROOM_ITEMS.filter(
    (x) => x.slot === roomCategory,
  )
    .map((x) => {
      const owned = state.owned.includes(x.id),
        placed = state.roomLayout[x.slot] === x.id;
      return `<button data-buy="${x.id}" class="${placed ? "equipped" : ""} ${owned ? "owned" : ""}" aria-label="${x.name} ${placed ? "已摆放" : owned ? "点击摆放" : x.cost + " 贝壳"}"><span>${x.emoji}</span><small>${placed ? "✓" : owned ? "摆放" : `🐚 ${x.cost}`}</small></button>`;
    })
    .join("")}</div></div>`;
}

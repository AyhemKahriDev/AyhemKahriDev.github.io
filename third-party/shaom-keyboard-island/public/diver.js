"use strict";
// Camera experiment: video stays in this document, never encoded, recorded or sent.
const DiverGame = (() => {
  let stream = null,
    session = 0,
    step = 0,
    locked = false,
    active = false,
    mode = "cartoon",
    timer,
    watchdog;
  const keys = [
    "F",
    "J",
    "F",
    "J",
    "SPACE",
    "F",
    "J",
    "SPACE",
    "J",
    "F",
    "J",
    "F",
    "SPACE",
    "J",
    "F",
    "SPACE",
    "F",
    "J",
    "SPACE",
    "F",
    "J",
    "F",
    "J",
    "SPACE",
  ];
  const phases = ["追上泡泡鱼", "穿过珊瑚林", "找到海底宝箱"];
  function stopCamera() {
    FaceCamera.stop();
    session++;
    clearTimeout(watchdog);
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    const v = document.querySelector("#diver-video");
    if (v) {
      v.pause();
      v.srcObject = null;
    }
    mode = "cartoon";
    syncCamera();
  }
  function stop() {
    active = false;
    clearTimeout(timer);
    stopCamera();
  }
  function syncCamera() {
    const stage = document.querySelector(".diver-stage");
    if (!stage) return;
    stage.classList.toggle("camera-live", !!stream);
    const b = document.querySelector("[data-diver-camera]");
    if (b) {
      b.textContent = stream ? "● 摄像头开着 · 关闭" : "📷 开启摄像头";
      b.setAttribute("aria-label", stream ? "关闭摄像头" : "开启摄像头");
    }
  }
  function notice(text) {
    const n = document.querySelector("#diver-notice");
    if (n && n.textContent !== text) n.textContent = text;
  }
  async function enableCamera() {
    if (!active) return;
    if (stream) {
      stopCamera();
      notice("摄像头已关闭，继续用卡通角色玩。");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      notice("当前浏览器无法使用摄像头，可以直接用卡通角色玩。");
      return;
    }
    const token = ++session;
    notice("请在浏览器中允许摄像头。只拍画面，不使用麦克风。");
    watchdog = setTimeout(() => {
      if (token === session && active)
        notice("还在等待摄像头许可，也可以先用卡通角色玩。");
    }, 8000);
    let acquired;
    try {
      acquired = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 24, max: 30 },
        },
      });
      if (token !== session || !active || document.hidden) {
        acquired.getTracks().forEach((t) => t.stop());
        return;
      }
      clearTimeout(watchdog);
      stream = acquired;
      const video = document.querySelector("#diver-video");
      video.srcObject = stream;
      await video.play();
      if (token !== session || !active || !stream) return;
      mode = "camera";
      syncCamera();
      FaceCamera.start(video, document.querySelector("#diver-face"), notice);
      stream.getVideoTracks()[0].addEventListener("ended", () => {
        if (token === session) {
          stopCamera();
          notice("摄像头已停止，卡通潜水员继续陪你玩。");
        }
      });
    } catch (e) {
      if (token !== session) return;
      clearTimeout(watchdog);
      acquired?.getTracks().forEach((t) => t.stop());
      stopCamera();
      const messages = {
        NotAllowedError:
          "没有获得摄像头许可。可检查浏览器权限，或直接用卡通角色玩。",
        NotFoundError: "没有找到摄像头，先用卡通角色去探险吧。",
        NotReadableError: "摄像头可能被其他应用占用，关闭其他应用后再试。",
        OverconstrainedError: "摄像头不支持当前设置，先用卡通角色玩吧。",
      };
      notice(messages[e.name] || "摄像头暂时无法启动，可以直接用卡通角色玩。");
    }
  }
  function diver() {
    return `<div class="diver-character"><div class="diver-arm arm-left"></div><div class="diver-arm arm-right"></div><div class="diver-suit"><span>★</span></div><div class="diver-boot boot-left"></div><div class="diver-boot boot-right"></div><div class="diver-helmet"><div class="helmet-window"><div class="diver-cartoon">${otter()}</div><video id="diver-video" autoplay muted playsinline aria-label="仅在本机显示的实时摄像头画面"></video><canvas id="diver-face" aria-label="自动放大并跟随的实时人脸"></canvas></div><i class="helmet-light"></i><span class="helmet-bolt bolt-left"></span><span class="helmet-bolt bolt-right"></span><div class="helmet-shine"></div></div></div>`;
  }
  function open() {
    clearGame();
    if (dialog.open) dialog.close();
    page = "diver";
    active = true;
    step = 0;
    locked = false;
    app.dataset.page = "diver";
    document
      .querySelectorAll(".nav")
      .forEach((n) => n.classList.remove("active"));
    initAudio();
    app.innerHTML = `<section class="diver-game"><div class="diver-toolbar"><button class="round-action" data-diver-exit aria-label="返回小岛">⌂</button><h1>我的海底冒险 <small>体验关</small></h1><button class="camera-switch" data-diver-camera aria-label="开启摄像头">📷 开启摄像头</button></div><div class="diver-stage"><div class="ocean-rays"></div><div class="diver-mission"><span id="diver-mission">${phases[0]}</span><div id="diver-progress" aria-label="探索进度">○ ○ ○</div></div><div class="ocean-fishes"><span>🐠</span><span>🐟</span><span>🐡</span></div><div class="diver-reef reef-left">🪸</div><div class="diver-reef reef-right">🌿</div><div class="diver-floor"></div><div class="diver-traveler">${diver()}</div><div class="diver-friend">${otter()}<span>🫧</span></div><div class="diver-chest">🎁</div><div class="diver-bubbles" aria-hidden="true"></div><div class="diver-goal" aria-label="当前目标按键"><span>按一下</span><b id="diver-target">F</b></div><div class="diver-finish" hidden><span>🐚</span><h2>找到宝藏啦！</h2><div><button class="primary" data-diver-replay>↻ 再潜一次</button><button class="secondary" data-diver-exit>⌂ 回小岛</button></div></div></div><div class="diver-bottom"><div class="face-size-controls"><button data-face-smaller aria-label="脸小一点">−</button><span>🤿</span><button data-face-bigger aria-label="脸大一点">＋</button></div><div class="diver-keycaps"><span data-diver-key="F">F<small>左手食指</small></span><span data-diver-key="J">J<small>右手食指</small></span><span data-diver-key="SPACE">␣<small>拇指</small></span></div><p id="diver-notice" role="status">可以直接玩，也可以请家长开启摄像头，变成小潜水员。</p></div></section>`;
    app.querySelector("[data-diver-camera]").onclick = enableCamera;
    app.querySelector("[data-face-smaller]").onclick = () =>
      FaceCamera.adjust(-0.1);
    app.querySelector("[data-face-bigger]").onclick = () =>
      FaceCamera.adjust(0.1);
    app
      .querySelectorAll("[data-diver-exit]")
      .forEach((b) => (b.onclick = () => navigate("home")));
    app.querySelector("[data-diver-replay]").onclick = () => {
      step = 0;
      locked = false;
      document.querySelector(".diver-finish").hidden = true;
      document.querySelector(".diver-goal").hidden = false;
      document.querySelector(".diver-stage").classList.remove("treasure-found");
      update();
    };
    update();
  }
  function update() {
    if (!active) return;
    document.querySelector("#diver-target").textContent =
      keys[step] === "SPACE" ? "␣" : keys[step];
    document.querySelector("#diver-mission").textContent =
      phases[Math.min(2, Math.floor(step / 8))];
    document.querySelector("#diver-progress").textContent = Array.from(
      { length: 3 },
      (_, i) => (step >= 8 * (i + 1) ? "★" : "○"),
    ).join(" ");
    document
      .querySelectorAll("[data-diver-key]")
      .forEach((el) =>
        el.classList.toggle("lit", el.dataset.diverKey === keys[step]),
      );
    document.querySelector(".diver-traveler").style.left =
      10 + (step / keys.length) * 42 + "%";
    document.querySelector(".diver-chest").style.opacity = String(
      0.25 + (step / keys.length) * 0.75,
    );
  }
  function press(key) {
    if (!active || locked || step >= keys.length || dialog.open) return;
    VoiceDirector.input(true);
    if (key !== keys[step]) {
      IslandAudio.wrong();
      const t = document.querySelector(".diver-goal");
      t.animate(
        [
          { transform: "rotate(-5deg)" },
          { transform: "rotate(5deg)" },
          { transform: "rotate(0)" },
        ],
        { duration: 250 },
      );
      return;
    }
    locked = true;
    const character = document.querySelector(".diver-character");
    character.classList.remove("swim-left", "swim-right", "swim-up");
    void character.offsetWidth;
    character.classList.add(
      key === "F" ? "swim-left" : key === "J" ? "swim-right" : "swim-up",
    );
    IslandAudio.water(step);
    if (key === "SPACE") IslandAudio.bell(784);
    const host = document.querySelector(".diver-bubbles");
    for (let i = 0; i < (state.reduced ? 3 : 9); i++) {
      const el = document.createElement("i");
      el.style.cssText = `left:${25 + Math.random() * 40}%;bottom:${10 + Math.random() * 25}%;--drift:${Math.random() * 100 - 50}px;--bubble-size:${12 + Math.random() * 32}px`;
      host.append(el);
      setTimeout(() => el.remove(), 1500);
    }
    step++;
    if (step % 8 === 0) IslandAudio.collect(3);
    timer = setTimeout(
      () => {
        if (!active) return;
        locked = false;
        if (step === keys.length) {
          document.querySelector(".diver-finish").hidden = false;
          document.querySelector(".diver-goal").hidden = true;
          document
            .querySelector(".diver-stage")
            .classList.add("treasure-found");
          document.querySelector("#diver-progress").textContent = "★ ★ ★";
          IslandAudio.celebrate(true);
        } else update();
      },
      key === "SPACE" ? 480 : 360,
    );
  }
  document.addEventListener("keydown", (e) => {
    if (
      !active ||
      page !== "diver" ||
      e.repeat ||
      e.ctrlKey ||
      e.altKey ||
      e.metaKey ||
      dialog.open
    )
      return;
    if (e.code === "Escape") {
      stopCamera();
      notice("摄像头已关闭。点击开启摄像头，可继续实时体验。");
      return;
    }
    const key = { KeyF: "F", KeyJ: "J", Space: "SPACE" }[e.code];
    if (key) {
      e.preventDefault();
      press(key);
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && active) {
      stopCamera();
      notice("离开页面时已关闭摄像头，回来后可手动开启。");
    }
  });
  window.addEventListener("pagehide", stop);
  return { open, stop, stopCamera };
})();

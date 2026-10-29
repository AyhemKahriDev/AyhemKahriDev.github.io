"use strict";
const FaceCamera = (() => {
  let worker,
    raf = 0,
    generation = 0,
    ready = false,
    busy = false,
    lastSent = 0,
    lastSeen = 0,
    lastPaint = 0,
    zoom = 1;
  let crop = { x: 0.5, y: 0.45, size: 0.75 },
    target = { ...crop },
    video,
    canvas,
    ctx,
    onStatus = () => {};
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  function stop() {
    generation++;
    cancelAnimationFrame(raf);
    raf = 0;
    worker?.terminate();
    worker = null;
    ready = false;
    busy = false;
    if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
    video = null;
    canvas = null;
    ctx = null;
  }
  // Bounding boxes remain geometry only. No identity, photo, or video is retained.
  function frameCrop(box, w, h) {
    const side = clamp(
      Math.max(box.width * 1.65, box.height * 1.48) / zoom,
      Math.min(w, h) * 0.14,
      Math.min(w, h),
    );
    return {
      x: clamp(
        (box.originX + box.width / 2) / w,
        side / 2 / w,
        1 - side / 2 / w,
      ),
      y: clamp(
        (box.originY + box.height * 0.48) / h,
        side / 2 / h,
        1 - side / 2 / h,
      ),
      size: side / Math.min(w, h),
    };
  }
  function choose(boxes, w, h) {
    return boxes
      .map((b) => ({
        b,
        score:
          Math.abs((b.originX + b.width / 2) / w - crop.x) +
          Math.abs((b.originY + b.height / 2) / h - crop.y) -
          Math.sqrt(b.width * b.height) / (w + h),
      }))
      .sort((a, b) => a.score - b.score)[0]?.b;
  }
  function start(v, c, status) {
    stop();
    video = v;
    canvas = c;
    ctx = c.getContext("2d", { alpha: false });
    canvas.width = canvas.height = 360;
    onStatus = status;
    crop = { x: 0.5, y: 0.45, size: 0.75 };
    target = { ...crop };
    lastSeen = 0;
    lastSent = 0;
    lastPaint = 0;
    zoom = 1;
    const token = generation;
    onStatus("正在准备自动跟随，画面只在本机处理。");
    try {
      worker = new Worker("face-worker.js");
      worker.onmessage = ({ data }) => {
        if (token !== generation) return;
        if (data.type === "ready") {
          ready = true;
          busy = false;
          canvas.dataset.tracking = "ready";
          onStatus("看一眼镜头，找到脸后会自动放大。");
        }
        if (data.type === "error") {
          ready = false;
          busy = false;
          if (canvas) canvas.dataset.tracking = "fallback";
          onStatus("自动跟随暂不可用，可用“脸大一点”调整画面。");
        }
        if (data.type === "frame-error") busy = false;
        if (data.type === "faces") {
          busy = false;
          const box = choose(data.boxes, data.width, data.height);
          if (box) {
            const fresh = !lastSeen || performance.now() - lastSeen > 2000;
            target = frameCrop(box, data.width, data.height);
            canvas.dataset.tracking = "following";
            canvas.dataset.faceFill = String(
              box.height / (target.size * Math.min(data.width, data.height)),
            );
            lastSeen = performance.now();
            if (fresh)
              onStatus("已跟随人脸。可以轻轻移动，不需要一直坐在正中间。");
          } else if (performance.now() - lastSeen > 2500) {
            target = { x: 0.5, y: 0.45, size: 0.85 / zoom };
            canvas.dataset.tracking = "searching";
            onStatus("暂时没看到脸，看看镜头，或往亮一点的地方坐。");
          }
        }
      };
      worker.onerror = (e) => {
        e.preventDefault();
        ready = false;
        busy = false;
        if (canvas) canvas.dataset.tracking = "fallback";
        onStatus("自动跟随暂不可用，可用“脸大一点”调整画面。");
      };
      worker.postMessage({ type: "init" });
    } catch {
      onStatus("可用“脸大一点”调整画面。");
    }
    async function tick(t) {
      if (token !== generation || !video || !ctx) return;
      raf = requestAnimationFrame(tick);
      if (video.readyState < 2 || t - lastPaint < 33) return;
      lastPaint = t;
      const w = video.videoWidth,
        h = video.videoHeight;
      for (const k of ["x", "y", "size"])
        crop[k] += (target[k] - crop[k]) * 0.17;
      const side = Math.min(w, h) * crop.size,
        x = clamp(crop.x * w - side / 2, 0, w - side),
        y = clamp(crop.y * h - side / 2, 0, h - side);
      ctx.save();
      ctx.translate(360, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, x, y, side, side, 0, 0, 360, 360);
      ctx.restore();
      if (ready && !busy && t - lastSent > 150) {
        busy = true;
        lastSent = t;
        try {
          const bitmap = await createImageBitmap(video, {
            resizeWidth: 320,
            resizeHeight: Math.round((320 * h) / w),
          });
          if (token !== generation) {
            bitmap.close();
            return;
          }
          worker.postMessage({ type: "frame", bitmap, time: t }, [bitmap]);
        } catch {
          busy = false;
        }
      }
    }
    raf = requestAnimationFrame(tick);
  }
  function adjust(amount) {
    zoom = clamp(zoom + amount, 0.8, 1.5);
    target.size = clamp(target.size * (amount > 0 ? 0.9 : 1.1), 0.15, 1);
    return Math.round(zoom * 100);
  }
  return { start, stop, adjust, frameCrop };
})();

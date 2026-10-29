"use strict";
let detector,
  scan = 0;
self.onmessage = async ({ data }) => {
  if (data.type === "init") {
    try {
      const { FaceDetector, FilesetResolver } =
        await import("./vendor/vision_bundle.mjs");
      const files = await FilesetResolver.forVisionTasks(
        new URL("./vendor/wasm", self.location.href).href,
      );
      detector = await FaceDetector.createFromOptions(files, {
        baseOptions: {
          modelAssetPath: new URL("./vendor/face.tflite", self.location.href)
            .href,
          delegate: "CPU",
        },
        runningMode: "VIDEO",
        minDetectionConfidence: 0.45,
        minSuppressionThreshold: 0.3,
      });
      self.postMessage({ type: "ready" });
    } catch {
      self.postMessage({ type: "error" });
    }
  }
  if (data.type === "frame") {
    try {
      const bitmap = data.bitmap,
        w = bitmap.width,
        h = bitmap.height;
      let result = detector.detectForVideo(bitmap, data.time),
        boxes = result.detections.map((d) => d.boundingBox);
      if (!boxes.length) {
        scan = (scan + 1) % 4;
        const cw = Math.round(w * 0.56),
          ch = Math.round(h * 0.75),
          ox = scan % 2 ? w - cw : 0,
          oy = scan > 1 ? h - ch : 0;
        const surface = new OffscreenCanvas(cw, ch);
        surface
          .getContext("2d")
          .drawImage(bitmap, ox, oy, cw, ch, 0, 0, cw, ch);
        const found = detector.detectForVideo(surface, data.time + 0.01);
        boxes = found.detections.map((d) => ({
          ...d.boundingBox,
          originX: d.boundingBox.originX + ox,
          originY: d.boundingBox.originY + oy,
        }));
      }
      self.postMessage({ type: "faces", boxes, width: w, height: h });
    } catch (e) {
      self.postMessage({ type: "frame-error", message: String(e) });
    } finally {
      data.bitmap.close();
    }
  }
};

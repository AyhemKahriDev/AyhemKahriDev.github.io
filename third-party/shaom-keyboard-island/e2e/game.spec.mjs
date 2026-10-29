import { test, expect } from "@playwright/test";
function combo(k) {
  if (k.startsWith("SHIFT+"))
    return (
      ("QAZWSXEDCRFVTGB".includes(k.slice(6)) ? "ShiftRight" : "ShiftLeft") +
      "+Key" +
      k.slice(6)
    );
  return (
    {
      SPACE: "Space",
      ENTER: "Enter",
      BACKSPACE: "Backspace",
      ";": "Semicolon",
      ",": "Comma",
      ".": "Period",
      "/": "Slash",
    }[k] || (/^\d$/.test(k) ? "Digit" + k : "Key" + k)
  );
}
test("all 96 chapters complete and save without optional recordings", async ({
  page,
}) => {
  test.setTimeout(420_000);
  const errors = [],
    audioRequests = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (/\.mp3(?:\?|$)/.test(r.url())) audioRequests.push(r.url());
  });
  await page.clock.install();
  await page.goto("/");
  await page.locator("[data-continue]").click();
  for (let id = 0; id < 96; id++) {
    expect(await page.evaluate(() => game.chapter.id)).toBe(id);
    let guard = 0;
    while (!(await page.locator("dialog").isVisible())) {
      const k = await page
        .locator("[data-expected]")
        .getAttribute("data-expected");
      await page.keyboard.press(combo(k));
      await page.clock.fastForward(1000);
      expect(++guard).toBeLessThan(150);
    }
    expect(await page.evaluate(() => !!state.completed[game.chapter.id])).toBe(
      true,
    );
    if (id < 95) await page.locator("dialog .primary[data-chapter]").click();
  }
  await page.reload();
  expect(await page.evaluate(() => completedCount())).toBe(96);
  expect(audioRequests).toEqual([]);
  expect(errors).toEqual([]);
});
test("chapter 18 checkpoint and decoration purchases survive reload", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => {
    state.completed = Object.fromEntries(
      CHAPTERS.slice(0, 17).map((c) => [c.id, { stars: 3, plays: 1 }]),
    );
    state.shells = 200;
    state.owned = ["plant", "rug"];
    state.checkpoint = {
      chapter: 17,
      step: 3,
      wrong: 1,
      hints: 0,
      typed: "cat",
      elapsed: 40,
      sequence: CHAPTERS[17].phases.flatMap((p) => p.keys),
    };
    save();
  });
  await page.reload();
  await page.locator("[data-continue]").click();
  expect(
    await page.locator("[data-expected]").getAttribute("data-expected"),
  ).toBe("SPACE");
  expect(await page.evaluate(() => game.step)).toBe(3);
  await page.getByRole("button", { name: "伙伴小屋", exact: true }).click();
  await expect(page.locator("[data-equipped]")).toHaveCount(2);
  await page.locator('[data-buy="fern"]').click();
  expect(await page.evaluate(() => state.shells)).toBe(180);
  await page.locator('[data-buy="fern"]').click();
  expect(await page.evaluate(() => state.shells)).toBe(180);
  await page.reload();
  await page.getByRole("button", { name: "伙伴小屋", exact: true }).click();
  await expect(page.locator('[data-equipped="fern"]')).toHaveCount(1);
});
test("gameplay cancels Space/Enter/Backspace and Shift defaults under button focus", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/");
  for (const key of ["SPACE", "ENTER", "BACKSPACE", "SHIFT+A", "SHIFT+J"]) {
    await page.evaluate((key) => {
      for (const ch of CHAPTERS)
        state.completed[ch.id] = { stars: 3, plays: 1 };
      const ch = CHAPTERS.find((c) =>
        c.phases.some((p) => p.keys.includes(key)),
      );
      startChapter(ch.id);
      game.step = game.sequence.indexOf(key);
      render();
      window.defaultAudit = [];
      window.addEventListener(
        "keydown",
        (e) =>
          defaultAudit.push({ code: e.code, prevented: e.defaultPrevented }),
        { once: false },
      );
    }, key);
    await page.locator("[data-pause]").focus();
    const step = await page.evaluate(() => game.step);
    await page.keyboard.press(combo(key));
    expect(await page.evaluate(() => game.step)).toBe(step + 1);
    expect(
      await page.evaluate(
        () =>
          defaultAudit.filter((x) => !x.code.startsWith("Shift")).at(-1)
            .prevented,
      ),
    ).toBe(true);
    await expect(page.locator("dialog")).not.toBeVisible();
  }
});
test("camera is opt-in, uses synthetic video, and stops on exit", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    window.streams = [];
    window.mediaConstraints = [];
    navigator.mediaDevices.getUserMedia = async (options) => {
      mediaConstraints.push(options);
      const s = await original(options);
      streams.push(s);
      return s;
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "实时潜水员体验" }).click();
  expect(await page.evaluate(() => streams.length)).toBe(0);
  await page.getByRole("button", { name: "开启摄像头", exact: true }).click();
  await expect(page.locator(".camera-live")).toBeVisible();
  expect(await page.evaluate(() => mediaConstraints[0].audio)).toBe(false);
  await page.locator("[data-diver-exit]").first().click();
  expect(
    await page.evaluate(() =>
      streams.every((s) =>
        s.getTracks().every((t) => t.readyState === "ended"),
      ),
    ),
  ).toBe(true);
});
test("camera denial leaves cartoon gameplay usable", async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException("denied", "NotAllowedError");
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "实时潜水员体验" }).click();
  await page.getByRole("button", { name: "开启摄像头", exact: true }).click();
  await expect(page.locator("#diver-notice")).toContainText("没有获得");
  await page.keyboard.press("KeyF");
  await expect(page.locator("#diver-target")).toHaveText("J");
});

test("voice controls clearly indicate that optional recordings are absent", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "家长设置" }).click();
  await expect(page.locator('[data-setting="voice"]')).toBeDisabled();
  await expect(page.locator("[data-voice-demo]")).toBeDisabled();
  await expect(page.locator("dialog")).toContainText("此版本未附录音");
});

import { describe, expect, it } from "vitest";
import { loadPersistenceModule } from "./helpers/load-core";

function card(suit: number, rank: number, isOpen = true) {
  return { suit, rank, color: suit % 2 === 0 ? 0 : 1, isOpen };
}

function boardState() {
  return {
    stock: [card(0, 1, false)],
    waste: [card(1, 2, true)],
    foundations: [[card(0, 1)], [], [], []],
    tableau: [
      [card(0, 7)],
      [card(1, 6)],
      [],
      [],
      [],
      [],
      []
    ]
  };
}

function createMemoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
    removeItem(key: string) {
      map.delete(key);
    }
  };
}

function createDocument(autoCheck = true) {
  const appVersion = { textContent: "" };
  const checkBox = { checked: autoCheck };
  const status = { textContent: "", style: { opacity: "0" } };
  const warning = { style: { opacity: "0" } };

  return {
    getElementById(id: string) {
      if (id === "app-version") return appVersion;
      if (id === "chk-autocheck") return checkBox;
      if (id === "status-msg") return status;
      if (id === "stuck-warning") return warning;
      return null;
    },
    checkBox,
    appVersion
  };
}

describe("persistence", () => {
  it("saves current progress with offline key", () => {
    const localStorage = createMemoryStorage();
    const document = createDocument(true);
    const state = {
      current: boardState(),
      initial: boardState(),
      history: [JSON.stringify(boardState())],
      isAutoFinishing: false,
      isAutoMoving: false,
      isAnimating: false,
      animatingCount: 0,
      lastAnimationPromise: Promise.resolve(),
      lastRevealPromise: Promise.resolve(),
      lastAnimationEndAt: 0,
      autoChainCount: 0
    };

    const { Persistence } = loadPersistenceModule({
      Config: { APP_VERSION: "v20260304" },
      State: state,
      UI: { render: () => {} },
      requestAutoCheck: () => {},
      clearStatus: () => {},
      updateButtons: () => {},
      setLastMove: () => {},
      document,
      localStorage,
      location: { pathname: "/game/klondike.html" }
    });

    Persistence.saveCurrentProgress();
    const raw = localStorage.getItem("klondike:save:offline:v1");

    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.state.history.length).toBe(1);
  });

  it("removes broken save payload during restore", () => {
    const localStorage = createMemoryStorage();
    localStorage.setItem("klondike:save:offline:v1", "{broken-json");

    const { Persistence } = loadPersistenceModule({
      Config: { APP_VERSION: "v20260304" },
      State: {
        current: null,
        initial: null,
        history: [],
        isAutoFinishing: false,
        isAutoMoving: false,
        isAnimating: false,
        animatingCount: 0,
        lastAnimationPromise: Promise.resolve(),
        lastRevealPromise: Promise.resolve(),
        lastAnimationEndAt: 0,
        autoChainCount: 0
      },
      UI: { render: () => {} },
      requestAutoCheck: () => {},
      clearStatus: () => {},
      updateButtons: () => {},
      setLastMove: () => {},
      document: createDocument(),
      localStorage,
      location: { pathname: "/game/klondike.html" }
    });

    expect(Persistence.restoreFromLocal()).toBe(false);
    expect(localStorage.getItem("klondike:save:offline:v1")).toBeNull();
  });

  it("does not restore offline save when running online variant", () => {
    const localStorage = createMemoryStorage();
    const payload = {
      schemaVersion: 1,
      appVersion: "v20260304",
      variant: "offline",
      savedAt: new Date().toISOString(),
      state: {
        current: boardState(),
        initial: boardState(),
        history: [JSON.stringify(boardState())],
        toggles: { autoCheck: false }
      }
    };
    localStorage.setItem("klondike:save:offline:v1", JSON.stringify(payload));

    const state = {
      current: null,
      initial: null,
      history: [],
      isAutoFinishing: false,
      isAutoMoving: false,
      isAnimating: false,
      animatingCount: 0,
      lastAnimationPromise: Promise.resolve(),
      lastRevealPromise: Promise.resolve(),
      lastAnimationEndAt: 0,
      autoChainCount: 0
    };

    const { Persistence } = loadPersistenceModule({
      Config: { APP_VERSION: "v20260304" },
      State: state,
      UI: { render: () => {} },
      requestAutoCheck: () => {},
      clearStatus: () => {},
      updateButtons: () => {},
      setLastMove: () => {},
      document: createDocument(),
      localStorage,
      location: { pathname: "/game/klondike-online.html" }
    });

    expect(Persistence.restoreFromLocal()).toBe(false);
    expect(state.current).toBeNull();
  });

  it("migrates legacy offline key to primary key on restore", () => {
    const localStorage = createMemoryStorage();
    const payload = {
      schemaVersion: 1,
      appVersion: "v20260304",
      variant: "offline",
      savedAt: new Date().toISOString(),
      state: {
        current: boardState(),
        initial: boardState(),
        history: [JSON.stringify(boardState())],
        toggles: { autoCheck: true }
      }
    };
    localStorage.setItem("klondike-save", JSON.stringify(payload));

    const state = {
      current: null,
      initial: null,
      history: [],
      isAutoFinishing: false,
      isAutoMoving: false,
      isAnimating: false,
      animatingCount: 0,
      lastAnimationPromise: Promise.resolve(),
      lastRevealPromise: Promise.resolve(),
      lastAnimationEndAt: 0,
      autoChainCount: 0
    };

    const { Persistence } = loadPersistenceModule({
      Config: { APP_VERSION: "v20260304" },
      State: state,
      UI: { render: () => {} },
      requestAutoCheck: () => {},
      clearStatus: () => {},
      updateButtons: () => {},
      setLastMove: () => {},
      document: createDocument(),
      localStorage,
      location: { pathname: "/game/klondike.html" }
    });

    expect(Persistence.restoreFromLocal()).toBe(true);
    expect(localStorage.getItem("klondike-save")).toBeNull();
    expect(localStorage.getItem("klondike:save:offline:v1")).not.toBeNull();
    expect(state.current).not.toBeNull();
  });

  it("restores manualMoveCount and maxAutoChainCount from saved payload", () => {
    const localStorage = createMemoryStorage();
    const payload = {
      schemaVersion: 1,
      appVersion: "v20260305",
      variant: "offline",
      savedAt: new Date().toISOString(),
      state: {
        current: boardState(),
        initial: boardState(),
        history: [JSON.stringify(boardState())],
        manualMoveCount: 42,
        moveCountHistory: [1, 2, 41],
        maxAutoChainCount: 17,
        toggles: { autoCheck: true }
      }
    };
    localStorage.setItem("klondike:save:offline:v1", JSON.stringify(payload));

    const state = {
      current: null,
      initial: null,
      history: [],
      manualMoveCount: 0,
      moveCountHistory: [],
      maxAutoChainCount: 0,
      isAutoFinishing: false,
      isAutoMoving: false,
      isAnimating: false,
      animatingCount: 0,
      lastAnimationPromise: Promise.resolve(),
      lastRevealPromise: Promise.resolve(),
      lastAnimationEndAt: 0,
      autoChainCount: 0
    };

    const { Persistence } = loadPersistenceModule({
      Config: { APP_VERSION: "v20260305" },
      State: state,
      UI: { render: () => {} },
      requestAutoCheck: () => {},
      clearStatus: () => {},
      updateButtons: () => {},
      setLastMove: () => {},
      document: createDocument(),
      localStorage,
      location: { pathname: "/game/klondike.html" }
    });

    expect(Persistence.restoreFromLocal()).toBe(true);
    expect(state.manualMoveCount).toBe(42);
    expect(state.moveCountHistory).toEqual([1, 2, 41]);
    expect(state.maxAutoChainCount).toBe(17);
  });
});

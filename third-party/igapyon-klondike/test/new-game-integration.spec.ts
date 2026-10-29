import { describe, expect, it } from "vitest";
import { loadMainModule } from "./helpers/load-core";

const ElementStub = function ElementStub() {};

function createElement() {
  return Object.assign(Object.create((ElementStub as any).prototype), {
    textContent: "",
    innerHTML: "",
    checked: true,
    disabled: false,
    dataset: {} as Record<string, string>,
    style: {} as Record<string, string>,
    children: [] as any[],
    onclick: null as any,
    onchange: null as any,
    oncontextmenu: null as any,
    onpointerdown: null as any,
    onpointerup: null as any,
    onpointerleave: null as any,
    onpointercancel: null as any,
    addEventListener() {},
    appendChild(node: any) {
      this.children.push(node);
      return node;
    },
    removeChild() {},
    remove() {},
    setAttribute() {},
    getAttribute() {
      return null;
    },
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    getBoundingClientRect() {
      return {
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        width: 0,
        height: 0
      };
    },
    closest() {
      return null;
    }
  });
}

function createDocumentStub() {
  const store = new Map<string, ReturnType<typeof createElement>>();
  const get = (id: string) => {
    if (!store.has(id)) store.set(id, createElement());
    return store.get(id)!;
  };

  [
    "app-version",
    "status-msg",
    "stuck-warning",
    "btn-undo",
    "btn-restart",
    "btn-hint",
    "new-game",
    "btn-test",
    "btn-deal-again",
    "chk-autocheck",
    "win-overlay",
    "stock",
    "waste",
    "moves-msg",
    "foundation-0",
    "foundation-1",
    "foundation-2",
    "foundation-3",
    "tableau-0",
    "tableau-1",
    "tableau-2",
    "tableau-3",
    "tableau-4",
    "tableau-5",
    "tableau-6"
  ].forEach(get);

  return {
    getElementById(id: string) {
      return get(id);
    },
    createElement() {
      return createElement();
    },
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    addEventListener() {}
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

describe("new game integration", () => {
  it("startNewGame initializes state and persists snapshot", async () => {
    const document = createDocumentStub();
    const localStorage = createMemoryStorage();
    const windowStub = { addEventListener() {} };

    const { Controller, State } = loadMainModule({
      document,
      localStorage,
      location: { pathname: "/game/klondike.html" },
      window: windowStub,
      customElements: { whenDefined: async () => {} },
      Element: ElementStub,
      performance,
      setTimeout,
      clearTimeout,
      Promise,
      confirm: () => true,
      console,
      Math,
      Date,
      JSON
    });

    await Controller.startNewGame();

    expect(State.current).not.toBeNull();
    expect(State.initial).not.toBeNull();
    expect(State.history).toHaveLength(0);
    expect(State.startSeed).toMatch(/^[0-9A-F]{8}$/);
    expect(State.startAttemptIndex).toBeGreaterThanOrEqual(0);
    expect(document.getElementById("win-startkey-value")?.textContent).toMatch(/^[0-9A-F]{8}-\d{4}$/);
    expect(localStorage.getItem("klondike:save:offline:v1")).not.toBeNull();
  });

  it("restores saved state on window load path", async () => {
    const document = createDocumentStub();
    const localStorage = createMemoryStorage();
    let loadHandler: (() => void) | null = null;
    const windowStub = {
      addEventListener(type: string, handler: () => void) {
        if (type === "load") loadHandler = handler;
      }
    };

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

    const { State } = loadMainModule({
      document,
      localStorage,
      location: { pathname: "/game/klondike.html" },
      window: windowStub,
      customElements: { whenDefined: async () => {} },
      Element: ElementStub,
      performance,
      setTimeout,
      clearTimeout,
      Promise,
      confirm: () => true,
      console,
      Math,
      Date,
      JSON
    });

    expect(loadHandler).not.toBeNull();
    loadHandler!();
    await Promise.resolve();
    await Promise.resolve();

    expect(State.current).not.toBeNull();
    expect(State.history).toHaveLength(1);
    expect(document.getElementById("chk-autocheck")?.checked).toBe(false);
  });

  it("hint behaves like manual flow and continues auto foundation", async () => {
    const document = createDocumentStub();
    const localStorage = createMemoryStorage();
    const windowStub = { addEventListener() {} };

    const { Controller, State } = loadMainModule({
      document,
      localStorage,
      location: { pathname: "/game/klondike.html" },
      window: windowStub,
      customElements: { whenDefined: async () => {} },
      Element: ElementStub,
      performance,
      setTimeout,
      clearTimeout,
      Promise,
      confirm: () => true,
      console,
      Math,
      Date,
      JSON
    });

    State.current = {
      stock: [card(0, 1, false)],
      waste: [],
      foundations: [[], [], [], []],
      tableau: [[], [], [], [], [], [], []]
    };
    State.initial = JSON.parse(JSON.stringify(State.current));
    State.history = [];

    Controller.hintMove();
    await new Promise((resolve) => setTimeout(resolve, 950));

    expect(State.current.foundations[0]).toHaveLength(1);
    expect(State.current.waste).toHaveLength(0);
  });
});

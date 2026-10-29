import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

function runCoreScript(filePath: string, contextSeed: Record<string, unknown>, exportExpr: string) {
  const source = fs.readFileSync(filePath, "utf8");
  const script = new vm.Script(`${source}\n;globalThis.__core_exports = (${exportExpr});`, {
    filename: path.basename(filePath)
  });
  const contextObject = { ...contextSeed } as Record<string, unknown>;
  const context = vm.createContext(contextObject);
  contextObject.globalThis = contextObject;
  script.runInContext(context);
  return contextObject.__core_exports;
}

export function loadRulesModule(contextSeed: Record<string, unknown>) {
  const filePath = path.resolve("src/core/rules.ts");
  return runCoreScript(filePath, contextSeed, "{ Rules, getCardKey, snapshotCard }") as {
    Rules: {
      isSafeToAutoMove: (card: any) => boolean;
      getCid: (card: any) => string;
      checkFoundationMove: (card: any, fIdx: number) => { ok: boolean };
      canPlaceOnTableau: (card: any, tIdx: number) => { ok: boolean; type?: string };
    };
    getCardKey: (card: any) => string;
    snapshotCard: (card: any) => any;
  };
}

export function loadSolverModule(contextSeed: Record<string, unknown>) {
  const filePath = path.resolve("src/core/solver.ts");
  return runCoreScript(filePath, contextSeed, "{ Simulator }") as {
    Simulator: new () => {
      findSolvableDeck: () => any;
      checkCurrentState: (state: any) => boolean;
      getNextMove: (state: any) => any;
      checkF: (state: any, card: any, fIdx: number) => boolean;
      findTabTarget: (state: any, card: any, ignoreIdx: number) => number;
      canSolve: (state: any, opts?: { limit?: number; noProgressLimit?: number }) => boolean;
    };
  };
}

export function loadPersistenceModule(contextSeed: Record<string, unknown>) {
  const filePath = path.resolve("src/main.ts");
  const source = fs.readFileSync(filePath, "utf8");
  const match = source.match(
    /\/\* --- \[Persistence\] --- \*\/([\s\S]*?)\/\* --- \[Core Modules\] --- \*\//
  );
  if (!match) {
    throw new Error("Persistence block not found in src/main.ts");
  }
  const snippet = match[1];
  const wrapped = `${snippet}\n;globalThis.__core_exports = { Persistence };`;

  const script = new vm.Script(wrapped, { filename: "persistence-snippet.ts" });
  const contextObject = {
    updateMoveCounter: () => {},
    updateWinStats: () => {},
    ...contextSeed
  } as Record<string, unknown>;
  const context = vm.createContext(contextObject);
  contextObject.globalThis = contextObject;
  script.runInContext(context);
  return contextObject.__core_exports as {
    Persistence: {
      saveCurrentProgress: () => void;
      restoreFromLocal: () => boolean;
    };
  };
}

export function loadMainModule(contextSeed: Record<string, unknown>) {
  const mainPath = path.resolve("src/main.ts");
  const solverPath = path.resolve("src/core/solver.ts");
  const rulesPath = path.resolve("src/core/rules.ts");
  const source = [
    fs.readFileSync(mainPath, "utf8"),
    fs.readFileSync(solverPath, "utf8"),
    fs.readFileSync(rulesPath, "utf8")
  ].join("\n\n");
  const script = new vm.Script(
    `${source}\n;globalThis.__core_exports = { Controller, State, Persistence };`,
    { filename: "main-with-core.ts" }
  );
  const contextObject = { ...contextSeed } as Record<string, unknown>;
  const context = vm.createContext(contextObject);
  contextObject.globalThis = contextObject;
  script.runInContext(context);
  return contextObject.__core_exports as {
    Controller: {
      startNewGame: () => Promise<void>;
      hintMove: () => void;
    };
    State: {
      current: any;
      initial: any;
      history: string[];
      startSeed?: string | null;
      startAttemptIndex?: number;
    };
    Persistence: {
      saveCurrentProgress: () => void;
      restoreFromLocal: () => boolean;
    };
  };
}

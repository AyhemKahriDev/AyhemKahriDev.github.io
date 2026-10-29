import { describe, expect, it } from "vitest";
import { loadSolverModule } from "./helpers/load-core";

describe("new game performance", () => {
  it("generates solvable new games within expected time budget", { timeout: 20000 }, () => {
    const config = {
      SOLVER_LIMIT_DEAL: 1000,
      SOLVER_STALL_DEAL: 13,
      SOLVER_LIMIT_CHECK: 1000,
      SOLVER_STALL_CHECK: 200
    };

    const trials = Number(process.env.KLONDIKE_NEW_GAME_TRIALS ?? 10);
    const maxTotalMs = Number(process.env.KLONDIKE_NEW_GAME_MAX_MS ?? 8000);

    const { Simulator } = loadSolverModule({ Config: config });
    const solver = new Simulator();

    const started = performance.now();
    for (let i = 0; i < trials; i++) {
      const state = solver.findSolvableDeck();
      expect(state.tableau).toHaveLength(7);
      expect(state.foundations).toHaveLength(4);
      expect(solver.checkCurrentState(state)).toBe(true);
    }
    const elapsed = performance.now() - started;

    expect(elapsed).toBeLessThanOrEqual(maxTotalMs);
  });
});

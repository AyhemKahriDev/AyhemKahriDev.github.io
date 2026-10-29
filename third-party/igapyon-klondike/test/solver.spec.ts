import { describe, expect, it } from "vitest";
import { loadSolverModule } from "./helpers/load-core";

function card(suit: number, rank: number, isOpen = true) {
  return { suit, rank, color: suit % 2 === 0 ? 0 : 1, isOpen };
}

describe("solver core", () => {
  it("uses the first open tableau index when generating t2t moves", () => {
    const config = {
      SOLVER_LIMIT_DEAL: 1000,
      SOLVER_STALL_DEAL: 13,
      SOLVER_LIMIT_CHECK: 1000,
      SOLVER_STALL_CHECK: 200
    };

    const { Simulator } = loadSolverModule({ Config: config });
    const solver = new Simulator();

    const state = {
      stock: [],
      waste: [],
      foundations: [[], [], [], []],
      tableau: [
        [card(0, 9, false), card(1, 6, true), card(0, 5, true)],
        [card(2, 7, true)],
        [card(3, 6, true)],
        [],
        [],
        [],
        []
      ]
    };

    const move = solver.getNextMove(state);

    expect(move).toEqual({ type: "t2t", fromIdx: 0, toIdx: 1, openIdx: 1 });
  });
});

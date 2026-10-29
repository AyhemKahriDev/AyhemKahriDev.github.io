export interface RoundProgress {
  size: number
  bumperCount: number
  remaining: number
  score: number
  isGameOver: boolean
}

export interface RoundProgressState {
  size: number
  bumperCount: number
  remaining: number
  score: number
  practiceMode: boolean
}

export function resolveRound(state: RoundProgressState, victory: boolean): RoundProgress {
  let { size, bumperCount, remaining, score } = state

  if (victory) {
    if (!state.practiceMode) {
      bumperCount += 1
    }
    score += size * bumperCount * 10
  }

  if (!state.practiceMode) {
    if (!victory) {
      bumperCount -= 3
    }

    if (bumperCount < 3 * size - 10) {
      if (size > 3) {
        size -= 1
        bumperCount += 2
      }
    } else if (bumperCount > 3 * size - 5) {
      size += 1
      bumperCount -= 2
    }

    if (bumperCount < 2) {
      bumperCount = 2
    }
  }

  return {
    size,
    bumperCount,
    remaining: remaining - 1,
    score,
    isGameOver: remaining <= 1,
  }
}

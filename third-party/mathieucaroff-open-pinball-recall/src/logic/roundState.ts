export interface RoundState {
  journey: number
  guess?: Position
  victory?: boolean
}

export function createRoundState(): RoundState {
  return { journey: 0 }
}

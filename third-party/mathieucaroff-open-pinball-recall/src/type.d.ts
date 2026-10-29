type Kind<TName extends string, TProperties extends {} = {}> = TProperties & { kind: TName }

type Direction = 'up' | 'down' | 'left' | 'right'

type BumperDirection =
  | 'diagonalUp' // '/'
  | 'diagonalDown' // '\'

interface Size {
  width: number
  height: number
}

interface Position {
  x: number
  y: number
}

interface Bumper extends Position {
  direction: BumperDirection
}

type GridDirection = BumperDirection | 'empty'

type Grid = GridDirection[][]

type Start = Position & { direction: Direction }

interface Counter {
  count: number
}

interface Mark extends Position {
  in: Direction
  out: Direction
  revealed: boolean
}

type Trail = Mark[]

type Phase =
  | 'introduction'
  | 'initial'
  | 'bumperView'
  | 'guess'
  | 'result'
  | 'resultEnd'
  | 'end'
  | 'review'
  | 'score'
  | 'playAgain'

interface Game {
  grid: Grid
  bumperArray: Bumper[]
  start: Start
  trail: Trail
  phase: Phase
}

import { resolveConfig } from './resolver'

function randomSeed() {
  return Math.random().toString(36).slice(2).toUpperCase()
}

export interface PinballConfig {
  /** difficulty specifies the size and the number of bumpers, separated by a colon `:` */
  difficulty: string
  /** size is the number of squares on the sides of the inner grid */
  size: number
  bumperCount: number
  /**
   * baseBumperViewTimeMs is the base time that the game waits while
   * displaying the bumpers to the player. The actual time will be longer than
   * the base proportionally to the number of bumpers.
   *
   * It is expressed in milliseconds
   */
  baseBumperViewTimeMs: number
  /**
   * perBumperViewTimeMs is multiplied by the number of bumpers and
   * added to the base timeout.
   *
   * It is expressed in milliseconds
   */
  perBumperViewTimeMs: number
  /** roundCount is the number of rounds in a game */
  roundCount: number
  /** remaining is the number of rounds before the score is displayed */
  remaining: number
  /** score is the number of accumulated points while playing */
  score: number
  /** practiceMode keeps the selected difficulty fixed between rounds */
  practiceMode: boolean
  /** successCount is the number of correct practice attempts */
  successCount: number
  /** failureCount is the number of incorrect practice attempts */
  failureCount: number
  /** Speed of the ball when resolving the maze. 100 by default. 200 is twice as fast, 50 is half as fast, etc. */
  ballSpeed: number
  /** seed -- the seed of the game */
  seed: string
  /** pauseAfterSuccess specifies whether the game waits for a click before the next play after a correct guess */
  pauseAfterSuccess: boolean
  /** pauseAfterFailure specifies whether the game waits for a click before the next play after a wrong guess */
  pauseAfterFailure: boolean
  // Colors
  backgroundColor: number
  ballColor: number
  boardColor: number
  bumperColor: number
  indicatorColor: number
  indicatorLitColor: number
  indicatorStrokeColor: number
  slateColor: number
  trailDotColor: number
  successDiskColor: number
  errorDiskColor: number
}

export function getConfig(location: Location) {
  let config = resolveConfig<PinballConfig>(location, {
    difficulty: () => '4:5',
    size: ({ difficulty }) => +difficulty().split(':')[0],
    bumperCount: ({ difficulty }) => +difficulty().split(':')[1],
    baseBumperViewTimeMs: () => 2000,
    perBumperViewTimeMs: () => 200,
    ballSpeed: () => 100,
    roundCount: () => 7,
    remaining: ({ roundCount }) => roundCount(),
    score: () => 0,
    practiceMode: () => false,
    successCount: () => 0,
    failureCount: () => 0,
    // Seed
    seed: () => randomSeed(),
    pauseAfterSuccess: () => false,
    pauseAfterFailure: () => true,
    // Colors
    backgroundColor: () => 0x503010,
    ballColor: () => 0x18b0e8,
    boardColor: () => 0x705028,
    bumperColor: () => 0xffffff,
    indicatorColor: () => 0x805028,
    indicatorStrokeColor: () => 0x3a200a,
    indicatorLitColor: () => 0xfcf0bc,
    slateColor: () => 0x38200a,
    trailDotColor: () => 0x604008,
    successDiskColor: () => 0x60d038,
    errorDiskColor: () => 0xff0000,
  })

  return config
}

import * as Switch from '@radix-ui/react-switch'
import { useEffect, useMemo, useState } from 'react'
import seedrandom from 'seedrandom'
import { errorSound, successSound } from '../audio/sound'
import { getConfig, PinballConfig } from '../config/config'
import { startNewSession, updateConfigHash } from '../config/locationHash'
import { createGame } from '../logic/game'
import { resolveRound } from '../logic/round'
import { BoardCanvas } from './BoardCanvas'
import { SettingsDialog, SettingsValues } from './SettingsDialog'

let repositoryUrl = 'https://github.com/mathieucaroff/open-pinball-recall'

function newSeed() {
  return Math.random().toString(36).slice(2).toUpperCase()
}

function toSettings(config: PinballConfig): SettingsValues {
  return {
    size: config.size,
    bumperCount: config.bumperCount,
    baseBumperViewTimeMs: config.baseBumperViewTimeMs,
    perBumperViewTimeMs: config.perBumperViewTimeMs,
    ballSpeed: config.ballSpeed,
    roundCount: config.roundCount,
    practiceMode: config.practiceMode,
    seed: config.seed,
    pauseAfterSuccess: config.pauseAfterSuccess,
    pauseAfterFailure: config.pauseAfterFailure,
  }
}

export function App() {
  let [config, setConfig] = useState(() => getConfig(window.location))
  let [phase, setPhase] = useState<Phase>('introduction')
  let [guess, setGuess] = useState<Position>()
  let [victory, setVictory] = useState<boolean>()
  let game = useMemo(() => createGame(config, seedrandom(config.seed), false), [config])

  useEffect(() => {
    let listener = () => setConfig(getConfig(window.location))
    window.addEventListener('hashchange', listener)
    return () => window.removeEventListener('hashchange', listener)
  }, [])

  useEffect(() => {
    if (phase !== 'bumperView') return
    let timeout = window.setTimeout(
      () => setPhase('guess'),
      config.baseBumperViewTimeMs + config.perBumperViewTimeMs * config.bumperCount,
    )
    return () => window.clearTimeout(timeout)
  }, [phase, config])

  let start = () => {
    setGuess(undefined)
    setVictory(undefined)
    setPhase('bumperView')
  }

  let startNewGame = () => {
    if (!config.practiceMode) {
      updateConfigHash(window.location, {
        remaining: config.roundCount,
        score: 0,
        seed: newSeed(),
      })
      setConfig(getConfig(window.location))
    }
    start()
  }

  let applySettings = (settings: SettingsValues) => {
    startNewSession(window.location, {
      ...settings,
      bumperCount: Math.min(settings.bumperCount, settings.size ** 2),
      seed: settings.seed || newSeed(),
    })
    setPhase('introduction')
  }

  let advance = () => {
    if (victory === undefined) return
    if (config.practiceMode) {
      updateConfigHash(window.location, {
        successCount: config.successCount + (victory ? 1 : 0),
        failureCount: config.failureCount + (victory ? 0 : 1),
        seed: newSeed(),
      })
      start()
      return
    }
    let progress = resolveRound(config, victory)
    if (progress.isGameOver) {
      updateConfigHash(window.location, {
        remaining: progress.remaining,
        score: progress.score,
      })
      setConfig(getConfig(window.location))
      setPhase('score')
      return
    }
    updateConfigHash(window.location, {
      size: progress.size,
      bumperCount: progress.bumperCount,
      remaining: progress.remaining,
      score: progress.score,
      seed: newSeed(),
    })
    start()
  }

  let finish = (nextVictory: boolean) => {
    if (phase !== 'result') return
    setVictory(nextVictory)
    nextVictory ? successSound.play() : errorSound.play()
    setPhase(
      nextVictory && !config.pauseAfterSuccess ? 'resultEnd' : nextVictory ? 'end' : 'review',
    )
  }

  useEffect(() => {
    if (phase !== 'resultEnd') return
    let timeout = window.setTimeout(advance, 1000)
    return () => window.clearTimeout(timeout)
  }, [phase, victory, config])

  let attempts = config.successCount + config.failureCount
  let round = config.roundCount - config.remaining + 1

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#1c1410] text-[#f7ead2]">
      <div className="absolute inset-0">
        <BoardCanvas
          config={config}
          game={game}
          phase={phase === 'resultEnd' ? 'end' : phase}
          guess={guess}
          onGuess={(position) => {
            if (phase === 'guess') {
              setGuess(position)
              setPhase('result')
            }
          }}
          onResolved={finish}
        />
      </div>
      {!['introduction', 'score', 'playAgain'].includes(phase) && (
        <header className="pointer-events-none fixed left-4 right-16 top-4 z-10 flex justify-between text-center text-xs font-semibold sm:text-sm">
          {config.practiceMode ? (
            <>
              <div className="rounded bg-[#321d1d]/90 px-3 py-2 text-[#ffb0a0] shadow">
                <div>Misses</div>
                <div>
                  {config.failureCount} / {attempts}
                </div>
              </div>
              <div className="rounded bg-[#19301b]/90 px-3 py-2 text-[#b8efb0] shadow">
                <div>Hits</div>
                <div>
                  {config.successCount} / {attempts}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="rounded bg-[#38200a]/90 px-3 py-2 text-[#c7b59d] shadow">
                Round {round} / {config.roundCount}
              </div>
              <div className="rounded bg-[#38200a]/90 px-3 py-2 text-[#c7b59d] shadow">
                Score {config.score}
              </div>
            </>
          )}
        </header>
      )}

      {['introduction', 'playAgain'].includes(phase) && (
        <section className="fixed inset-0 z-10 grid place-items-center bg-black/30 p-5 text-center">
          <div className="max-w-sm">
            <h1 className="text-4xl font-semibold">Open Pinball Recall</h1>
            <p className="mt-3 text-[#c7b59d]">
              Memorize the bumpers, then predict where the ball exits.
            </p>
            <button
              className="mt-7 rounded bg-[#b98b4c] px-5 py-3 font-semibold text-[#20140a] hover:bg-[#d3a663]"
              onClick={startNewGame}
            >
              {phase === 'playAgain' ? 'Play again' : 'Start game'}
            </button>
            <label className="mt-5 flex items-center justify-center gap-3 text-sm text-[#c7b59d]">
              <Switch.Root
                className="relative h-6 w-11 rounded-full bg-black/50 outline-none data-[state=checked]:bg-[#4e8b42]"
                checked={config.practiceMode}
                onCheckedChange={(checked) =>
                  applySettings({ ...toSettings(config), practiceMode: checked })
                }
              >
                <Switch.Thumb className="block h-5 w-5 translate-x-0.5 rounded-full bg-[#f7ead2] transition-transform data-[state=checked]:translate-x-5" />
              </Switch.Root>
              Practice mode
            </label>
            <SettingsDialog config={toSettings(config)} onApply={applySettings} showSetupTrigger />
            <nav className="mt-4 flex justify-center gap-5 text-sm font-semibold">
              <a
                className="border-b-2 border-brass/50 pb-1 text-brass hover:border-[#f7ead2] hover:text-[#f7ead2]"
                href={repositoryUrl}
                rel="noreferrer"
                target="_blank"
              >
                Fork me on GitHub
              </a>
              <a
                className="border-b-2 border-brass/50 pb-1 text-brass hover:border-[#f7ead2] hover:text-[#f7ead2]"
                href={`${repositoryUrl}/issues`}
                rel="noreferrer"
                target="_blank"
              >
                Report an issue
              </a>
            </nav>
          </div>
        </section>
      )}

      {!['introduction', 'playAgain'].includes(phase) && (
        <SettingsDialog
          config={toSettings(config)}
          onApply={applySettings}
          showSetupTrigger={false}
        />
      )}

      {phase === 'review' && (
        <section className="fixed inset-x-4 bottom-5 z-10 flex items-center justify-center gap-4 rounded-md bg-[#303030]/80 p-3">
          <strong className="text-[#ffb0a0]">Incorrect</strong>
          <button
            className="rounded bg-[#b98b4c] px-4 py-2 text-sm font-semibold text-[#20140a] hover:bg-[#d3a663]"
            onClick={advance}
          >
            Next round
          </button>
        </section>
      )}
      {phase === 'end' && victory && (
        <section className="fixed inset-x-4 bottom-5 z-10 text-center">
          <button
            className="rounded bg-[#b98b4c] px-4 py-2 text-sm font-semibold text-[#20140a] hover:bg-[#d3a663]"
            onClick={advance}
          >
            Next round
          </button>
        </section>
      )}
      {phase === 'score' && (
        <section className="fixed inset-0 z-10 grid place-items-center bg-black/50 p-5 text-center">
          <div>
            <p className="text-[#c7b59d]">Final score</p>
            <p className="mt-1 text-5xl font-semibold">{config.score}</p>
            <button
              className="mt-7 rounded bg-[#b98b4c] px-5 py-3 font-semibold text-[#20140a] hover:bg-[#d3a663]"
              onClick={() => setPhase('playAgain')}
            >
              Continue
            </button>
          </div>
        </section>
      )}
    </main>
  )
}

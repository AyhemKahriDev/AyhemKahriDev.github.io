// Signal Meadow style: full-bleed game canvas, ink surround, asymmetric HUD rail, and chunky thumb-safe controls.
import { useEffect, useRef, useState } from "react";
import { Engine } from "@babylonjs/core/Engines/engine";
import { createGameScene, type GameHandle } from "@/game/scene";
import { ByteboundAudio } from "@/game/audio";
import type { HudSnapshot, InputAction } from "@/game/types";

const INITIAL_HUD: HudSnapshot = { stage: 1, stageName: "Meadow Relay", score: 0, shards: 0, totalShards: 9, lives: 3, status: "menu", message: "RUN THE RELAY" };
const SETTINGS_KEY = "bytebound-settings-v1";
type GameSettings = { leftHanded: boolean; soundEnabled: boolean; hapticsEnabled: boolean };
const DEFAULT_SETTINGS: GameSettings = { leftHanded: false, soundEnabled: true, hapticsEnabled: true };
const readSettings = (): GameSettings => { if (typeof window === "undefined") return DEFAULT_SETTINGS; try { const saved = JSON.parse(window.localStorage.getItem(SETTINGS_KEY) ?? "null") as Partial<GameSettings> | null; return { ...DEFAULT_SETTINGS, ...(saved ?? {}) }; } catch { return DEFAULT_SETTINGS; } };

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null); const handleRef = useRef<GameHandle | null>(null); const audioRef = useRef<ByteboundAudio | null>(null); const initialized = useRef(false); const settingsOpenRef = useRef(false); const settingsPauseRef = useRef(false); const settingsRef = useRef<GameSettings>(readSettings()); const [hud, setHud] = useState(INITIAL_HUD); const [settings, setSettings] = useState<GameSettings>(settingsRef.current); const [settingsOpen, setSettingsOpen] = useState(false); const [isPortrait, setIsPortrait] = useState(() => typeof window !== "undefined" && window.innerWidth < 900 && window.innerHeight > window.innerWidth); const [isFullscreen, setIsFullscreen] = useState(() => typeof document !== "undefined" && Boolean(document.fullscreenElement));
  useEffect(() => { const updateOrientation = () => setIsPortrait(window.innerWidth < 900 && window.innerHeight > window.innerWidth); updateOrientation(); window.addEventListener("resize", updateOrientation); window.addEventListener("orientationchange", updateOrientation); return () => { window.removeEventListener("resize", updateOrientation); window.removeEventListener("orientationchange", updateOrientation); }; }, []);
  useEffect(() => { const updateFullscreen = () => setIsFullscreen(Boolean(document.fullscreenElement)); document.addEventListener("fullscreenchange", updateFullscreen); return () => document.removeEventListener("fullscreenchange", updateFullscreen); }, []);
  useEffect(() => { settingsRef.current = settings; try { window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* Private browsing can disable local storage; session settings still work. */ } }, [settings]);
  useEffect(() => { settingsOpenRef.current = settingsOpen; }, [settingsOpen]);
  useEffect(() => {
    if (initialized.current || !canvasRef.current) return;
    initialized.current = true;
    const canvas = canvasRef.current; const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true, adaptToDeviceRatio: true });
    const audio = new ByteboundAudio(); audio.setMuted(!settingsRef.current.soundEnabled); audioRef.current = audio;
    const handle = createGameScene(engine, canvas, { onHud: setHud, onAudioCue: (cue) => { if (settingsRef.current.soundEnabled) audio.playCue(cue); if (settingsRef.current.hapticsEnabled && typeof navigator !== "undefined" && "vibrate" in navigator) { const pattern = cue === "collect" ? 16 : cue === "jump" ? 10 : cue === "hurt" ? [28, 18, 28] : cue === "checkpoint" ? [12, 24, 12] : cue === "finish" ? [18, 30, 26] : 8; navigator.vibrate(pattern); } } }); handleRef.current = handle;
    let demoTimer: number | undefined;
    if (new URLSearchParams(window.location.search).has("demo")) {
      handle.start();
      handle.setInput({ right: true });
      demoTimer = window.setInterval(() => {
        handle.setInput({ jump: true });
        window.setTimeout(() => handle.setInput({ jump: false }), 120);
      }, 1250);
    }
    const resize = () => engine.resize(); window.addEventListener("resize", resize);
    const keyMap: Record<string, InputAction> = { ArrowLeft: "left", a: "left", ArrowRight: "right", d: "right", ArrowUp: "jump", w: "jump", " ": "jump" };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape" && settingsOpenRef.current) { event.preventDefault(); settingsOpenRef.current = false; setSettingsOpen(false); if (settingsPauseRef.current && hud.status === "paused") handle.press("pause"); settingsPauseRef.current = false; return; } if (event.key === "p" || event.key === "Escape") { event.preventDefault(); handle.press("pause"); return; } if (event.key === "r") { event.preventDefault(); handle.press("restart"); return; } const action = keyMap[event.key]; if (action) { event.preventDefault(); audio.unlock(); handle.setInput({ [action]: true }); } };
    const onKeyUp = (event: KeyboardEvent) => { const action = keyMap[event.key]; if (action) { event.preventDefault(); handle.setInput({ [action]: false }); } };
    window.addEventListener("keydown", onKeyDown, { passive: false }); window.addEventListener("keyup", onKeyUp, { passive: false });
    return () => { if (demoTimer) window.clearInterval(demoTimer); window.removeEventListener("resize", resize); window.removeEventListener("keydown", onKeyDown); window.removeEventListener("keyup", onKeyUp); handle.dispose(); engine.dispose(); audio.dispose(); audioRef.current = null; handleRef.current = null; initialized.current = false; };
  }, []);
  const unlockAudio = () => audioRef.current?.unlock();
  const enterFullscreen = async () => { try { if (!document.fullscreenElement && document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen(); } catch { /* Fullscreen is optional on iOS and embedded browsers. */ } };
  const toggleFullscreen = async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen(); } catch { /* CSS viewport fallback remains active. */ } };
  const startRun = () => { unlockAudio(); void enterFullscreen(); handleRef.current?.start(); };
  const retryRun = () => { unlockAudio(); handleRef.current?.setInput({ jump: true }); window.setTimeout(() => handleRef.current?.setInput({ jump: false }), 120); };
  const setAction = (action: "left" | "right" | "jump", value: boolean) => handleRef.current?.setInput({ [action]: value });
  const bindButton = (action: "left" | "right" | "jump") => ({ onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => { event.preventDefault(); unlockAudio(); event.currentTarget.setPointerCapture(event.pointerId); setAction(action, true); }, onPointerUp: (event: React.PointerEvent<HTMLButtonElement>) => { event.preventDefault(); if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); setAction(action, false); }, onPointerCancel: () => setAction(action, false), onLostPointerCapture: () => setAction(action, false), onContextMenu: (event: React.MouseEvent<HTMLButtonElement>) => event.preventDefault() });
  const openSettings = () => { settingsPauseRef.current = hud.status === "playing"; if (settingsPauseRef.current) handleRef.current?.press("pause"); setSettingsOpen(true); };
  const closeSettings = () => { setSettingsOpen(false); if (settingsPauseRef.current && hud.status === "paused") handleRef.current?.press("pause"); settingsPauseRef.current = false; };
  const updateSetting = <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => setSettings((current) => ({ ...current, [key]: value }));
  const toggleAudio = () => setSettings((current) => { const next = { ...current, soundEnabled: !current.soundEnabled }; audioRef.current?.setMuted(!next.soundEnabled); return next; });
  return (
    <main className="game-shell">
      <div className="game-stage">
        <canvas ref={canvasRef} className="game-canvas" aria-label="Bytebound Meadow Run game canvas" />
        <div className="game-topbar"><div className="brand-lockup"><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span><span>BYTEBOUND</span></div><div className="hud-strip" aria-live="polite"><span>STAGE {String(hud.stage).padStart(2, "0")}</span><span>{hud.stageName}</span><span>SCORE {String(hud.score).padStart(5, "0")}</span><span>SHARDS {hud.shards}/{hud.totalShards}</span><span>LIVES {hud.lives}</span></div><div className="top-actions"><button className="icon-button" onClick={() => handleRef.current?.press("pause")} aria-label="Pause or resume">{hud.status === "paused" ? "▶" : "Ⅱ"}</button><button className="icon-button" onClick={() => handleRef.current?.press("restart")} aria-label="Restart stage">↻</button><button className="icon-button" onClick={toggleAudio} aria-label={settings.soundEnabled ? "Mute sound" : "Turn sound on"} aria-pressed={!settings.soundEnabled}>{settings.soundEnabled ? "♫" : "×"}</button><button className="icon-button" onClick={toggleFullscreen} aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"} aria-pressed={isFullscreen}>{isFullscreen ? "×" : "⛶"}</button><button className="icon-button" onClick={openSettings} aria-label="Open settings">⚙</button></div></div>
        <div className={`game-banner ${hud.status === "playing" ? "is-playing" : ""}`}><span>{hud.message}</span>{hud.status === "menu" && <button onClick={startRun}>PLAY ROUTE <b>→</b></button>}{hud.status === "dead" && <button onClick={retryRun}>TRY AGAIN <b>→</b></button>}{hud.status === "complete" && <button onClick={startRun}>RUN AGAIN <b>↻</b></button>}</div>
        <div className={`touch-controls ${settings.leftHanded ? "is-left-handed" : ""}`} aria-label="Touch controls">{settings.leftHanded ? <><button {...bindButton("jump")} className="jump-button" aria-label="Jump">JUMP</button><div className="touch-cluster"><button {...bindButton("left")} aria-label="Move left">←</button><button {...bindButton("right")} aria-label="Move right">→</button></div></> : <><div className="touch-cluster"><button {...bindButton("left")} aria-label="Move left">←</button><button {...bindButton("right")} aria-label="Move right">→</button></div><button {...bindButton("jump")} className="jump-button" aria-label="Jump">JUMP</button></>}</div>
      </div>
      <aside className="side-note"><div className="side-index">FIELD NOTE / 01—03</div><div><strong>MEADOW<br />RELAY</strong><p>Keep the route bright.<br />Reach the next pennant.</p></div><div className="side-foot">MOVE / LEAP / RELAY<br /><span>ARROWS / WASD + SPACE</span></div></aside>
      {isPortrait && <div className="orientation-gate" role="dialog" aria-modal="true" aria-label="Rotate device to play"><div className="orientation-card"><span className="rotate-glyph" aria-hidden="true">↻</span><strong>TURN SIDEWAYS</strong><p>Bytebound runs in landscape so every jump has room to land.</p><span className="orientation-hint">ROTATE YOUR PHONE TO PLAY</span></div></div>}
      {settingsOpen && <div className="settings-overlay" role="dialog" aria-modal="true" aria-labelledby="settings-title" onPointerDown={(event) => { if (event.target === event.currentTarget) closeSettings(); }}><section className="settings-card"><div className="settings-heading"><div><span className="settings-kicker">FIELD CONFIG</span><h2 id="settings-title">SETTINGS</h2></div><button className="settings-close" onClick={closeSettings} aria-label="Close settings">×</button></div><p className="settings-intro">Tune the relay for your hands and your device.</p><div className="settings-list"><button className="setting-row" onClick={() => updateSetting("leftHanded", !settings.leftHanded)} aria-pressed={settings.leftHanded}><span><strong>LEFT-HANDED CONTROLS</strong><small>Move buttons on the right, jump on the left.</small></span><span className={`setting-toggle ${settings.leftHanded ? "is-on" : ""}`}>{settings.leftHanded ? "ON" : "OFF"}</span></button><button className="setting-row" onClick={() => { const next = !settings.soundEnabled; updateSetting("soundEnabled", next); audioRef.current?.setMuted(!next); }} aria-pressed={settings.soundEnabled}><span><strong>SOUND &amp; MUSIC</strong><small>Keep the Meadow Run loop and retro cues audible.</small></span><span className={`setting-toggle ${settings.soundEnabled ? "is-on" : ""}`}>{settings.soundEnabled ? "ON" : "OFF"}</span></button><button className="setting-row" onClick={() => updateSetting("hapticsEnabled", !settings.hapticsEnabled)} aria-pressed={settings.hapticsEnabled}><span><strong>HAPTIC FEEDBACK</strong><small>Pulse on jumps, shards, damage, and checkpoints.</small></span><span className={`setting-toggle ${settings.hapticsEnabled ? "is-on" : ""}`}>{settings.hapticsEnabled ? "ON" : "OFF"}</span></button></div><span className="settings-save-note">Preferences save automatically on this device.</span></section></div>}
    </main>
  );
}

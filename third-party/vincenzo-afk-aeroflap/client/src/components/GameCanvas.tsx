/**
 * Sunlit Paper Skies component contract: canvas-first game with a sparse, ink-navy flight-deck overlay.
 * React frames the game and Babylon owns the continuous world simulation.
 */
import { useEffect, useRef, useState } from "react";
import { Engine } from "@babylonjs/core/Engines/engine";
import { ArrowUp, Crosshair, Keyboard, Play, RotateCcw } from "lucide-react";
import { createGameScene, type GameHandle } from "@/game/scene";
import { assets } from "@/game/assets";
import type { FlightState } from "@/game/GameWorld";
import CustomizationStudio from "./CustomizationStudio";
import {
  CUSTOMIZATION_DEFAULTS,
  type CustomizationSnapshot,
} from "../../../shared/customization";

const initialState: FlightState = { score: 0, best: 0, phase: "idle" };
const initialCustomization: CustomizationSnapshot = {
  settings: CUSTOMIZATION_DEFAULTS,
  assets: {},
};

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startedRef = useRef(false);
  const [flight, setFlight] = useState<FlightState>(initialState);
  const [customization, setCustomization] = useState<CustomizationSnapshot>(initialCustomization);
  const ambientAudioRef = useRef<HTMLAudioElement>(null);
  const flapAudioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const onState = (event: Event) => {
      setFlight((event as CustomEvent<FlightState>).detail);
    };
    window.addEventListener("aeroflap:state", onState);
    return () => window.removeEventListener("aeroflap:state", onState);
  }, []);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent<CustomizationSnapshot>("aeroflap:customization", {
        detail: customization,
      }),
    );
  }, [customization]);

  useEffect(() => {
    const ambient = ambientAudioRef.current;
    const flap = flapAudioRef.current;
    if (ambient) {
      ambient.volume = customization.settings.volume;
      ambient.muted = customization.settings.muted;
    }
    if (flap) {
      flap.volume = customization.settings.volume;
      flap.muted = customization.settings.muted;
    }
  }, [customization.settings.muted, customization.settings.volume]);

  useEffect(() => {
    const onFlap = () => {
      if (customization.settings.muted) return;
      const ambient = ambientAudioRef.current;
      if (ambient && customization.assets.ambientAudio?.url) {
        void ambient.play().catch(() => undefined);
      }
      const flap = flapAudioRef.current;
      if (flap && customization.assets.flapAudio?.url) {
        flap.currentTime = 0;
        void flap.play().catch(() => undefined);
      }
    };
    window.addEventListener("aeroflap:flap", onFlap);
    return () => window.removeEventListener("aeroflap:flap", onFlap);
  }, [customization]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || startedRef.current) return;
    startedRef.current = true;
    const engine = new Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
      adaptToDeviceRatio: true,
      alpha: true,
    });

    let handle: GameHandle | null = null;
    let active = true;
    createGameScene(engine, canvas).then((gameHandle) => {
      if (!active) {
        gameHandle.dispose();
        return;
      }
      handle = gameHandle;
      engine.runRenderLoop(() => gameHandle.scene.render());
      engine.resize();
      gameHandle.resize();
    });

    const onResize = () => {
      engine.resize();
      handle?.resize();
    };
    window.addEventListener("resize", onResize);

    return () => {
      active = false;
      window.removeEventListener("resize", onResize);
      handle?.dispose();
      engine.dispose();
      startedRef.current = false;
    };
  }, []);

  const requestFlap = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    window.dispatchEvent(new Event("aeroflap:flap"));
  };

  const statusCopy =
    flight.phase === "idle"
      ? { eyebrow: "Flight path 01", title: "Clear the clouds.\nKeep the line.", action: "Launch flight" }
      : { eyebrow: "Flight log complete", title: "Air current lost.\nTry the line again.", action: "Fly again" };

  const hasImageBackground =
    customization.settings.backgroundMode === "image" &&
    Boolean(customization.assets.backgroundImage?.url);
  const hasVideoBackground =
    customization.settings.backgroundMode === "video" &&
    Boolean(customization.assets.backgroundVideo?.url);

  return (
    <main className="aeroflap-shell" aria-label="AeroFlap endless flying game">
      {hasImageBackground && (
        <div
          className="custom-media-background custom-image-background"
          style={{ backgroundImage: `url(${customization.assets.backgroundImage?.url})` }}
          aria-hidden="true"
        />
      )}
      {hasVideoBackground && (
        <video
          className="custom-media-background custom-video-background"
          src={customization.assets.backgroundVideo?.url}
          autoPlay
          loop
          muted
          playsInline
          aria-hidden="true"
        />
      )}
      <canvas
        ref={canvasRef}
        className="aeroflap-canvas"
        style={{ touchAction: "none" }}
        aria-label="AeroFlap game canvas. Tap, click, Space, or Arrow Up to lift the plane."
        tabIndex={0}
      />

      <section className="flight-overlay" aria-live="polite">
        <header className="flight-brand">
          <span className="brand-mark" aria-hidden="true"><img src={assets.wingMark} alt="" /></span>
          <div>
            <p className="brand-kicker">Endless aviation test</p>
            <h1>AeroFlap</h1>
          </div>
        </header>

        <aside className="instrument-rail" aria-label="Flight instruments">
          <div className="rail-chip">
            <Crosshair size={15} strokeWidth={2.3} aria-hidden="true" />
            <span>Route</span>
            <strong>01</strong>
          </div>
          <div className="rail-divider" />
          <div className="rail-score">
            <span>Best</span>
            <strong>{String(flight.best).padStart(2, "0")}</strong>
          </div>
        </aside>

        <div className="score-dial" aria-label={`Current score ${flight.score}`}>
          <span>Altitude cleared</span>
          <strong>{String(flight.score).padStart(2, "0")}</strong>
          <i />
        </div>

        {flight.phase !== "playing" && (
          <div className={`flight-prompt ${flight.phase === "gameover" ? "is-gameover" : ""}`}>
            <p className="prompt-eyebrow">{statusCopy.eyebrow}</p>
            <h2>{statusCopy.title.split("\n").map((line) => <span key={line}>{line}</span>)}</h2>
            {flight.phase === "gameover" && (
              <p className="run-summary">You cleared <strong>{flight.score}</strong> {flight.score === 1 ? "gate" : "gates"} this run.</p>
            )}
            <button data-aeroflap-control type="button" onClick={requestFlap} className="flight-action">
              {flight.phase === "idle" ? <Play size={16} fill="currentColor" aria-hidden="true" /> : <RotateCcw size={17} aria-hidden="true" />}
              <span>{statusCopy.action}</span>
            </button>
            <p className="control-hint">
              <Keyboard size={15} aria-hidden="true" /> <span>or tap anywhere to lift</span> <ArrowUp size={15} aria-hidden="true" />
            </p>
          </div>
        )}

        <footer className="flight-footer">
          <span>Tap · Click · Space</span>
          <span>—</span>
          <span>stay inside the skyway</span>
        </footer>
      </section>
      <audio ref={ambientAudioRef} src={customization.assets.ambientAudio?.url} loop preload="metadata" />
      <audio ref={flapAudioRef} src={customization.assets.flapAudio?.url} preload="auto" />
      <CustomizationStudio onChange={setCustomization} />
    </main>
  );
}

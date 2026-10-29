/**
 * Customization Studio: player-controlled media, styling, and tuning in a compact flight-deck panel.
 * Signed-in players persist assets and settings; guests can still audition a session-local draft.
 */
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import {
  CUSTOMIZATION_ASSET_SLOTS,
  CUSTOMIZATION_DEFAULTS,
  type CustomizationAssetRecord,
  type CustomizationAssetSlot,
  type CustomizationSettings,
  type CustomizationSnapshot,
} from "../../../shared/customization";
import { Check, ChevronDown, CloudUpload, Palette, RotateCcw, SlidersHorizontal, Volume2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type StudioProps = {
  onChange: (snapshot: CustomizationSnapshot) => void;
};

type AssetMap = CustomizationSnapshot["assets"];

const assetLabels: Record<CustomizationAssetSlot, { title: string; help: string; accept: string }> = {
  backgroundImage: { title: "Sky image", help: "PNG, JPG, WebP · up to 5 MB", accept: "image/png,image/jpeg,image/webp" },
  backgroundVideo: { title: "Sky loop", help: "MP4 or WebM · up to 12 MB", accept: "video/mp4,video/webm" },
  planeImage: { title: "Aircraft art", help: "PNG, JPG, WebP · up to 5 MB", accept: "image/png,image/jpeg,image/webp" },
  ambientAudio: { title: "Ambient track", help: "MP3, WAV, OGG · up to 8 MB", accept: "audio/mpeg,audio/wav,audio/ogg" },
  flapAudio: { title: "Lift sound", help: "MP3, WAV, OGG · up to 8 MB", accept: "audio/mpeg,audio/wav,audio/ogg" },
};

const clientLimits: Record<CustomizationAssetSlot, number> = {
  backgroundImage: 5 * 1024 * 1024,
  planeImage: 5 * 1024 * 1024,
  backgroundVideo: 12 * 1024 * 1024,
  ambientAudio: 8 * 1024 * 1024,
  flapAudio: 8 * 1024 * 1024,
};

function readDraft(): CustomizationSettings {
  try {
    const raw = window.localStorage.getItem("aeroflap-customization-draft");
    return raw ? { ...CUSTOMIZATION_DEFAULTS, ...JSON.parse(raw) } : CUSTOMIZATION_DEFAULTS;
  } catch {
    return CUSTOMIZATION_DEFAULTS;
  }
}

function assetsToMap(records: CustomizationAssetRecord[]) {
  return records.reduce<AssetMap>((map, record) => ({ ...map, [record.slot]: record }), {});
}

export default function CustomizationStudio({ onChange }: StudioProps) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const guestPreview = new URLSearchParams(window.location.search).has("guestPreview");
  const canPersist = isAuthenticated && !guestPreview;
  const [open, setOpen] = useState(
    () => new URLSearchParams(window.location.search).has("studio"),
  );
  const [settings, setSettings] = useState<CustomizationSettings>(readDraft);
  const [assetMap, setAssetMap] = useState<AssetMap>({});
  const [notice, setNotice] = useState("Session draft active");
  const [uploading, setUploading] = useState<CustomizationAssetSlot | null>(null);
  const profileQuery = trpc.customization.get.useQuery(undefined, {
    enabled: canPersist,
    retry: false,
  });
  const saveMutation = trpc.customization.save.useMutation();
  const uploadMutation = trpc.customization.upload.useMutation();
  const clearMutation = trpc.customization.clearAsset.useMutation();

  const snapshot = useMemo<CustomizationSnapshot>(
    () => ({ settings, assets: assetMap }),
    [assetMap, settings],
  );

  useEffect(() => {
    onChange(snapshot);
    try {
      window.localStorage.setItem("aeroflap-customization-draft", JSON.stringify(settings));
    } catch {
      // The gameplay preview remains available even when local storage is unavailable.
    }
  }, [onChange, settings, snapshot]);

  useEffect(() => {
    if (!profileQuery.data) return;
    setSettings({ ...CUSTOMIZATION_DEFAULTS, ...profileQuery.data.settings });
    setAssetMap(assetsToMap(profileQuery.data.assets));
    setNotice("Saved flight profile loaded");
  }, [profileQuery.data]);

  const updateSetting = <K extends keyof CustomizationSettings>(key: K, value: CustomizationSettings[K]) => {
    setSettings(current => ({ ...current, [key]: value }));
    setNotice(canPersist ? "Unsaved profile changes" : "Session draft active");
  };

  const handleUpload = async (slot: CustomizationAssetSlot, file?: File) => {
    if (!file) return;
    if (file.size > clientLimits[slot]) {
      setNotice(`${assetLabels[slot].title} is too large for this slot.`);
      return;
    }

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("The selected file could not be read."));
      reader.readAsDataURL(file);
    });
    const preview: CustomizationAssetRecord = {
      slot,
      url: dataUrl,
      fileName: file.name,
      mimeType: file.type,
    };
    setAssetMap(current => ({ ...current, [slot]: preview }));
    setNotice(`${assetLabels[slot].title} preview applied`);

    if (!canPersist) return;
    setUploading(slot);
    try {
      const result = await uploadMutation.mutateAsync({
        slot,
        fileName: file.name,
        mimeType: file.type,
        base64: dataUrl,
      });
      setAssetMap(current => ({ ...current, [slot]: { ...preview, url: result.url } }));
      setNotice(`${assetLabels[slot].title} saved to your profile`);
    } catch {
      setNotice("Upload could not be saved. The local preview remains active.");
    } finally {
      setUploading(null);
    }
  };

  const removeAsset = async (slot: CustomizationAssetSlot) => {
    setAssetMap(current => {
      const next = { ...current };
      delete next[slot];
      return next;
    });
    if (canPersist) {
      try {
        await clearMutation.mutateAsync(slot);
        setNotice(`${assetLabels[slot].title} cleared from your profile`);
      } catch {
        setNotice("The local preview was cleared, but the saved asset could not be removed.");
      }
    }
  };

  const saveProfile = async () => {
    if (!canPersist) {
      startLogin();
      return;
    }
    try {
      await saveMutation.mutateAsync(settings);
      setNotice("Customization profile saved");
    } catch {
      setNotice("Profile save failed. Your current preview is still active.");
    }
  };

  const resetProfile = async () => {
    setSettings(CUSTOMIZATION_DEFAULTS);
    setAssetMap({});
    try {
      window.localStorage.removeItem("aeroflap-customization-draft");
    } catch {
      // Resetting the live game does not depend on browser storage availability.
    }
    if (canPersist) {
      await Promise.all(CUSTOMIZATION_ASSET_SLOTS.map(slot => clearMutation.mutateAsync(slot).catch(() => undefined)));
      await saveMutation.mutateAsync(CUSTOMIZATION_DEFAULTS).catch(() => undefined);
      setNotice("Default flight profile restored");
    } else {
      setNotice("Default session restored");
    }
  };

  return (
    <aside className={`customization-studio ${open ? "is-open" : ""}`} aria-label="AeroFlap customization studio">
      <button data-aeroflap-control type="button" className="studio-toggle" onClick={event => { event.stopPropagation(); setOpen(value => !value); }}>
        <SlidersHorizontal size={17} aria-hidden="true" />
        <span>Customize</span>
        <ChevronDown size={15} className="studio-toggle-icon" aria-hidden="true" />
      </button>

      {open && (
        <div className="studio-panel">
          <div className="studio-heading">
            <div>
              <p>Personal flight deck</p>
              <h2>Make this run yours.</h2>
            </div>
            <button data-aeroflap-control type="button" aria-label="Close customization studio" className="studio-close" onClick={event => { event.stopPropagation(); setOpen(false); }}>
              <X size={17} />
            </button>
          </div>

          <div className="studio-notice" role="status">
            <Check size={14} aria-hidden="true" />
            <span>{authLoading ? "Checking profile…" : notice}</span>
          </div>

          <section className="studio-section">
            <div className="studio-section-title"><Palette size={15} /><span>Appearance</span></div>
            <div className="studio-grid two-column">
              <label className="color-field">Action color<input type="color" value={settings.accentColor} onChange={event => updateSetting("accentColor", event.target.value)} /></label>
              <label className="color-field">Gate color<input type="color" value={settings.gateColor} onChange={event => updateSetting("gateColor", event.target.value)} /></label>
            </div>
            <div className="mode-picker" aria-label="Background mode">
              {(["default", "image", "video"] as const).map(mode => (
                <button data-aeroflap-control type="button" key={mode} className={settings.backgroundMode === mode ? "is-selected" : ""} onClick={event => { event.stopPropagation(); updateSetting("backgroundMode", mode); }}>
                  {mode === "default" ? "Atlas sky" : mode === "image" ? "Own image" : "Video loop"}
                </button>
              ))}
            </div>
          </section>

          <section className="studio-section">
            <div className="studio-section-title"><SlidersHorizontal size={15} /><span>Flight tuning</span></div>
            <label className="range-field"><span><b>Flight pace</b><em>{settings.pace.toFixed(2)}×</em></span><input type="range" min="0.75" max="1.35" step="0.05" value={settings.pace} onChange={event => updateSetting("pace", Number(event.target.value))} /></label>
            <label className="range-field"><span><b>Gate opening</b><em>{settings.gateOpening.toFixed(2)}×</em></span><input type="range" min="0.8" max="1.2" step="0.05" value={settings.gateOpening} onChange={event => updateSetting("gateOpening", Number(event.target.value))} /></label>
          </section>

          <section className="studio-section">
            <div className="studio-section-title"><Volume2 size={15} /><span>Sound</span></div>
            <label className="range-field"><span><b>Master volume</b><em>{Math.round(settings.volume * 100)}%</em></span><input type="range" min="0" max="1" step="0.05" value={settings.volume} onChange={event => updateSetting("volume", Number(event.target.value))} /></label>
            <button data-aeroflap-control type="button" className={`mute-toggle ${settings.muted ? "is-muted" : ""}`} onClick={event => { event.stopPropagation(); updateSetting("muted", !settings.muted); }}>
              {settings.muted ? "Sound muted" : "Sound enabled"}
            </button>
          </section>

          <section className="studio-section">
            <div className="studio-section-title"><CloudUpload size={15} /><span>Imported media</span></div>
            <div className="asset-list">
              {CUSTOMIZATION_ASSET_SLOTS.map(slot => {
                const record = assetMap[slot];
                const meta = assetLabels[slot];
                return (
                  <div className="asset-row" key={slot}>
                    <div><b>{meta.title}</b><span>{record ? record.fileName : meta.help}</span></div>
                    <div className="asset-actions">
                      <label className="asset-upload">
                        <input
                          type="file"
                          aria-label={`Import ${meta.title}`}
                          accept={meta.accept}
                          onChange={event => void handleUpload(slot, event.target.files?.[0])}
                        />
                        {uploading === slot ? "Saving…" : record ? "Replace" : "Add"}
                      </label>
                      {record && <button data-aeroflap-control type="button" className="asset-remove" onClick={event => { event.stopPropagation(); void removeAsset(slot); }}>Clear</button>}
                    </div>
                  </div>
                );
              })}
            </div>
            {!canPersist && <p className="studio-auth-note">Preview any file now. Sign in when you are ready to keep the studio profile and imported media.</p>}
            <p className="studio-live-note">Changes preview immediately. Save profile stores the current flight deck for your account.</p>
          </section>

          <div className="studio-actions">
            <button data-aeroflap-control type="button" className="reset-profile" onClick={event => { event.stopPropagation(); void resetProfile(); }}><RotateCcw size={15} />Reset</button>
            <button data-aeroflap-control type="button" className="save-profile" onClick={event => { event.stopPropagation(); void saveProfile(); }}>
              {canPersist ? "Save profile" : "Sign in to save"}
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}

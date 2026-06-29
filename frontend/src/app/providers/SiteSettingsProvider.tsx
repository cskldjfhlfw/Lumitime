import { createContext, useContext, useMemo, useState } from 'react';

interface SiteSettings {
  cursorTrail: boolean;
}

interface SiteSettingsState {
  settings: SiteSettings;
  setCursorTrail: (enabled: boolean) => void;
}

const STORAGE_KEY = 'lumitime.settings.v1';
const DEFAULT_SETTINGS: SiteSettings = {
  cursorTrail: false,
};

const SiteSettingsContext = createContext<SiteSettingsState>({
  settings: DEFAULT_SETTINGS,
  setCursorTrail: () => {},
});

export function SiteSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings>(() => readSettings());

  const value = useMemo<SiteSettingsState>(() => ({
    settings,
    setCursorTrail: (enabled: boolean) => {
      setSettings(current => {
        const next = { ...current, cursorTrail: enabled };
        writeSettings(next);
        return next;
      });
    },
  }), [settings]);

  return (
    <SiteSettingsContext.Provider value={value}>
      {children}
    </SiteSettingsContext.Provider>
  );
}

export function useSiteSettings() {
  return useContext(SiteSettingsContext);
}

function readSettings(): SiteSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<SiteSettings>;
    return {
      cursorTrail: parsed.cursorTrail === true,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function writeSettings(settings: SiteSettings) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

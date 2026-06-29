import { createContext, useContext, useEffect, useMemo, useState } from 'react';

interface NightModeState {
  nightMode: boolean;
  setNightMode: (value: boolean) => void;
  toggleNightMode: () => void;
}

const STORAGE_KEY = 'lumitime.nightMode';

const NightModeContext = createContext<NightModeState>({
  nightMode: false,
  setNightMode: () => {},
  toggleNightMode: () => {},
});

function readInitialMode() {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(STORAGE_KEY) === 'true';
}

export function NightModeProvider({ children }: { children: React.ReactNode }) {
  const [nightMode, setNightMode] = useState(readInitialMode);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', nightMode);
    window.localStorage.setItem(STORAGE_KEY, String(nightMode));
  }, [nightMode]);

  const value = useMemo<NightModeState>(() => ({
    nightMode,
    setNightMode,
    toggleNightMode: () => setNightMode(value => !value),
  }), [nightMode]);

  return (
    <NightModeContext.Provider value={value}>
      {children}
    </NightModeContext.Provider>
  );
}

export function useNightMode() {
  return useContext(NightModeContext);
}

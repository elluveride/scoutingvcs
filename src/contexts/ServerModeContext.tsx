import React, { createContext, useContext, useState, useCallback } from 'react';

export type ServerMode = 'cloud' | 'local';

interface ServerModeContextType {
  mode: ServerMode;
  localUrl: string;
  setMode: (mode: ServerMode) => void;
  setLocalUrl: (url: string) => void;
  getBaseUrl: () => string | null;
}

const STORAGE_KEY_MODE = 'decode-server-mode';
const STORAGE_KEY_URL = 'decode-local-url';

function loadMode(): ServerMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_MODE);
    if (stored === 'local') return 'local';
  } catch {}
  return 'cloud';
}

function loadUrl(): string {
  try {
    return localStorage.getItem(STORAGE_KEY_URL) || 'http://192.168.137.1:3000';
  } catch {
    return 'http://192.168.137.1:3000';
  }
}

const ServerModeContext = createContext<ServerModeContextType | undefined>(undefined);

export const ServerModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, _setMode] = useState<ServerMode>(loadMode);
  const [localUrl, _setLocalUrl] = useState<string>(loadUrl);

  const setMode = useCallback((m: ServerMode) => {
    _setMode(m);
    try { localStorage.setItem(STORAGE_KEY_MODE, m); } catch {}
  }, []);

  const setLocalUrl = useCallback((url: string) => {
    _setLocalUrl(url);
    try { localStorage.setItem(STORAGE_KEY_URL, url); } catch {}
  }, []);

  /** Returns null for cloud mode (use Supabase), or the base URL for local mode */
  const getBaseUrl = useCallback((): string | null => {
    if (mode === 'local') return localUrl.replace(/\/+$/, '');
    return null;
  }, [mode, localUrl]);

  return (
    <ServerModeContext.Provider value={{ mode, localUrl, setMode, setLocalUrl, getBaseUrl }}>
      {children}
    </ServerModeContext.Provider>
  );
};

export const useServerMode = () => {
  const context = useContext(ServerModeContext);
  if (!context) throw new Error('useServerMode must be used within ServerModeProvider');
  return context;
};

import React, { createContext, useContext, ReactNode } from 'react';
import { BuildConfig } from './types';
import { ODYSSEY_ASSASSIN_CONFIG } from './odysseyAssassin';

const BuildContext = createContext<BuildConfig>(ODYSSEY_ASSASSIN_CONFIG);

interface BuildProviderProps {
  config?: BuildConfig;
  children: ReactNode;
}

/**
 * Provides build configuration to the entire app
 * Future: Can swap configs for different builds
 */
export function BuildProvider({ config = ODYSSEY_ASSASSIN_CONFIG, children }: BuildProviderProps) {
  return (
    <BuildContext.Provider value={config}>
      {children}
    </BuildContext.Provider>
  );
}

/**
 * Hook to access build configuration anywhere in the app
 */
export function useBuildConfig(): BuildConfig {
  return useContext(BuildContext);
}

/**
 * Direct access to current config (for non-React code)
 * Future: Can be made dynamic
 */
export function getBuildConfig(): BuildConfig {
  return ODYSSEY_ASSASSIN_CONFIG;
}

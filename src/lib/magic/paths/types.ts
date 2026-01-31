import { PathConfig, MagicPath } from '../types';

// Re-export for convenience
export type { PathConfig, MagicPath };

// Path registry type
export type PathRegistry = Record<MagicPath, PathConfig>;

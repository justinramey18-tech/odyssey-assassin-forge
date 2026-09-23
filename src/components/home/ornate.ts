import type { CSSProperties } from 'react';

export const PILL_STYLE = (pillUrl: string): CSSProperties => ({
  height: 30,
  borderStyle: 'solid',
  borderWidth: '0 26px',
  borderImage: `url(${pillUrl}) 0 134 0 134 fill / 0 26px stretch`,
});
import React from 'react';
import { ICON_PATHS } from './icon-paths.js';
export function Icon({ name, size = 28, ...props }) { return <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={ICON_PATHS[name] || ICON_PATHS.power}/></svg>; }

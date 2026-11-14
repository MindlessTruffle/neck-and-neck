import React from 'react';
import { Crest } from './ui-art.jsx';
import { assetUrl } from './assets.js';
import './loading-screen.css';
import { useT } from './i18n.jsx';

export function LoadingScreen({ progress = 0 }) {
  const t=useT();
  const value = Number.isFinite(progress) ? Math.max(0, Math.min(100, Math.round(progress * 100))) : null;
  return <div className="loading-screen" role="status" aria-live="polite">
    <div className="loading-screen-cloud" aria-hidden="true"><Crest/></div>
    <div className="loading-screen-giraffe" aria-hidden="true" style={{ backgroundImage: `url("${assetUrl('ui/giraffe-loading-illustrated.png')}")` }}/>
    <h1>NECK <i>&</i> NECK</h1>
    <div className="loading-screen-meter" role="progressbar" aria-label="Loading game" aria-valuemin="0" aria-valuemax="100" aria-valuenow={value ?? undefined}>
      <span style={value == null ? undefined : { width: `${value}%` }}/>
    </div>
    <p>{value == null ? 'GETTING THE COURT READY' : `${t('LOADING')} ${value}%`}</p>
  </div>;
}

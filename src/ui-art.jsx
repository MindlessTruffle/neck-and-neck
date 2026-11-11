import React from 'react';

const INK = '#28241f';
const CREAM = '#ffe7ad';

function GiraffeBust({ x = 0, y = 0, scale = 1, flip = false, team = '#368b7a' }) {
  return <g transform={`translate(${x} ${y}) scale(${flip ? -scale : scale} ${scale})`} stroke={INK} strokeWidth="3.7" strokeLinejoin="round" strokeLinecap="round">
    <path d="M-15 39 -17 70 12 73 15 37" fill="#e8b65d"/>
    <path d="m-8 48 7-3 5 8-6 4-6-3m0 12 8-4 5 6-4 6-8-1" fill="#a66a3c" strokeWidth="1.4"/>
    <path d="M-20 57q18 12 38 0l2 12q-22 11-43-2Z" fill={team}/>
    <path d="m12 68 12-3 4 18-10-5-6 4Z" fill={team}/>
    <path d="M-19 0q-17-10-23 1 4 15 24 13m37-15q18-10 24 2-5 14-24 12" fill="#eac276"/>
    <path d="M-12-9-15-27m25 17 4-19" fill="none"/>
    <path d="M-20-28q5-8 12-1l-1 7h-10m26-9q6-8 13-1l-2 8h-10" fill="#94623d"/>
    <path d="M-22 7q-3-22 22-24 24 2 23 26l-1 22q-2 18-23 18-26-2-24-21Z" fill="#f1c66e"/>
    <path d="M-26 6q1-29 26-28 27 1 29 25l-14 2-3-11-22-1-5 12Z" fill="#9a6d49"/>
    <path d="M-9-20 6-19 8 2-8 2Z" fill="#c4955d"/>
    <path d="m-23 2 3 27m43-26-3 21" fill="none" stroke="#76523b" strokeWidth="5"/>
    <ellipse cx="-9" cy="18" rx="5.7" ry="9.3" fill="#fff4d6"/>
    <ellipse cx="12" cy="18" rx="5.7" ry="9.3" fill="#fff4d6"/>
    <path d="M-8 14v8m21-8v8" strokeWidth="4.5"/>
    <path d="m-15 4 10-2m12 1 11 3" fill="none" strokeWidth="3"/>
    <path d="M-21 29q3-10 23-10 23 0 26 13l-3 14q-24 14-46-1Z" fill="#f9d994"/>
    <path d="m-12 31 2 1m21-1 2-1m-15 14q8 5 14-1" fill="none" strokeWidth="3"/>
    <path d="m-30 2 6 4m55-4-6 4M-3-13v9" stroke="#dfbc84" strokeWidth="2"/>
  </g>;
}

export function Crest({ className = '' }) {
  return <svg className={className} viewBox="0 0 240 280" fill="none" aria-hidden="true">
    <g stroke={INK} strokeWidth="5" strokeLinejoin="round" strokeLinecap="round">
      <path d="m30 54 90-27 89 28-8 130q-16 46-81 70-64-22-82-70Z" fill="#456b52"/>
      <path d="m41 63 79-24 78 24-8 118q-18 40-70 61-53-20-70-61Z" fill="#e1aa51" strokeWidth="3"/>
      <path d="m50 70 70-22 69 22-8 107q-15 35-61 56-47-20-61-56Z" fill="#f6df9f" strokeWidth="2.5"/>
      <path d="m23 183 25-6 6 28-30 8 7-16-8-14m194 0-26-6-6 28 31 8-8-16 9-14" fill="#b64f3a"/>
      <path d="M49 194q69-17 141 0l-3 28q-72-18-135 0Z" fill="#ce6744"/>
      <path d="m65 201 10-1m9-1 48-1m8 1 32 2" stroke="#e9975f" strokeWidth="2"/>
      <path d="M62 228q-21-15-30-42m145 43q23-18 30-43" stroke="#314f3e" strokeWidth="4"/>
      <path d="m39 208-15-4 6 12 14 4m-8-29-13-7 2 13 13 8m158 3 15-4-6 12-14 4m8-29 13-7-2 13-13 8" fill="#6f8c51" strokeWidth="3"/>
      <path d="m60 76-14-11m135 10 13-12m-79 165 4 13 6-13" strokeWidth="3"/>
    </g>
    <GiraffeBust x={111} y={96} scale={1.68} team="#bf5139"/>
    <g stroke={INK} strokeWidth="4.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="m145 143 44 12-1 45q-15 22-40 28-25-10-34-33l2-41Z" fill="#b88243"/>
      <path d="m146 151 34 10-1 35q-13 16-31 23-19-9-26-27l2-32Z" fill={CREAM} strokeWidth="2.5"/>
      <circle cx="151" cy="183" r="25" fill="#f9e7b5" strokeWidth="3.6"/>
      <path d="M132 167q21 0 29 36m-11-45q-10 15-23 23m46-10q-16 4-35 32" stroke="#c76b43" strokeWidth="7"/>
      <circle cx="151" cy="183" r="25" fill="none" strokeWidth="3.6"/>
      <path d="m185 126 5-11 5 11 10 4-10 5-5 10-5-10-10-5Zm-132 19 3-7 4 7 7 3-7 3-4 7-3-7-7-3Z" fill="#ffe7ad" strokeWidth="2.5"/>
      <path d="m75 245 11 4m10 4 9 4m31-3 10-4m10-6 9-6" fill="none" strokeWidth="2"/>
    </g>
  </svg>;
}

export function ModeEmblem({ mode }) {
  const doubles = mode === '2v2';
  return <svg viewBox="0 0 180 108" fill="none" aria-hidden="true">
    <path d="M8 91q83-12 164 0" stroke={INK} strokeWidth="4" strokeLinecap="round"/>
    {doubles ? <>
      <GiraffeBust x={35} y={40} scale={.65} team="#328c79"/>
      <GiraffeBust x={65} y={52} scale={.65} team="#328c79"/>
      <GiraffeBust x={145} y={40} scale={.65} flip team="#c86446"/>
      <GiraffeBust x={115} y={52} scale={.65} flip team="#c86446"/>
    </> : <>
      <GiraffeBust x={45} y={36} scale={.85} team="#328c79"/>
      <GiraffeBust x={135} y={36} scale={.85} flip team="#c86446"/>
    </>}
    <path d="m91 39-9 23 11-3-6 22 15-30-12 5 8-17" fill="#e1a743" stroke={INK} strokeWidth="2.7" strokeLinejoin="round"/>
  </svg>;
}

export function TrophyArt() {
  return <svg viewBox="0 0 200 172" fill="none" aria-hidden="true">
    <g stroke={INK} strokeWidth="4.7" strokeLinejoin="round" strokeLinecap="round">
      <path d="M57 45H29q-5 51 39 52m75-52h28q5 51-39 52" fill="#d59a43"/>
      <path d="M67 151h67l-6-17H74Z" fill="#a57946"/>
      <path d="m90 99-4 35h29l-6-35" fill="#e5b04a"/>
      <path d="m50 39 9 45q9 28 42 29 32-1 42-29l8-45Z" fill="#edbd59"/>
      <path d="m61 49 5 30q7 22 21 24" stroke="#ffe5a1" strokeWidth="6"/>
      <path d="M47 32q54-11 107 0l-2 16q-52 8-102 0Z" fill="#f4d178"/>
      <circle cx="101" cy="40" r="29" fill="#fff0c4"/>
      <path d="M80 20q25 9 29 47m-3-56Q95 32 74 40m51-18q-9 17-39 42" stroke="#c57543" strokeWidth="7"/>
      <circle cx="101" cy="40" r="29" fill="none"/>
      <path d="m37 103-11-4 3 13 14 2m-1 3-14 1 7 12 14-6m113-21 11-4-3 13-14 2m1 3 14 1-7 12-14-6" fill="#6a8b54" strokeWidth="3.5"/>
      <path d="m31 93q-2 29 27 42m112-42q2 29-27 42" strokeWidth="3"/>
      <path d="m22 33 4-9 4 9 9 4-9 4-4 9-4-9-9-4m143-16 4-9 4 9 9 4-9 4-4 9-4-9-9-4" fill="#f6d276" strokeWidth="2.5"/>
    </g>
  </svg>;
}

export function PauseArt() {
  return <svg viewBox="0 0 200 172" fill="none" aria-hidden="true">
    <path d="m32 123 14-62 103-2 15 65" fill="#a47545" stroke={INK} strokeWidth="5" strokeLinejoin="round"/>
    <GiraffeBust x={100} y={51} scale={.92} team="#b95039"/>
    <g stroke={INK} strokeWidth="4.5" strokeLinejoin="round" strokeLinecap="round">
      <path d="m27 105 143-6 6 52-149 8Z" fill="#e9c17e"/>
      <path d="m33 111 131-5m-129 42 135-7" stroke="#b7874f" strokeWidth="2"/>
      <path d="m82 116 13-1v27l-13 1Zm24-1 13-1v27l-13 1Z" fill="#b64e36"/>
      <path d="m39 123 13-1m97 12 12-1" strokeWidth="3"/>
      <path d="m25 48-8-8m5 28-12 1m165-21 8-8m-5 28 12 1" strokeWidth="3.5"/>
    </g>
  </svg>;
}

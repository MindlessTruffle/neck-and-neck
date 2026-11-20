import React, { useEffect, useRef, useState } from 'react';
import { QUICK_GROUPS, QUICK_LABELS } from './quick-messages.js';
import './quick-chat.css';

const badges = {
  wave: ['#78cfed', 'M4 13q4-6 8 0t8 0 M4 8q4-6 8 0t8 0'],
  heart: ['#fc85a4', 'M12 20 3 11Q0 1 8 3l4 3 4-3q9-2 5 8Z'],
  star: ['#f3c45b', 'm12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z'],
  crown: ['#b698f4', 'm2 6 6 5 4-8 4 8 6-5-3 13H5Z'],
};

function Emote({ id }) {
  if (!badges[id]) return null;
  const [color, badge] = badges[id];
  return <svg viewBox="0 0 64 64" aria-hidden="true" stroke="#392738" strokeWidth="2.8" strokeLinejoin="round">
    <rect x="2" y="2" width="60" height="60" rx="15" fill={color}/>
    <g fill="#ffd782" transform={id === 'wave' ? 'rotate(-8 30 35)' : undefined}>
      <path d="m17 36-7 19 17 5 13-23Z"/>
      <path d="m19 27-9-9q-4 15 9 14m10-11-1-10m10 14 4-10" strokeWidth="4" strokeLinecap="round"/>
      <circle cx="28" cy="10" r="3" fill="#975736"/><circle cx="42" cy="14" r="3" fill="#975736"/>
      <path d="M17 29q3-13 17-11 8 2 10 12l8 4q8 5 1 12-10 8-23 1-14-3-13-18Z"/>
      <path d="M29 43q5 5 12 2" fill="none"/>
      {id==='heart' ? <path d="m23 29 4-4 4 4m3 1 3-4 3 3" fill="none"/> : <g fill="#392738"><circle cx="27" cy="29" r="1.7"/><circle cx="37" cy="29" r="1.7"/></g>}
      <circle cx="48" cy="36" r="1.3" fill="#975736"/>
    </g>
    <g transform="translate(38 38) scale(.95)"><path d={badge} fill={id==='wave'?'none':'#fff3a4'} strokeWidth="3" strokeLinecap="round"/></g>
  </svg>;
}

export function QuickChat({ send, message }) {
  const [open, setOpen] = useState(false);
  const [group, setGroup] = useState(0);
  const [shown, setShown] = useState(null);
  const cooldown = useRef(0);
  useEffect(() => {
    if (!message) return;
    setShown(message);
    const timer = setTimeout(() => setShown(null), 2600);
    return () => clearTimeout(timer);
  }, [message]);

  function pick(index) {
    if (Date.now() < cooldown.current) return;
    cooldown.current = Date.now() + 900;
    send(QUICK_GROUPS[group].items[index][0]);
    setOpen(false);
  }
  useEffect(() => {
    function key(event) {
      if (event.ctrlKey || event.altKey || event.metaKey) return;
      const {code} = event;
      if (code !== 'KeyC' && !(open && /^(Escape|Tab|Digit[1-4]|ArrowLeft|ArrowRight)$/.test(code))) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.repeat) return;
      if (code === 'KeyC') setOpen(!open);
      else if (code === 'Escape') setOpen(false);
      else if (code.startsWith('Digit')) pick(Number(code.slice(-1)) - 1);
      else setGroup((group + (code === 'ArrowLeft' ? 2 : 1)) % QUICK_GROUPS.length);
    }
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  });
  return <aside className="quick-chat">
    <button aria-expanded={open} aria-label="Quick chat (C)" onClick={() => setOpen(!open)}>Chat <kbd>C</kbd></button>
    {open && <section aria-label="Quick chat">
      <nav>{QUICK_GROUPS.map((g,i) => <button key={g.name} aria-pressed={group===i} onClick={() => setGroup(i)}>{g.name}</button>)}</nav>
      <div>{QUICK_GROUPS[group].items.map(([id,label],i) => <button key={id} onClick={() => pick(i)}><Emote id={id}/>{label} <kbd>{i+1}</kbd></button>)}</div>
    </section>}
    {shown && <output key={shown.id??shown.key}><strong>{shown.name}</strong> <Emote id={shown.key}/>{QUICK_LABELS.get(shown.key)}</output>}
  </aside>;
}

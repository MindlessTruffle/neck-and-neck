import React, { useState } from 'react';
import { getSkin } from './profile.js';
import { assetUrl } from './assets.js';
import './online-panel.css';
import { useT } from './i18n.jsx';
import { Icon } from './icons.jsx';

const read = (key, fallback) => { try { return localStorage.getItem(key) || fallback; } catch { return fallback; } };
const save = (key, value) => { try { localStorage.setItem(key, value); } catch {} };
const localHost = () => ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);

export function OnlinePanel({ client, state = {}, profile }) {
  const t=useT();
  const [endpoint, setEndpoint] = useState(() => read('neck.server', import.meta.env.VITE_SERVER_URL || (localHost() ? 'ws://127.0.0.1:8787' : '')));
  const [name, setName] = useState(() => read('neck.name', 'Tall Friend'));
  const [code, setCode] = useState('');
  const [notice, setNotice] = useState('');
  const [partyMenu, setPartyMenu] = useState(false);
  const room = state.room;
  const connected = state.connection === 'connected';
  const busy = ['connecting', 'reconnecting'].includes(state.connection);
  const memberId = state.id || state.memberId;
  const host = room?.hostId === memberId;
  const queued = state.queue?.status === 'waiting' || room?.status === 'queued';
  const invoke = async operation => { setNotice(''); try { await operation(); } catch (error) { setNotice(error.message || 'Could not connect. Try again.'); } };
  const connect = async () => {
    save('neck.server', endpoint.trim()); save('neck.name', name.trim());
    await client.connect(endpoint.trim(), { name: name.trim(), loadout: { ability: profile.equippedAbility, skin: getSkin(profile.equippedSkin).palette, cosmetics: profile.cosmetics } });
  };
  const ensureConnected = async () => { if (!connected) await connect(); };
  const setQueue = mode => { setPartyMenu(false); return invoke(async () => { await ensureConnected(); await client.joinQueue(mode); }); };
  return <section className="party-panel" role="dialog" aria-modal="true" aria-labelledby="party-title">
    <header className="party-heading"><h1 id="party-title">{t('MULTIPLAYER')}</h1><span className="post-stamp" data-online={connected}>{connected ? '●' : busy ? '…' : '○'}</span></header>
    {connected && <div className="party-name-badge">{name}</div>}
    {!connected && <div className="party-connect">
      <label className="party-name-label">{t('YOUR NAME')}<input aria-label="Your multiplayer name" value={name} maxLength={24} onChange={event => setName(event.target.value)} placeholder="Tall Friend" autoComplete="nickname"/></label>
      <details className="party-advanced"><summary>{t('ADVANCED')}</summary><label>{t('SERVER ADDRESS')}<input aria-label="Server address" value={endpoint} onChange={event => setEndpoint(event.target.value)} placeholder="wss://your-club.example.com" autoCapitalize="none" spellCheck="false"/></label></details>
      {!endpoint.trim() && <p className="server-unavailable" role="status">{t('SERVER UNAVAILABLE · OPEN ADVANCED')}</p>}
    </div>}
    {queued ? <div className="post-queue" role="status"><span className="post-orbit"><Icon name="users" size={60}/></span><h2>{t('SEARCHING…')}</h2><p>{state.queue?.mode || room?.mode}</p><button onClick={() => invoke(() => client.cancelQueue())}>{t('CANCEL')}</button></div> : room ? <div className="party-room">
      <div className="room-code"><div><small>{t('INVITE CODE')}</small><strong>{room.code}</strong></div><button onClick={() => invoke(async () => { await navigator.clipboard.writeText(room.code); setNotice(t('COPIED')); })}>{t('COPY')}</button></div>
      <div className="party-formations"><span>{room.mode}</span>{host && !queued && room.status === 'lobby' && <>{['1v1', '2v2'].map(mode => <button key={mode} aria-pressed={room.mode === mode} onClick={() => invoke(() => client.setMode(mode))}>{mode}</button>)}</>}</div>
      <div className="party-teams">{[0, 1].map(team => <div key={team}><h2>{team === 0 ? t('MEADOW') : t('EMBER')}</h2>{room.members.filter(member => member.team === team).map(member => <p key={member.id}><span>{member.name}{member.id === memberId ? ' · YOU' : ''}</span><small>{member.host ? t('HOST') : member.connected ? '●' : '…'}</small></p>)}{!queued && room.status === 'lobby' && <button onClick={() => invoke(() => client.setTeam(team))}>JOIN {team === 0 ? t('MEADOW') : t('EMBER')}</button>}</div>)}</div>
      {host && <button className="post-primary" disabled={room.status !== 'lobby' || room.members.length !== (room.mode === '1v1' ? 2 : 4) || room.members.some(member => !member.connected)} onClick={() => invoke(() => client.startMatch())}>{t('START MATCH')}</button>}
      {host && room.members.length === 2 && <button className="post-secondary" onClick={() => invoke(async () => { await ensureConnected(); if(room.mode!=='2v2')client.setMode('2v2'); await client.joinQueue('2v2'); })}>FIND 2v2</button>}
      <button className="post-text" onClick={() => invoke(() => client.leaveRoom())}>{t('LEAVE PARTY')}</button>
    </div> : <>
      {busy && <p className="connect-status" role="status">{t('CONNECTING…')}</p>}
      {!partyMenu ? <div className="party-options" aria-label="Choose multiplayer mode">
        <button className="mode-choice mode-one" disabled={busy || !name.trim() || !endpoint.trim()} onClick={() => setQueue('1v1')}><span>1v1</span></button>
        <button className="mode-choice mode-two" disabled={busy || !name.trim() || !endpoint.trim()} onClick={() => setQueue('2v2')}><span>2v2</span></button>
        <button className="mode-choice mode-party" disabled={busy || !name.trim() || !endpoint.trim()} onClick={() => setPartyMenu(true)}><span>{t('PARTY')}</span></button>
      </div> : <div className="party-create">
        <h2>{t('PARTY')}</h2>
        <div className="post-pair"><button disabled={busy || !name.trim() || !endpoint.trim()} onClick={() => invoke(async () => { await ensureConnected(); await client.createRoom('1v1'); })}>CREATE 1v1</button><button disabled={busy || !name.trim() || !endpoint.trim()} onClick={() => invoke(async () => { await ensureConnected(); await client.createRoom('2v2'); })}>CREATE 2v2</button></div>
        <div className="post-join"><input aria-label="Party invite code" value={code} maxLength={10} onChange={event => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} placeholder="INVITE CODE"/><button disabled={!code || busy || !endpoint.trim()} onClick={() => invoke(async () => { await ensureConnected(); await client.joinRoom(code); })}>{t('JOIN')}</button></div>
        <button className="party-back-button" style={{ backgroundImage: `url("${assetUrl('kenney/ui/back-button-red.png')}")` }} aria-label="Back to multiplayer modes" onClick={() => setPartyMenu(false)}><img src={assetUrl('kenney/ui/back-arrow-red.png')} alt=""/></button>
      </div>}
      {connected && <button className="post-text" onClick={() => client.disconnect()}>{t('DISCONNECT')}</button>}
    </>}
    {(notice || state.error) && <p className="post-error" role="status">{notice || (typeof state.error === 'string' ? state.error : state.error.message)}</p>}
  </section>;
}

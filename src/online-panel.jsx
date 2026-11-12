import React, { useState } from 'react';
import { getSkin } from './profile.js';
import './online-panel.css';

const read = (key, fallback) => { try { return localStorage.getItem(key) || fallback; } catch { return fallback; } };
const save = (key, value) => { try { localStorage.setItem(key, value); } catch {} };
const localHost = () => ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);

export function OnlinePanel({ client, state = {}, profile, onClose }) {
  const [endpoint, setEndpoint] = useState(() => read('neck.server', import.meta.env.VITE_SERVER_URL || (localHost() ? 'ws://127.0.0.1:8787' : '')));
  const [name, setName] = useState(() => read('neck.name', 'Tall Friend'));
  const [code, setCode] = useState('');
  const [notice, setNotice] = useState('');
  const room = state.room;
  const connected = state.connection === 'connected';
  const busy = ['connecting', 'reconnecting'].includes(state.connection);
  const memberId = state.id || state.memberId;
  const host = room?.hostId === memberId;
  const queued = state.queue?.status === 'waiting' || room?.status === 'queued';
  const invoke = async operation => { setNotice(''); try { await operation(); } catch (error) { setNotice(error.message || 'The post could not get through. Try again.'); } };
  const connect = () => invoke(async () => {
    save('neck.server', endpoint.trim()); save('neck.name', name.trim());
    await client.connect(endpoint.trim(), { name: name.trim(), loadout: { ability: profile.equippedAbility, skin: getSkin(profile.equippedSkin).palette } });
  });
  return <section className="party-panel" role="dialog" aria-modal="true" aria-labelledby="party-title">
    <header className="party-heading"><div><small>THE SKY CLUB AIRMAIL SERVICE</small><h1 id="party-title">PARTY POST</h1></div><span className="post-stamp" data-online={connected}>{connected ? 'CONNECTED' : busy ? 'CONNECTING' : 'OFFLINE'}<b>{connected && state.rtt ? `${Math.round(state.rtt)} ms` : '✉'}</b></span></header>
    <p>Bring a friend. Find a rival. Make a ridiculous save.</p>
    {!connected ? <div className="party-connect">
      <label>YOUR COURT NAME<input aria-label="Your court name" value={name} maxLength={24} onChange={event => setName(event.target.value)} placeholder="Tall Friend" autoComplete="nickname"/></label>
      <label>CLUB SERVER<input aria-label="Club server address" value={endpoint} onChange={event => setEndpoint(event.target.value)} placeholder="wss://your-club.example.com" autoCapitalize="none" spellCheck="false"/></label>
      <p className="post-note">{localHost() ? 'Local club: start the multiplayer server, then connect. Online friends use your secure Oracle server address.' : 'Club address is ready. Enter your name, connect, then invite friends or find a match.'}</p>
      <button className="post-primary" disabled={busy || !endpoint.trim()} onClick={connect}>{busy ? 'SENDING YOUR POSTCARD…' : 'ENTER THE CLUB'}</button>
    </div> : <>
      {room ? <div className="party-room">
        <div className="room-code"><div><small>INVITE CODE</small><strong>{room.code}</strong></div><button onClick={() => invoke(async () => { await navigator.clipboard.writeText(room.code); setNotice('Invite code copied. Friends connect to the same club server, then join with this code.'); })}>COPY INVITE</button></div>
        <div className="party-formations"><span>{room.mode} PARTY</span>{host && !queued && room.status === 'lobby' && <>{['1v1', '2v2'].map(mode => <button key={mode} aria-pressed={room.mode === mode} onClick={() => invoke(() => client.setMode(mode))}>{mode}</button>)}</>}</div>
        <div className="party-teams">{[0, 1].map(team => <div key={team}><h2>{team === 0 ? 'MEADOW' : 'EMBER'}</h2>{room.members.filter(member => member.team === team).map(member => <p key={member.id}><span>{member.name}{member.id === memberId ? ' (YOU)' : ''}</span><small>{member.host ? 'HOST' : member.connected ? 'HERE' : 'REJOINING'}</small></p>)}{!queued && room.status === 'lobby' && <button onClick={() => invoke(() => client.setTeam(team))}>JOIN {team === 0 ? 'MEADOW' : 'EMBER'}</button>}</div>)}</div>
        {host && !queued && <button className="post-primary" disabled={room.status !== 'lobby' || room.members.length !== (room.mode === '1v1' ? 2 : 4) || room.members.some(member => !member.connected)} onClick={() => invoke(() => client.startMatch())}>START PRIVATE MATCH</button>}
        {!host && <p className="post-note">Host starts the match or sends the party into a queue.</p>}
        {host && !queued && room.mode === '2v2' && room.members.length === 2 && <button className="post-secondary" onClick={() => invoke(() => client.joinQueue('2v2'))}>FIND A 2v2 MATCH TOGETHER</button>}
        <button className="post-text" onClick={() => invoke(() => client.leaveRoom())}>LEAVE PARTY</button>
      </div> : !queued && <div className="party-options">
        <div><h2>FIND A MATCH</h2><p>Real players. Same physical court.</p><div className="post-pair"><button onClick={() => invoke(() => client.joinQueue('1v1'))}><b>1v1</b><span>SOLO DUEL</span></button><button onClick={() => invoke(() => client.joinQueue('2v2'))}><b>2v2</b><span>TEAM RALLY</span></button></div></div>
        <div><h2>YOUR OWN PARTY</h2><p>Invite friends with a private code.</p><div className="post-pair"><button onClick={() => invoke(() => client.createRoom('1v1'))}>CREATE 1v1</button><button onClick={() => invoke(() => client.createRoom('2v2'))}>CREATE 2v2</button></div><div className="post-join"><input aria-label="Party invite code" value={code} maxLength={10} onChange={event => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} placeholder="INVITE CODE"/><button disabled={!code} onClick={() => invoke(() => client.joinRoom(code))}>JOIN</button></div></div>
      </div>}
      {queued && <div className="post-queue" role="status"><span className="post-orbit">✦</span><h2>LOOKING FOR YOUR RIVALS…</h2><p>{state.queue?.mode || room?.mode} · Keep this game open. Match starts when everyone arrives.</p><button onClick={() => invoke(() => client.cancelQueue())}>CANCEL SEARCH</button></div>}
      {!queued && <button className="post-text" onClick={() => client.disconnect()}>DISCONNECT FROM CLUB</button>}
    </>}
    {(notice || state.error) && <p className="post-error" role="status">{notice || (typeof state.error === 'string' ? state.error : state.error.message)}</p>}
    <footer><span>Guest play · skins and clovers saved on this device</span><button onClick={onClose}>BACK TO CLOUDS</button></footer>
  </section>;
}


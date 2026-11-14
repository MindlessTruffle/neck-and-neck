import { COSMETICS, cleanCosmetics } from './cosmetics-catalog.js';
export const PROFILE_VERSION = 1;
export const PROFILE_KEY = 'neck-and-neck.profile.v1';
export const ROLL_COST = 100;
export const DUPLICATE_REFUND = 75;

const skin = (id, name, price, rarity, description, palette) => Object.freeze({ id, name, price, rarity, description, palette: Object.freeze(palette) });
export const SKINS = Object.freeze([
  skin('classic', 'Club Original', 0, 'Starter', 'The first neck on the court. A proper classic.', { body: '#e8b35b', spots: '#8c4b2c', muzzle: '#ffe5ac', scarf: '#2e9e95', accent: '#f5cc68' }),
  skin('blossom', 'Cherry Bonk', 180, 'Fresh', 'Blush-pink spots. A surprisingly fierce serve.', { body: '#f4b5ba', spots: '#aa5268', muzzle: '#ffe3d8', scarf: '#6076ca', accent: '#ffe1a1' }),
  skin('moss', 'Clover Captain', 220, 'Fresh', 'Meadow greens for the home-court specialist.', { body: '#97b574', spots: '#486644', muzzle: '#e1e8b9', scarf: '#d27051', accent: '#f5d179' }),
  skin('midnight', 'Night Shift', 260, 'Rare', 'Ink-blue coat. Golden-hour confidence.', { body: '#36465f', spots: '#172638', muzzle: '#a9bfd1', scarf: '#efb451', accent: '#e99752' }),
  skin('tangerine', 'Orange Crush', 320, 'Rare', 'Warm citrus colour with a deep-blue neckerchief.', { body: '#ec9753', spots: '#9d4430', muzzle: '#ffe0ad', scarf: '#2f6b7b', accent: '#ffbd48' }),
  skin('glacier', 'Frost Front', 380, 'Rare', 'Ice-blue spots. Unreasonably cool under pressure.', { body: '#bfdee5', spots: '#6b9fb5', muzzle: '#eefaf2', scarf: '#3fa8a1', accent: '#f5dd90' }),
  skin('royal', 'Royal Rally', 520, 'Epic', 'Lavender velvet colours and a gold club scarf.', { body: '#b3a1ce', spots: '#685188', muzzle: '#eadcf0', scarf: '#ca9b45', accent: '#ffe8a4' }),
  skin('cosmic', 'Afterglow', 850, 'Legendary', 'Deep-sea spots with electric candy-colour trim.', { body: '#263d47', spots: '#4f7886', muzzle: '#afdadb', scarf: '#e883a9', accent: '#91e9cd' }),
]);

export const ABILITY_CATALOG = Object.freeze([
  Object.freeze({ id: 'magnet', name: 'Magnet Head', rarity: 'Club', odds: 30, color: '#f3a4db', short: 'Pull it closer.', description: 'A magnetic contact window helps your head collect difficult returns.' }),
  Object.freeze({ id: 'feather', name: 'Feather Float', rarity: 'Club', odds: 25, color: '#d8f4ee', short: 'Keep it in the air.', description: 'Your next contact floats high, giving the team time to recover.' }),
  Object.freeze({ id: 'spring', name: 'Spring Step', rarity: 'Rare', odds: 20, color: '#ffd56c', short: 'Meet it up there.', description: 'Launch into a bigger jump for a high receive or attacking contact.' }),
  Object.freeze({ id: 'rocket', name: 'Rocket Hooves', rarity: 'Epic', odds: 15, color: '#ffa574', short: 'Cover the whole court.', description: 'A burst of speed turns a distant ball into a possible save.' }),
  Object.freeze({ id: 'shield', name: 'Iron Canopy', rarity: 'Legendary', odds: 10, color: '#82cbe8', short: 'Close the net.', description: 'A wider defensive head window makes your blocking presence count.' }),
]);

const SKIN_IDS = new Set(SKINS.map(item => item.id));
const ABILITY_IDS = new Set(ABILITY_CATALOG.map(item => item.id));
const integer = (value, fallback = 0) => Number.isSafeInteger(value) && value >= 0 ? Math.min(value, 999999) : fallback;
const ids = (values, allowed, starter) => [...new Set([starter, ...(Array.isArray(values) ? values.filter(value => typeof value === 'string' && allowed.has(value)) : [])])];

export function createProfile() {
  return { version: PROFILE_VERSION, coins: 500, ownedSkins: ['classic'], equippedSkin: 'classic', ownedAbilities: ['magnet'], equippedAbility: 'magnet', ownedCosmetics: [], cosmetics: cleanCosmetics(), stats: { points: 0, wins: 0, matches: 0, rolls: 0 }, claimedRewards: [] };
}

/** Only known IDs, nonnegative integers and bounded arrays enter the saved schema. */
export function validateProfile(raw) {
  if (!raw || typeof raw !== 'object' || raw.version !== PROFILE_VERSION) return createProfile();
  const ownedSkins = ids(raw.ownedSkins, SKIN_IDS, 'classic');
  const ownedAbilities = ids(raw.ownedAbilities, ABILITY_IDS, 'magnet');
  const stats = raw.stats && typeof raw.stats === 'object' ? raw.stats : {};
  return {
    version: PROFILE_VERSION,
    coins: integer(raw.coins),
    ownedSkins,
    ownedCosmetics: [...new Set((Array.isArray(raw.ownedCosmetics)?raw.ownedCosmetics:[]).filter(id=>COSMETICS.some(c=>c.id===id)))],
    cosmetics: cleanCosmetics(Object.fromEntries(Object.entries(cleanCosmetics(raw.cosmetics)).map(([slot,id])=>[slot,Array.isArray(raw.ownedCosmetics)&&raw.ownedCosmetics.includes(id)?id:null]))),
    equippedSkin: ownedSkins.includes(raw.equippedSkin) ? raw.equippedSkin : 'classic',
    ownedAbilities,
    equippedAbility: ownedAbilities.includes(raw.equippedAbility) ? raw.equippedAbility : 'magnet',
    stats: { points: integer(stats.points), wins: integer(stats.wins), matches: integer(stats.matches), rolls: integer(stats.rolls) },
    claimedRewards: [...new Set(Array.isArray(raw.claimedRewards) ? raw.claimedRewards.filter(value => typeof value === 'string' && value.length > 0 && value.length <= 100) : [])].slice(-128),
  };
}

function getStorage(storage) {
  if (storage !== undefined) return storage;
  try { return globalThis.localStorage; } catch { return null; }
}

export function loadProfile(storage) {
  try { const text = getStorage(storage)?.getItem(PROFILE_KEY); return text ? validateProfile(JSON.parse(text)) : createProfile(); }
  catch { return createProfile(); }
}

export function saveProfile(profile, storage) {
  const clean = validateProfile(profile);
  try { getStorage(storage)?.setItem(PROFILE_KEY, JSON.stringify(clean)); } catch {}
  return clean;
}

export const getSkin = id => SKINS.find(item => item.id === id) || SKINS[0];
export const getAbility = id => ABILITY_CATALOG.find(item => item.id === id) || ABILITY_CATALOG[0];
const outcome = (ok, profile, message, extras = {}) => ({ ok, profile, message, ...extras });

export function purchaseSkin(raw, id) {
  const profile = validateProfile(raw), item = SKINS.find(entry => entry.id === id);
  if (!item) return outcome(false, profile, 'That colourway is not in the club locker.');
  if (profile.ownedSkins.includes(id)) return outcome(false, profile, 'Already in your locker.');
  if (profile.coins < item.price) return outcome(false, profile, `You need ${item.price - profile.coins} more clovers.`);
  profile.coins -= item.price; profile.ownedSkins.push(id); profile.equippedSkin = id;
  return outcome(true, profile, `${item.name} unlocked and equipped.`, { item, spent: item.price });
}

export function equipSkin(raw, id) {
  const profile = validateProfile(raw);
  if (!SKIN_IDS.has(id) || !profile.ownedSkins.includes(id)) return outcome(false, profile, 'Unlock this colourway first.');
  profile.equippedSkin = id;
  return outcome(true, profile, `${getSkin(id).name} equipped.`, { item: getSkin(id) });
}

export function equipAbility(raw, id) {
  const profile = validateProfile(raw);
  if (!ABILITY_IDS.has(id) || !profile.ownedAbilities.includes(id)) return outcome(false, profile, 'Roll this power before equipping it.');
  profile.equippedAbility = id;
  return outcome(true, profile, `${getAbility(id).name} equipped for your next match.`, { ability: getAbility(id) });
}

export function rollAbility(raw, random = Math.random) {
  const profile = validateProfile(raw);
  if (profile.coins < ROLL_COST) return outcome(false, profile, `You need ${ROLL_COST - profile.coins} more clovers to roll.`);
  let draw;
  try { draw = random(); } catch { return outcome(false, profile, 'Roll could not finish. Your clovers are safe.'); }
  if (!Number.isFinite(draw) || draw < 0 || draw >= 1) return outcome(false, profile, 'Roll could not finish. Your clovers are safe.');
  let cumulative = 0;
  const ability = ABILITY_CATALOG.find(item => { cumulative += item.odds; return draw * 100 < cumulative; }) || ABILITY_CATALOG.at(-1);
  const duplicate = profile.ownedAbilities.includes(ability.id);
  profile.coins -= ROLL_COST;
  if (duplicate) profile.coins += DUPLICATE_REFUND;
  else profile.ownedAbilities.push(ability.id);
  profile.equippedAbility = ability.id; profile.stats.rolls++;
  return outcome(true, profile, duplicate ? `${ability.name} again. ${DUPLICATE_REFUND} clovers returned.` : `${ability.name} unlocked and equipped!`, { ability, duplicate, refund: duplicate ? DUPLICATE_REFUND : 0, spent: ROLL_COST - (duplicate ? DUPLICATE_REFUND : 0) });
}

/** Score rewards and a completed-match bonus. An optional stable ID prevents replay. */
export function award(raw, event = {}) {
  const profile = validateProfile(raw);
  if (!['score', 'win'].includes(event.type) || ![0, 1].includes(event.team)) return outcome(false, profile, 'No reward to collect.', { earned: 0 });
  const id = typeof event.rewardId === 'string' && event.rewardId.length <= 100 ? event.rewardId : null;
  if (id && profile.claimedRewards.includes(id)) return outcome(false, profile, 'Reward already collected.', { earned: 0 });
  let earned = 0;
  if (event.type === 'score' && event.team === 0) { profile.stats.points++; earned = 20; }
  if (event.type === 'win') {
    profile.stats.matches++;
    if (event.team === 0) { profile.stats.wins++; earned = 150; }
    else earned = 30;
  }
  profile.coins = Math.min(999999, profile.coins + earned);
  if (id) profile.claimedRewards = [...profile.claimedRewards, id].slice(-128);
  return outcome(true, profile, earned ? `+${earned} clovers earned.` : 'Keep the rally going.', { earned });
}

export const purchase = purchaseSkin;
export const roll = rollAbility;
export function equip(profile, selection) {
  return selection?.ability ? equipAbility(profile, selection.ability) : equipSkin(profile, typeof selection === 'string' ? selection : selection?.skin);
}

export function purchaseCosmetic(raw,id){
 const profile=validateProfile(raw),item=COSMETICS.find(c=>c.id===id);
 if(!item)return outcome(false,profile,'Unknown cosmetic.');
 if(profile.ownedCosmetics.includes(id))return equipCosmetic(profile,id);
 if(profile.coins<item.price)return outcome(false,profile,`You need ${item.price-profile.coins} more clovers.`);
 profile.coins-=item.price;profile.ownedCosmetics.push(id);profile.cosmetics[item.slot]=id;
 return outcome(true,profile,`${item.name} unlocked and equipped.`,{item,spent:item.price});
}
export function equipCosmetic(raw,id,slot){
 const profile=validateProfile(raw),item=COSMETICS.find(c=>c.id===id);
 if(id===null&&['hat','face','back'].includes(slot)){profile.cosmetics[slot]=null;return outcome(true,profile,'Cosmetic removed.');}
 if(!item||!profile.ownedCosmetics.includes(id))return outcome(false,profile,'Unlock this cosmetic first.');
 profile.cosmetics[item.slot]=id;return outcome(true,profile,`${item.name} equipped.`,{item});
}

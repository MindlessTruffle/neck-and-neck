import assert from 'node:assert/strict';
import { SKINS, ABILITY_CATALOG, createProfile, validateProfile, loadProfile, saveProfile, purchaseSkin, equipSkin, equipAbility, rollAbility, award } from '../src/profile.js';

const initial = createProfile();
assert.equal(initial.coins, 500);
assert.equal(SKINS.length, 8);
assert.equal(ABILITY_CATALOG.reduce((sum, ability) => sum + ability.odds, 0), 100);
assert.equal(new Set(SKINS.map(item => JSON.stringify(item.palette))).size, 8);
const dirty = validateProfile({ ...initial, coins: -90, ownedSkins: ['cosmic', 'fake', 'cosmic'], equippedSkin: 'fake', ownedAbilities: ['rocket', 'unknown'], equippedAbility: 'shield', stats: { wins: Infinity, matches: 2.1 }, claimedRewards: Array.from({ length: 150 }, (_, i) => `reward-${i}`), secret: 'ignored' });
assert.equal(dirty.coins, 0); assert.equal(dirty.equippedSkin, 'classic'); assert.equal(dirty.equippedAbility, 'magnet');
assert.deepEqual(dirty.ownedSkins, ['classic', 'cosmic']); assert.deepEqual(dirty.ownedAbilities, ['magnet', 'rocket']);
assert.equal(dirty.stats.wins, 0); assert.equal(dirty.claimedRewards.length, 128); assert.equal(dirty.secret, undefined);
assert.deepEqual(validateProfile({ ...initial, version: 999 }), initial);
assert.equal(purchaseSkin(initial, 'blossom').profile.coins, 320);
assert.equal(initial.coins, 500, 'transactions never mutate the caller');
const purchased = purchaseSkin(initial, 'blossom').profile;
assert.equal(purchaseSkin(purchased, 'blossom').ok, false); assert.equal(purchaseSkin(purchased, 'blossom').profile.coins, 320);
assert.equal(purchaseSkin(initial, 'cosmic').ok, false); assert.equal(purchaseSkin(initial, '__proto__').ok, false);
assert.equal(equipSkin(initial, 'cosmic').ok, false); assert.equal(equipSkin(purchased, 'blossom').profile.equippedSkin, 'blossom');
assert.equal(equipAbility(initial, 'shield').ok, false);
for (const [draw, expected] of [[0, 'magnet'], [.29999, 'magnet'], [.30, 'feather'], [.55, 'spring'], [.75, 'rocket'], [.90, 'shield'], [.999999, 'shield']]) {
  const result = rollAbility(initial, () => draw);
  assert.equal(result.ability.id, expected); assert.equal(result.profile.equippedAbility, expected);
  assert.equal(result.profile.coins, expected === 'magnet' ? 475 : 400);
  assert.equal(result.profile.stats.rolls, 1);
}
for (const draw of [NaN, Infinity, -1, 1, undefined]) { const result = rollAbility(initial, () => draw); assert.equal(result.ok, false); assert.equal(result.profile.coins, 500); }
assert.equal(rollAbility(initial, () => { throw new Error('rng'); }).profile.coins, 500);
assert.equal(rollAbility({ ...initial, coins: 99 }).ok, false);
const point = award(initial, { type: 'score', team: 0, rewardId: 'match1-point1' });
assert.equal(point.profile.coins, 520); assert.equal(point.profile.stats.points, 1);
assert.equal(award(point.profile, { type: 'score', team: 0, rewardId: 'match1-point1' }).profile.coins, 520);
assert.equal(award(point.profile, { type: 'win', team: 0 }).profile.coins, 670);
assert.equal(award(initial, { type: 'win', team: 1 }).profile.coins, 530);
assert.equal(award(initial, { type: 'purchase', team: 0 }).ok, false);
assert.equal(award({ ...initial, coins: 999990 }, { type: 'win', team: 0 }).profile.coins, 999999);
const storage = { value: null, getItem() { return this.value; }, setItem(key, value) { this.value = value; } };
assert.deepEqual(loadProfile(storage), initial); saveProfile(purchased, storage); assert.deepEqual(loadProfile(storage), purchased);
storage.value = '{broken'; assert.deepEqual(loadProfile(storage), initial);
const blocked = { getItem() { throw new Error('privacy'); }, setItem() { throw new Error('quota'); } };
assert.deepEqual(loadProfile(blocked), initial); assert.deepEqual(saveProfile(purchased, blocked), purchased);
console.log('PASS Profile: validated persistence, eight palettes, exact visible roll odds, duplicates/refunds, immutable transactions, ownership and reward replay protection.');

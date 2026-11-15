export const MAPS = [
  { id: 'meadow', name: 'Meadow', ground: '#86b753', stone: '#657a80', court: '#8ec269', sky: '#64bbdf', horizon: '#f4eac7', sun: '#fff0c7', foliage: '#3f875a', accent: '#ef9a67' },
  { id: 'jungle', name: 'Jungle', ground: '#458d66', stone: '#375b61', court: '#74b493', sky: '#4cbfbd', horizon: '#c7ebc5', sun: '#e5ffb1', foliage: '#207d62', accent: '#ff9e75' },
  { id: 'beach', name: 'Beach', ground: '#ead098', stone: '#b3906c', court: '#ffe2b8', sky: '#49bfea', horizon: '#fff2d1', sun: '#fff4cb', foliage: '#46a980', accent: '#fa8976' },
  { id: 'volcano', name: 'Volcano', ground: '#514653', stone: '#39394a', court: '#a57b9d', sky: '#535780', horizon: '#ffbe8b', sun: '#f2d4ef', foliage: '#75566b', accent: '#ff7034' },
  { id: 'mountain', name: 'Mountain', ground: '#a4b8b1', stone: '#6b7f95', court: '#e1eef7', sky: '#78b4df', horizon: '#f7ecde', sun: '#ffedcc', foliage: '#497d82', accent: '#db9d6d' },
];
export const getMap = id => MAPS.find(m => m.id === id) || MAPS[0];
export const chooseMap = (random = Math.random) => MAPS[Math.min(MAPS.length - 1, Math.max(0, Math.floor(random() * MAPS.length)))].id;

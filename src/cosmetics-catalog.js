export const SLOTS = ['hat','face','back','scarf','goal'];
const gear = (id,name,slot,price,color,trim,shape) => ({id,name,slot,price,color,trim,shape});
export const COSMETICS = [
  gear('cap','Club Cap','hat',80,'#39aaa9','#214b69'),
  gear('crown','Rally Royal','hat',180,'#edb335','#ffdb70'),
  gear('bucket','Beach Bucket','hat',100,'#e77f80','#ffe4ad'),
  gear('shades','Court Shades','face',70,'#19283d','#67c5df'),
  gear('hearts','Love All','face',100,'#e85d9e','#ffb8d4'),
  gear('pack','Cloud Pack','back',130,'#3cb5b4','#edb849'),
  gear('witch','Moon Witch','hat',240,'#514086','#ffce67','witch'),
  gear('mushroom','Amanita','hat',180,'#ef6451','#ffe8bb','mushroom'),
  gear('angler','Deep Sea Angler','hat',220,'#245572','#8cfff0','angler'),
  gear('snowcap','Ski Patrol','hat',120,'#d94159','#fff8dc','beanie'),
  gear('sunhat','Straw Boater','hat',100,'#e3b976','#f36d6d','boater'),
  gear('totem','Frog Prince','hat',250,'#72b879','#f9df79','frog'),
  gear('monocle','Clockmaker','face',160,'#e6ad4a','#8ae2de','monocle'),
  gear('visor','Solar Visor','face',180,'#632c67','#ffb335','visor'),
  gear('pilot','Air Mail','face',150,'#794e3b','#8cdce4','pilot'),
  gear('wings','Cloud Wings','back',320,'#f9f4df','#abd9f0','wings'),
  gear('batwing','Night Wings','back',320,'#6d4b9a','#d283c9','bat'),
  gear('tank','Reef Explorer','back',220,'#ffc349','#368f98','tank'),
  gear('satchel','Postmaster','back',140,'#ae6447','#ffe9b5','satchel'),
  gear('quiver','Bamboo Quiver','back',190,'#828751','#eda75e','quiver'),
  gear('trail','Trail Scout','scarf',85,'#e96847','#ffdb82','tie'),
  gear('tide','Sailor Stripe','scarf',100,'#294a77','#faf5da','stripe'),
  gear('aurora','Aurora Knit','scarf',135,'#7658af','#99ffe0','stripe'),
  gear('garden','Rose Ribbon','scarf',145,'#f17d9c','#fff0d4','bow'),
  gear('silk','Golden Bow','scarf',165,'#eaba44','#623b59','bow'),
  gear('comet','Comet Shower','goal',250,'#ff7545','#fff097','comet'),
  gear('sakura','Blossom Burst','goal',240,'#ed84ad','#ffddd6','petal'),
  gear('polar','Polar Flare','goal',280,'#70c5fb','#e2fff7','frost'),
  gear('starfall','Stardust','goal',350,'#af83ff','#fff1aa','star'),
];
export const getCosmetic = id => COSMETICS.find(item => item.id === id);
export function cleanCosmetics(value){
 return Object.fromEntries(SLOTS.map(slot=>[slot,getCosmetic(value?.[slot])?.slot===slot?value[slot]:null]));
}

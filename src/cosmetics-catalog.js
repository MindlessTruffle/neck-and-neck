export const COSMETICS=Object.freeze([
 {id:'cap',name:'Club Cap',slot:'hat',price:80,color:'#49b9b3'},
 {id:'crown',name:'Rally Royal',slot:'hat',price:180,color:'#f4c453'},
 {id:'bucket',name:'Beach Bucket',slot:'hat',price:100,color:'#ef8c8a'},
 {id:'shades',name:'Court Shades',slot:'face',price:70,color:'#73cde4'},
 {id:'hearts',name:'Love All',slot:'face',price:100,color:'#f3a1c7'},
 {id:'pack',name:'Cloud Pack',slot:'back',price:130,color:'#58bfc0'},
]);
export function cleanCosmetics(value){return Object.fromEntries(['hat','face','back'].map(slot=>[slot,COSMETICS.some(c=>c.id===value?.[slot]&&c.slot===slot)?value[slot]:null]));}

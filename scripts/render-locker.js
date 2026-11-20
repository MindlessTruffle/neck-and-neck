import {accessory,disposeAccessory} from '../src/accessory.js';
import {getAthlete,makeStudio} from '../src/wardrobe-studio.js';
import {COSMETICS} from '../src/cosmetics-catalog.js';
import {SKINS} from '../src/profile.js';
import {Box3} from 'three';
// Render inventory thumbnails using the mesh and materials displayed on court.
export async function renderCatalog(){
 const canvas=document.createElement('canvas'),studio=makeStudio(canvas);
 studio.renderer.setSize(224,224,false);const output={};
 for(const item of COSMETICS){
   const model=accessory(item.id);studio.scene.add(model);studio.fit(new Box3().setFromObject(model),item.slot==='back'?2.75:.42,.2);
   output[item.id]=canvas.toDataURL('image/webp',.90).split(',')[1];disposeAccessory(model);
 }
 studio.load(await getAthlete());
 for(const skin of SKINS){studio.show(skin.palette,{},.68);output['skin-'+skin.id]=canvas.toDataURL('image/webp',.90).split(',')[1];}
 studio.dispose();return output;
}

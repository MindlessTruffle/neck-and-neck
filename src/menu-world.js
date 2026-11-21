import {createAthleticVillage} from './athletic-village.js';
import { createSkyFerry } from './sky-ferry.js';
import { prepareWorldModel } from './environments.js';

export function createMenuWorld(root, model, textures, coarse = false) {
  prepareWorldModel(model, textures, coarse);
  root.add(model);
  const ferry=createSkyFerry(root), village=createAthleticVillage(root);
  return (time,reduced)=>{ferry(time,reduced);village(time,reduced);};
}

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const INK = '#28241f';

/** Shared cel materials and bounded, screen-width ink hulls. No postprocess pass. */
export function createToonStyle() {
  const rampBytes = new Uint8Array([38,38,38,255, 118,118,118,255, 194,194,194,255, 255,255,255,255]);
  const ramp = new THREE.DataTexture(rampBytes, 4, 1, THREE.RGBAFormat);
  ramp.minFilter = ramp.magFilter = THREE.NearestFilter; ramp.generateMipmaps = false; ramp.needsUpdate = true;
  const viewport = { value: new THREE.Vector2(1280, 720) };
  const materialCache = new Map(), inkCache = new Map(), ownedMaterials = new Set(), ownedGeometry = new Set();
  const batches = []; let outlineCount = 0, batchedMeshes = 0;

  function material(source, { unique = false } = {}) {
    if (source?.isMeshToonMaterial && !unique) return source;
    const key = typeof source === 'string' ? source : source?.uuid;
    if (!unique && materialCache.has(key)) return materialCache.get(key);
    const result = new THREE.MeshToonMaterial({
      color: typeof source === 'string' ? source : source?.color || '#ffffff',
      gradientMap: ramp,
      map: source?.map || null,
      alphaMap: source?.alphaMap || null,
      alphaTest: source?.alphaTest || 0,
      opacity: source?.opacity ?? 1,
      transparent: source?.transparent || false,
      side: source?.side ?? THREE.FrontSide,
      vertexColors: source?.vertexColors || false,
      depthWrite: source?.depthWrite ?? true,
      emissive: source?.emissive || '#000000',
      emissiveIntensity: Math.min(source?.emissiveIntensity ?? 0, .2),
    });
    const pigment = {}; result.color.getHSL(pigment);
    if (pigment.h > .17 && pigment.h < .47) result.color.setHSL(pigment.h - .025, pigment.s * .86, Math.min(.8, pigment.l + .015));
    if (pigment.s < .12 && pigment.l > .6) result.color.lerp(new THREE.Color('#f5e7c3'), .2);
    result.name = source?.name || `Cel_${source}`;
    result.userData.cel = true;
    ownedMaterials.add(result); if (!unique) materialCache.set(key, result); return result;
  }

  function inkMaterial(width) {
    if (inkCache.has(width)) return inkCache.get(width);
    const result = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide, fog: true, depthWrite: true });
    result.name = `Ink_${width}px`; result.toneMapped = false;
    result.onBeforeCompile = shader => {
      shader.uniforms.inkViewport = viewport; shader.uniforms.inkWidth = { value: width };
      shader.vertexShader = `uniform vec2 inkViewport;\nuniform float inkWidth;\n${shader.vertexShader}`;
      // Basic material only normally calculates normals for skin/env maps.
      // Enable the same normal path for static and instanced hulls as well.
      shader.vertexShader = shader.vertexShader.replace('#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )', '#if 1');
      shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
        vec2 inkNormal = -transformedNormal.xy;
        float inkLength = length(inkNormal);
        inkNormal = inkLength > 0.0001 ? inkNormal / inkLength : vec2(0.0);
        gl_Position.xy += inkNormal * (2.0 * inkWidth / inkViewport) * gl_Position.w;
        gl_Position.z += 0.00002 * gl_Position.w;
      `);
    };
    result.customProgramCacheKey = () => `meadow-ink-v1-${width}`;
    ownedMaterials.add(result); inkCache.set(width, result); return result;
  }

  function hullGeometry(meshes, root, skinned) {
    root.updateWorldMatrix(true, true);
    const inverse = root.matrixWorld.clone().invert(), parts = [];
    for (const object of meshes) {
      const part = new THREE.BufferGeometry();
      const attributes = skinned ? ['position','normal','skinIndex','skinWeight'] : ['position','normal'];
      if (attributes.some(name => !object.geometry.attributes[name])) continue;
      for (const name of attributes) part.setAttribute(name, object.geometry.attributes[name].clone());
      if (object.geometry.index) part.setIndex(object.geometry.index);
      if (!skinned) part.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, object.matrixWorld));
      parts.push(part);
    }
    if (!parts.length) return null;
    // All production glTFs are indexed. This also handles mixed user geometry.
    const indexed = parts.every(part => !!part.index), normalized = indexed ? parts : parts.map(part => part.index ? part.toNonIndexed() : part);
    const merged = mergeGeometries(normalized, false);
    if (merged) ownedGeometry.add(merged);
    return merged;
  }

  function ink(root, { width = 1.6, skinned = false, predicate = () => true } = {}) {
    const sources = [];
    root.traverse(object => { if (object.isMesh && !object.userData.isInk && !!object.isSkinnedMesh === skinned && predicate(object)) sources.push(object); });
    if (!sources.length) return null;
    const geometry = hullGeometry(sources, root, skinned); if (!geometry) return null;
    let outline;
    if (skinned) {
      const source = sources[0]; outline = new THREE.SkinnedMesh(geometry, inkMaterial(width));
      outline.skeleton = source.skeleton; outline.bindMode = source.bindMode;
      outline.bindMatrix.copy(source.bindMatrix); outline.bindMatrixInverse.copy(source.bindMatrixInverse);
      outline.position.copy(source.position); outline.quaternion.copy(source.quaternion); outline.scale.copy(source.scale);
      source.parent.add(outline); outline.frustumCulled = false;
    } else { outline = new THREE.Mesh(geometry, inkMaterial(width)); root.add(outline); }
    outline.name = 'CartoonInkHull'; outline.userData.isInk = true; outline.castShadow = false; outline.receiveShadow = false;
    outlineCount++; return outline;
  }

  function stylize(root, { width = 1.6, outline = true } = {}) {
    root.traverse(object => {
      if (!object.isMesh || object.userData.isInk) return;
      object.material = Array.isArray(object.material) ? object.material.map(source => material(source)) : material(object.material);
    });
    if (outline) ink(root, { width }); return root;
  }

  /** Instance repeated scenery and crowd pieces without changing their motion. */
  function batch(objects, parent, dynamic = false) {
    parent.updateMatrixWorld(true); const groups = new Map();
    for (const object of objects) {
      if (!object.isMesh || object.isSkinnedMesh || object.isInstancedMesh || Array.isArray(object.material)) continue;
      const key = `${object.geometry.uuid}/${object.material.uuid}/${object.castShadow}/${object.receiveShadow}`;
      if (!groups.has(key)) groups.set(key, []); groups.get(key).push(object);
    }
    for (const sources of groups.values()) {
      if (sources.length < 2) continue;
      const sample = sources[0], instance = new THREE.InstancedMesh(sample.geometry, sample.material, sources.length);
      instance.name = dynamic ? 'AnimatedCrowdBatch' : 'StaticSceneryBatch'; instance.castShadow = sample.castShadow; instance.receiveShadow = sample.receiveShadow; instance.frustumCulled = false;
      if (dynamic) instance.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      sources.forEach((object, i) => { instance.setMatrixAt(i, object.matrixWorld); object.visible = false; });
      parent.add(instance); batchedMeshes += sources.length; batches.push({ instance, sources, dynamic });
    }
  }

  function update(camera, width, height) {
    viewport.value.set(Math.max(1, width), Math.max(1, height));
    for (const batch of batches) if (batch.dynamic) {
      batch.sources.forEach((source, i) => { source.updateWorldMatrix(true, false); batch.instance.setMatrixAt(i, source.matrixWorld); });
      batch.instance.instanceMatrix.needsUpdate = true;
    }
  }
  function stats() { return { celMaterials: ownedMaterials.size - inkCache.size, inkHulls: outlineCount, batchDraws: batches.length, batchedMeshes }; }
  function dispose() { ramp.dispose(); ownedMaterials.forEach(item => item.dispose()); ownedGeometry.forEach(item => item.dispose()); batches.forEach(({ instance }) => { instance.removeFromParent(); instance.dispose(); }); batches.length = 0; }
  return { material, ink, stylize, batch, update, stats, dispose };
}

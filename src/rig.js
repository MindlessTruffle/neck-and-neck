import { createCosmeticRig } from './cosmetics-rig.js';
import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';

const UP = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);
const V = (point) => new THREE.Vector3(point.x, point.y, point.z);

/** Drives the Blender armature from the simulation's articulated chain. */
export class GiraffeRig {
  constructor(template, scene, index = 0, toon = null) {
    this.root = new THREE.Group();
    this.model = cloneSkeleton(template);
    this.root.add(this.model); scene.add(this.root);
    this.cosmetics=createCosmeticRig(this.root);
    this.index = index; this.yaw = Math.PI / 2; this.team = -1;
    this.gaitPhase = index * 1.7; this.moving = 0; this.headOrientation = null;
    this.bones = new Map(); this.materials = [];this.baseColors=new Map();this.skin=null;this.skinKey='';
    this.root.updateMatrixWorld(true);
    this.model.traverse(object => {
      if (object.isBone) {
        const point = object.getWorldPosition(new THREE.Vector3());
        const orientation = object.getWorldQuaternion(new THREE.Quaternion());
        this.bones.set(object.name, { bone: object, position: object.position.clone(), quaternion: object.quaternion.clone(), scale: object.scale.clone(), restPosition: point, restQuaternion: orientation });
      }
      if (object.isMesh) {
        object.castShadow = true; object.receiveShadow = true; object.frustumCulled = false;
        const copyMaterial = material => { const copy = toon ? toon.material(material, { unique: true }) : material.clone(); this.materials.push(copy);if(copy.color)this.baseColors.set(copy,copy.color.clone());return copy; };
        object.material = Array.isArray(object.material) ? object.material.map(copyMaterial) : copyMaterial(object.material);
      }
    });
    for (const record of this.bones.values()) {
      const next = record.bone.children.find(child => child.isBone);
      const end = next ? next.getWorldPosition(new THREE.Vector3()) : record.restPosition.clone().add(new THREE.Vector3(0, .35, 0));
      record.length = Math.max(.025, end.distanceTo(record.restPosition));
      record.axis = end.sub(record.restPosition).normalize().applyQuaternion(record.restQuaternion.clone().invert());
    }
    this.neck = Array.from({ length: 8 }, (_, i) => this.bones.get(`Neck_${String(i).padStart(2, '0')}`)).filter(Boolean);
    this.head = this.bones.get('Head');
    this._renderNeckPoints = Array.from({ length: 9 }, () => new THREE.Vector3());
    this._renderHead = new THREE.Vector3();
    this._bodyYawQuaternion = new THREE.Quaternion();
    this._tumbleQuaternion = new THREE.Quaternion();
    this.legs = ['Front_L', 'Front_R', 'Back_L', 'Back_R'].map(name => ({ upper: this.bones.get(`${name}_Upper`), lower: this.bones.get(`${name}_Lower`), front: name.startsWith('Front') ? 1 : -1, side: name.includes('_L') ? -1 : 1 })).filter(leg => leg.upper && leg.lower);
    this.legs.forEach(leg => {
      leg.restFoot = new THREE.Vector3(leg.side * .37, .15, leg.front > 0 ? .56 : -.57);
      leg.lower.length = leg.restFoot.distanceTo(leg.lower.restPosition);
      leg.lower.axis.copy(leg.restFoot).sub(leg.lower.restPosition).normalize().applyQuaternion(leg.lower.restQuaternion.clone().invert());
    });
    this.ink = toon?.ink(this.model, { width: index === 0 ? 3.6 : 2.7, skinned: true });
  }
  setSkin(palette=null) {
    if(palette&&typeof palette!=='object')return;
    const key=JSON.stringify(palette||{})+this.team;if(key===this.skinKey)return;
    this.skin=palette;this.skinKey=key;
    for(const material of this.materials){
      if(!material.color)continue;
      material.color.copy(this.baseColors.get(material));
      const name=material.name;
      const field=/GoldenCoat/i.test(name)?'body':/CaramelPatches/i.test(name)?'spots':/WarmMuzzle|Cream/i.test(name)?'muzzle':/TeamScarf/i.test(name)?'scarf':/TeamTrim/i.test(name)?'accent':null;
      if(field&&palette?.[field])material.color.set(palette[field]);
      else if(/TeamScarf|TeamTrim/i.test(name)&&this.team!==-1)material.color.set(this.team===0?'#238d8c':'#e3684f');
    }
  }

  poseSegment(record, start, end, stretch = false) {
    const { bone } = record;
    bone.parent.updateWorldMatrix(true, false);
    const parentQ = bone.parent.getWorldQuaternion(new THREE.Quaternion());
    const actorQ = this.root.getWorldQuaternion(new THREE.Quaternion());
    const referenceQ = actorQ.multiply(record.restQuaternion);
    const restDirection = record.axis.clone().applyQuaternion(referenceQ);
    const targetDirection = end.clone().sub(start).normalize();
    const worldQ = new THREE.Quaternion().setFromUnitVectors(restDirection, targetDirection).multiply(referenceQ);
    bone.position.copy(bone.parent.worldToLocal(start.clone()));
    bone.quaternion.copy(parentQ.invert().multiply(worldQ));
    bone.scale.copy(record.scale);
    // The translated joints stretch the continuous, blended skin naturally.
    // Keep bone scale uniform so chained nonuniform transforms cannot shear it.
    bone.updateMatrix(); bone.updateWorldMatrix(false, true);
  }

  update(player, dt, time) {
    this.root.visible = !!player; if (!player) return;
    if (this.team !== player.team) {
      this.team = player.team;
      this.skinKey='';
    }
    this.setSkin(player.skin&&typeof player.skin==='object'?player.skin:this.skin);
    // Restore the bind pose before posing children in hierarchy order.
    for (const r of this.bones.values()) { r.bone.position.copy(r.position); r.bone.quaternion.copy(r.quaternion); r.bone.scale.copy(r.scale); }
    const dive=THREE.MathUtils.clamp(player.dive||0,0,1),bounce=THREE.MathUtils.clamp(player.setBounce||0,0,1),knock=THREE.MathUtils.clamp(player.knockback||0,0,1),tumble=player.tumble||0;
    const speed = Math.hypot(player.vx || 0, player.vz || 0);
    this.moving = THREE.MathUtils.lerp(this.moving, Math.min(1, speed / 5), 1 - Math.exp(-dt * 13));
    const moving = this.moving;
    const targetYaw = Number.isFinite(player.bodyYaw)?Math.PI/2-player.bodyYaw:(player.team===0?Math.PI/2:-Math.PI/2);
    const normalTurn = targetYaw + THREE.MathUtils.clamp((player.vz || 0) * (player.team ? .08 : -.08), -.4, .4);
    const diveYaw=Math.atan2(player._diveX??0,player._diveZ??1);
    const turn=normalTurn+Math.atan2(Math.sin(diveYaw-normalTurn),Math.cos(diveYaw-normalTurn))*dive;
    this.yaw += Math.atan2(Math.sin(turn - this.yaw), Math.cos(turn - this.yaw)) * (1 - Math.exp(-dt * 8));
    this.root.position.set(player.x,(player.y||0)+dive*.38,player.z);
    this.root.rotation.set(dive*.38+Math.sin(tumble)*knock*.25,this.yaw+tumble*.35,dive*1.5+tumble*.7,'YXZ');
    const body=this.bones.get('Body');
    if(body){
      const phase=player._setBounceTime>0?1-player._setBounceTime/.58:0;
      body.bone.position.y-=Math.sin(phase*Math.PI*2)*.16;
      body.bone.scale.set(body.scale.x*(1+bounce*.1),body.scale.y*(1-bounce*.16),body.scale.z*(1+bounce*.08));
    }
    this.root.updateMatrixWorld(true);
    this.gaitPhase += dt * (7 + speed * .55) * (.2 + moving * .8);
    const gait = this.gaitPhase;
    this.legs.forEach((leg, i) => {
      const phase = gait + (i === 0 || i === 3 ? 0 : Math.PI);
      const hipLocal = leg.upper.restPosition.clone();
      const kneeLocal = leg.lower.restPosition.clone();
      const footLocal = leg.restFoot.clone();
      // Blender's hoof center is y=.15, with its sole resting on y=0.
      footLocal.y = .15 + Math.max(0, Math.cos(phase)) * .30 * moving + Math.min(player.y || 0, .7) * .12;
      footLocal.z += Math.sin(phase) * .3 * moving;
      footLocal.x += leg.side * (Math.min(player.y || 0, 1) * .06+dive*.55+knock*.3);
      footLocal.y += dive*.7+knock*(.55+Math.sin(time*15+i)*.2)-bounce*.1;
      footLocal.z += leg.front*dive*.32+Math.sin(time*13+i)*knock*.25;
      const upperLength = hipLocal.distanceTo(kneeLocal), lowerLength = leg.lower.length;
      const hip = leg.upper.bone.getWorldPosition(new THREE.Vector3()), foot = this.root.localToWorld(footLocal);
      const delta = foot.clone().sub(hip), distance = Math.min(delta.length(), upperLength + lowerLength - .005), direction = delta.normalize();
      const along = (upperLength * upperLength - lowerLength * lowerLength + distance * distance) / (2 * Math.max(.02, distance));
      const bend = Z.clone().multiplyScalar(leg.front).applyQuaternion(this.root.quaternion);
      bend.addScaledVector(direction, -bend.dot(direction)).normalize();
      const knee = hip.clone().addScaledVector(direction, along).addScaledVector(bend, Math.sqrt(Math.max(.001, upperLength * upperLength - along * along)));
      this.poseSegment(leg.upper, hip, knee); this.poseSegment(leg.lower, knee, foot);
    });
    const points = player.neckPoints;
    if (points?.length >= 9) {
      // Celebration tumble rotates the full rig. The simulated neck chain remains
      // in world space, so carry its rendered joints through the same body rotation
      // before posing the skeleton; otherwise the torso spins away from its neck.
      if (knock) {
        this._bodyYawQuaternion.setFromEuler(new THREE.Euler(0, this.yaw, 0, 'YXZ')).invert();
        this._tumbleQuaternion.copy(this.root.quaternion).multiply(this._bodyYawQuaternion);
        for (let i = 0; i < 9; i++) this._renderNeckPoints[i].copy(V(points[i])).sub(this.root.position).applyQuaternion(this._tumbleQuaternion).add(this.root.position);
      } else {
        for (let i = 0; i < 9; i++) this._renderNeckPoints[i].copy(V(points[i]));
      }
      this.neck.forEach((record, i) => this.poseSegment(record, this._renderNeckPoints[i], this._renderNeckPoints[i + 1], true));
    } else {
      // Loading poses use the same armature, never a replacement character.
      const first = this.root.localToWorld(new THREE.Vector3(0, 1.45, .22));
      const last = player.head ? V(player.head) : this.root.localToWorld(new THREE.Vector3(0, 2.9, .35));
      this.neck.forEach((record, i) => this.poseSegment(record, first.clone().lerp(last, i / 8), first.clone().lerp(last, (i + 1) / 8)));
    }
    if (this.head && player.head) {
      const record = this.head, bone = record.bone;
      bone.parent.updateWorldMatrix(true, false);
      const headPoint = knock
        ? this._renderHead.copy(V(player.head)).sub(this.root.position).applyQuaternion(this._tumbleQuaternion).add(this.root.position)
        : V(player.head);
      bone.position.copy(bone.parent.worldToLocal(headPoint));
      const aimYaw = player.neck?.yaw ?? (player.team ? Math.PI : 0), pitch = player.neck?.pitch || 0;
      let yaw = aimYaw;
      if (points?.length >= 9) {
        const a = points[7], b = points[8], dx = b.x - a.x, dz = b.z - a.z;
        if (Math.hypot(dx, dz) > .035) yaw += Math.atan2(Math.sin(Math.atan2(dz, dx) - aimYaw), Math.cos(Math.atan2(dz, dx) - aimYaw)) * .24;
      }
      const wanted = new THREE.Quaternion().setFromEuler(new THREE.Euler(-pitch, Math.PI / 2 - yaw, 0, 'YXZ')).multiply(record.restQuaternion);
      if (knock) wanted.premultiply(this._tumbleQuaternion);
      if (!this.headOrientation) this.headOrientation = wanted.clone();
      this.headOrientation.slerp(wanted, 1 - Math.exp(-dt * 13));
      bone.quaternion.copy(bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(this.headOrientation));
      const swing = player.swing || 0;
      bone.scale.set(1 + swing * .035, 1 - swing * .045, 1 + swing * .025);
    }
    const tail = this.bones.get('Tail_00');
    if (tail) tail.bone.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(UP, Math.sin(time * 5 + this.index) * .22));
    this.cosmetics.set(player.cosmetics);this.cosmetics.update(player,knock?this._renderHead:null,knock?this._tumbleQuaternion:null);
    this.root.updateMatrixWorld(true);
  }
  dispose() { this.cosmetics.dispose();this.root.removeFromParent(); this.materials.forEach(material => material.dispose()); }
}

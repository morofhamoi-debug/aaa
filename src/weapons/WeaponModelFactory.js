import * as THREE from 'three';

const MATERIAL = {
  darkMetal: new THREE.MeshStandardMaterial({ color: 0x252a2b, metalness: 0.82, roughness: 0.36 }),
  steel: new THREE.MeshStandardMaterial({ color: 0x697276, metalness: 0.9, roughness: 0.3 }),
  polymer: new THREE.MeshStandardMaterial({ color: 0x171c1e, metalness: 0.08, roughness: 0.82 }),
  rubber: new THREE.MeshStandardMaterial({ color: 0x090c0d, metalness: 0.02, roughness: 0.98 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x68472d, metalness: 0.02, roughness: 0.82 }),
  skin: new THREE.MeshStandardMaterial({ color: 0xb98263, roughness: 0.72, metalness: 0 }),
  sleeve: new THREE.MeshStandardMaterial({ color: 0x424b48, roughness: 0.92, metalness: 0.01 }),
  sleeveDark: new THREE.MeshStandardMaterial({ color: 0x252d2c, roughness: 0.95, metalness: 0.01 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x536e78, metalness: 0.45, roughness: 0.14, transparent: true, opacity: 0.6 })
};

function addBox(parent, name, size, position, material, bevel = 0) {
  const geometry = new THREE.BoxGeometry(...size);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (bevel > 0) mesh.userData.bevelHint = bevel;
  parent.add(mesh);
  return mesh;
}

function addCylinder(parent, name, radiusTop, radiusBottom, length, position, rotation, material, segments = 12) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, length, segments), material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function addSegment(parent, name, start, end, radius, material, segments = 8) {
  const a = new THREE.Vector3(...start);
  const b = new THREE.Vector3(...end);
  const direction = new THREE.Vector3().subVectors(b, a);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.88, radius, direction.length(), segments), material);
  mesh.name = name;
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function buildHands(parent) {
  const hands = new THREE.Group();
  hands.name = 'ProceduralFirstPersonHands';
  hands.userData.ignoreRaycast = true;
  const makeArm = (side) => {
    const sign = side === 'right' ? 1 : -1;
    const shoulder = [sign * 0.56, -0.51, 0.04];
    const wrist = [sign * (side === 'right' ? 0.29 : 0.12), -0.24, side === 'right' ? -0.1 : -0.39];
    const armGroup = new THREE.Group();
    armGroup.name = `${side[0].toUpperCase()}${side.slice(1)}ArmRig`;
    addSegment(armGroup, `${side} sleeve forearm`, shoulder, wrist, 0.105, MATERIAL.sleeve, 10);
    addSegment(armGroup, `${side} cuff`, [wrist[0] + sign * 0.025, wrist[1] + 0.025, wrist[2] + 0.01], wrist, 0.108, MATERIAL.sleeveDark, 10);
    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.095, 12, 10), MATERIAL.skin);
    palm.name = `${side} palm volume`;
    palm.position.set(wrist[0], wrist[1] - 0.012, wrist[2] - 0.035);
    palm.scale.set(0.78, 0.72, 1.18);
    palm.castShadow = true;
    armGroup.add(palm);
    const fingerBase = [wrist[0], wrist[1] - 0.04, wrist[2] - 0.1];
    for (let finger = 0; finger < 4; finger++) {
      const spread = (finger - 1.5) * 0.038;
      const base = [fingerBase[0] + spread, fingerBase[1] - 0.01, fingerBase[2] - finger * 0.009];
      const mid = [base[0] + sign * 0.012, base[1] - 0.068, base[2] - 0.015];
      const tip = [base[0] + sign * 0.018, base[1] - 0.125, base[2] + 0.015];
      addSegment(armGroup, `${side} finger ${finger + 1} proximal`, base, mid, 0.019, MATERIAL.skin, 7);
      addSegment(armGroup, `${side} finger ${finger + 1} distal`, mid, tip, 0.014, MATERIAL.skin, 7);
    }
    const thumbStart = [wrist[0] - sign * 0.065, wrist[1] - 0.01, wrist[2] - 0.055];
    const thumbMiddle = [wrist[0] - sign * 0.105, wrist[1] - 0.055, wrist[2] - 0.105];
    const thumbTip = [wrist[0] - sign * 0.07, wrist[1] - 0.105, wrist[2] - 0.145];
    addSegment(armGroup, `${side} thumb proximal`, thumbStart, thumbMiddle, 0.023, MATERIAL.skin, 8);
    addSegment(armGroup, `${side} thumb distal`, thumbMiddle, thumbTip, 0.018, MATERIAL.skin, 8);
    return armGroup;
  };
  hands.add(makeArm('right'));
  hands.add(makeArm('left'));
  parent.add(hands);
  return hands;
}

function buildWeaponMesh(config) {
  const root = new THREE.Group();
  root.name = `${config.id.toUpperCase()}_OriginalProceduralViewModel`;
  root.userData.ignoreRaycast = true;
  const isPistol = config.family === 'pistol' || config.family === 'heavyPistol';
  const isKnife = config.family === 'knife';
  const isShotgun = config.family === 'shotgun';
  const bodyLength = config.bodyLength;
  const bodyWidth = isPistol ? 0.115 : 0.14;
  const bodyHeight = isPistol ? 0.105 : 0.13;

  if (isKnife) {
    const handle = addBox(root, 'knife textured grip', [0.075, 0.085, 0.22], [0, -0.01, -0.02], MATERIAL.rubber);
    handle.rotation.x = -0.12;
    const blade = new THREE.Mesh(new THREE.BufferGeometry(), MATERIAL.steel);
    const shape = new THREE.Shape();
    shape.moveTo(-0.035, 0); shape.lineTo(0.04, 0); shape.lineTo(0.024, 0.36); shape.lineTo(-0.006, 0.43); shape.lineTo(-0.035, 0.1); shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.012, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.004, bevelThickness: 0.004 });
    geometry.rotateX(Math.PI / 2);
    blade.geometry.dispose();
    blade.geometry = geometry;
    blade.name = 'knife faceted blade';
    blade.position.set(0, 0.025, -0.12);
    root.add(blade);
  } else {
    const bodyMat = config.family === 'ak' || config.stock === 'wood' ? MATERIAL.wood : MATERIAL.polymer;
    const receiver = addBox(root, 'receiver housing', [bodyWidth, bodyHeight, bodyLength * 0.66], [0, 0, -bodyLength * 0.2], MATERIAL.darkMetal);
    const upper = addBox(root, 'upper receiver', [bodyWidth * 0.88, bodyHeight * 0.45, bodyLength * 0.64], [0, bodyHeight * 0.56, -bodyLength * 0.2], MATERIAL.steel);
    addBox(root, 'dust cover / slide', [bodyWidth * 0.65, 0.035, bodyLength * 0.4], [0, bodyHeight * 0.88, -bodyLength * 0.18], MATERIAL.darkMetal);
    addBox(root, 'rear grip', [bodyWidth * 0.72, isPistol ? 0.17 : 0.19, 0.115], [0, -0.11, 0.015], bodyMat).rotation.x = -0.18;
    addBox(root, 'trigger guard upper', [0.1, 0.018, 0.085], [0, -0.16, -0.12], MATERIAL.steel);
    addBox(root, 'trigger guard forward', [0.018, 0.075, 0.018], [0.045, -0.19, -0.16], MATERIAL.steel);
    addBox(root, 'trigger guard rear', [0.018, 0.075, 0.018], [-0.045, -0.19, -0.16], MATERIAL.steel);
    addBox(root, 'trigger', [0.018, 0.065, 0.018], [0, -0.19, -0.145], MATERIAL.steel);

    if (!isPistol) {
      const barrelStart = -bodyLength * 0.48;
      addCylinder(root, 'barrel outer', 0.034, 0.034, config.barrelLength, [0, 0.025, barrelStart - config.barrelLength * 0.5], [Math.PI / 2, 0, 0], MATERIAL.darkMetal, 16);
      addCylinder(root, 'muzzle ring', 0.042, 0.042, 0.045, [0, 0.025, barrelStart - config.barrelLength + 0.02], [Math.PI / 2, 0, 0], MATERIAL.steel, 16);
      addBox(root, 'handguard', [bodyWidth * 0.94, bodyHeight * 0.92, config.barrelLength * 0.58], [0, -0.005, barrelStart - config.barrelLength * 0.3], bodyMat);
      for (let rail = 0; rail < 5; rail++) addBox(root, `handguard rail rib ${rail}`, [bodyWidth * 1.04, 0.016, 0.035], [0, 0.065, barrelStart - 0.08 - rail * 0.09], MATERIAL.steel);
      const stockLength = config.family === 'sniper' ? 0.34 : 0.26;
      addBox(root, 'stock body', [bodyWidth * 0.82, bodyHeight * 0.85, stockLength], [0, 0.01, bodyLength * 0.33], config.stock === 'wood' ? MATERIAL.wood : MATERIAL.polymer);
      addBox(root, 'stock shoulder pad', [bodyWidth * 0.95, bodyHeight * 0.95, 0.035], [0, 0.012, bodyLength * 0.33 + stockLength * 0.5], MATERIAL.rubber);
      if (config.magazineStyle !== 'tube') {
        const magLength = config.magazineStyle === 'curved' ? 0.24 : 0.2;
        const mag = addBox(root, 'detachable magazine', [0.105, magLength, 0.13], [0, -0.205, -0.06], MATERIAL.darkMetal);
        root.userData.magazine = mag;
        root.userData.magazineRestY = mag.position.y;
        if (config.magazineStyle === 'curved') mag.rotation.x = -0.18;
        addBox(root, 'magazine floor plate', [0.11, 0.018, 0.135], [0, -0.205 - magLength / 2, -0.06], MATERIAL.steel);
        for (let rib = 0; rib < 3; rib++) addBox(root, `magazine rib ${rib}`, [0.11, 0.012, 0.012], [0, -0.15 - rib * 0.04, 0.01], MATERIAL.steel);
      } else {
        addCylinder(root, 'shotgun tube magazine', 0.045, 0.045, 0.52, [0, -0.11, -0.33], [Math.PI / 2, 0, 0], MATERIAL.darkMetal, 12);
      }
      addBox(root, 'top sight rail', [0.075, 0.022, bodyLength * 0.62], [0, 0.105, -0.18], MATERIAL.steel);
      addBox(root, 'rear sight block', [0.11, 0.065, 0.055], [0, 0.15, 0.08], MATERIAL.darkMetal);
      addBox(root, 'front sight block', [0.035, 0.07, 0.045], [0, 0.145, barrelStart - config.barrelLength * 0.62], MATERIAL.darkMetal);
    } else {
      addCylinder(root, 'pistol barrel', 0.027, 0.027, config.barrelLength, [0, 0.015, -0.23 - config.barrelLength * 0.35], [Math.PI / 2, 0, 0], MATERIAL.steel, 14);
      addBox(root, 'pistol slide', [bodyWidth * 0.95, 0.075, bodyLength * 0.84], [0, 0.065, -0.045], MATERIAL.steel);
      addBox(root, 'pistol grip', [0.095, 0.19, 0.13], [0, -0.105, 0.055], bodyMat).rotation.x = -0.22;
      addBox(root, 'pistol magazine base', [0.09, 0.018, 0.1], [0, -0.205, 0.055], MATERIAL.steel);
      for (let notch = 0; notch < 4; notch++) addBox(root, `slide serration ${notch}`, [0.012, 0.046, 0.012], [0.062, 0.072, 0.055 + notch * 0.025], MATERIAL.darkMetal);
    }

    if (config.suppressor) {
      addCylinder(root, 'suppressor tube', isPistol ? 0.05 : 0.065, isPistol ? 0.05 : 0.065, isPistol ? 0.28 : 0.32, [0, 0.025, -config.barrelLength - 0.02], [Math.PI / 2, 0, 0], MATERIAL.darkMetal, 20);
      addCylinder(root, 'suppressor end cap', isPistol ? 0.052 : 0.067, isPistol ? 0.052 : 0.067, 0.025, [0, 0.025, -config.barrelLength - (isPistol ? 0.16 : 0.18)], [Math.PI / 2, 0, 0], MATERIAL.steel, 20);
    }
    if (config.scope) {
      addBox(root, 'optic mount', [0.12, 0.055, 0.2], [0, 0.19, -0.22], MATERIAL.darkMetal);
      addCylinder(root, 'scope housing', 0.075, 0.075, 0.32, [0, 0.26, -0.25], [Math.PI / 2, 0, 0], MATERIAL.darkMetal, 20);
      addCylinder(root, 'scope lens', 0.061, 0.061, 0.008, [0, 0.26, -0.415], [Math.PI / 2, 0, 0], MATERIAL.glass, 20);
    }
  }

  const muzzle = new THREE.Object3D();
  muzzle.name = 'MuzzleAttachment';
  muzzle.position.set(0, 0.025, -Math.max(0.45, config.barrelLength + 0.18));
  root.add(muzzle);
  const eject = new THREE.Object3D();
  eject.name = 'ShellEjectionAttachment';
  eject.position.set(0.13, 0.07, -0.08);
  root.add(eject);
  const sight = new THREE.Object3D();
  sight.name = 'SightAttachment';
  sight.position.set(0, 0.18, -0.22);
  root.add(sight);
  root.userData.attachments = { muzzle, eject, sight };
  return root;
}

export function createWeaponViewModel(config) {
  const root = new THREE.Group();
  root.name = `ViewModelRig_${config.id}`;
  root.userData.ignoreRaycast = true;
  const weapon = buildWeaponMesh(config);
  const hands = buildHands(root);
  root.add(weapon);
  root.userData.weaponMesh = weapon;
  root.userData.hands = hands;
  root.userData.attachments = weapon.userData.attachments;
  root.userData.magazine = weapon.userData.magazine ?? null;
  root.userData.magazineRestY = weapon.userData.magazineRestY ?? null;
  root.position.set(...config.viewPosition);
  root.rotation.set(...config.viewRotation);
  return root;
}

export function createWorldWeaponModel(config) {
  const model = buildWeaponMesh(config);
  model.name = `WorldWeapon_${config.id}`;
  model.userData.worldWeapon = true;
  model.scale.setScalar(1.0);
  return model;
}

// city.js — Coral Bay itself: a flat island grid in the sea with five
// districts (Downtown towers, the Neon Mile shops, the Marina boardwalk,
// Coral Beach, Palm Heights suburbs and the Port), roads with markings and
// traffic lights, palms, lamps, benches, a canal with bridges, piers and
// boats, stunt ramps and twenty hidden golden shells. Everything is
// generated from the fixed seed, and every solid thing registers a
// collider here so the player, cars and traffic all bump into the same city.
(function () {
  'use strict';
  window.CBH = window.CBH || {};
  const C = CBH.config;
  const R = CBH.rng;
  const M = CBH.math;

  const boxColliders = [];   // {x1,z1,x2,z2}
  const circleColliders = []; // {x,z,r}
  const windowMaterials = []; // facade materials whose emissive follows night
  let seaMesh = null;
  let seaTime = 0;
  const animatedBoats = [];

  const BLOCK_X = [[-193, -127], [-113, -47], [-33, 33], [47, 113], [127, 193]];
  const BLOCK_Z = [[-193, -127], [-113, -47], [-33, 33], [47, 113], [127, 193]];

  function addBoxCollider(x1, z1, x2, z2) {
    boxColliders.push({ x1: Math.min(x1, x2), z1: Math.min(z1, z2), x2: Math.max(x1, x2), z2: Math.max(z1, z2) });
  }

  function addCircleCollider(x, z, r) {
    circleColliders.push({ x: x, z: z, r: r });
  }

  // Push a circle (x,z,radius) out of every collider; returns the corrected
  // position and whether anything was hit (and how hard, for crash sounds).
  function collideCircle(x, z, radius) {
    let hit = false;
    for (let i = 0; i < boxColliders.length; i++) {
      const b = boxColliders[i];
      const nearestX = M.clamp(x, b.x1, b.x2);
      const nearestZ = M.clamp(z, b.z1, b.z2);
      const dx = x - nearestX;
      const dz = z - nearestZ;
      const d2 = dx * dx + dz * dz;
      if (d2 < radius * radius) {
        hit = true;
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2);
          x = nearestX + (dx / d) * radius;
          z = nearestZ + (dz / d) * radius;
        } else {
          // Centre inside the box: push out along the smallest exit.
          const left = x - b.x1, right = b.x2 - x, top = z - b.z1, bottom = b.z2 - z;
          const minExit = Math.min(left, right, top, bottom);
          if (minExit === left) x = b.x1 - radius;
          else if (minExit === right) x = b.x2 + radius;
          else if (minExit === top) z = b.z1 - radius;
          else z = b.z2 + radius;
        }
      }
    }
    for (let i = 0; i < circleColliders.length; i++) {
      const c = circleColliders[i];
      const dx = x - c.x;
      const dz = z - c.z;
      const rr = radius + c.r;
      const d2 = dx * dx + dz * dz;
      if (d2 < rr * rr && d2 > 0.0001) {
        const d = Math.sqrt(d2);
        x = c.x + (dx / d) * rr;
        z = c.z + (dz / d) * rr;
        hit = true;
      }
    }
    return { x: x, z: z, hit: hit };
  }

  function isPointInWater(x, z) {
    const half = C.WORLD.islandHalf + 6;
    if (Math.abs(x) > half || Math.abs(z) > half) return true;
    if (isInCanal(x, z)) return true;
    return false;
  }

  function isInCanal(x, z) {
    // The canal cuts the north-east corner from x=150 to the east shore.
    if (x > 150 && z > -178 && z < -158) {
      if (x > 191 && x < 209) return false; // avenue bridge deck
      if (x > 237 && x < 255) return false; // coast road bridge deck
      return true;
    }
    return false;
  }

  function nearestRoadDistance(x, z) {
    let best = 1e9;
    for (let i = 0; i < C.AVENUES_X.length; i++) best = Math.min(best, Math.abs(x - C.AVENUES_X[i]));
    for (let i = 0; i < C.STREETS_Z.length; i++) best = Math.min(best, Math.abs(z - C.STREETS_Z[i]));
    return best;
  }

  function districtAt(x, z) {
    if (z > 200) return 'marina';
    if (x < -200) return 'beach';
    if (x > 200) return 'port';
    if (z < -200) return 'suburbs';
    if (Math.abs(x) <= 120 && Math.abs(z) <= 120) return Math.abs(x) <= 46 || Math.abs(z) <= 46 ? 'shops' : 'downtown';
    if (z <= -127) return 'suburbs';
    if (x >= 127) return 'port';
    if (x <= -127) return 'beach';
    if (z >= 127) return 'marina';
    return 'shops';
  }

  function blockDistrict(cx, cz) {
    return districtAt(cx, cz);
  }

  // ---- canvas facade textures -------------------------------------------
  function makeFacadeTextures(baseColorHex, floors, shopFront) {
    const base = new THREE.Color(baseColorHex);
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#' + base.getHexString();
    ctx.fillRect(0, 0, 128, 256);
    // subtle vertical shading
    const grad = ctx.createLinearGradient(0, 0, 128, 0);
    grad.addColorStop(0, 'rgba(0,0,0,0.16)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.05)');
    grad.addColorStop(1, 'rgba(0,0,0,0.20)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 256);

    const glowCanvas = document.createElement('canvas');
    glowCanvas.width = 128;
    glowCanvas.height = 256;
    const gtx = glowCanvas.getContext('2d');
    gtx.fillStyle = '#000000';
    gtx.fillRect(0, 0, 128, 256);

    const rows = Math.max(2, floors);
    const cols = 5;
    const winW = 14, winH = 12;
    const stepX = 128 / cols;
    const stepY = (shopFront ? 200 : 236) / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const wx = c * stepX + (stepX - winW) / 2;
        const wy = 10 + r * stepY;
        const lit = R.chance(0.42);
        ctx.fillStyle = lit ? '#bfe6f5' : '#33505e';
        ctx.fillRect(wx, wy, winW, winH);
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(wx, wy, winW, 3);
        if (R.chance(0.5)) {
          gtx.fillStyle = R.chance(0.5) ? '#ffd98a' : '#a8d8ff';
          gtx.fillRect(wx, wy, winW, winH);
        }
      }
    }
    if (shopFront) {
      // Awning + shopfront glass at street level.
      ctx.fillStyle = '#' + new THREE.Color(R.pick([0xd94f6d, 0x2ea8a0, 0xf2a13c, 0x7a5fd0])).getHexString();
      ctx.fillRect(0, 216, 128, 14);
      ctx.fillStyle = '#9fd8e8';
      ctx.fillRect(6, 232, 116, 20);
      gtx.fillStyle = '#ffe2a8';
      gtx.fillRect(6, 232, 116, 20);
    }
    const map = new THREE.CanvasTexture(canvas);
    const emissiveMap = new THREE.CanvasTexture(glowCanvas);
    return { map: map, emissiveMap: emissiveMap };
  }

  function facadeMaterial(palette, floors, shopFront) {
    const textures = makeFacadeTextures(R.pick(palette), floors, shopFront);
    const material = new THREE.MeshLambertMaterial({
      map: textures.map,
      emissive: 0xffca7a,
      emissiveMap: textures.emissiveMap,
      emissiveIntensity: 0,
    });
    windowMaterials.push(material);
    return material;
  }

  function setNightWindowGlow(amount) {
    for (let i = 0; i < windowMaterials.length; i++) {
      windowMaterials[i].emissiveIntensity = amount * 0.95;
    }
  }

  // ---- shared geometry/material caches ----------------------------------
  const boxGeoCache = {};
  function boxGeometry(w, h, d) {
    const key = w + 'x' + h + 'x' + d;
    if (!boxGeoCache[key]) boxGeoCache[key] = new THREE.BoxGeometry(w, h, d);
    return boxGeoCache[key];
  }
  const materialCache = {};
  function flatMaterial(color) {
    if (!materialCache[color]) materialCache[color] = new THREE.MeshLambertMaterial({ color: color });
    return materialCache[color];
  }

  function addBox(parent, w, h, d, x, y, z, material) {
    const mesh = new THREE.Mesh(boxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }

  // ---- ground, sea, roads -------------------------------------------------
  function buildGroundAndSea(scene) {
    // The sea: one huge animated plane.
    const seaMaterial = new THREE.MeshLambertMaterial({ color: 0x1a6f9e });
    seaMesh = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), seaMaterial);
    seaMesh.rotation.x = -Math.PI / 2;
    seaMesh.position.y = C.WORLD.seaLevel;
    scene.add(seaMesh);
    CBH.sky.registerSeaMaterial(seaMaterial);

    // Sandy island slab with a beach rim.
    const sand = new THREE.Mesh(boxGeometry(574, 1.2, 574), flatMaterial(0xe8d193));
    sand.position.y = -0.6;
    scene.add(sand);
    // City pavement.
    const pavement = new THREE.Mesh(boxGeometry(506, 0.24, 506), flatMaterial(0x9aa0a3));
    pavement.position.y = 0.02;
    scene.add(pavement);
    // Coral Beach sand strip on the west shore.
    const beach = new THREE.Mesh(boxGeometry(64, 0.3, 500), flatMaterial(0xf2ddab));
    beach.position.set(-238, 0.06, 0);
    scene.add(beach);
    // Marina boardwalk: warm wooden decking along the south shore.
    const boardwalk = new THREE.Mesh(boxGeometry(500, 0.3, 52), flatMaterial(0xb0824f));
    boardwalk.position.set(0, 0.06, 240);
    scene.add(boardwalk);
    // Grass in the suburbs ring.
    const northGrass = new THREE.Mesh(boxGeometry(500, 0.26, 56), flatMaterial(0x77b06a));
    northGrass.position.set(0, 0.05, -232);
    scene.add(northGrass);
  }

  function makeRoadTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#3c4147';
    ctx.fillRect(0, 0, 64, 128);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 60; i++) ctx.fillRect(R.float() * 64, R.float() * 128, 2, 2);
    // edge lines
    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(2, 0, 2, 128);
    ctx.fillRect(60, 0, 2, 128);
    // centre dashes
    ctx.fillStyle = '#ffd23e';
    ctx.fillRect(30, 6, 4, 34);
    ctx.fillRect(30, 74, 4, 34);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }

  function buildRoads(scene) {
    const roadTexture = makeRoadTexture();
    const roadMaterial = new THREE.MeshLambertMaterial({ map: roadTexture });
    const length = 500;
    for (let i = 0; i < C.AVENUES_X.length; i++) {
      const tex = roadTexture.clone();
      tex.needsUpdate = true;
      tex.repeat.set(1, 16);
      const mat = new THREE.MeshLambertMaterial({ map: tex });
      const road = new THREE.Mesh(new THREE.PlaneGeometry(14, length), mat);
      road.rotation.x = -Math.PI / 2;
      road.position.set(C.AVENUES_X[i], 0.09, 0);
      scene.add(road);
    }
    for (let i = 0; i < C.STREETS_Z.length; i++) {
      const tex = roadTexture.clone();
      tex.needsUpdate = true;
      tex.repeat.set(1, 16);
      const mat = new THREE.MeshLambertMaterial({ map: tex });
      const road = new THREE.Mesh(new THREE.PlaneGeometry(14, length), mat);
      road.rotation.x = -Math.PI / 2;
      road.rotation.z = Math.PI / 2;
      road.position.set(0, 0.09, C.STREETS_Z[i]);
      scene.add(road);
    }
    // Intersection pads + crosswalks + traffic lights.
    const padMaterial = flatMaterial(0x3c4147);
    const stripeMaterial = flatMaterial(0xe8e8e8);
    for (let a = 0; a < C.AVENUES_X.length; a++) {
      for (let s = 0; s < C.STREETS_Z.length; s++) {
        const x = C.AVENUES_X[a];
        const z = C.STREETS_Z[s];
        const pad = new THREE.Mesh(new THREE.PlaneGeometry(15, 15), padMaterial);
        pad.rotation.x = -Math.PI / 2;
        pad.position.set(x, 0.1, z);
        scene.add(pad);
        const isRing = a === 0 || s === 0 || a === C.AVENUES_X.length - 1 || s === C.STREETS_Z.length - 1;
        if (isRing) continue;
        for (let k = -2; k <= 2; k++) {
          addBox(scene, 1.1, 0.04, 4.6, x + k * 2.6, 0.12, z - 9.6, stripeMaterial);
          addBox(scene, 1.1, 0.04, 4.6, x + k * 2.6, 0.12, z + 9.6, stripeMaterial);
          addBox(scene, 4.6, 0.04, 1.1, x - 9.6, 0.12, z + k * 2.6, stripeMaterial);
          addBox(scene, 4.6, 0.04, 1.1, x + 9.6, 0.12, z + k * 2.6, stripeMaterial);
        }
        buildTrafficLight(scene, x + 9.8, z + 9.8);
        buildTrafficLight(scene, x - 9.8, z - 9.8);
      }
    }
    // Canal water + bridge decks.
    const canalWater = new THREE.Mesh(new THREE.PlaneGeometry(128, 20), flatMaterial(0x1a6f9e));
    canalWater.rotation.x = -Math.PI / 2;
    canalWater.position.set(214, -0.35, -168);
    scene.add(canalWater);
    const deckMaterial = flatMaterial(0x8a6f4d);
    addBox(scene, 18, 0.5, 22, 200, 0.05, -168, deckMaterial);
    addBox(scene, 18, 0.5, 22, 246, 0.05, -168, deckMaterial);
    // Canal banks are solid except at the decks.
    addBoxCollider(150, -180, 191, -156);
    addBoxCollider(209, -180, 237, -156);
    addBoxCollider(255, -180, 290, -156);
  }

  const trafficLightHeads = [];
  function buildTrafficLight(scene, x, z) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 4.6, 6), flatMaterial(0x333a40));
    pole.position.set(x, 2.3, z);
    scene.add(pole);
    const head = addBox(scene, 0.55, 1.3, 0.55, x, 5.1, z, flatMaterial(0x1c2126));
    const lampMaterial = new THREE.MeshLambertMaterial({ color: 0x331111, emissive: 0xff2a1a, emissiveIntensity: 0.4 });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 8), lampMaterial);
    lamp.position.set(x, 5.45, z);
    scene.add(lamp);
    trafficLightHeads.push({ lampMaterial: lampMaterial, phase: R.float() * 10 });
    addCircleCollider(x, z, 0.35);
    return head;
  }

  function updateTrafficLights(time) {
    for (let i = 0; i < trafficLightHeads.length; i++) {
      const head = trafficLightHeads[i];
      const cycle = (time + head.phase) % 12;
      if (cycle < 5) { head.lampMaterial.emissive.setHex(0x2aff5a); head.lampMaterial.color.setHex(0x113311); }
      else if (cycle < 6.5) { head.lampMaterial.emissive.setHex(0xffc21a); head.lampMaterial.color.setHex(0x333011); }
      else { head.lampMaterial.emissive.setHex(0xff2a1a); head.lampMaterial.color.setHex(0x331111); }
    }
  }

  // Traffic light state for the AI: 0 = green along avenues, 1 = green along streets.
  function trafficLightPhase(time) {
    const cycle = time % 13;
    if (cycle < 5.5) return 0;
    if (cycle < 7) return -1;
    if (cycle < 12) return 1;
    return -1;
  }

  // ---- buildings ----------------------------------------------------------
  function buildBlockBuildings(scene) {
    for (let bx = 0; bx < BLOCK_X.length; bx++) {
      for (let bz = 0; bz < BLOCK_Z.length; bz++) {
        const range = BLOCK_X[bx];
        const rangeZ = BLOCK_Z[bz];
        const cx = (range[0] + range[1]) / 2;
        const cz = (rangeZ[0] + rangeZ[1]) / 2;
        const district = C.DISTRICTS[blockDistrict(cx, cz)];
        buildOneBlock(scene, range[0], range[1], rangeZ[0], rangeZ[1], district, blockDistrict(cx, cz));
      }
    }
    buildRingDistricts(scene);
  }

  function buildOneBlock(scene, x1, x2, z1, z2, district, districtKey) {
    // Sidewalk slab for the block.
    const slab = new THREE.Mesh(boxGeometry(x2 - x1 + 4, 0.22, z2 - z1 + 4), flatMaterial(0xb9bdc0));
    slab.position.set((x1 + x2) / 2, 0.08, (z1 + z2) / 2);
    scene.add(slab);
    if (districtKey === 'suburbs') {
      buildSuburbBlock(scene, x1, x2, z1, z2, district);
      return;
    }
    if (districtKey === 'port') {
      buildPortBlock(scene, x1, x2, z1, z2, district);
      return;
    }
    const count = districtKey === 'downtown' ? R.int(2, 3) : R.int(2, 4);
    const cellW = (x2 - x1) / 2;
    const cellD = (z2 - z1) / 2;
    let placed = 0;
    for (let i = 0; i < 2 && placed < count; i++) {
      for (let j = 0; j < 2 && placed < count; j++) {
        if (R.chance(0.18)) continue;
        const w = cellW * R.range(0.62, 0.9);
        const d = cellD * R.range(0.62, 0.9);
        const floors = R.int(district.minFloors, district.maxFloors);
        const h = floors * 3.1;
        const x = x1 + cellW * i + cellW / 2;
        const z = z1 + cellD * j + cellD / 2;
        buildBuilding(scene, x, z, w, d, h, floors, district, districtKey === 'shops');
        placed++;
      }
    }
    decorateBlockEdges(scene, x1, x2, z1, z2, districtKey);
  }

  function buildBuilding(scene, x, z, w, d, h, floors, district, shopFront) {
    const material = facadeMaterial(district.wall, floors, shopFront);
    const building = new THREE.Mesh(boxGeometry(w, h, d), material);
    building.position.set(x, h / 2 + 0.15, z);
    scene.add(building);
    // Roof slab + rooftop props so the chase camera sees detail.
    addBox(scene, w + 0.6, 0.4, d + 0.6, x, h + 0.3, z, flatMaterial(district.roof));
    if (R.chance(0.7)) addBox(scene, 2.2, 1.4, 2.2, x + R.range(-w / 4, w / 4), h + 1.1, z + R.range(-d / 4, d / 4), flatMaterial(0x8b959c));
    if (R.chance(0.45)) {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 2.6, 8), flatMaterial(0xa8845c));
      tank.position.set(x + R.range(-w / 4, w / 4), h + 1.8, z + R.range(-d / 4, d / 4));
      scene.add(tank);
    }
    if (shopFront) buildShopSign(scene, x, z, w, d, h);
    addBoxCollider(x - w / 2, z - d / 2, x + w / 2, z + d / 2);
    return building;
  }

  function buildShopSign(scene, x, z, w, d, h) {
    const name = R.pick(C.SHOP_SIGNS);
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 48;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#141c26';
    ctx.fillRect(0, 0, 256, 48);
    ctx.font = 'bold 30px Trebuchet MS, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = R.pick(['#ffd23e', '#ff6ec7', '#4ef0e0', '#ffb52e']);
    ctx.fillText(name, 128, 26);
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.MeshBasicMaterial({ map: texture });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w * 0.9, 16), 2.2), material);
    sign.position.set(x, 4.6, z + d / 2 + 0.15);
    scene.add(sign);
    const back = sign.clone();
    back.rotation.y = Math.PI;
    back.position.z = z - d / 2 - 0.15;
    scene.add(back);
  }

  function buildSuburbBlock(scene, x1, x2, z1, z2, district) {
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        const x = x1 + (x2 - x1) * (0.27 + 0.46 * i);
        const z = z1 + (z2 - z1) * (0.27 + 0.46 * j);
        const w = R.range(13, 17);
        const d = R.range(11, 15);
        const h = R.range(3.4, 5);
        const material = facadeMaterial(district.wall, 2, false);
        const house = new THREE.Mesh(boxGeometry(w, h, d), material);
        house.position.set(x, h / 2 + 0.15, z);
        scene.add(house);
        // Pitched roof from a rotated box.
        const roof = new THREE.Mesh(boxGeometry(w + 1.4, 0.5, d + 1.4), flatMaterial(district.roof));
        roof.position.set(x, h + 0.9, z);
        roof.rotation.z = 0.0;
        scene.add(roof);
        addBox(scene, w * 0.5, 2.2, 0.4, x, h + 0.6, z, flatMaterial(district.roof));
        // Garden hedge + fence posts.
        addBox(scene, w + 3, 0.8, 0.3, x, 0.55, z + d / 2 + 2.2, flatMaterial(0x4e8a44));
        addBoxCollider(x - w / 2, z - d / 2, x + w / 2, z + d / 2);
        if (R.chance(0.6)) buildTree(scene, x + w / 2 + 3.5, z + R.range(-4, 4), true);
      }
    }
  }

  function buildPortBlock(scene, x1, x2, z1, z2, district) {
    const cx = (x1 + x2) / 2;
    const cz = (z1 + z2) / 2;
    const w = (x2 - x1) * 0.78;
    const d = (z2 - z1) * 0.7;
    const h = R.range(7, 10);
    const warehouse = new THREE.Mesh(boxGeometry(w, h, d), facadeMaterial(district.wall, 2, false));
    warehouse.position.set(cx, h / 2 + 0.15, cz);
    scene.add(warehouse);
    addBox(scene, w + 1, 0.5, d + 1, cx, h + 0.35, cz, flatMaterial(0x707880));
    addBoxCollider(cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2);
    // Container stacks beside the warehouse.
    const containerColors = [0xd95f43, 0x3f7fbf, 0x53a06a, 0xd9a441, 0x7a6ab0];
    for (let i = 0; i < 4; i++) {
      const px = x1 + 6 + (i % 2) * 13;
      const pz = z2 - 6 - Math.floor(i / 2) * 7;
      const levels = R.int(1, 3);
      for (let level = 0; level < levels; level++) {
        addBox(scene, 11, 2.6, 5, px, 1.45 + level * 2.65, pz, flatMaterial(R.pick(containerColors)));
      }
      addBoxCollider(px - 5.5, pz - 2.5, px + 5.5, pz + 2.5);
    }
  }

  function buildRingDistricts(scene) {
    // Marina hotels along the boardwalk.
    for (let i = 0; i < 6; i++) {
      const x = -190 + i * 74;
      buildBuilding(scene, x, 222, 30, 15, R.range(9, 15), 4, C.DISTRICTS.marina, true);
    }
    // Beach hotels + props on the west shore.
    for (let i = 0; i < 4; i++) {
      const z = -160 + i * 96;
      buildBuilding(scene, -222, z, 15, 26, R.range(7, 11), 3, C.DISTRICTS.beach, true);
    }
    buildLifeguardTower(scene, -246, 60);
    buildBeachProps(scene);
    // Port shore: cranes, fuel tanks, extra warehouses.
    for (let i = 0; i < 3; i++) {
      const z = -150 + i * 130;
      buildCrane(scene, 238, z);
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 8, 14), flatMaterial(0xd8dde2));
      tank.position.set(224, 4.1, z + 34);
      scene.add(tank);
      addCircleCollider(224, z + 34, 6.4);
    }
    buildMarinaPiers(scene);
    buildStuntRamps(scene);
  }

  function buildLifeguardTower(scene, x, z) {
    const wood = flatMaterial(0xc9a06a);
    for (let i = 0; i < 4; i++) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 5.4, 6), wood);
      leg.position.set(x + (i % 2 ? 1.6 : -1.6), 2.7, z + (i < 2 ? 1.6 : -1.6));
      scene.add(leg);
    }
    addBox(scene, 4.6, 2.4, 4.6, x, 6.4, z, flatMaterial(0xfff3d9));
    addBox(scene, 5.6, 0.4, 5.6, x, 7.9, z, flatMaterial(0xd94f6d));
    const ramp = addBox(scene, 1.6, 0.25, 6.5, x + 3.4, 2.6, z, wood);
    ramp.rotation.z = -0.72;
    addCircleCollider(x, z, 2.2);
  }

  function buildBeachProps(scene) {
    // Umbrellas and towels scattered on the sand.
    for (let i = 0; i < 16; i++) {
      const x = R.range(-262, -216);
      const z = R.range(-230, 230);
      if (Math.abs(z - 60) < 8 && x < -236) continue;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 5), flatMaterial(0xeeeeee));
      pole.position.set(x, 1.2, z);
      scene.add(pole);
      const shade = new THREE.Mesh(new THREE.ConeGeometry(1.9, 0.7, 8), flatMaterial(R.pick([0xff6b6b, 0x4ecdc4, 0xffe66d, 0xff9ff3])));
      shade.position.set(x, 2.5, z);
      scene.add(shade);
      addBox(scene, 2.2, 0.08, 1.1, x + R.range(-1.5, 1.5), 0.22, z + R.range(1, 2), flatMaterial(R.pick([0xffffff, 0x87ceeb, 0xffb6c1])));
    }
    // The beach party clearing used by mission 4: a ring of crates + lights.
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      addBox(scene, 1.2, 1.2, 1.2, -238 + Math.cos(angle) * 6, 0.75, 100 + Math.sin(angle) * 6, flatMaterial(0xa8845c));
    }
  }

  function buildCrane(scene, x, z) {
    const steel = flatMaterial(0xe07b39);
    addBox(scene, 1.6, 26, 1.6, x - 5, 13, z, steel);
    addBox(scene, 1.6, 26, 1.6, x + 5, 13, z, steel);
    addBox(scene, 30, 1.8, 1.8, x - 8, 26.5, z, steel);
    addBox(scene, 4, 4, 4, x - 17, 22, z, flatMaterial(0x3a4a55));
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 12, 4), flatMaterial(0x222222));
    cable.position.set(x - 17, 16, z);
    scene.add(cable);
    const hookBox = addBox(scene, 5, 2.4, 2.4, x - 17, 9, z, flatMaterial(0x3f7fbf));
    hookBox.position.y = 9;
    addBoxCollider(x - 6.5, z - 1, x + 6.5, z + 1);
  }

  function buildMarinaPiers(scene) {
    const wood = flatMaterial(0x9a744a);
    const pierXs = [-120, -40, 40, 120];
    for (let i = 0; i < pierXs.length; i++) {
      const x = pierXs[i];
      const pier = addBox(scene, 7, 0.5, 42, x, 0.35, 282, wood);
      pier.position.y = 0.35;
      for (let b = 0; b < 3; b++) {
        buildBoat(scene, x + (b % 2 ? 6.5 : -6.5), 268 + b * 13, R.float() * Math.PI);
      }
    }
    // Boardwalk lamps and benches.
    for (let x = -230; x <= 230; x += 38) {
      buildLampPost(scene, x, 218);
      if (R.chance(0.6)) buildBench(scene, x + 8, 216, 0);
    }
  }

  function buildBoat(scene, x, z, rotation) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(boxGeometry(3.4, 1.2, 8.5), flatMaterial(R.pick([0xffffff, 0xd94f4f, 0x3f7fbf, 0xf2b13c])));
    hull.position.y = 0.2;
    boat.add(hull);
    const cabin = new THREE.Mesh(boxGeometry(2.4, 1.3, 3), flatMaterial(0xf5f5f5));
    cabin.position.set(0, 1.3, -0.6);
    boat.add(cabin);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 6.5, 5), flatMaterial(0x8a6f4d));
    mast.position.set(0, 3.6, 1.6);
    boat.add(mast);
    boat.position.set(x, C.WORLD.seaLevel + 0.5, z);
    boat.rotation.y = rotation;
    scene.add(boat);
    animatedBoats.push({ group: boat, baseY: C.WORLD.seaLevel + 0.5, phase: R.float() * 6 });
    return boat;
  }

  function buildStuntRamps(scene) {
    const rampMaterial = flatMaterial(0xd9a441);
    const spots = [
      { x: 232, z: 30, rotationY: Math.PI },     // port ramp launching west
      { x: 232, z: -60, rotationY: Math.PI },
      { x: -60, z: -232, rotationY: Math.PI / 2 }, // north ramp launching south... faces road
    ];
    for (let i = 0; i < spots.length; i++) {
      const s = spots[i];
      const ramp = new THREE.Mesh(boxGeometry(7, 0.4, 9), rampMaterial);
      ramp.position.set(s.x, 1.1, s.z);
      ramp.rotation.y = s.rotationY;
      ramp.rotation.x = s.rotationY === Math.PI / 2 ? 0 : -0.42;
      if (s.rotationY === Math.PI / 2) ramp.rotation.z = 0.42;
      scene.add(ramp);
      CBH.G.stuntRamps.push({ x: s.x, z: s.z, dirX: s.rotationY === Math.PI ? -1 : 0, dirZ: s.rotationY === Math.PI / 2 ? 1 : 0, used: false });
    }
  }

  // ---- street furniture ---------------------------------------------------
  function buildLampPost(scene, x, z) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 5.6, 6), flatMaterial(0x2f363c));
    pole.position.set(x, 2.8, z);
    scene.add(pole);
    const lampMaterial = new THREE.MeshLambertMaterial({ color: 0x554a33, emissive: 0xffc978, emissiveIntensity: 0 });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 8), lampMaterial);
    bulb.position.set(x, 5.7, z);
    scene.add(bulb);
    CBH.sky.registerLampMaterial(lampMaterial);
    addCircleCollider(x, z, 0.3);
  }

  function buildBench(scene, x, z, rotationY) {
    const bench = new THREE.Group();
    addBox(bench, 2.4, 0.12, 0.6, 0, 0.55, 0, flatMaterial(0x8a5a34));
    addBox(bench, 2.4, 0.7, 0.12, 0, 0.95, -0.3, flatMaterial(0x8a5a34));
    addBox(bench, 0.12, 0.55, 0.55, -1, 0.27, 0, flatMaterial(0x333333));
    addBox(bench, 0.12, 0.55, 0.55, 1, 0.27, 0, flatMaterial(0x333333));
    bench.position.set(x, 0.1, z);
    bench.rotation.y = rotationY;
    scene.add(bench);
    addCircleCollider(x, z, 0.8);
  }

  function buildTree(scene, x, z, palm) {
    if (palm) {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, 5.6, 6), flatMaterial(0x9a744a));
      trunk.position.set(x, 2.8, z);
      trunk.rotation.z = R.range(-0.09, 0.09);
      scene.add(trunk);
      const frondMaterial = flatMaterial(0x3f9e4d);
      for (let i = 0; i < 6; i++) {
        const frond = new THREE.Mesh(boxGeometry(3.6, 0.08, 0.7), frondMaterial);
        const angle = (i / 6) * Math.PI * 2;
        frond.position.set(x + Math.cos(angle) * 1.5, 5.9 - Math.abs(Math.sin(angle)) * 0.2, z + Math.sin(angle) * 1.5);
        frond.rotation.y = -angle;
        frond.rotation.z = Math.cos(angle) * 0.5;
        scene.add(frond);
      }
    } else {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 2.6, 6), flatMaterial(0x7a5a38));
      trunk.position.set(x, 1.3, z);
      scene.add(trunk);
      const crown = new THREE.Mesh(new THREE.SphereGeometry(R.range(1.7, 2.3), 8, 7), flatMaterial(0x4e9e4f));
      crown.position.set(x, 3.8, z);
      scene.add(crown);
    }
    addCircleCollider(x, z, 0.45);
  }

  function buildHydrant(scene, x, z) {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.8, 7), flatMaterial(0xd93a2e));
    body.position.set(x, 0.5, z);
    scene.add(body);
    addCircleCollider(x, z, 0.3);
  }

  function decorateBlockEdges(scene, x1, x2, z1, z2, districtKey) {
    // Palms and lamps along the sidewalks, benches and hydrants for detail.
    const palm = districtKey === 'marina' || districtKey === 'beach' || districtKey === 'shops';
    const spots = [
      { x: x1 - 2.5, z: z1 - 2.5 }, { x: x2 + 2.5, z: z1 - 2.5 },
      { x: x1 - 2.5, z: z2 + 2.5 }, { x: x2 + 2.5, z: z2 + 2.5 },
      { x: (x1 + x2) / 2, z: z1 - 2.5 }, { x: (x1 + x2) / 2, z: z2 + 2.5 },
    ];
    for (let i = 0; i < spots.length; i++) {
      const s = spots[i];
      const roll = R.float();
      if (roll < 0.5) buildTree(scene, s.x, s.z, palm || R.chance(0.5));
      else if (roll < 0.8) buildLampPost(scene, s.x, s.z);
      else buildHydrant(scene, s.x, s.z);
    }
    if (R.chance(0.7)) buildBench(scene, x1 - 2.5, (z1 + z2) / 2, Math.PI / 2);
    // Dumpsters and crates in the alleys.
    if (R.chance(0.65)) {
      const dx = R.range(x1 + 4, x2 - 4);
      addBox(scene, 2.6, 1.4, 1.4, dx, 0.85, z1 + 1.2, flatMaterial(0x3f6a4f));
      addBoxCollider(dx - 1.3, z1 + 0.5, dx + 1.3, z1 + 1.9);
    }
    if (R.chance(0.5)) {
      const cx = R.range(x1 + 3, x2 - 3);
      addBox(scene, 1.2, 1.2, 1.2, cx, 0.75, z2 - 1.2, flatMaterial(0xa8845c));
      addBoxCollider(cx - 0.6, z2 - 1.8, cx + 0.6, z2 - 0.6);
    }
  }

  // ---- golden shells --------------------------------------------------------
  const SHELL_SPOTS = [
    { x: -120, z: 301, label: 'the end of Gale Pier' },
    { x: 40, z: 301, label: 'the end of Rosa Pier' },
    { x: 120, z: 301, label: 'the end of Heron Pier' },
    { x: -40, z: 296, label: 'the end of Alba Pier' },
    { x: -246, z: 66, label: 'the lifeguard tower deck' },
    { x: -252, z: -40, label: 'the quiet north beach' },
    { x: -228, z: 150, label: 'the party beach rocks' },
    { x: -233, z: -180, label: 'the driftwood shore' },
    { x: 0, z: 236, label: 'the boardwalk fountain' },
    { x: 168, z: 224, label: 'the marina hotel steps' },
    { x: 200, z: -168, label: 'the canal bridge' },
    { x: 238, z: 96, label: 'the port crane yard' },
    { x: 224, z: -126, label: 'the fuel tank walkway' },
    { x: -160, z: -232, label: 'a Palm Heights garden' },
    { x: -52, z: -216, label: 'a Palm Heights porch' },
    { x: 84, z: -228, label: 'a Palm Heights hedge' },
    { x: -58, z: 44, label: 'the alley behind Cafe Rosa' },
    { x: 58, z: -58, label: 'a Downtown service lane' },
    { x: -100, z: 100, label: 'a Neon Mile side street' },
    { x: 246, z: 246, label: 'the south-east coast corner' },
  ];

  function buildShells(scene) {
    const shellMaterial = new THREE.MeshLambertMaterial({ color: 0xffd23e, emissive: 0xa87400, emissiveIntensity: 0.7 });
    for (let i = 0; i < SHELL_SPOTS.length; i++) {
      const spot = SHELL_SPOTS[i];
      const group = new THREE.Group();
      const shellBody = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), shellMaterial);
      shellBody.scale.set(1, 0.62, 1);
      group.add(shellBody);
      for (let r = 0; r < 5; r++) {
        const ridge = new THREE.Mesh(boxGeometry(0.09, 0.3, 0.8), shellMaterial);
        const angle = (r / 4 - 0.5) * 1.5;
        ridge.position.set(Math.sin(angle) * 0.4, 0.22, Math.cos(angle) * 0.1);
        ridge.rotation.z = angle;
        group.add(ridge);
      }
      group.position.set(spot.x, spot.label.indexOf('tower deck') >= 0 ? 5.6 : 0.9, spot.z);
      scene.add(group);
      CBH.G.shells.push({ id: i, group: group, x: spot.x, z: spot.z, label: spot.label, taken: !!CBH.G.shellsFound[i] });
      if (CBH.G.shellsFound[i]) group.visible = false;
    }
  }

  function applyCollectedShells() {
    for (let i = 0; i < CBH.G.shells.length; i++) {
      const shell = CBH.G.shells[i];
      if (CBH.G.shellsFound[shell.id]) {
        shell.taken = true;
        shell.group.visible = false;
      }
    }
  }

  function updateCity(dt, time) {
    seaTime += dt;
    if (seaMesh) {
      seaMesh.position.y = C.WORLD.seaLevel + Math.sin(seaTime * 0.7) * 0.08;
    }
    for (let i = 0; i < animatedBoats.length; i++) {
      const boat = animatedBoats[i];
      boat.group.position.y = boat.baseY + Math.sin(seaTime * 0.9 + boat.phase) * 0.14;
      boat.group.rotation.z = Math.sin(seaTime * 0.6 + boat.phase) * 0.03;
    }
    for (let i = 0; i < CBH.G.shells.length; i++) {
      const shell = CBH.G.shells[i];
      if (!shell.taken) {
        shell.group.rotation.y += dt * 1.4;
        shell.group.position.y += Math.sin(time * 2 + shell.id) * dt * 0.12;
      }
    }
    updateTrafficLights(time);
  }

  function buildCity(scene) {
    buildGroundAndSea(scene);
    buildRoads(scene);
    buildBlockBuildings(scene);
    buildShells(scene);
  }

  window.CBH.city = {
    build: buildCity,
    update: updateCity,
    collideCircle: collideCircle,
    isPointInWater: isPointInWater,
    isInCanal: isInCanal,
    nearestRoadDistance: nearestRoadDistance,
    districtAt: districtAt,
    setNightWindowGlow: setNightWindowGlow,
    applyCollectedShells: applyCollectedShells,
    flatMaterial: flatMaterial,
    boxGeometry: boxGeometry,
    addBox: addBox,
    addBoxCollider: addBoxCollider,
    addCircleCollider: addCircleCollider,
    SHELL_SPOTS: SHELL_SPOTS,
  };
})();

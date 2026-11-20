// pedestrians.js — Coral Bay's people: low-poly walkers who stroll the
// pavements, wait at bus stops and shop fronts, cross at crosswalks, chat
// in pairs, and run screaming from gunfire and crashes. The same body
// builder makes Mari, mission characters, police officers and gunmen.
(function () {
  'use strict';
  window.CBH = window.CBH || {};
  const C = CBH.config;
  const R = CBH.rng;
  const M = CBH.math;

  function buildPersonMesh(shirtColor, pantsColor, skinColor, opts) {
    opts = opts || {};
    const group = new THREE.Group();
    const shirt = CBH.city.flatMaterial(shirtColor);
    const pants = CBH.city.flatMaterial(pantsColor);
    const skin = CBH.city.flatMaterial(skinColor);

    const legGeometry = CBH.city.boxGeometry(0.21, 0.78, 0.24).clone();
    legGeometry.translate(0, -0.39, 0);
    const legL = new THREE.Mesh(legGeometry, pants);
    legL.position.set(-0.13, 0.78, 0);
    group.add(legL);
    const legR = new THREE.Mesh(legGeometry, pants);
    legR.position.set(0.13, 0.78, 0);
    group.add(legR);
    const torso = new THREE.Mesh(CBH.city.boxGeometry(0.56, 0.68, 0.3), shirt);
    torso.position.y = 1.12;
    group.add(torso);
    const armL = new THREE.Mesh(CBH.city.boxGeometry(0.16, 0.62, 0.18), shirt);
    armL.geometry = armL.geometry.clone();
    armL.geometry.translate(0, -0.26, 0);
    armL.position.set(-0.37, 1.4, 0);
    group.add(armL);
    const armR = new THREE.Mesh(CBH.city.boxGeometry(0.16, 0.62, 0.18), shirt);
    armR.geometry = armL.geometry;
    armR.position.set(0.37, 1.4, 0);
    group.add(armR);
    const head = new THREE.Mesh(CBH.city.boxGeometry(0.4, 0.44, 0.4), skin);
    head.position.y = 1.72;
    group.add(head);
    const hair = new THREE.Mesh(CBH.city.boxGeometry(0.44, 0.14, 0.44), CBH.city.flatMaterial(opts.hairColor || 0x2a1c10));
    hair.position.y = 1.97;
    group.add(hair);
    if (opts.hat) {
      const cap = new THREE.Mesh(CBH.city.boxGeometry(0.46, 0.1, 0.46), CBH.city.flatMaterial(opts.hat));
      cap.position.y = 2.02;
      group.add(cap);
      const brim = new THREE.Mesh(CBH.city.boxGeometry(0.46, 0.05, 0.3), CBH.city.flatMaterial(opts.hat));
      brim.position.set(0, 1.98, 0.36);
      group.add(brim);
    }
    if (opts.badge) {
      const badge = new THREE.Mesh(CBH.city.boxGeometry(0.12, 0.12, 0.03), CBH.city.flatMaterial(0xffd23e));
      badge.position.set(0.15, 1.25, 0.17);
      group.add(badge);
    }
    if (opts.gun) {
      const gun = new THREE.Mesh(CBH.city.boxGeometry(0.09, 0.14, 0.5), CBH.city.flatMaterial(0x14161a));
      gun.position.set(0.37, 1.14, 0.3);
      group.add(gun);
      group.userData.gunMesh = gun;
    }
    group.userData.parts = { legL: legL, legR: legR, armL: armL, armR: armR, head: head, torso: torso };
    return group;
  }

  let nextPedId = 1;
  function createPedestrian(x, z, opts) {
    opts = opts || {};
    const mesh = buildPersonMesh(
      opts.shirt !== undefined ? opts.shirt : R.pick(C.PED_SHIRTS),
      opts.pants !== undefined ? opts.pants : R.pick(C.PED_PANTS),
      opts.skin !== undefined ? opts.skin : R.pick(C.SKIN_TONES),
      opts
    );
    mesh.position.set(x, 0, z);
    CBH.G.scene.add(mesh);
    const ped = {
      id: nextPedId++,
      group: mesh,
      parts: mesh.userData.parts,
      health: opts.health || 100,
      state: opts.state || 'walk', // walk | idle | flee | down | dead | follow | guard | attack
      heading: R.float() * Math.PI * 2,
      speed: 0,
      walkSpeed: R.range(1.6, 2.6),
      walkPhase: R.float() * 6,
      // sidewalk path: travel along an axis at a fixed offset coord
      axis: R.chance(0.5) ? 'x' : 'z',
      dirSign: R.chance(0.5) ? 1 : -1,
      laneCoord: 0,
      idleTimer: 0,
      fleeFrom: null,
      fleeTimer: 0,
      downTimer: 0,
      isOfficer: !!opts.isOfficer,
      isGunman: !!opts.isGunman,
      isMissionChar: !!opts.isMissionChar,
      name: opts.name || '',
      shootCooldown: 0,
      burstLeft: 0,
      targetPoint: opts.targetPoint || null,
      screamCooldown: 0,
    };
    ped.laneCoord = 0;
    if (!opts.noSnap) snapPedToSidewalk(ped, x, z);
    if (opts.state === 'idle') ped.state = 'idle';
    CBH.G.pedestrians.push(ped);
    return ped;
  }

  function snapPedToSidewalk(ped, x, z) {
    // Choose the nearest pavement line: offset from the nearest road centre.
    if (ped.axis === 'x') {
      const street = CBH.traffic.nearestStreet(z);
      ped.laneCoord = street + (z >= street ? C.WORLD.sidewalkOffset : -C.WORLD.sidewalkOffset) * (R.chance(0.5) ? 1 : 1);
      ped.group.position.set(x, 0, ped.laneCoord);
    } else {
      const avenue = CBH.traffic.nearestAvenue(x);
      ped.laneCoord = avenue + (x >= avenue ? C.WORLD.sidewalkOffset : -C.WORLD.sidewalkOffset);
      ped.group.position.set(ped.laneCoord, 0, z);
    }
  }

  function spawnCrowd() {
    for (let i = 0; i < C.TUNING.pedestrianCount; i++) {
      const avenue = R.pick(C.AVENUES_X.slice(1, 7));
      const street = R.pick(C.STREETS_Z.slice(1, 7));
      const x = avenue + R.range(-90, 90);
      const z = street + R.range(-9, 9);
      const ped = createPedestrian(M.clamp(x, -250, 250), M.clamp(z, -250, 250), {});
      if (R.chance(0.22)) {
        ped.state = 'idle';
        ped.idleTimer = R.range(4, 14);
      }
    }
    // Beach strollers and boardwalk crowds.
    for (let i = 0; i < 6; i++) {
      const ped = createPedestrian(R.range(-250, -215), R.range(-200, 200), { shirt: R.pick([0xff6b6b, 0xffe66d, 0x4ecdc4]) });
      ped.axis = 'z';
      ped.laneCoord = ped.group.position.x;
    }
    for (let i = 0; i < 5; i++) {
      createPedestrian(R.range(-220, 220), 224 + R.range(-3, 6), {});
    }
  }

  function animatePerson(ped, dt, speedRatio) {
    ped.walkPhase += dt * (4 + speedRatio * 7);
    const swing = Math.sin(ped.walkPhase) * 0.55 * Math.min(1, speedRatio + 0.15);
    if (ped.state !== 'down' && ped.state !== 'dead') {
      ped.parts.legL.rotation.x = swing;
      ped.parts.legR.rotation.x = -swing;
      if (ped.state === 'flee') {
        ped.parts.armL.rotation.x = -2.6 + Math.sin(ped.walkPhase * 1.4) * 0.3;
        ped.parts.armR.rotation.x = -2.6 - Math.sin(ped.walkPhase * 1.4) * 0.3;
      } else if (ped.isOfficer || ped.isGunman) {
        ped.parts.armR.rotation.x = -1.35; // gun arm levelled
        ped.parts.armL.rotation.x = swing * 0.5;
      } else {
        ped.parts.armL.rotation.x = -swing * 0.7;
        ped.parts.armR.rotation.x = swing * 0.7;
      }
      ped.group.rotation.z = 0;
      ped.group.position.y = Math.abs(Math.sin(ped.walkPhase)) * 0.05 * speedRatio;
    }
  }

  function knockDownPed(ped, lethal) {
    if (ped.state === 'dead') return;
    ped.state = lethal ? 'dead' : 'down';
    ped.downTimer = lethal ? 9999 : R.range(3, 6);
    ped.group.rotation.x = -Math.PI / 2;
    ped.group.position.y = 0.25;
    ped.parts.legL.rotation.x = 0.3;
    ped.parts.legR.rotation.x = -0.2;
  }

  function damagePed(ped, amount, fromX, fromZ) {
    if (ped.state === 'dead') return;
    ped.health -= amount;
    CBH.particles.spawn(ped.group.position.x, 1.3, ped.group.position.z, 'sparks', 3);
    if (ped.health <= 0) {
      knockDownPed(ped, true);
      if (!ped.isOfficer && !ped.isGunman) CBH.state.reportCrime(30, fromX, fromZ);
      else CBH.state.reportCrime(14, fromX, fromZ);
    } else if (!ped.isOfficer && !ped.isGunman) {
      ped.state = 'flee';
      ped.fleeFrom = { x: fromX, z: fromZ };
      ped.fleeTimer = 4;
      CBH.state.reportCrime(12, fromX, fromZ);
    }
  }

  function updatePedestrian(ped, dt) {
    if (ped.state === 'dead') return;
    if (ped.state === 'down') {
      ped.downTimer -= dt;
      if (ped.downTimer <= 0) {
        ped.state = 'flee';
        ped.fleeTimer = 3;
        ped.group.rotation.x = 0;
        ped.group.position.y = 0;
        ped.health = Math.max(30, ped.health);
      }
      return;
    }
    const pos = ped.group.position;
    let moveX = 0;
    let moveZ = 0;
    let speedRatio = 0;

    if (ped.state === 'flee') {
      ped.fleeTimer -= dt;
      const from = ped.fleeFrom || CBH.state.playerPosition();
      const away = M.headingTo(from.x, from.z, pos.x, pos.z);
      ped.heading = M.angleLerp(ped.heading, away, Math.min(1, dt * 6));
      moveX = Math.sin(ped.heading) * 5.4;
      moveZ = Math.cos(ped.heading) * 5.4;
      speedRatio = 1;
      if (ped.fleeTimer <= 0) {
        ped.state = 'walk';
        snapPedToSidewalk(ped, pos.x, pos.z);
      }
      if (ped.screamCooldown > 0) ped.screamCooldown -= dt;
    } else if (ped.state === 'idle') {
      ped.idleTimer -= dt;
      speedRatio = 0;
      if (ped.idleTimer <= 0) {
        ped.state = 'walk';
        if (R.chance(0.4)) {
          ped.axis = ped.axis === 'x' ? 'z' : 'x';
          snapPedToSidewalk(ped, pos.x, pos.z);
        }
        if (R.chance(0.5)) ped.dirSign = -ped.dirSign;
      }
    } else if (ped.state === 'walk') {
      if (ped.axis === 'x') {
        moveX = ped.dirSign * ped.walkSpeed;
        ped.heading = M.angleLerp(ped.heading, ped.dirSign > 0 ? Math.PI / 2 : -Math.PI / 2, Math.min(1, dt * 5));
        pos.z = M.lerp(pos.z, ped.laneCoord, Math.min(1, dt * 2));
        if (Math.abs(pos.x) > 252) ped.dirSign = -ped.dirSign;
        // Turn at intersections sometimes; pause at shop fronts sometimes.
        if (R.jitter() < dt * 0.02) { ped.state = 'idle'; ped.idleTimer = R.range(2, 7); }
        if (R.jitter() < dt * 0.03) {
          ped.axis = 'z';
          ped.laneCoord = CBH.traffic.nearestAvenue(pos.x) + (R.chance(0.5) ? C.WORLD.sidewalkOffset : -C.WORLD.sidewalkOffset);
        }
      } else {
        moveZ = ped.dirSign * ped.walkSpeed;
        ped.heading = M.angleLerp(ped.heading, ped.dirSign > 0 ? 0 : Math.PI, Math.min(1, dt * 5));
        pos.x = M.lerp(pos.x, ped.laneCoord, Math.min(1, dt * 2));
        if (Math.abs(pos.z) > 252) ped.dirSign = -ped.dirSign;
        if (R.jitter() < dt * 0.02) { ped.state = 'idle'; ped.idleTimer = R.range(2, 7); }
        if (R.jitter() < dt * 0.03) {
          ped.axis = 'x';
          ped.laneCoord = CBH.traffic.nearestStreet(pos.z) + (R.chance(0.5) ? C.WORLD.sidewalkOffset : -C.WORLD.sidewalkOffset);
        }
      }
      speedRatio = 0.45;
    }

    if (moveX !== 0 || moveZ !== 0) {
      let nx = pos.x + moveX * dt;
      let nz = pos.z + moveZ * dt;
      const resolved = CBH.city.collideCircle(nx, nz, 0.5);
      nx = resolved.x;
      nz = resolved.z;
      if (CBH.city.isPointInWater(nx, nz)) {
        ped.dirSign = -ped.dirSign;
      } else {
        pos.x = nx;
        pos.z = nz;
      }
      ped.group.rotation.y = ped.heading;
    }
    animatePerson(ped, dt, speedRatio);
  }

  function updatePedestrians(dt) {
    const list = CBH.G.pedestrians;
    for (let i = list.length - 1; i >= 0; i--) {
      const ped = list[i];
      if (ped.isOfficer || ped.isGunman || ped.isMissionChar) continue; // driven by their own modules
      updatePedestrian(ped, dt);
    }
  }

  function panicPedestriansNear(x, z, radius) {
    for (let i = 0; i < CBH.G.pedestrians.length; i++) {
      const ped = CBH.G.pedestrians[i];
      if (ped.isOfficer || ped.isGunman || ped.isMissionChar) continue;
      if (ped.state === 'dead' || ped.state === 'down') continue;
      if (M.distance2D(ped.group.position.x, ped.group.position.z, x, z) < radius) {
        ped.state = 'flee';
        ped.fleeFrom = { x: x, z: z };
        ped.fleeTimer = R.range(2.5, 4.5);
      }
    }
  }

  // Cars hitting pedestrians: called from the main loop for every car list.
  function checkCarPedestrianHits(cars) {
    for (let c = 0; c < cars.length; c++) {
      const car = cars[c];
      if (Math.abs(car.speed) < 3 || !car.group.visible) continue;
      for (let i = 0; i < CBH.G.pedestrians.length; i++) {
        const ped = CBH.G.pedestrians[i];
        if (ped.state === 'dead' || ped.state === 'down') continue;
        const pp = ped.group.position;
        if (M.distance2D(pp.x, pp.z, car.group.position.x, car.group.position.z) < 1.9) {
          const lethal = Math.abs(car.speed) > 16;
          knockDownPed(ped, lethal);
          if (car === CBH.G.inCar) {
            CBH.state.reportCrime(lethal ? 34 : 18);
            CBH.G.shake = Math.max(CBH.G.shake, 0.25);
            CBH.audio.crash(0.4);
            if (lethal) CBH.hud.showToast('You ran someone down!');
          }
          CBH.particles.spawn(pp.x, 0.8, pp.z, 'dust', 4);
        }
      }
      // And the player on foot.
      if (car !== CBH.G.inCar && CBH.G.player && !CBH.G.inCar) {
        const pp = CBH.G.player.group.position;
        if (M.distance2D(pp.x, pp.z, car.group.position.x, car.group.position.z) < 1.9) {
          CBH.player.hurtPlayer(Math.abs(car.speed) * 0.9);
          CBH.player.knockPlayerFrom(car.group.position.x, car.group.position.z);
        }
      }
    }
  }

  function removePedestrian(ped) {
    CBH.G.scene.remove(ped.group);
    const idx = CBH.G.pedestrians.indexOf(ped);
    if (idx >= 0) CBH.G.pedestrians.splice(idx, 1);
  }

  window.CBH.peds = {
    buildPersonMesh: buildPersonMesh,
    create: createPedestrian,
    spawnCrowd: spawnCrowd,
    update: updatePedestrians,
    updateOne: updatePedestrian,
    animate: animatePerson,
    damage: damagePed,
    knockDown: knockDownPed,
    panicNear: panicPedestriansNear,
    checkCarHits: checkCarPedestrianHits,
    remove: removePedestrian,
  };
})();

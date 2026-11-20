// combat.js — hitscan gunfire for Coral Bay Heat: the player's pistol,
// police officers and mission gunmen all shoot through here. A shot draws
// a tracer, flashes a muzzle, sparks on impact, and damages the first
// person or car along its line. Cover behaviour lives in the shooters:
// they sidestep between bursts (see police.js and missions.js).
(function () {
  'use strict';
  window.CBH = window.CBH || {};
  const C = CBH.config;
  const M = CBH.math;

  const tracerPool = [];
  let tracerIndex = 0;

  function buildTracerPool(scene) {
    const material = new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0 });
    for (let i = 0; i < 24; i++) {
      const tracer = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 1), material.clone());
      tracer.visible = false;
      scene.add(tracer);
      tracerPool.push({ mesh: tracer, life: 0 });
    }
  }

  function drawTracer(fromX, fromY, fromZ, toX, toY, toZ) {
    if (tracerPool.length === 0) return;
    const entry = tracerPool[tracerIndex];
    tracerIndex = (tracerIndex + 1) % tracerPool.length;
    const mesh = entry.mesh;
    const dx = toX - fromX;
    const dy = toY - fromY;
    const dz = toZ - fromZ;
    const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
    mesh.scale.set(1, 1, Math.max(0.1, length));
    mesh.position.set((fromX + toX) / 2, (fromY + toY) / 2, (fromZ + toZ) / 2);
    mesh.lookAt(toX, toY, toZ);
    mesh.material.opacity = 0.9;
    mesh.visible = true;
    entry.life = 0.07;
  }

  function updateTracers(dt) {
    for (let i = 0; i < tracerPool.length; i++) {
      const entry = tracerPool[i];
      if (entry.life > 0) {
        entry.life -= dt;
        if (entry.life <= 0) entry.mesh.visible = false;
      }
    }
  }

  // Find the best target near a ray: people first, then cars, then a wall
  // point at max range. spread widens the acceptable cone (AI accuracy).
  function findShotTarget(fromX, fromZ, heading, range, spread, shooterIsPlayer) {
    const dirX = Math.sin(heading);
    const dirZ = Math.cos(heading);
    let best = null;
    let bestScore = -1;

    function consider(x, z, radius, payload) {
      const rx = x - fromX;
      const rz = z - fromZ;
      const along = rx * dirX + rz * dirZ;
      if (along < 1 || along > range) return;
      const side = Math.abs(rx * dirZ - rz * dirX);
      const allowed = radius + along * spread;
      if (side > allowed) return;
      const score = along - side * 4;
      if (score > bestScore) {
        bestScore = score;
        best = { payload: payload, x: fromX + dirX * along, z: fromZ + dirZ * along, dist: along };
      }
    }

    for (let i = 0; i < CBH.G.pedestrians.length; i++) {
      const ped = CBH.G.pedestrians[i];
      if (ped.state === 'dead') continue;
      if (shooterIsPlayer && ped.isMissionChar) continue;
      consider(ped.group.position.x, ped.group.position.z, 0.75, { kind: 'ped', ped: ped });
    }
    if (!shooterIsPlayer && CBH.G.player && !CBH.G.inCar) {
      const pp = CBH.G.player.group.position;
      consider(pp.x, pp.z, 0.8, { kind: 'player' });
    }
    const carLists = [CBH.G.trafficCars, CBH.G.parkedCars, CBH.G.policeCars, CBH.G.missionCars];
    for (let l = 0; l < carLists.length; l++) {
      for (let i = 0; i < carLists[l].length; i++) {
        const car = carLists[l][i];
        if (!car.group.visible) continue;
        consider(car.group.position.x, car.group.position.z, 2.3, { kind: 'car', car: car });
      }
    }
    if (!shooterIsPlayer && CBH.G.inCar) {
      consider(CBH.G.inCar.group.position.x, CBH.G.inCar.group.position.z, 2.5, { kind: 'playerCar' });
    }
    if (!best) {
      best = { payload: { kind: 'none' }, x: fromX + dirX * range, z: fromZ + dirZ * range, dist: range };
    }
    return best;
  }

  // Fire one shot. opts: {damage, spread, isPlayer, soundLevel}
  function fireShot(fromX, fromY, fromZ, heading, opts) {
    opts = opts || {};
    const range = opts.range || C.TUNING.pistolRange;
    const target = findShotTarget(fromX, fromZ, heading, range, opts.spread || 0.02, !!opts.isPlayer);
    drawTracer(fromX, fromY, fromZ, target.x, 1.25, target.z);
    CBH.particles.spawn(fromX + Math.sin(heading) * 0.6, fromY, fromZ + Math.cos(heading) * 0.6, 'muzzle', 2);
    CBH.audio.gunshot();
    const payload = target.payload;
    if (payload.kind === 'ped') {
      CBH.peds.damage(payload.ped, opts.damage || C.TUNING.pistolDamage, fromX, fromZ);
      CBH.particles.spawn(target.x, 1.3, target.z, 'sparks', 4);
    } else if (payload.kind === 'car') {
      CBH.cars.damage(payload.car, (opts.damage || C.TUNING.pistolDamage) * 0.5);
      CBH.particles.spawn(target.x, 0.9, target.z, 'sparks', 5);
      if (payload.car.role === 'traffic') {
        payload.car.fleeTimer = 4;
        payload.car.panic = 3;
      }
    } else if (payload.kind === 'player') {
      CBH.player.hurtPlayer(opts.damage || 11);
      CBH.particles.spawn(target.x, 1.3, target.z, 'sparks', 3);
    } else if (payload.kind === 'playerCar') {
      CBH.cars.damage(CBH.G.inCar, (opts.damage || 14) * 0.4);
      CBH.player.hurtPlayer((opts.damage || 14) * 0.25);
      CBH.particles.spawn(target.x, 0.9, target.z, 'sparks', 4);
    } else {
      CBH.particles.spawn(target.x, 1.0, target.z, 'dust', 2);
    }
    // Gunfire panics the neighbourhood and draws heat when witnessed.
    CBH.peds.panicNear(fromX, fromZ, 30);
    CBH.traffic.panicNear(fromX, fromZ, 36);
    if (opts.isPlayer) CBH.state.reportCrime(16);
    return target;
  }

  // A punch: short range, quiet, knocks people down.
  function throwPunch(fromX, fromZ, heading) {
    CBH.audio.punch();
    const fx = fromX + Math.sin(heading) * C.TUNING.punchRange;
    const fz = fromZ + Math.cos(heading) * C.TUNING.punchRange;
    let hit = false;
    for (let i = 0; i < CBH.G.pedestrians.length; i++) {
      const ped = CBH.G.pedestrians[i];
      if (ped.state === 'dead' || ped.isMissionChar) continue;
      if (M.distance2D(ped.group.position.x, ped.group.position.z, fx, fz) < 1.1) {
        CBH.peds.damage(ped, C.TUNING.punchDamage, fromX, fromZ);
        if (ped.health > 0) CBH.peds.knockDown(ped, false);
        CBH.G.hitStop = Math.max(CBH.G.hitStop, 0.06);
        hit = true;
      }
    }
    if (hit) CBH.state.reportCrime(10);
    return hit;
  }

  window.CBH.combat = {
    buildTracers: buildTracerPool,
    updateTracers: updateTracers,
    fireShot: fireShot,
    punch: throwPunch,
  };
})();

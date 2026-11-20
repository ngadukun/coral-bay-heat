// police.js — Coral Bay PD: the wanted star system and the response.
// Crimes raise heat; police interceptors spawn at the island edges and
// pursue with ramming and boxing-in, roadblocks appear at three stars,
// and officers get out and shoot when Mari is on foot or stopped. Heat
// cools while she stays out of sight, and standing still near an officer
// with the Busted meter full ends the chase the cheap way.
(function () {
  'use strict';
  window.CBH = window.CBH || {};
  const C = CBH.config;
  const M = CBH.math;

  const STAR_THRESHOLDS = [0, 12, 30, 52, 74, 92]; // points where star N+1 lights

  function starsForPoints(points) {
    let stars = 0;
    for (let i = 0; i < STAR_THRESHOLDS.length; i++) {
      if (points >= STAR_THRESHOLDS[i]) stars = i;
    }
    return Math.min(5, stars);
  }

  function desiredPoliceCount(stars) {
    return [0, 1, 2, 3, 4, 6][stars] || 0;
  }

  function spawnPoliceCar() {
    const G = CBH.G;
    const pp = CBH.state.playerPosition();
    // Spawn at a road edge, out of sight but close enough to matter.
    const avenues = C.AVENUES_X;
    const streets = C.STREETS_Z;
    let x, z;
    const side = Math.floor(Math.random() * 4);
    if (side === 0) { x = pp.x + (Math.random() < 0.5 ? -150 : 150); z = CBH.traffic.nearestStreet(pp.z); }
    else if (side === 1) { x = pp.x + (Math.random() < 0.5 ? -150 : 150); z = CBH.traffic.nearestStreet(pp.z + 40); }
    else if (side === 2) { z = pp.z + (Math.random() < 0.5 ? -150 : 150); x = CBH.traffic.nearestAvenue(pp.x); }
    else { z = pp.z + (Math.random() < 0.5 ? -150 : 150); x = CBH.traffic.nearestAvenue(pp.x + 40); }
    x = M.clamp(x, -244, 244);
    z = M.clamp(z, -244, 244);
    if (CBH.city.isPointInWater(x, z)) { x = M.clamp(x, -200, 200); z = M.clamp(z, -200, 200); }
    const car = CBH.cars.create('police', 0xf2f2f2, x, z, 0);
    car.role = 'police';
    car.cruiseSpeed = 40;
    car.officer = null;
    car.roadblock = false;
    car.stuckTimer = 0;
    G.policeCars.push(car);
    return car;
  }

  function spawnRoadblock(aheadX, aheadZ) {
    const G = CBH.G;
    for (let i = 0; i < 2; i++) {
      const car = CBH.cars.create('police', 0xf2f2f2, aheadX + (i === 0 ? -3.4 : 3.4), aheadZ + (i === 0 ? 1 : -1), Math.PI / 2);
      car.role = 'police';
      car.roadblock = true;
      car.speed = 0;
      car.officer = null;
      G.policeCars.push(car);
    }
    CBH.hud.showToast('Police roadblock ahead!');
  }

  function updateWanted(dt) {
    const G = CBH.G;
    const previousStars = G.wantedStars;
    // Police "see" the player when any unit is close with a clear run.
    let seen = false;
    const pp = CBH.state.playerPosition();
    for (let i = 0; i < G.policeCars.length; i++) {
      const car = G.policeCars[i];
      if (M.distance2D(car.group.position.x, car.group.position.z, pp.x, pp.z) < 68) seen = true;
      if (car.officer && car.officer.state !== 'dead') {
        if (M.distance2D(car.officer.group.position.x, car.officer.group.position.z, pp.x, pp.z) < 55) seen = true;
      }
    }
    G.policeSeePlayer = seen;
    if (seen) {
      G.searchTimer = 0;
    } else if (G.wantedPoints > 0) {
      G.searchTimer += dt;
      if (G.searchTimer > 4) {
        G.wantedPoints = Math.max(0, G.wantedPoints - C.TUNING.wantedDecayPerSecond * dt);
        if (G.wantedPoints === 0) G.searchTimer = 0;
      }
    }
    G.wantedStars = starsForPoints(G.wantedPoints);
    if (G.wantedStars > previousStars) {
      CBH.hud.showCenterMessage(G.wantedStars + (G.wantedStars === 1 ? ' STAR' : ' STARS'), 'Coral Bay PD is on you', 1300);
    }
    // Force a minimum heat floor while a mission demands it.
    if (G.heatFloor && G.wantedPoints < G.heatFloor) {
      G.wantedPoints = G.heatFloor;
      G.wantedStars = starsForPoints(G.wantedPoints);
    }
    // Spawn / despawn units to match the heat.
    const wanted = desiredPoliceCount(G.wantedStars);
    if (G.mode === 'play' && G.policeCars.length < wanted) {
      if (!G.policeSpawnCooldown || G.policeSpawnCooldown <= 0) {
        spawnPoliceCar();
        G.policeSpawnCooldown = 2.5;
      }
    }
    if (G.policeSpawnCooldown > 0) G.policeSpawnCooldown -= dt;
    if (G.wantedStars === 0) {
      // Heat gone: units peel off and despawn.
      for (let i = G.policeCars.length - 1; i >= 0; i--) {
        const car = G.policeCars[i];
        if (car.officer) dismissOfficer(car);
        CBH.cars.remove(car);
      }
    }
    // Roadblocks at three stars and up, occasionally, ahead of the player.
    if (G.wantedStars >= 3 && G.inCar && Math.random() < dt * 0.05) {
      const car = G.inCar;
      const aheadX = car.group.position.x + Math.sin(car.heading) * 85;
      const aheadZ = car.group.position.z + Math.cos(car.heading) * 85;
      if (Math.abs(aheadX) < 240 && Math.abs(aheadZ) < 240 && !CBH.city.isPointInWater(aheadX, aheadZ)) {
        const roadX = CBH.traffic.nearestAvenue(aheadX);
        const roadZ = CBH.traffic.nearestStreet(aheadZ);
        spawnRoadblock(Math.abs(aheadX - roadX) < Math.abs(aheadZ - roadZ) ? roadX : aheadX, Math.abs(aheadX - roadX) < Math.abs(aheadZ - roadZ) ? aheadZ : roadZ);
      }
    }
    updateBusted(dt, seen);
  }

  function updateBusted(dt, seen) {
    const G = CBH.G;
    if (G.wantedStars === 0 || G.player.dead) {
      G.bustedMeter = Math.max(0, G.bustedMeter - dt);
      return;
    }
    const pp = CBH.state.playerPosition();
    const playerSpeed = G.inCar ? Math.abs(G.inCar.speed) : 3;
    let nearestOfficer = 1e9;
    for (let i = 0; i < G.policeCars.length; i++) {
      const car = G.policeCars[i];
      nearestOfficer = Math.min(nearestOfficer, M.distance2D(car.group.position.x, car.group.position.z, pp.x, pp.z));
      if (car.officer && car.officer.state !== 'dead') {
        nearestOfficer = Math.min(nearestOfficer, M.distance2D(car.officer.group.position.x, car.officer.group.position.z, pp.x, pp.z));
      }
    }
    const vulnerable = !G.inCar || playerSpeed < 3.5;
    if (seen && vulnerable && nearestOfficer < 13) {
      G.bustedMeter += C.TUNING.bustedFillRate * dt * (1.6 - nearestOfficer / 13);
    } else {
      G.bustedMeter -= C.TUNING.bustedDrainRate * dt;
    }
    G.bustedMeter = M.clamp(G.bustedMeter, 0, 1);
    if (G.bustedMeter >= 1) {
      CBH.missions.onPlayerBusted();
    }
  }

  function dismissOfficer(car) {
    if (car.officer) {
      CBH.peds.remove(car.officer);
      car.officer = null;
    }
  }

  function deployOfficer(car) {
    const pos = car.group.position;
    const officer = CBH.peds.create(pos.x + 2, pos.z + 1, {
      shirt: 0x2456a8, pants: 0x1c2a44, skin: CBH.rng.pick(C.SKIN_TONES),
      isOfficer: true, noSnap: true, badge: true, gun: true, health: 80,
    });
    officer.state = 'attack';
    car.officer = officer;
    return officer;
  }

  function updatePoliceCar(car, dt) {
    const G = CBH.G;
    if (car.dead) {
      if (car.officer) updateOfficer(car, dt);
      return;
    }
    const pos = car.group.position;
    const pp = CBH.state.playerPosition();
    const distToPlayer = M.distance2D(pos.x, pos.z, pp.x, pp.z);

    if (car.roadblock) {
      updatePoliceLights(car, dt);
      if (distToPlayer > 190) CBH.cars.remove(car);
      return;
    }
    // Officer deployment: when close and the player is on foot or stopped.
    const playerSlow = !G.inCar || Math.abs(G.inCar.speed) < 3;
    if (distToPlayer < 17 && playerSlow && !car.officer && G.wantedStars >= 1) {
      deployOfficer(car);
    }
    if (car.officer) {
      // The car holds position while its officer is out.
      car.speed = M.lerp(car.speed, 0, dt * 4);
      updateOfficer(car, dt);
      updatePoliceLights(car, dt);
      CBH.cars.updateVisuals(car, dt, false);
      if (car.officer.state === 'dead') {
        car.officer = null;
      }
      return;
    }
    // Pursuit steering: aim at a point just behind the player's heading so
    // the interceptor rams and boxes in rather than orbiting.
    let targetX = pp.x;
    let targetZ = pp.z;
    if (G.inCar) {
      targetX = pp.x - Math.sin(G.inCar.heading) * 2;
      targetZ = pp.z - Math.cos(G.inCar.heading) * 2;
    }
    const desired = M.headingTo(pos.x, pos.z, targetX, targetZ);
    let headingDiff = desired - car.heading;
    while (headingDiff > Math.PI) headingDiff -= Math.PI * 2;
    while (headingDiff < -Math.PI) headingDiff += Math.PI * 2;
    const maxSpeed = car.spec.topSpeed * (0.82 + G.wantedStars * 0.05);
    let targetSpeed = maxSpeed;
    if (Math.abs(headingDiff) > 1.9) targetSpeed = -8; // reverse out of a bad angle
    else if (Math.abs(headingDiff) > 0.8) targetSpeed = maxSpeed * 0.45;
    if (distToPlayer < 6) targetSpeed = Math.min(targetSpeed, 8);
    car.steer = M.clamp(headingDiff * 1.6, -1, 1);
    car.heading += car.steer * 1.7 * dt * (car.speed < -0.5 ? -1 : 1);
    if (car.speed < targetSpeed) car.speed = Math.min(targetSpeed, car.speed + car.spec.accel * dt);
    else car.speed = Math.max(targetSpeed, car.speed - 30 * dt);

    let nx = pos.x + Math.sin(car.heading) * car.speed * dt;
    let nz = pos.z + Math.cos(car.heading) * car.speed * dt;
    const resolved = CBH.city.collideCircle(nx, nz, 2.0);
    if (resolved.hit) {
      car.speed *= 0.35;
      car.stuckTimer += dt;
      if (car.stuckTimer > 1.4) {
        car.heading += Math.PI * 0.9; // spin out and re-approach
        car.stuckTimer = 0;
      }
      nx = resolved.x;
      nz = resolved.z;
    } else {
      car.stuckTimer = 0;
    }
    if (CBH.city.isPointInWater(nx, nz)) {
      car.speed = 0;
      car.heading += Math.PI;
    } else {
      pos.x = nx;
      pos.z = nz;
    }
    car.group.rotation.y = car.heading;
    updatePoliceLights(car, dt);
    CBH.cars.updateVisuals(car, dt, targetSpeed < car.speed - 1);
    // Despawn units that fell hopelessly behind when the heat is low.
    if (distToPlayer > 320 && G.wantedStars <= 2) {
      CBH.cars.remove(car);
    }
  }

  function updatePoliceLights(car, dt) {
    const flash = Math.sin(CBH.G.clockTime * 11 + car.id) > 0;
    const red = car.group.userData.redLamp;
    const blue = car.group.userData.blueLamp;
    if (red && blue) {
      red.material.emissiveIntensity = flash ? 2.4 : 0.1;
      blue.material.emissiveIntensity = flash ? 0.1 : 2.4;
    }
  }

  function updateOfficer(car, dt) {
    const officer = car.officer;
    if (!officer || officer.state === 'dead') return;
    const G = CBH.G;
    const pos = officer.group.position;
    const pp = CBH.state.playerPosition();
    const dist = M.distance2D(pos.x, pos.z, pp.x, pp.z);
    officer.heading = M.headingTo(pos.x, pos.z, pp.x, pp.z);
    officer.group.rotation.y = officer.heading;
    let speedRatio = 0;
    if (dist > 26) {
      // Close the gap on foot.
      const nx = pos.x + Math.sin(officer.heading) * 4.6 * dt;
      const nz = pos.z + Math.cos(officer.heading) * 4.6 * dt;
      const resolved = CBH.city.collideCircle(nx, nz, 0.5);
      pos.x = resolved.x;
      pos.z = resolved.z;
      speedRatio = 0.9;
    } else if (dist < 12) {
      // Step sideways to a firing position — simple cover behaviour.
      const side = Math.sin(CBH.G.clockTime * 0.7 + officer.id) > 0 ? 1 : -1;
      pos.x += Math.cos(officer.heading) * side * 1.1 * dt;
      pos.z -= Math.sin(officer.heading) * side * 1.1 * dt;
      speedRatio = 0.3;
    }
    CBH.peds.animate(officer, dt, speedRatio);
    // Shooting in bursts when in range.
    officer.shootCooldown -= dt;
    if (dist < 42 && officer.shootCooldown <= 0) {
      if (officer.burstLeft <= 0) {
        officer.burstLeft = 3;
        officer.shootCooldown = 1.1 + Math.random() * 0.7;
      } else {
        officer.burstLeft--;
        officer.shootCooldown = 0.19;
        CBH.combat.fireShot(pos.x, 1.45, pos.z, officer.heading, { damage: 9, spread: 0.05 + dist / 900 });
      }
    }
    if (dist > 120) {
      // Too far: get back in the car.
      dismissOfficer(car);
    }
  }

  function updatePolice(dt) {
    const G = CBH.G;
    updateWanted(dt);
    for (let i = G.policeCars.length - 1; i >= 0; i--) {
      updatePoliceCar(G.policeCars[i], dt);
    }
    // Siren audio follows the nearest active unit.
    let nearest = 1e9;
    for (let i = 0; i < G.policeCars.length; i++) {
      const car = G.policeCars[i];
      nearest = Math.min(nearest, M.distance2D(car.group.position.x, car.group.position.z, CBH.state.playerPosition().x, CBH.state.playerPosition().z));
    }
    CBH.audio.updateSiren(G.clockTime, nearest, G.wantedStars > 0 && G.policeCars.length > 0);
  }

  function clearWanted() {
    const G = CBH.G;
    G.wantedPoints = 0;
    G.wantedStars = 0;
    G.bustedMeter = 0;
    G.heatFloor = 0;
    for (let i = G.policeCars.length - 1; i >= 0; i--) {
      dismissOfficer(G.policeCars[i]);
      CBH.cars.remove(G.policeCars[i]);
    }
  }

  function setWantedStars(stars) {
    const G = CBH.G;
    G.wantedPoints = STAR_THRESHOLDS[Math.min(5, stars)] + 1;
    G.wantedStars = starsForPoints(G.wantedPoints);
  }

  window.CBH.police = {
    update: updatePolice,
    clearWanted: clearWanted,
    setStars: setWantedStars,
    starsForPoints: starsForPoints,
    spawnCar: spawnPoliceCar,
  };
})();

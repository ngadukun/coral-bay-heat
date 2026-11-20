// traffic.js — Coral Bay's civilian traffic and parked cars. Traffic cars
// pick a lane on the road grid, keep spacing, stop at red lights, brake
// for obstacles and the player, honk when blocked, and flee or swerve when
// gunfire or a crash erupts nearby. Parked cars line the kerbs waiting to
// be borrowed.
(function () {
  'use strict';
  window.CBH = window.CBH || {};
  const C = CBH.config;
  const R = CBH.rng;
  const M = CBH.math;

  // A traffic car travels along one axis-aligned road toward a target
  // intersection, then turns. dir: 0=+x, 1=-x, 2=+z, 3=-z.
  function lanePositionFor(car) {
    const pos = car.group.position;
    if (car.dir === 0) return { x: pos.x, z: car.roadCoord + C.WORLD.laneOffset };
    if (car.dir === 1) return { x: pos.x, z: car.roadCoord - C.WORLD.laneOffset };
    if (car.dir === 2) return { x: car.roadCoord - C.WORLD.laneOffset, z: pos.z };
    return { x: car.roadCoord + C.WORLD.laneOffset, z: pos.z };
  }

  function pickNextRoad(car) {
    // At an intersection: mostly straight on, often a turn, rarely a U-turn.
    const roll = R.jitter();
    let newDir = car.dir;
    if (roll < 0.45) newDir = car.dir;
    else if (roll < 0.72) newDir = turnLeft(car.dir);
    else if (roll < 0.97) newDir = turnRight(car.dir);
    else newDir = (car.dir + 2) % 4;
    car.dir = newDir;
    if (newDir === 0 || newDir === 1) {
      car.roadCoord = nearestStreet(car.group.position.z);
      car.targetCoord = newDir === 0 ? 290 : -290;
    } else {
      car.roadCoord = nearestAvenue(car.group.position.x);
      car.targetCoord = newDir === 2 ? 290 : -290;
    }
  }

  function turnLeft(dir) {
    // Facing +x (east), left is -z (north): dir 0->3, 1->2, 2->0, 3->1.
    return [3, 2, 0, 1][dir];
  }

  function turnRight(dir) {
    return [2, 3, 1, 0][dir];
  }

  function nearestAvenue(x) {
    let best = C.AVENUES_X[0];
    for (let i = 0; i < C.AVENUES_X.length; i++) if (Math.abs(C.AVENUES_X[i] - x) < Math.abs(best - x)) best = C.AVENUES_X[i];
    return best;
  }

  function nearestStreet(z) {
    let best = C.STREETS_Z[0];
    for (let i = 0; i < C.STREETS_Z.length; i++) if (Math.abs(C.STREETS_Z[i] - z) < Math.abs(best - z)) best = C.STREETS_Z[i];
    return best;
  }

  function spawnTrafficCar(x, z, dir) {
    const type = R.pick(C.CAR_TYPES);
    const color = type === 'taxi' ? 0xf2b13c : R.pick(C.CAR_COLORS);
    const actualType = R.chance(0.10) ? 'taxi' : type;
    const car = CBH.cars.create(actualType, actualType === 'taxi' ? 0xf2b13c : color, x, z, 0);
    car.role = 'traffic';
    car.dir = dir;
    car.cruiseSpeed = R.range(10, 15.5);
    car.speed = car.cruiseSpeed * 0.7;
    car.blockedTimer = 0;
    car.fleeTimer = 0;
    car.panic = 0;
    if (dir === 0 || dir === 1) {
      car.roadCoord = nearestStreet(z);
      car.targetCoord = dir === 0 ? 290 : -290;
    } else {
      car.roadCoord = nearestAvenue(x);
      car.targetCoord = dir === 2 ? 290 : -290;
    }
    const lane = lanePositionFor(car);
    car.group.position.x = lane.x;
    car.group.position.z = lane.z;
    car.heading = [Math.PI / 2, -Math.PI / 2, 0, Math.PI][dir];
    car.group.rotation.y = car.heading;
    CBH.G.trafficCars.push(car);
    return car;
  }

  function spawnTrafficFleet() {
    const count = C.TUNING.trafficCount;
    for (let i = 0; i < count; i++) {
      const onAvenue = R.chance(0.5);
      if (onAvenue) {
        const x = R.pick(C.AVENUES_X) + R.range(-2, 2);
        const z = R.range(-235, 235);
        spawnTrafficCar(x, z, R.chance(0.5) ? 2 : 3);
      } else {
        const x = R.range(-235, 235);
        const z = R.pick(C.STREETS_Z) + R.range(-2, 2);
        spawnTrafficCar(x, z, R.chance(0.5) ? 0 : 1);
      }
    }
  }

  function spawnParkedCars() {
    const count = C.TUNING.parkedCount;
    let placed = 0;
    let guard = 0;
    while (placed < count && guard++ < 300) {
      const avenue = R.pick(C.AVENUES_X.slice(1, 7));
      const street = R.pick(C.STREETS_Z.slice(1, 7));
      const alongAvenue = R.chance(0.5);
      let x, z, heading;
      if (alongAvenue) {
        x = avenue + (R.chance(0.5) ? 5.6 : -5.6);
        z = street + R.range(14, 62) * (R.chance(0.5) ? 1 : -1);
        heading = x > avenue ? Math.PI : 0;
        heading = R.chance(0.5) ? 0 : Math.PI;
      } else {
        z = street + (R.chance(0.5) ? 5.6 : -5.6);
        x = avenue + R.range(14, 62) * (R.chance(0.5) ? 1 : -1);
        heading = R.chance(0.5) ? Math.PI / 2 : -Math.PI / 2;
      }
      if (Math.abs(x) > 245 || Math.abs(z) > 245) continue;
      if (CBH.city.isPointInWater(x, z)) continue;
      const resolved = CBH.city.collideCircle(x, z, 2.4);
      if (resolved.hit) continue;
      const type = R.pick(C.CAR_TYPES);
      const car = CBH.cars.create(type, R.pick(C.CAR_COLORS), x, z, heading);
      car.role = 'parked';
      car.heading = heading;
      CBH.G.parkedCars.push(car);
      placed++;
    }
    // A guaranteed convertible near the spawn for the player's first drive.
    const starter = CBH.cars.create('convertible', 0xff7f50, -28, 208, Math.PI);
    starter.role = 'parked';
    starter.heading = Math.PI;
    CBH.G.parkedCars.push(starter);
    // A taxi waiting by the marina rank.
    const rankTaxi = CBH.cars.create('taxi', 0xf2b13c, 66, 208, Math.PI);
    rankTaxi.role = 'parked';
    rankTaxi.heading = Math.PI;
    CBH.G.parkedCars.push(rankTaxi);
  }

  function obstacleAhead(car, lookDistance) {
    const pos = car.group.position;
    const fx = Math.sin(car.heading);
    const fz = Math.cos(car.heading);
    const checkX = pos.x + fx * lookDistance;
    const checkZ = pos.z + fz * lookDistance;
    // Another car?
    const lists = [CBH.G.trafficCars, CBH.G.policeCars, CBH.G.parkedCars, CBH.G.missionCars];
    for (let l = 0; l < lists.length; l++) {
      for (let i = 0; i < lists[l].length; i++) {
        const other = lists[l][i];
        if (other === car) continue;
        if (M.distance2D(other.group.position.x, other.group.position.z, checkX, checkZ) < 3.4) return other;
      }
    }
    if (CBH.G.inCar && M.distance2D(CBH.G.inCar.group.position.x, CBH.G.inCar.group.position.z, checkX, checkZ) < 3.6) return CBH.G.inCar;
    if (!CBH.G.inCar && CBH.G.player) {
      const pp = CBH.G.player.group.position;
      if (M.distance2D(pp.x, pp.z, checkX, checkZ) < 2.2) return 'player';
    }
    // A red light at the next intersection?
    const phase = CBH.sky ? phaseFor(car) : 0;
    if (phase === 'red') {
      const distToIntersection = distanceToNextIntersection(car);
      if (distToIntersection > 2 && distToIntersection < lookDistance + 4) return 'light';
    }
    return null;
  }

  function phaseFor(car) {
    // Lights run on a global clock in sky.js trafficLightPhase terms:
    // 0 = avenues green, 1 = streets green, -1 = amber (treated as red).
    const cycle = CBH.G.clockTime % 13;
    const avenuesGreen = cycle < 5.5;
    const streetsGreen = cycle >= 7 && cycle < 12;
    const movingAlongAvenue = car.dir === 2 || car.dir === 3; // travelling in z => on an avenue
    if (movingAlongAvenue) return avenuesGreen ? 'green' : 'red';
    return streetsGreen ? 'green' : 'red';
  }

  function distanceToNextIntersection(car) {
    const pos = car.group.position;
    let best = 1e9;
    if (car.dir === 0 || car.dir === 1) {
      for (let i = 0; i < C.AVENUES_X.length; i++) {
        const d = (C.AVENUES_X[i] - pos.x) * (car.dir === 0 ? 1 : -1);
        if (d > 0 && d < best) best = d;
      }
    } else {
      for (let i = 0; i < C.STREETS_Z.length; i++) {
        const d = (C.STREETS_Z[i] - pos.z) * (car.dir === 2 ? 1 : -1);
        if (d > 0 && d < best) best = d;
      }
    }
    return best;
  }

  function updateTrafficCar(car, dt) {
    if (car.dead || car.role !== 'traffic') return;
    const pos = car.group.position;
    // Despawn far cars and respawn near the player to keep the city alive.
    const pp = CBH.state.playerPosition();
    const distToPlayer = M.distance2D(pos.x, pos.z, pp.x, pp.z);
    if (distToPlayer > 340) {
      respawnTrafficNear(car, pp);
      return;
    }
    // Panic: gunfire or a crash nearby makes drivers flee or swerve.
    if (car.fleeTimer > 0) car.fleeTimer -= dt;
    const targetSpeedBase = car.fleeTimer > 0 ? car.cruiseSpeed * 1.7 : car.cruiseSpeed;
    const obstacle = obstacleAhead(car, 9 + Math.abs(car.speed) * 0.7);
    let targetSpeed = targetSpeedBase;
    if (obstacle) {
      targetSpeed = 0;
      car.blockedTimer += dt;
      if (car.blockedTimer > 1.6 && R.jitter() < dt * 0.5) {
        CBH.audio.horn(R.range(300, 430));
        car.blockedTimer = 0.6;
      }
    } else {
      car.blockedTimer = 0;
    }
    if (car.speed < targetSpeed) car.speed = Math.min(targetSpeed, car.speed + car.spec.accel * 0.7 * dt);
    else car.speed = Math.max(targetSpeed, car.speed - 26 * dt);

    // Steering toward the lane centre, with a panic swerve.
    const lane = lanePositionFor(car);
    let steerTargetX = lane.x;
    let steerTargetZ = lane.z;
    if (car.dir === 0) steerTargetX = pos.x + 20;
    if (car.dir === 1) steerTargetX = pos.x - 20;
    if (car.dir === 2) steerTargetZ = pos.z + 20;
    if (car.dir === 3) steerTargetZ = pos.z - 20;
    if (car.panic > 0) {
      car.panic -= dt;
      steerTargetX += Math.sin(CBH.G.clockTime * 9 + car.id) * 3;
      steerTargetZ += Math.cos(CBH.G.clockTime * 7 + car.id) * 3;
    }
    const desired = M.headingTo(pos.x, pos.z, steerTargetX, steerTargetZ);
    car.heading = M.angleLerp(car.heading, desired, Math.min(1, dt * 2.6));
    car.steer = M.clamp((desired - car.heading) * 2, -1, 1);

    let nx = pos.x + Math.sin(car.heading) * car.speed * dt;
    let nz = pos.z + Math.cos(car.heading) * car.speed * dt;
    const resolved = CBH.city.collideCircle(nx, nz, 1.9);
    if (resolved.hit) {
      car.speed *= 0.3;
      nx = resolved.x;
      nz = resolved.z;
    }
    if (CBH.city.isPointInWater(nx, nz)) {
      car.speed = 0;
      pickNextRoad(car);
      return;
    }
    pos.x = nx;
    pos.z = nz;
    car.group.rotation.y = car.heading;
    CBH.cars.updateVisuals(car, dt, targetSpeed < car.speed - 1);

    // Reached the end of this road or crossed an intersection: maybe turn.
    const pastTarget = (car.dir === 0 && pos.x > car.targetCoord) || (car.dir === 1 && pos.x < car.targetCoord) ||
      (car.dir === 2 && pos.z > car.targetCoord) || (car.dir === 3 && pos.z < car.targetCoord);
    const nearIntersection = distanceToNextIntersection(car) < 3.2 && Math.abs(car.speed) > 1;
    if (pastTarget || (nearIntersection && R.jitter() < 0.012)) {
      if (pastTarget) {
        // Wrap: swing around to a fresh road rather than leaving the island.
        pickNextRoad(car);
      } else {
        pickNextRoad(car);
      }
    }
  }

  function respawnTrafficNear(car, pp) {
    const angle = R.jitter() * Math.PI * 2;
    const dist = 150 + R.jitter() * 60;
    let x = M.clamp(pp.x + Math.cos(angle) * dist, -240, 240);
    let z = M.clamp(pp.z + Math.sin(angle) * dist, -240, 240);
    const dir = Math.floor(R.jitter() * 4);
    car.dir = dir;
    if (dir === 0 || dir === 1) {
      car.roadCoord = nearestStreet(z);
      car.targetCoord = dir === 0 ? 290 : -290;
      car.group.position.set(x, 0, car.roadCoord + (dir === 0 ? C.WORLD.laneOffset : -C.WORLD.laneOffset));
    } else {
      car.roadCoord = nearestAvenue(x);
      car.targetCoord = dir === 2 ? 290 : -290;
      car.group.position.set(car.roadCoord + (dir === 2 ? -C.WORLD.laneOffset : C.WORLD.laneOffset), 0, z);
    }
    car.heading = [Math.PI / 2, -Math.PI / 2, 0, Math.PI][dir];
    car.speed = car.cruiseSpeed * 0.6;
    car.health = 100;
    car.dead = false;
  }

  function panicTrafficNear(x, z, radius) {
    for (let i = 0; i < CBH.G.trafficCars.length; i++) {
      const car = CBH.G.trafficCars[i];
      if (M.distance2D(car.group.position.x, car.group.position.z, x, z) < radius) {
        car.fleeTimer = 3.5;
        car.panic = 2.5;
      }
    }
  }

  function updateTraffic(dt) {
    for (let i = 0; i < CBH.G.trafficCars.length; i++) updateTrafficCar(CBH.G.trafficCars[i], dt);
    for (let i = 0; i < CBH.G.parkedCars.length; i++) {
      const car = CBH.G.parkedCars[i];
      if (car.dead) CBH.cars.updateVisuals(car, dt, false);
    }
  }

  window.CBH.traffic = {
    spawnFleet: spawnTrafficFleet,
    spawnParked: spawnParkedCars,
    spawnCar: spawnTrafficCar,
    update: updateTraffic,
    panicNear: panicTrafficNear,
    nearestAvenue: nearestAvenue,
    nearestStreet: nearestStreet,
  };
})();

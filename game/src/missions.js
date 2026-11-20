// missions.js — the mission runner and Coral Bay's side hustles. It reads
// missions-data.js and plays it: gold markers, opening dialogue, objective
// steps (drives, chases, tailing, shootouts, a cafe defence, escapes),
// checkpoints, timers and rewards — plus taxi fares, two checkpoint street
// races, and the Busted/Wasted respawn flow.
(function () {
  'use strict';
  window.CBH = window.CBH || {};
  const C = CBH.config;
  const M = CBH.math;
  const DATA = CBH.missionsData;

  let missionMarker = null;
  let raceMarker = null;
  let taxiRing = null;
  let waitingPassenger = null;
  let passengerTimer = 8;
  let tipIndex = 0;
  let tipTimer = 20;

  function makeBeamMarker(colorHex, radius) {
    const group = new THREE.Group();
    const beamMaterial = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.30, depthWrite: false, side: THREE.DoubleSide });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 34, 14, 1, true), beamMaterial);
    beam.position.y = 17;
    group.add(beam);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius + 0.5, 0.16, 8, 28), new THREE.MeshBasicMaterial({ color: colorHex }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.35;
    group.add(ring);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(radius, 20), new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.22, depthWrite: false }));
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.22;
    group.add(disc);
    group.visible = false;
    CBH.G.scene.add(group);
    return group;
  }

  function buildMarkers(scene) {
    missionMarker = makeBeamMarker(0xffd23e, 2.4);
    raceMarker = makeBeamMarker(0x4ef0e0, 2.4);
    taxiRing = makeBeamMarker(0xffffff, 1.6);
  }

  function setMarker(marker, x, z) {
    if (!marker) return;
    if (x === null || x === undefined) {
      marker.visible = false;
      return;
    }
    marker.visible = true;
    marker.position.set(x, 0, z);
  }

  // ---- dialogue -----------------------------------------------------------
  function playDialogue(lines, onDone) {
    CBH.hud.showDialogue(lines, onDone);
  }

  // ---- mission lifecycle ----------------------------------------------------
  function currentMissionDef() {
    return DATA.MISSIONS[CBH.G.missionIndex] || null;
  }

  function startMission(def) {
    const G = CBH.G;
    if (def.nightRun) CBH.sky.setTimeOfDay(0.02);
    if (def.grantsPistol && !G.hasPistol) {
      CBH.player.givePistol(48);
      CBH.hud.showToast('You found a pistol in the glovebox (+48 rounds)');
    }
    G.activeMission = {
      def: def,
      stepIndex: -1,
      step: null,
      timer: def.timer || 0,
      targetCar: null,
      passengerPed: null,
      passengerAboard: false,
      gunmen: [],
      follow: null,
      defend: null,
      heatRampTimer: 0,
      caughtTimer: 0,
      started: false,
    };
    playDialogue(def.intro, function () {
      G.activeMission.started = true;
      advanceStep();
    });
  }

  function advanceStep() {
    const G = CBH.G;
    const active = G.activeMission;
    if (!active) return;
    cleanupStepEntities();
    active.stepIndex++;
    if (active.stepIndex >= active.def.steps.length) {
      completeMission();
      return;
    }
    active.step = active.def.steps[active.stepIndex];
    active.caughtTimer = 0;
    active.heatRampTimer = 0;
    setupStep(active.step);
    if (active.stepIndex > 0) {
      CBH.hud.showToast('Checkpoint reached');
      CBH.save.write();
    }
  }

  function cleanupStepEntities() {
    const G = CBH.G;
    const active = G.activeMission;
    if (!active) return;
    if (active.targetCar && active.targetCar.role === 'mission') {
      // Mission cars the player never took are removed between steps;
      // a car the player is driving stays theirs.
      if (CBH.G.inCar !== active.targetCar) CBH.cars.remove(active.targetCar);
    }
    active.targetCar = null;
    for (let i = 0; i < active.gunmen.length; i++) {
      if (active.gunmen[i].state !== 'dead') CBH.peds.remove(active.gunmen[i]);
    }
    active.gunmen = [];
    if (active.passengerPed && !active.passengerAboard) {
      CBH.peds.remove(active.passengerPed);
      active.passengerPed = null;
    }
  }

  function setupStep(step) {
    const G = CBH.G;
    const active = G.activeMission;
    if (step.kind === 'pickupCar') {
      const car = CBH.cars.create(step.carType, step.carColor, step.spawn.x, step.spawn.z, step.spawn.heading || 0);
      car.role = 'mission';
      car.heading = step.spawn.heading || 0;
      G.missionCars.push(car);
      active.targetCar = car;
      if (step.trailer) attachTrailer(car);
      if (step.alarm) CBH.hud.showToast('The alarm will draw police once you take it');
    }
    if (step.kind === 'chaseCar') {
      const car = CBH.traffic.spawnCar(step.spawn.x, step.spawn.z, 2);
      car.cruiseSpeed = 17.5;
      car.fleeTimer = 9999;
      car.isChaseTarget = true;
      active.targetCar = car;
    }
    if (step.kind === 'followCar') {
      const car = CBH.cars.create(step.carType, step.carColor, step.spawn.x, step.spawn.z, step.spawn.heading || 0);
      car.role = 'mission';
      car.heading = step.spawn.heading || 0;
      G.missionCars.push(car);
      active.targetCar = car;
      active.follow = { route: step.route.slice(), routeIndex: 0, spook: 0, lostTimer: 0, done: false };
    }
    if (step.kind === 'driveTo' && step.passenger) {
      const prev = active.def.steps[active.stepIndex - 1];
      const person = DATA.PEOPLE[step.passenger];
      const ped = CBH.peds.create(prev ? prev.x : step.x, prev ? prev.z : step.z, {
        isMissionChar: true, noSnap: true, name: person.name, shirt: 0xff9f68, pants: 0x5c374c, skin: 0xa9713f,
      });
      ped.state = 'idle';
      active.passengerPed = ped;
    }
    if (step.kind === 'shootout') {
      spawnGunmen(step.x, step.z, step.gunmen, active);
    }
    if (step.kind === 'defend') {
      active.defend = { timeLeft: step.duration, wave: 0, nextWaveAt: step.duration - 2 };
    }
    if (step.kind === 'escapeTo') {
      if (step.finalHeat) G.heatFloor = 92;
      else if (active.def.id === 'beach-party-bust') G.heatFloor = Math.max(G.heatFloor || 0, 30);
    }
    if (step.grantsHeat) {
      // applied on arrival in the goto check
    }
  }

  function attachTrailer(car) {
    const trailer = new THREE.Group();
    const frame = new THREE.Mesh(CBH.city.boxGeometry(2.2, 0.5, 6.4), CBH.city.flatMaterial(0x3a4046));
    frame.position.y = 0.75;
    trailer.add(frame);
    const boat = new THREE.Mesh(CBH.city.boxGeometry(2.6, 1.1, 5.6), CBH.city.flatMaterial(0xf2f2f2));
    boat.position.y = 1.6;
    trailer.add(boat);
    const cabin = new THREE.Mesh(CBH.city.boxGeometry(1.9, 0.9, 2.2), CBH.city.flatMaterial(0x2456a8));
    cabin.position.set(0, 2.4, -0.4);
    trailer.add(cabin);
    const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10);
    const wheelMat = CBH.city.flatMaterial(0x14161a);
    const w1 = new THREE.Mesh(wheelGeo, wheelMat);
    w1.rotation.z = Math.PI / 2;
    w1.position.set(-1.1, 0.42, -1.8);
    trailer.add(w1);
    const w2 = w1.clone();
    w2.position.x = 1.1;
    trailer.add(w2);
    CBH.G.scene.add(trailer);
    car.trailerGroup = trailer;
  }

  function updateTrailer(car) {
    if (!car.trailerGroup) return;
    const backX = car.group.position.x - Math.sin(car.heading) * 5.6;
    const backZ = car.group.position.z - Math.cos(car.heading) * 5.6;
    car.trailerGroup.position.set(backX, 0, backZ);
    car.trailerGroup.rotation.y = car.heading;
  }

  function spawnGunmen(x, z, count, active) {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const gx = x + Math.cos(angle) * (6 + i * 2);
      const gz = z + Math.sin(angle) * (6 + i * 2);
      const gunman = CBH.peds.create(gx, gz, {
        isGunman: true, noSnap: true, gun: true, health: 70,
        shirt: 0x2b2b33, pants: 0x1c1c22, skin: CBH.rng.pick(C.SKIN_TONES),
      });
      gunman.state = 'attack';
      active.gunmen.push(gunman);
      CBH.G.gunmen.push(gunman);
    }
  }

  function completeMission() {
    const G = CBH.G;
    const active = G.activeMission;
    const def = active.def;
    cleanupStepEntities();
    G.activeMission = null;
    G.heatFloor = 0;
    playDialogue(def.outro, function () {
      CBH.state.addCash(def.reward);
      CBH.audio.cash();
      if (G.hasPistol) G.pistolReserve += 24;
      CBH.hud.showMissionCard(def.title, '+$' + def.reward + ' — debt paid down');
      G.missionIndex++;
      CBH.save.write();
      if (G.missionIndex >= DATA.MISSIONS.length) {
        CBH.hud.showCenterMessage('STORY COMPLETE', 'Mari Solano is a free woman. Coral Bay remains yours.', 5000);
      }
    });
  }

  function failMission(reason) {
    const G = CBH.G;
    if (!G.activeMission) return;
    cleanupStepEntities();
    G.activeMission = null;
    G.heatFloor = 0;
    CBH.police.clearWanted();
    CBH.hud.showMissionCard('MISSION FAILED', reason || 'Try again from the gold marker');
    CBH.audio.crash(0.4);
  }

  // ---- step logic ---------------------------------------------------------
  function stepTarget(step, active) {
    if (!step) return null;
    if (active.targetCar && (step.kind === 'pickupCar' || step.kind === 'chaseCar' || step.kind === 'followCar')) {
      return { x: active.targetCar.group.position.x, z: active.targetCar.group.position.z };
    }
    if (step.x !== undefined) return { x: step.x, z: step.z };
    return null;
  }

  function currentObjective() {
    const G = CBH.G;
    if (G.activeMission && G.activeMission.step) {
      let label = G.activeMission.step.label;
      if (G.activeMission.step.onFoot && G.inCar) label += ' (on foot!)';
      return label;
    }
    if (G.activeTaxi) {
      return G.activeTaxi.phase === 'pickup' ? 'Pick up your fare' : 'Drop off your fare — the meter is running';
    }
    if (G.activeRace) {
      return G.activeRace.def.name + ': checkpoint ' + (G.activeRace.cpIndex + 1) + ' / ' + G.activeRace.def.checkpoints.length;
    }
    const def = currentMissionDef();
    if (def) return 'Next job: ' + def.title + ' — head to the gold marker';
    return 'Free roam — Coral Bay is yours';
  }

  function updateMission(dt) {
    const G = CBH.G;
    const active = G.activeMission;
    if (!active || !active.started || G.dialogueOpen) {
      setMarker(missionMarker, null);
      return;
    }
    const step = active.step;
    if (!step) return;
    const pp = CBH.state.playerPosition();
    const target = stepTarget(step, active);
    if (target) setMarker(missionMarker, target.x, target.z);
    else setMarker(missionMarker, null);

    // Mission timer.
    if (active.def.timer) {
      active.timer -= dt;
      if (active.timer <= 0) {
        failMission('Out of time');
        return;
      }
    }
    if (step.heatRamp) {
      active.heatRampTimer += dt;
      if (active.heatRampTimer > 18) {
        active.heatRampTimer = 0;
        G.heatFloor = Math.min(52, (G.heatFloor || 0) + 22);
        CBH.hud.showToast('The heat is rising!');
      }
    }

    if (step.kind === 'goto' || step.kind === 'driveTo' || step.kind === 'escapeTo') {
      updateGotoStep(step, active, pp, dt);
    } else if (step.kind === 'pickupCar') {
      if (G.inCar === active.targetCar) {
        if (step.alarm) {
          CBH.police.setStars(2);
          CBH.hud.showToast('Alarm! The police are coming');
        }
        if (active.def.id === 'the-harbour-job') CBH.police.setStars(3);
        advanceStep();
      }
    } else if (step.kind === 'chaseCar') {
      updateChaseStep(step, active, pp, dt);
    } else if (step.kind === 'followCar') {
      updateFollowStep(step, active, pp, dt);
    } else if (step.kind === 'shootout') {
      updateGunmen(active.gunmen, dt);
      let alive = 0;
      for (let i = 0; i < active.gunmen.length; i++) if (active.gunmen[i].state !== 'dead') alive++;
      if (alive === 0) advanceStep();
    } else if (step.kind === 'defend') {
      updateDefendStep(step, active, dt);
    }
    if (active.targetCar) updateTrailer(active.targetCar);
  }

  function updateGotoStep(step, active, pp, dt) {
    const G = CBH.G;
    // Passenger boarding for driveTo steps.
    if (step.kind === 'driveTo' && step.passenger && active.passengerPed && !active.passengerAboard) {
      const ped = active.passengerPed;
      const pedPos = ped.group.position;
      if (G.inCar && M.distance2D(pedPos.x, pedPos.z, pp.x, pp.z) < 7) {
        CBH.peds.remove(ped);
        active.passengerPed = null;
        active.passengerAboard = true;
        CBH.hud.showToast(DATA.PEOPLE[step.passenger].name + ' is in. Drive!');
      }
    }
    const reach = step.kind === 'goto' ? 5 : 7.5;
    const dist = M.distance2D(pp.x, pp.z, step.x, step.z);
    if (dist > reach) return;
    if (step.onFoot && G.inCar) return;
    if (step.kind === 'driveTo' && !G.inCar) return;
    if (step.mustBeInMissionCar && G.inCar !== active.targetCar && active.targetCar) return;
    if (step.kind === 'driveTo' && step.passenger && !active.passengerAboard) {
      CBH.hud.showToast('You left your passenger behind!');
      return;
    }
    if (step.grantsHeat) CBH.police.setStars(step.grantsHeat);
    if (step.kind === 'escapeTo') {
      CBH.police.clearWanted();
      G.heatFloor = 0;
    }
    // Release the passenger at the destination.
    if (step.kind === 'driveTo' && step.passenger && active.passengerAboard) {
      const ped = CBH.peds.create(step.x + 3, step.z + 2, { noSnap: true, shirt: 0xff9f68, pants: 0x5c374c, skin: 0xa9713f });
      ped.state = 'walk';
      active.passengerAboard = false;
    }
    advanceStep();
  }

  function updateChaseStep(step, active, pp, dt) {
    const car = active.targetCar;
    if (!car) { advanceStep(); return; }
    car.fleeTimer = 9999;
    car.panic = 1;
    const dist = M.distance2D(pp.x, pp.z, car.group.position.x, car.group.position.z);
    if (car.dead) {
      CBH.hud.showToast('Got him! The envelope is yours');
      const idx = CBH.G.trafficCars.indexOf(car);
      if (idx >= 0) CBH.G.trafficCars.splice(idx, 1);
      active.targetCar = null;
      advanceStep();
      return;
    }
    if (dist < 4.5 && Math.abs(car.speed) < 3) {
      active.caughtTimer += dt;
      if (active.caughtTimer > 1.2) {
        CBH.hud.showToast('Caught! He hands over the envelope');
        car.role = 'parked';
        const idx = CBH.G.trafficCars.indexOf(car);
        if (idx >= 0) CBH.G.trafficCars.splice(idx, 1);
        CBH.G.parkedCars.push(car);
        active.targetCar = null;
        advanceStep();
      }
    } else {
      active.caughtTimer = 0;
    }
    if (dist > 320) failMission('The debtor got away');
  }

  function driveCarToward(car, tx, tz, cruiseSpeed, dt) {
    const pos = car.group.position;
    const desired = M.headingTo(pos.x, pos.z, tx, tz);
    let diff = desired - car.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.steer = M.clamp(diff * 1.8, -1, 1);
    car.heading += car.steer * 1.8 * dt * (Math.abs(car.speed) > 0.5 ? 1 : 0);
    const targetSpeed = Math.abs(diff) > 1.2 ? cruiseSpeed * 0.4 : cruiseSpeed;
    if (car.speed < targetSpeed) car.speed = Math.min(targetSpeed, car.speed + car.spec.accel * 0.8 * dt);
    else car.speed = Math.max(targetSpeed, car.speed - 24 * dt);
    let nx = pos.x + Math.sin(car.heading) * car.speed * dt;
    let nz = pos.z + Math.cos(car.heading) * car.speed * dt;
    const resolved = CBH.city.collideCircle(nx, nz, 1.9);
    if (resolved.hit) car.speed *= 0.4;
    nx = resolved.x;
    nz = resolved.z;
    if (!CBH.city.isPointInWater(nx, nz)) {
      pos.x = nx;
      pos.z = nz;
    }
    car.group.rotation.y = car.heading;
    CBH.cars.updateVisuals(car, dt, false);
    return M.distance2D(pos.x, pos.z, tx, tz);
  }

  function updateFollowStep(step, active, pp, dt) {
    const follow = active.follow;
    const car = active.targetCar;
    if (!car || follow.done) return;
    const waypoint = follow.route[follow.routeIndex];
    const distToWaypoint = driveCarToward(car, waypoint.x, waypoint.z, 11.5, dt);
    if (distToWaypoint < 9) {
      follow.routeIndex++;
      if (follow.routeIndex >= follow.route.length) {
        follow.done = true;
        car.speed = 0;
        CBH.hud.showToast('He is going inside — the deal is at the warehouse');
        advanceStep();
        return;
      }
    }
    const distToPlayer = M.distance2D(pp.x, pp.z, car.group.position.x, car.group.position.z);
    if (distToPlayer < 11) {
      follow.spook += dt;
      CBH.hud.showToast('Too close! He is getting suspicious');
      if (follow.spook > 3) {
        failMission('You spooked the Middleman');
        return;
      }
    } else {
      follow.spook = Math.max(0, follow.spook - dt * 0.5);
    }
    if (distToPlayer > 58) {
      follow.lostTimer += dt;
      if (follow.lostTimer > 6) {
        failMission('You lost the Middleman');
        return;
      }
    } else {
      follow.lostTimer = 0;
    }
  }

  function updateGunmen(gunmen, dt) {
    const G = CBH.G;
    const pp = CBH.state.playerPosition();
    for (let i = 0; i < gunmen.length; i++) {
      const gunman = gunmen[i];
      if (gunman.state === 'dead') continue;
      const pos = gunman.group.position;
      const dist = M.distance2D(pos.x, pos.z, pp.x, pp.z);
      gunman.heading = M.headingTo(pos.x, pos.z, pp.x, pp.z);
      gunman.group.rotation.y = gunman.heading;
      let speedRatio = 0;
      if (dist > 30) {
        const nx = pos.x + Math.sin(gunman.heading) * 4.8 * dt;
        const nz = pos.z + Math.cos(gunman.heading) * 4.8 * dt;
        const resolved = CBH.city.collideCircle(nx, nz, 0.5);
        pos.x = resolved.x;
        pos.z = resolved.z;
        speedRatio = 0.95;
      } else if (dist < 13) {
        const side = Math.sin(CBH.G.clockTime * 0.6 + gunman.id * 2) > 0 ? 1 : -1;
        pos.x += Math.cos(gunman.heading) * side * 1.3 * dt;
        pos.z -= Math.sin(gunman.heading) * side * 1.3 * dt;
        speedRatio = 0.3;
      }
      CBH.peds.animate(gunman, dt, speedRatio);
      gunman.shootCooldown -= dt;
      if (dist < 46 && gunman.shootCooldown <= 0) {
        if (gunman.burstLeft <= 0) {
          gunman.burstLeft = 3;
          gunman.shootCooldown = 1.2 + Math.random() * 0.8;
        } else {
          gunman.burstLeft--;
          gunman.shootCooldown = 0.21;
          CBH.combat.fireShot(pos.x, 1.45, pos.z, gunman.heading, { damage: 8, spread: 0.055 + dist / 1000 });
        }
      }
    }
  }

  function updateDefendStep(step, active, dt) {
    const defend = active.defend;
    defend.timeLeft -= dt;
    // Waves roll in at set times.
    while (defend.nextWaveAt > defend.timeLeft && defend.wave < step.waves) {
      defend.wave++;
      defend.nextWaveAt = step.duration - defend.wave * (step.duration / step.waves) - 2;
      const spawnPoints = [
        { x: -40, z: 20 }, { x: -64, z: 66 }, { x: -30, z: 44 }, { x: -70, z: 20 },
      ];
      for (let i = 0; i < 3; i++) {
        const sp = spawnPoints[(defend.wave * 3 + i) % spawnPoints.length];
        const gunman = CBH.peds.create(sp.x + i * 2, sp.z + i, {
          isGunman: true, noSnap: true, gun: true, health: 70, shirt: 0x402020, pants: 0x1c1c22, skin: CBH.rng.pick(C.SKIN_TONES),
        });
        gunman.state = 'attack';
        active.gunmen.push(gunman);
        CBH.G.gunmen.push(gunman);
      }
      CBH.hud.showCenterMessage('WAVE ' + defend.wave, 'They keep coming — hold the street!', 1400);
      CBH.audio.horn(220);
    }
    updateGunmen(active.gunmen, dt);
    if (defend.timeLeft <= 0) {
      // Survivors scatter; the cafe stands.
      for (let i = 0; i < active.gunmen.length; i++) {
        if (active.gunmen[i].state !== 'dead') CBH.peds.remove(active.gunmen[i]);
      }
      active.gunmen = [];
      advanceStep();
    }
  }

  // ---- free-roam: starting missions, taxi, races ---------------------------
  function updateFreeRoam(dt) {
    const G = CBH.G;
    const pp = CBH.state.playerPosition();
    // Story start marker.
    if (!G.activeMission && !G.dialogueOpen) {
      const def = currentMissionDef();
      if (def) {
        setMarker(missionMarker, def.start.x, def.start.z);
        if (!G.inCar && M.distance2D(pp.x, pp.z, def.start.x, def.start.z) < 3.4) {
          startMission(def);
        }
      } else {
        setMarker(missionMarker, null);
      }
    }
    updateTaxi(dt, pp);
    updateRaces(dt, pp);
    // Rotating free-roam tips.
    if (!G.activeMission) {
      tipTimer -= dt;
      if (tipTimer <= 0) {
        tipTimer = 26;
        G.freeRoamObjective = DATA.FREE_ROAM_TIPS[tipIndex % DATA.FREE_ROAM_TIPS.length];
        tipIndex++;
      }
    }
  }

  function updateTaxi(dt, pp) {
    const G = CBH.G;
    // Spawn a waiting passenger now and then.
    passengerTimer -= dt;
    if (!waitingPassenger && !G.activeTaxi && passengerTimer <= 0) {
      passengerTimer = 14;
      const angle = Math.random() * Math.PI * 2;
      const dist = 55 + Math.random() * 50;
      let x = M.clamp(pp.x + Math.cos(angle) * dist, -245, 245);
      let z = M.clamp(pp.z + Math.sin(angle) * dist, -245, 245);
      const street = CBH.traffic.nearestStreet(z);
      z = street + (Math.random() < 0.5 ? C.WORLD.sidewalkOffset : -C.WORLD.sidewalkOffset);
      if (!CBH.city.isPointInWater(x, z)) {
        waitingPassenger = CBH.peds.create(x, z, { isMissionChar: true });
        waitingPassenger.state = 'idle';
      }
    }
    if (waitingPassenger) {
      const wp = waitingPassenger.group.position;
      setMarker(taxiRing, wp.x, wp.z);
      if (M.distance2D(pp.x, pp.z, wp.x, wp.z) > 230) {
        CBH.peds.remove(waitingPassenger);
        waitingPassenger = null;
        setMarker(taxiRing, null);
      } else if (G.inCar && Math.abs(G.inCar.speed) < 2.5 && M.distance2D(pp.x, pp.z, wp.x, wp.z) < 4.5) {
        // Picked up: choose a destination across town.
        const name = DATA.TAXI.passengerNames[Math.floor(Math.random() * DATA.TAXI.passengerNames.length)];
        let destX = 0, destZ = 0, fareDist = 0;
        for (let tries = 0; tries < 12; tries++) {
          destX = CBH.traffic.nearestAvenue((Math.random() - 0.5) * 440);
          destZ = CBH.traffic.nearestStreet((Math.random() - 0.5) * 440);
          fareDist = M.distance2D(wp.x, wp.z, destX, destZ);
          if (fareDist > 130 && fareDist < 420) break;
        }
        G.activeTaxi = {
          phase: 'dropoff',
          destX: destX, destZ: destZ,
          fare: Math.round(fareDist * DATA.TAXI.farePerMeter),
          timeLeft: fareDist / 8.5 + 25,
          timeStart: fareDist / 8.5 + 25,
          name: name,
        };
        CBH.peds.remove(waitingPassenger);
        waitingPassenger = null;
        setMarker(taxiRing, null);
        CBH.hud.showToast('Fare: ' + name + ' — fare $' + G.activeTaxi.fare);
        CBH.audio.click();
      }
    }
    if (G.activeTaxi) {
      const taxi = G.activeTaxi;
      setMarker(missionMarker, taxi.destX, taxi.destZ);
      taxi.timeLeft -= dt;
      if (!G.inCar) {
        G.activeTaxi = null;
        setMarker(missionMarker, null);
        CBH.hud.showToast('Fare abandoned');
        return;
      }
      if (taxi.timeLeft <= 0) {
        G.activeTaxi = null;
        setMarker(missionMarker, null);
        CBH.hud.showToast('Too slow — the fare walked away');
        return;
      }
      if (M.distance2D(pp.x, pp.z, taxi.destX, taxi.destZ) < 7.5 && Math.abs(G.inCar.speed) < 3) {
        const tip = taxi.timeLeft > taxi.timeStart * DATA.TAXI.tipWindowRatio ? Math.round(taxi.fare * 0.4) : 0;
        CBH.state.addCash(taxi.fare + tip);
        CBH.audio.cash();
        CBH.hud.showToast('Fare paid $' + taxi.fare + (tip ? ' + $' + tip + ' tip!' : ''));
        G.activeTaxi = null;
        setMarker(missionMarker, null);
        passengerTimer = 10;
      }
    }
  }

  function updateRaces(dt, pp) {
    const G = CBH.G;
    if (G.activeRace) {
      const race = G.activeRace;
      race.time += dt;
      const cp = race.def.checkpoints[race.cpIndex];
      setMarker(raceMarker, cp.x, cp.z);
      if (G.inCar && M.distance2D(pp.x, pp.z, cp.x, cp.z) < 11) {
        CBH.audio.shell();
        race.cpIndex++;
        if (race.cpIndex >= race.def.checkpoints.length) {
          const total = race.time;
          const best = G.raceBest[race.def.id];
          if (!best || total < best) G.raceBest[race.def.id] = total;
          const won = total <= race.def.parSeconds;
          if (won) {
            CBH.state.addCash(race.def.reward);
            CBH.audio.cash();
          }
          CBH.hud.showMissionCard(
            race.def.name + (won ? ' — WINNER!' : ' — FINISHED'),
            'Time ' + total.toFixed(1) + 's (par ' + race.def.parSeconds + 's)' + (won ? ' — +$' + race.def.reward : '')
          );
          G.activeRace = null;
          setMarker(raceMarker, null);
          CBH.save.write();
        } else {
          CBH.hud.showToast('Checkpoint ' + race.cpIndex + ' / ' + race.def.checkpoints.length + ' — ' + race.time.toFixed(1) + 's');
        }
      }
      if (!G.inCar) {
        G.activeRace = null;
        setMarker(raceMarker, null);
        CBH.hud.showToast('Race abandoned');
      }
      return;
    }
    // Offer a race when the player idles at a start line.
    G.nearRaceStart = null;
    if (G.inCar && !G.activeMission && !G.activeTaxi) {
      for (let i = 0; i < DATA.RACES.length; i++) {
        const race = DATA.RACES[i];
        if (M.distance2D(pp.x, pp.z, race.start.x, race.start.z) < 9) {
          setMarker(raceMarker, race.start.x, race.start.z);
          G.nearRaceStart = race;
          if (CBH.input.wasPressed('Enter')) {
            G.activeRace = { def: race, cpIndex: 0, time: 0 };
            CBH.hud.showCenterMessage(race.name, 'Beat ' + race.parSeconds + 's for $' + race.reward + '!', 1600);
            CBH.audio.cash();
          }
          return;
        }
      }
    }
    setMarker(raceMarker, null);
  }

  // ---- cross-module events --------------------------------------------------
  function onPlayerEnterCar(car) {
    const G = CBH.G;
    const active = G.activeMission;
    if (active && active.step && active.step.kind === 'pickupCar' && car === active.targetCar) {
      // handled by the step check next frame
    }
    if (car.trailerGroup) updateTrailer(car);
  }

  function failActiveMissionQuietly() {
    const G = CBH.G;
    if (G.activeMission) {
      cleanupStepEntities();
      G.activeMission = null;
    }
    G.heatFloor = 0;
    if (G.activeTaxi) G.activeTaxi = null;
    if (G.activeRace) {
      G.activeRace = null;
      setMarker(raceMarker, null);
    }
  }

  function onPlayerBusted() {
    const G = CBH.G;
    failActiveMissionQuietly();
    const fine = Math.max(50, Math.round(G.cash * 0.12));
    G.cash = Math.max(0, G.cash - fine);
    G.mode = 'busted';
    CBH.input.exitPointerLock();
    CBH.hud.showEndScreen('BUSTED', 'The Coral Bay PD took $' + fine + ' in fines. You walk out of the station on Palm Avenue.');
  }

  function onPlayerWasted() {
    const G = CBH.G;
    failActiveMissionQuietly();
    const bill = Math.max(50, Math.round(G.cash * 0.1));
    G.cash = Math.max(0, G.cash - bill);
    G.mode = 'wasted';
    CBH.input.exitPointerLock();
    CBH.hud.showEndScreen('WASTED', 'The hospital patched Mari up and billed $' + bill + '. Coral Bay General, Downtown.');
  }

  function respawnAfterEnd() {
    const G = CBH.G;
    // Busted -> police station on Palm Avenue; Wasted -> hospital downtown.
    const spot = G.mode === 'busted' ? { x: 126, z: -112 } : { x: 48, z: -34 };
    if (G.inCar) {
      const car = G.inCar;
      car.role = 'parked';
      CBH.G.parkedCars.push(car);
      G.inCar = null;
    }
    G.player.group.visible = true;
    G.player.group.position.set(spot.x, 0, spot.z);
    G.player.health = C.TUNING.playerMaxHealth;
    G.player.dead = false;
    CBH.police.clearWanted();
    G.mode = 'play';
    CBH.cameraControl.snapBehindPlayer();
    CBH.hud.hideEndScreen();
    CBH.save.write();
  }

  function update(dt) {
    if (missionMarker) {
      missionMarker.rotation.y += dt * 0.8;
      raceMarker.rotation.y -= dt * 0.8;
      if (taxiRing.visible) taxiRing.rotation.y += dt * 1.4;
    }
    if (CBH.G.dialogueOpen) {
      setMarker(missionMarker, null);
      return;
    }
    if (CBH.G.activeMission) updateMission(dt);
    else updateFreeRoam(dt);
    // Mission cars that are not driven still need their visuals ticking.
    for (let i = 0; i < CBH.G.missionCars.length; i++) {
      const car = CBH.G.missionCars[i];
      if (car !== CBH.G.inCar && car.role === 'mission') updateTrailer(car);
    }
  }

  window.CBH.missions = {
    build: buildMarkers,
    update: update,
    currentObjective: currentObjective,
    startMission: startMission,
    onPlayerEnterCar: onPlayerEnterCar,
    onPlayerBusted: onPlayerBusted,
    onPlayerWasted: onPlayerWasted,
    respawn: respawnAfterEnd,
    failMission: failMission,
    stepTarget: stepTarget,
  };
})();

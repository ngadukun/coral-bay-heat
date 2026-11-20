// cars.js — Coral Bay's vehicles: low-poly cars built from boxes (sedans,
// hatchbacks, convertibles, sports cars, vans, pickups, taxis and police
// interceptors) and the arcade driving model the player uses — acceleration,
// speed-sensitive steering, handbrake drift, body roll, denting damage,
// smoke and fire as a car dies, tyre smoke and skid marks.
(function () {
  'use strict';
  window.CBH = window.CBH || {};
  const C = CBH.config;
  const R = CBH.rng;
  const M = CBH.math;

  const CAR_SPECS = {
    sedan:      { length: 4.4, width: 1.9, height: 0.62, cabinH: 0.55, topSpeed: 34, accel: 15, grip: 3.4 },
    hatch:      { length: 3.9, width: 1.8, height: 0.66, cabinH: 0.6, topSpeed: 31, accel: 14, grip: 3.6 },
    convertible:{ length: 4.3, width: 1.9, height: 0.55, cabinH: 0.18, topSpeed: 38, accel: 17, grip: 3.2 },
    sports:     { length: 4.5, width: 2.0, height: 0.45, cabinH: 0.42, topSpeed: 46, accel: 21, grip: 3.0 },
    van:        { length: 5.0, width: 2.1, height: 1.15, cabinH: 0.5, topSpeed: 27, accel: 11, grip: 3.8 },
    pickup:     { length: 4.9, width: 2.0, height: 0.8, cabinH: 0.55, topSpeed: 30, accel: 13, grip: 3.5 },
    taxi:       { length: 4.4, width: 1.9, height: 0.62, cabinH: 0.55, topSpeed: 33, accel: 15, grip: 3.4 },
    police:     { length: 4.6, width: 1.95, height: 0.6, cabinH: 0.55, topSpeed: 42, accel: 19, grip: 3.1 },
  };

  const skidMarkPool = [];
  let skidMarkIndex = 0;

  function buildSkidMarkPool(scene) {
    const material = new THREE.MeshBasicMaterial({ color: 0x14161a, transparent: true, opacity: 0.55 });
    for (let i = 0; i < 240; i++) {
      const mark = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 1.6), material);
      mark.rotation.x = -Math.PI / 2;
      mark.position.y = -50;
      mark.visible = false;
      scene.add(mark);
      skidMarkPool.push(mark);
    }
  }

  function dropSkidMark(x, z, heading) {
    if (skidMarkPool.length === 0) return;
    const mark = skidMarkPool[skidMarkIndex];
    skidMarkIndex = (skidMarkIndex + 1) % skidMarkPool.length;
    mark.position.set(x, 0.13, z);
    mark.rotation.z = -heading;
    mark.visible = true;
  }

  function buildCarMesh(type, colorHex) {
    const spec = CAR_SPECS[type] || CAR_SPECS.sedan;
    const group = new THREE.Group();
    const paint = new THREE.MeshLambertMaterial({ color: colorHex });
    const darkGlass = CBH.city.flatMaterial(0x1c2a38);
    const trim = CBH.city.flatMaterial(0x22262b);

    const body = new THREE.Mesh(CBH.city.boxGeometry(spec.width, spec.height, spec.length), paint);
    body.position.y = 0.55 + spec.height / 2;
    group.add(body);
    const hood = new THREE.Mesh(CBH.city.boxGeometry(spec.width * 0.92, 0.16, spec.length * 0.3), paint);
    hood.position.set(0, 0.62 + spec.height, spec.length * 0.32);
    group.add(hood);

    if (type === 'van') {
      const box = new THREE.Mesh(CBH.city.boxGeometry(spec.width * 0.96, spec.cabinH + 0.5, spec.length * 0.62), paint);
      box.position.set(0, 0.75 + spec.height, -spec.length * 0.12);
      group.add(box);
      const windshield = new THREE.Mesh(CBH.city.boxGeometry(spec.width * 0.9, 0.5, 0.1), darkGlass);
      windshield.position.set(0, 0.85 + spec.height, spec.length * 0.2);
      group.add(windshield);
    } else if (type === 'convertible') {
      const tub = new THREE.Mesh(CBH.city.boxGeometry(spec.width * 0.9, 0.3, spec.length * 0.45), trim);
      tub.position.set(0, 0.72 + spec.height, -spec.length * 0.08);
      group.add(tub);
      const seatA = new THREE.Mesh(CBH.city.boxGeometry(0.6, 0.4, 0.5), CBH.city.flatMaterial(0x8a3b2e));
      seatA.position.set(-0.42, 0.85 + spec.height, -spec.length * 0.02);
      group.add(seatA);
      const seatB = seatA.clone();
      seatB.position.x = 0.42;
      group.add(seatB);
      const shield = new THREE.Mesh(CBH.city.boxGeometry(spec.width * 0.88, 0.42, 0.08), darkGlass);
      shield.position.set(0, 0.95 + spec.height, spec.length * 0.16);
      group.add(shield);
    } else {
      const cabin = new THREE.Mesh(CBH.city.boxGeometry(spec.width * 0.84, spec.cabinH, spec.length * 0.44), darkGlass);
      cabin.position.set(0, 0.62 + spec.height + spec.cabinH / 2, -spec.length * 0.05);
      group.add(cabin);
      const roof = new THREE.Mesh(CBH.city.boxGeometry(spec.width * 0.8, 0.09, spec.length * 0.4), paint);
      roof.position.set(0, 0.66 + spec.height + spec.cabinH, -spec.length * 0.05);
      group.add(roof);
    }
    if (type === 'sports') {
      const spoiler = new THREE.Mesh(CBH.city.boxGeometry(spec.width * 0.95, 0.09, 0.4), trim);
      spoiler.position.set(0, 1.25, -spec.length * 0.46);
      group.add(spoiler);
    }
    if (type === 'pickup') {
      const bed = new THREE.Mesh(CBH.city.boxGeometry(spec.width * 0.9, 0.3, spec.length * 0.34), trim);
      bed.position.set(0, 0.72 + spec.height, -spec.length * 0.3);
      group.add(bed);
    }
    if (type === 'taxi') {
      const sign = new THREE.Mesh(CBH.city.boxGeometry(0.9, 0.28, 0.4), new THREE.MeshLambertMaterial({ color: 0xfff2b0, emissive: 0xcc9a00, emissiveIntensity: 0.5 }));
      sign.position.set(0, 1.95, -spec.length * 0.05);
      group.add(sign);
    }
    if (type === 'police') {
      const stripe = new THREE.Mesh(CBH.city.boxGeometry(spec.width + 0.04, 0.3, spec.length * 0.9), CBH.city.flatMaterial(0x2456a8));
      stripe.position.y = 0.85;
      group.add(stripe);
      const lightBar = new THREE.Group();
      const redLamp = new THREE.Mesh(CBH.city.boxGeometry(0.55, 0.22, 0.5), new THREE.MeshLambertMaterial({ color: 0x550000, emissive: 0xff2211, emissiveIntensity: 0 }));
      redLamp.position.x = -0.32;
      const blueLamp = new THREE.Mesh(CBH.city.boxGeometry(0.55, 0.22, 0.5), new THREE.MeshLambertMaterial({ color: 0x000055, emissive: 0x2266ff, emissiveIntensity: 0 }));
      blueLamp.position.x = 0.32;
      lightBar.add(redLamp);
      lightBar.add(blueLamp);
      lightBar.position.set(0, 1.98, -spec.length * 0.05);
      group.add(lightBar);
      group.userData.redLamp = redLamp;
      group.userData.blueLamp = blueLamp;
    }

    // Headlights, brake lights, wheels.
    const headlightMaterial = new THREE.MeshLambertMaterial({ color: 0xfff6cc, emissive: 0xffedb5, emissiveIntensity: 0.15 });
    const brakeMaterial = new THREE.MeshLambertMaterial({ color: 0x661111, emissive: 0xff1a1a, emissiveIntensity: 0.25 });
    const hl1 = new THREE.Mesh(CBH.city.boxGeometry(0.42, 0.18, 0.08), headlightMaterial);
    hl1.position.set(-spec.width * 0.32, 0.78, spec.length / 2 + 0.02);
    group.add(hl1);
    const hl2 = hl1.clone();
    hl2.position.x = spec.width * 0.32;
    group.add(hl2);
    const bl1 = new THREE.Mesh(CBH.city.boxGeometry(0.42, 0.16, 0.08), brakeMaterial);
    bl1.position.set(-spec.width * 0.32, 0.82, -spec.length / 2 - 0.02);
    group.add(bl1);
    const bl2 = bl1.clone();
    bl2.position.x = spec.width * 0.32;
    group.add(bl2);
    group.userData.brakeMaterial = brakeMaterial;
    group.userData.headlightMaterial = headlightMaterial;

    // Headlight cones for night driving (fake volumetrics).
    const coneMaterial = new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0, depthWrite: false });
    const coneGeo = new THREE.ConeGeometry(1.6, 11, 10, 1, true);
    const coneL = new THREE.Mesh(coneGeo, coneMaterial);
    coneL.rotation.x = Math.PI / 2 + 0.06;
    coneL.position.set(-spec.width * 0.32, 0.7, spec.length / 2 + 5.4);
    group.add(coneL);
    const coneR = coneL.clone();
    coneR.position.x = spec.width * 0.32;
    group.add(coneR);
    group.userData.coneMaterial = coneMaterial;

    const wheels = [];
    const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
    const wheelMaterial = CBH.city.flatMaterial(0x14161a);
    const wheelPositions = [
      [-spec.width / 2 + 0.05, spec.length * 0.32], [spec.width / 2 - 0.05, spec.length * 0.32],
      [-spec.width / 2 + 0.05, -spec.length * 0.32], [spec.width / 2 - 0.05, -spec.length * 0.32],
    ];
    for (let i = 0; i < wheelPositions.length; i++) {
      const wheel = new THREE.Mesh(wheelGeo, wheelMaterial);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wheelPositions[i][0], 0.38, wheelPositions[i][1]);
      group.add(wheel);
      wheels.push(wheel);
    }
    return { group: group, wheels: wheels, spec: spec };
  }

  let nextCarId = 1;
  function createCar(type, colorHex, x, z, heading) {
    const built = buildCarMesh(type, colorHex);
    built.group.position.set(x, 0, z);
    built.group.rotation.y = heading || 0;
    CBH.G.scene.add(built.group);
    const car = {
      id: nextCarId++,
      type: type,
      group: built.group,
      wheels: built.wheels,
      spec: built.spec,
      color: colorHex,
      heading: heading || 0,
      speed: 0,
      steer: 0,
      health: 100,
      dead: false,
      burning: 0,
      smokeTimer: 0,
      role: 'parked', // parked | traffic | police | player | mission
      driver: null,
      honkTimer: 0,
      skidTimer: 0,
      airborne: 0,
      verticalVelocity: 0,
      groundY: 0,
      stuntChecked: false,
    };
    return car;
  }

  function damageCar(car, amount, causeX, causeZ) {
    if (car.dead) return;
    car.health -= amount;
    if (car.health <= 35 && car.health + amount > 35) {
      CBH.audio.crash(0.5);
    }
    if (car.health <= 0) {
      car.health = 0;
      car.dead = true;
      car.burning = 6;
      if (CBH.G.inCar === car) {
        CBH.player.hurtPlayer(18);
      }
    }
  }

  function updateCarVisuals(car, dt, braking) {
    const speedRatio = Math.abs(car.speed) / car.spec.topSpeed;
    for (let i = 0; i < car.wheels.length; i++) {
      car.wheels[i].rotation.x += car.speed * dt * 2.4;
      if (i < 2) car.wheels[i].rotation.y = car.steer * 0.5;
    }
    // Body roll and pitch from steering and acceleration.
    car.group.rotation.z = M.lerp(car.group.rotation.z, -car.steer * speedRatio * 0.06, 0.2);
    car.group.rotation.x = M.lerp(car.group.rotation.x, M.clamp(-car.accelPitch || 0, -0.03, 0.045), 0.15);
    car.group.userData.brakeMaterial.emissiveIntensity = braking ? 1.6 : 0.25;
    const night = CBH.G.isNight;
    car.group.userData.headlightMaterial.emissiveIntensity = night ? 1.2 : 0.15;
    car.group.userData.coneMaterial.opacity = night ? 0.13 : 0;
    // Damage smoke, then fire.
    car.smokeTimer -= dt;
    if ((car.health < 45 || car.dead) && car.smokeTimer <= 0) {
      car.smokeTimer = car.dead ? 0.06 : 0.16;
      const pos = car.group.position;
      if (car.dead) {
        CBH.particles.spawn(pos.x, 1.6, pos.z, 'fire', 2);
        CBH.particles.spawn(pos.x, 2.0, pos.z, 'smoke', 1);
        car.burning -= dt;
      } else {
        CBH.particles.spawn(pos.x, 1.2, pos.z, 'smoke', 1);
      }
    }
  }

  // The arcade driving model used by the player (and reused, with synthetic
  // inputs, by mission cars). Returns crash info for sound/shake/damage.
  function driveCar(car, throttle, steering, handbrake, dt) {
    const spec = car.spec;
    let crash = 0;
    if (car.dead) {
      car.speed = M.lerp(car.speed, 0, dt * 2);
      throttle = 0;
    }
    const wet = CBH.G.weather === 'rain' ? 0.82 : 1;
    if (throttle > 0) {
      car.speed += spec.accel * throttle * dt * (1 - Math.abs(car.speed) / (spec.topSpeed * 1.25));
    } else if (throttle < 0) {
      if (car.speed > 0.6) car.speed -= 30 * dt; // braking
      else car.speed = Math.max(car.speed + spec.accel * 0.55 * throttle * dt, -spec.topSpeed * 0.38);
    } else {
      car.speed -= car.speed * 0.35 * dt; // engine drag
      if (Math.abs(car.speed) < 0.05) car.speed = 0;
    }
    car.speed = M.clamp(car.speed, -spec.topSpeed * 0.4, spec.topSpeed);
    const speedRatio = M.clamp(Math.abs(car.speed) / spec.topSpeed, 0, 1);
    const steerAuthority = M.lerp(1.0, 0.42, speedRatio) * (handbrake ? 1.5 : 1);
    car.steer = M.lerp(car.steer, steering * steerAuthority, Math.min(1, dt * 8));
    const turnRate = car.steer * M.lerp(1.9, 1.15, speedRatio) * (handbrake ? 1.35 : 1);
    if (Math.abs(car.speed) > 0.2) {
      car.heading += turnRate * dt * (car.speed >= 0 ? 1 : -1) * (handbrake ? 1 : spec.grip * 0.32 + 0.68);
    }
    car.accelPitch = throttle * 0.03 - (throttle < 0 && car.speed > 1 ? 0.02 : 0);

    // Stunt ramps: driving onto one at speed launches the car.
    if (car.airborne <= 0) {
      for (let i = 0; i < CBH.G.stuntRamps.length; i++) {
        const ramp = CBH.G.stuntRamps[i];
        if (Math.abs(car.group.position.x - ramp.x) < 4.5 && Math.abs(car.group.position.z - ramp.z) < 5 && Math.abs(car.speed) > 13) {
          car.airborne = 0.001;
          car.verticalVelocity = 7.5;
          car.stuntChecked = false;
          if (CBH.G.inCar === car) {
            CBH.G.slowmoTimer = Math.max(CBH.G.slowmoTimer, 0.9);
            CBH.hud.showToast('STUNT JUMP!');
          }
          break;
        }
      }
    }
    if (car.airborne > 0 || car.group.position.y > 0) {
      car.airborne += dt;
      car.verticalVelocity += -16 * dt;
      car.group.position.y += car.verticalVelocity * dt;
      if (car.group.position.y <= 0) {
        car.group.position.y = 0;
        if (car.airborne > 0.55 && !car.stuntChecked && CBH.G.inCar === car) {
          car.stuntChecked = true;
          CBH.state.addCash(150);
          CBH.audio.cash();
          CBH.hud.showToast('Stunt bonus +$150');
          CBH.G.statsJumps = (CBH.G.statsJumps || 0) + 1;
        }
        if (car.verticalVelocity < -9) {
          damageCar(car, 8);
          crash = Math.max(crash, 0.4);
        }
        car.airborne = 0;
        car.verticalVelocity = 0;
      }
    }

    const vx = Math.sin(car.heading) * car.speed;
    const vz = Math.cos(car.heading) * car.speed;
    let nx = car.group.position.x + vx * dt;
    let nz = car.group.position.z + vz * dt;

    // Building collision.
    const resolved = CBH.city.collideCircle(nx, nz, 2.1);
    if (resolved.hit) {
      const impact = Math.abs(car.speed);
      if (impact > 6) {
        crash = Math.max(crash, Math.min(1, impact / 30));
        damageCar(car, impact * 0.55);
        if (CBH.G.inCar === car) {
          CBH.G.shake = Math.max(CBH.G.shake, impact / 34);
          CBH.player.hurtPlayer(impact * 0.12);
        }
      }
      car.speed *= 0.25;
      nx = resolved.x;
      nz = resolved.z;
    }
    // Island bounds: the sea stops a car hard (and hurts).
    if (CBH.city.isPointInWater(nx, nz) && car.group.position.y <= 0) {
      if (Math.abs(car.speed) > 4 && CBH.G.inCar === car) {
        CBH.audio.splash();
        CBH.hud.showToast('Into the drink! The car is lost.');
        CBH.player.carLostInSea(car);
        return { crash: 1 };
      }
      car.speed *= 0.4;
      nx = car.group.position.x;
      nz = car.group.position.z;
    }
    car.group.position.x = nx;
    car.group.position.z = nz;
    car.group.rotation.y = car.heading;

    // Tyre smoke + skid marks while sliding.
    const sliding = (handbrake && Math.abs(car.speed) > 7) || Math.abs(car.steer) > 0.75 && Math.abs(car.speed) > 20;
    if (sliding) {
      car.skidTimer -= dt;
      if (car.skidTimer <= 0) {
        car.skidTimer = 0.03;
        const backX = nx - Math.sin(car.heading) * 1.4;
        const backZ = nz - Math.cos(car.heading) * 1.4;
        dropSkidMark(backX - Math.cos(car.heading) * 0.8, backZ + Math.sin(car.heading) * 0.8, car.heading);
        dropSkidMark(backX + Math.cos(car.heading) * 0.8, backZ - Math.sin(car.heading) * 0.8, car.heading);
        CBH.particles.spawn(nx, 0.4, nz, 'tireSmoke', 1);
        if (CBH.G.inCar === car) CBH.audio.skid(Math.abs(car.speed) / spec.topSpeed);
      }
    }
    updateCarVisuals(car, dt, throttle < 0);
    return { crash: crash, sliding: sliding };
  }

  // Car-to-car bumps for every driven/AI car list passed in.
  function collideCars(listA, listB, dt) {
    for (let i = 0; i < listA.length; i++) {
      const a = listA[i];
      if (!a.group.visible) continue;
      for (let j = 0; j < listB.length; j++) {
        const b = listB[j];
        if (a === b || !b.group.visible) continue;
        const dx = b.group.position.x - a.group.position.x;
        const dz = b.group.position.z - a.group.position.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < 16.8 && d2 > 0.001) {
          const d = Math.sqrt(d2);
          const push = (4.1 - d) / 2;
          const ux = dx / d;
          const uz = dz / d;
          a.group.position.x -= ux * push;
          a.group.position.z -= uz * push;
          b.group.position.x += ux * push;
          b.group.position.z += uz * push;
          const relativeSpeed = Math.abs(a.speed - b.speed) + Math.abs(a.speed) * 0.3;
          if (relativeSpeed > 5) {
            damageCar(a, relativeSpeed * 0.4);
            damageCar(b, relativeSpeed * 0.4);
            CBH.audio.crash(Math.min(1, relativeSpeed / 26));
            if (CBH.G.inCar === a || CBH.G.inCar === b) {
              CBH.G.shake = Math.max(CBH.G.shake, relativeSpeed / 30);
              if (b.role === 'police' || a.role === 'police') CBH.state.reportCrime(6);
            }
            CBH.particles.spawn((a.group.position.x + b.group.position.x) / 2, 0.8, (a.group.position.z + b.group.position.z) / 2, 'sparks', 6);
          }
          if (a.role === 'traffic') a.speed *= 0.4;
          if (b.role === 'traffic') b.speed *= 0.4;
        }
      }
    }
  }

  function removeCar(car) {
    CBH.G.scene.remove(car.group);
    const lists = [CBH.G.trafficCars, CBH.G.parkedCars, CBH.G.policeCars, CBH.G.missionCars];
    for (let i = 0; i < lists.length; i++) {
      const idx = lists[i].indexOf(car);
      if (idx >= 0) lists[i].splice(idx, 1);
    }
  }

  window.CBH.cars = {
    SPECS: CAR_SPECS,
    create: createCar,
    drive: driveCar,
    damage: damageCar,
    collideCars: collideCars,
    remove: removeCar,
    buildSkidMarkPool: buildSkidMarkPool,
    updateVisuals: updateCarVisuals,
  };
})();

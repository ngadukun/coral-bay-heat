// player.js — Mari Solano herself: third-person on-foot movement relative
// to the mouse-orbit camera, sprinting, jumping, punching and pistol fire,
// entering and jacking cars, health and regeneration, and what happens
// when she is hurt, knocked down, busted or wasted.
(function () {
  'use strict';
  window.CBH = window.CBH || {};
  const C = CBH.config;
  const M = CBH.math;

  function buildPlayer() {
    const mesh = CBH.peds.buildPersonMesh(0x14b8a6, 0x27324a, 0xd9a066, { hairColor: 0x191008, gun: false });
    mesh.position.set(-40, 0, 232);
    CBH.G.scene.add(mesh);
    const player = {
      group: mesh,
      parts: mesh.userData.parts,
      heading: Math.PI, // facing the city from the promenade
      health: C.TUNING.playerMaxHealth,
      verticalVelocity: 0,
      physicsY: 0,
      grounded: true,
      walkPhase: 0,
      fireCooldown: 0,
      punchCooldown: 0,
      sinceHurt: 99,
      dead: false,
    };
    CBH.G.player = player;
    return player;
  }

  function hurtPlayer(amount) {
    const G = CBH.G;
    if (G.mode !== 'play' || !G.player || G.player.dead) return;
    G.player.health -= amount;
    G.player.sinceHurt = 0;
    const vignette = document.getElementById('damageVignette');
    if (vignette) vignette.style.opacity = Math.min(0.9, 0.35 + amount / 40);
    if (G.player.health <= 0) {
      G.player.health = 0;
      G.player.dead = true;
      CBH.missions.onPlayerWasted();
    }
  }

  function knockPlayerFrom(x, z) {
    const G = CBH.G;
    if (!G.player) return;
    const pos = G.player.group.position;
    const away = M.headingTo(x, z, pos.x, pos.z);
    pos.x += Math.sin(away) * 2.2;
    pos.z += Math.cos(away) * 2.2;
    G.shake = Math.max(G.shake, 0.3);
  }

  function healPlayer(amount) {
    const G = CBH.G;
    G.player.health = Math.min(C.TUNING.playerMaxHealth, G.player.health + amount);
  }

  function findNearbyCar() {
    const G = CBH.G;
    const pos = G.player.group.position;
    let best = null;
    let bestDist = C.TUNING.enterCarRange;
    const lists = [CBH.G.parkedCars, CBH.G.trafficCars, CBH.G.missionCars, CBH.G.policeCars];
    for (let l = 0; l < lists.length; l++) {
      for (let i = 0; i < lists[l].length; i++) {
        const car = lists[l][i];
        if (!car.group.visible || car.dead) continue;
        const d = M.distance2D(pos.x, pos.z, car.group.position.x, car.group.position.z);
        if (d < bestDist) {
          bestDist = d;
          best = car;
        }
      }
    }
    return best;
  }

  function enterCar(car) {
    const G = CBH.G;
    const wasTraffic = car.role === 'traffic';
    const wasPolice = car.role === 'police';
    if (wasTraffic && !car.driver) {
      // Jacking a car with a driver inside pulls them out onto the pavement.
      const driver = CBH.peds.create(car.group.position.x + 2.4, car.group.position.z + 1.2, { noSnap: true });
      driver.state = 'flee';
      driver.fleeFrom = { x: car.group.position.x, z: car.group.position.z };
      driver.fleeTimer = 3.5;
    }
    if (car.driver && typeof car.driver === 'object' && car.driver.group) {
      // Jacking: the driver is pulled out onto the pavement.
      const driver = car.driver;
      driver.group.position.set(car.group.position.x + 2.2, 0, car.group.position.z + 1);
      driver.state = 'flee';
      driver.fleeFrom = { x: car.group.position.x, z: car.group.position.z };
      driver.fleeTimer = 3;
      if (!CBH.G.pedestrians.includes(driver)) CBH.G.pedestrians.push(driver);
      car.driver = null;
    }
    if (car.role === 'traffic') {
      const idx = CBH.G.trafficCars.indexOf(car);
      if (idx >= 0) CBH.G.trafficCars.splice(idx, 1);
    }
    if (car.role === 'parked') {
      const idx = CBH.G.parkedCars.indexOf(car);
      if (idx >= 0) CBH.G.parkedCars.splice(idx, 1);
    }
    car.role = 'player';
    car.previousRole = wasTraffic ? 'traffic' : wasPolice ? 'police' : 'parked';
    G.inCar = car;
    G.player.group.visible = false;
    CBH.audio.click();
    if (wasTraffic) {
      CBH.state.reportCrime(14);
      CBH.hud.showToast('Car jacked! The heat noticed.');
    } else if (wasPolice) {
      CBH.state.reportCrime(24);
      CBH.hud.showToast('You stole a police interceptor!');
    }
    CBH.missions.onPlayerEnterCar(car);
  }

  function exitCar() {
    const G = CBH.G;
    const car = G.inCar;
    if (!car) return;
    const pos = car.group.position;
    const sideX = Math.cos(car.heading);
    const sideZ = -Math.sin(car.heading);
    let exitX = pos.x + sideX * 2.4;
    let exitZ = pos.z + sideZ * 2.4;
    const resolved = CBH.city.collideCircle(exitX, exitZ, 0.6);
    exitX = resolved.x;
    exitZ = resolved.z;
    G.player.group.position.set(exitX, 0, exitZ);
    G.player.heading = car.heading;
    G.player.group.visible = true;
    car.role = 'parked';
    car.speed = 0;
    if (!CBH.G.parkedCars.includes(car)) CBH.G.parkedCars.push(car);
    G.inCar = null;
    CBH.audio.click();
  }

  function carLostInSea(car) {
    const G = CBH.G;
    CBH.cars.remove(car);
    if (G.inCar === car) {
      G.inCar = null;
      G.player.group.visible = true;
      // Mari swims ashore at the nearest dry point.
      const pos = G.player.group.position;
      pos.x = M.clamp(pos.x, -268, 268);
      pos.z = M.clamp(pos.z, -268, 268);
      G.player.group.position.set(pos.x, 0, pos.z);
      hurtPlayer(10);
    }
  }

  function updatePlayerOnFoot(dt) {
    const G = CBH.G;
    const player = G.player;
    const pos = player.group.position;
    const axis = CBH.input.moveAxis();
    const camYaw = CBH.cameraRig.yaw;
    const sprinting = CBH.input.isHeld('ShiftLeft') || CBH.input.isHeld('ShiftRight');
    const speed = sprinting ? C.TUNING.playerSprintSpeed : C.TUNING.playerWalkSpeed;
    let moveX = 0;
    let moveZ = 0;
    if (axis.x !== 0 || axis.z !== 0) {
      const forwardX = -Math.sin(camYaw);
      const forwardZ = -Math.cos(camYaw);
      const rightX = Math.cos(camYaw);
      const rightZ = -Math.sin(camYaw);
      moveX = forwardX * -axis.z + rightX * axis.x;
      moveZ = forwardZ * -axis.z + rightZ * axis.x;
      const len = Math.sqrt(moveX * moveX + moveZ * moveZ) || 1;
      moveX = (moveX / len) * speed;
      moveZ = (moveZ / len) * speed;
      player.heading = M.angleLerp(player.heading, Math.atan2(moveX, moveZ), Math.min(1, dt * 12));
    }
    // Jumping and gravity (physics height is kept apart from the walk bob).
    if ((CBH.input.wasPressed('Space')) && player.grounded) {
      player.verticalVelocity = C.TUNING.jumpVelocity;
      player.grounded = false;
    }
    if (!player.grounded) {
      player.verticalVelocity += C.TUNING.gravity * dt;
      player.physicsY += player.verticalVelocity * dt;
      if (player.physicsY <= 0) {
        player.physicsY = 0;
        player.grounded = true;
        player.verticalVelocity = 0;
        CBH.particles.spawn(pos.x, 0.2, pos.z, 'dust', 2);
      }
    }
    let nx = pos.x + moveX * dt;
    let nz = pos.z + moveZ * dt;
    const resolved = CBH.city.collideCircle(nx, nz, C.TUNING.playerRadius);
    nx = resolved.x;
    nz = resolved.z;
    if (!CBH.city.isPointInWater(nx, nz) || player.physicsY > 0) {
      pos.x = M.clamp(nx, -272, 272);
      pos.z = M.clamp(nz, -272, 272);
    }
    player.group.rotation.y = player.heading;
    const moving = Math.abs(moveX) + Math.abs(moveZ) > 0.1;
    player.walkPhase += dt * (moving ? (sprinting ? 11 : 8) : 0);
    const swing = moving ? Math.sin(player.walkPhase) * 0.6 : 0;
    player.parts.legL.rotation.x = swing;
    player.parts.legR.rotation.x = -swing;
    if (G.hasPistol) {
      player.parts.armR.rotation.x = -1.3;
      player.parts.armL.rotation.x = -swing * 0.5;
    } else {
      player.parts.armL.rotation.x = -swing * 0.8;
      player.parts.armR.rotation.x = swing * 0.8;
    }
    pos.y = player.physicsY + (moving && player.grounded ? Math.abs(Math.sin(player.walkPhase)) * 0.05 : 0);

    // Combat: click or F fires the pistol, click without one punches.
    player.fireCooldown -= dt;
    player.punchCooldown -= dt;
    const wantFire = CBH.input.wasMouseClicked() || CBH.input.wasPressed('KeyF');
    if (wantFire && !G.dialogueOpen) {
      if (G.hasPistol && player.fireCooldown <= 0) {
        firePistol(player);
      } else if (!G.hasPistol && player.punchCooldown <= 0) {
        player.punchCooldown = 0.34;
        CBH.combat.punch(pos.x, pos.z, player.heading);
        player.parts.armR.rotation.x = -1.9;
      }
    }
    // Enter / exit vehicles and context interactions on E.
    G.nearCar = findNearbyCar();
    if (CBH.input.wasPressed('KeyE') && !G.dialogueOpen) {
      if (G.nearCar) enterCar(G.nearCar);
    }
    // Health regeneration after a quiet spell.
    player.sinceHurt += dt;
    if (player.sinceHurt > C.TUNING.healthRegenDelay && player.health > 0) {
      player.health = Math.min(C.TUNING.playerMaxHealth, player.health + C.TUNING.healthRegenPerSecond * dt);
    }
  }

  function firePistol(player) {
    const G = CBH.G;
    if (G.pistolAmmo <= 0) {
      if (G.pistolReserve > 0) {
        const load = Math.min(12, G.pistolReserve);
        G.pistolAmmo = load;
        G.pistolReserve -= load;
        CBH.hud.showToast('Reloaded');
      } else {
        CBH.audio.click();
        CBH.hud.showToast('Out of ammo — missions and the gun corner restock you.');
        player.fireCooldown = 0.4;
        return;
      }
    }
    G.pistolAmmo -= 1;
    player.fireCooldown = C.TUNING.pistolCooldown;
    const pos = player.group.position;
    // Aim follows the camera yaw: Mari shoots where you look.
    const aimHeading = CBH.cameraRig.yaw + Math.PI;
    player.heading = aimHeading;
    CBH.combat.fireShot(pos.x, 1.45, pos.z, aimHeading, { isPlayer: true, damage: C.TUNING.pistolDamage, spread: 0.012 });
    G.shake = Math.max(G.shake, 0.05);
  }

  function givePistol(ammoRounds) {
    const G = CBH.G;
    G.hasPistol = true;
    G.pistolReserve += ammoRounds || 0;
    if (G.pistolAmmo === 0 && G.pistolReserve > 0) {
      const load = Math.min(12, G.pistolReserve);
      G.pistolAmmo = load;
      G.pistolReserve -= load;
    }
    // Show the gun in Mari's hand.
    if (G.player && !G.player.group.userData.gunMesh) {
      const gun = new THREE.Mesh(CBH.city.boxGeometry(0.09, 0.14, 0.5), CBH.city.flatMaterial(0x14161a));
      gun.position.set(0.37, 1.14, 0.3);
      G.player.group.add(gun);
      G.player.group.userData.gunMesh = gun;
    }
  }

  function updatePlayerDriving(dt) {
    const G = CBH.G;
    const car = G.inCar;
    if (!car) return;
    let throttle = 0;
    let steering = 0;
    if (CBH.input.isHeld('KeyW') || CBH.input.isHeld('ArrowUp')) throttle = 1;
    if (CBH.input.isHeld('KeyS') || CBH.input.isHeld('ArrowDown')) throttle = -1;
    if (CBH.input.isHeld('KeyA') || CBH.input.isHeld('ArrowLeft')) steering = 1;
    if (CBH.input.isHeld('KeyD') || CBH.input.isHeld('ArrowRight')) steering = -1;
    const handbrake = CBH.input.isHeld('Space');
    const result = CBH.cars.drive(car, throttle, steering, handbrake, dt);
    if (result.crash > 0.15) CBH.audio.crash(result.crash);
    CBH.audio.updateEngine(Math.abs(car.speed) / car.spec.topSpeed, true);
    if (CBH.input.wasPressed('KeyE') && Math.abs(car.speed) < 4) {
      exitCar();
    }
    G.player.sinceHurt += dt;
    if (G.player.sinceHurt > C.TUNING.healthRegenDelay) {
      G.player.health = Math.min(C.TUNING.playerMaxHealth, G.player.health + C.TUNING.healthRegenPerSecond * 0.6 * dt);
    }
  }

  function updatePlayer(dt) {
    const G = CBH.G;
    if (!G.player || G.player.dead) return;
    if (G.inCar) updatePlayerDriving(dt);
    else updatePlayerOnFoot(dt);
    // Shell pickup check (on foot or slow car both fine).
    const pos = CBH.state.playerPosition();
    for (let i = 0; i < G.shells.length; i++) {
      const shell = G.shells[i];
      if (shell.taken) continue;
      if (M.distance2D(pos.x, pos.z, shell.x, shell.z) < 2.4) {
        shell.taken = true;
        shell.group.visible = false;
        G.shellsFound[shell.id] = true;
        G.shellsCount++;
        CBH.audio.shell();
        CBH.hud.showToast('Golden shell found! ' + G.shellsCount + ' / 20 — ' + shell.label);
        if (G.shellsCount % C.TUNING.shellBonusEvery === 0) {
          CBH.state.addCash(C.TUNING.shellBonusCash);
          CBH.audio.cash();
          CBH.hud.showToast('Shell bonus +$' + C.TUNING.shellBonusCash + '!');
        }
        CBH.save.write();
      }
    }
    // Damage vignette fades.
    const vignette = document.getElementById('damageVignette');
    if (vignette && parseFloat(vignette.style.opacity || '0') > 0) {
      vignette.style.opacity = Math.max(0, parseFloat(vignette.style.opacity) - dt * 0.5);
    }
  }

  window.CBH.player = {
    build: buildPlayer,
    update: updatePlayer,
    hurt: hurtPlayer,
    hurtPlayer: hurtPlayer,
    heal: healPlayer,
    knockFrom: knockPlayerFrom,
    enterCar: enterCar,
    exitCar: exitCar,
    carLostInSea: carLostInSea,
    givePistol: givePistol,
    findNearbyCar: findNearbyCar,
  };
})();

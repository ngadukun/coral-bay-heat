// main.js — Coral Bay Heat's entry point: builds the renderer, the city,
// the people, the traffic and the systems, wires the menus, stages a
// screenshot scene when the URL asks for one, and runs the frame loop
// (input -> player -> traffic -> police -> missions -> camera -> HUD).
(function () {
  'use strict';
  window.CBH = window.CBH || {};
  const G = CBH.G;

  const query = CBH.shots.readQuery();
  G.seed = query.seed;
  CBH.rng.reseed(G.seed);

  const canvas = document.getElementById('game3d');
  const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  G.renderer = renderer;
  G.scene = new THREE.Scene();
  G.camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 1600);
  G.camera.position.set(-40, 4, 224);
  window.addEventListener('resize', function () {
    G.camera.aspect = window.innerWidth / window.innerHeight;
    G.camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // ---- build the world -----------------------------------------------------
  CBH.sky.build(G.scene);
  CBH.city.build(G.scene);
  CBH.cars.buildSkidMarkPool(G.scene);
  CBH.particles.build(G.scene);
  CBH.combat.buildTracers(G.scene);
  CBH.missions.build(G.scene);
  CBH.player.build();
  CBH.traffic.spawnParked();
  CBH.traffic.spawnFleet();
  CBH.peds.spawnCrowd();
  CBH.hud.grab();
  CBH.input.bind(canvas);
  CBH.cameraControl.snapBehindPlayer();

  // ---- menu wiring -----------------------------------------------------------
  const btnNew = document.getElementById('btnNewGame');
  const btnContinue = document.getElementById('btnContinue');
  const btnResume = document.getElementById('btnResume');
  const btnSave = document.getElementById('btnSave');
  const btnRestart = document.getElementById('btnRestart');
  const btnRespawn = document.getElementById('btnRespawn');
  if (!CBH.save.has()) btnContinue.disabled = true;

  function beginPlay(fresh) {
    CBH.audio.init();
    CBH.audio.click();
    if (fresh) {
      CBH.save.clear();
      G.missionIndex = 0;
      G.cash = 250;
      G.totalEarned = 0;
      G.shellsFound = {};
      G.shellsCount = 0;
      G.hasPistol = false;
      G.pistolAmmo = 0;
      G.pistolReserve = 0;
      G.raceBest = {};
      CBH.city.applyCollectedShells();
      G.player.group.position.set(-40, 0, 232);
      G.player.heading = Math.PI;
      CBH.sky.setTimeOfDay(CBH.config.WORLD.startDayFraction);
    } else {
      const data = CBH.save.read();
      if (data) CBH.save.apply(data);
    }
    G.mode = 'play';
    CBH.hud.hideStartScreen();
    CBH.cameraControl.snapBehindPlayer();
    if (fresh) {
      CBH.hud.showCenterMessage('CORAL BAY HEAT', 'Marina "Mari" Solano is home — and she owes. Find the gold marker.', 3200);
    } else {
      CBH.hud.showToast('Welcome back to Coral Bay');
    }
  }

  btnNew.addEventListener('click', function () { beginPlay(true); });
  btnContinue.addEventListener('click', function () { beginPlay(false); });
  btnResume.addEventListener('click', function () {
    CBH.audio.click();
    G.mode = 'play';
    CBH.hud.hidePause();
  });
  btnSave.addEventListener('click', function () {
    CBH.audio.click();
    if (CBH.save.write()) CBH.hud.showToast('Saved');
  });
  btnRestart.addEventListener('click', function () {
    CBH.audio.click();
    CBH.hud.hidePause();
    beginPlay(true);
  });
  btnRespawn.addEventListener('click', function () {
    CBH.audio.click();
    CBH.missions.respawn();
  });

  function togglePause() {
    if (G.mode === 'play') {
      G.mode = 'pause';
      CBH.input.exitPointerLock();
      CBH.hud.showPause();
    } else if (G.mode === 'pause') {
      G.mode = 'play';
      CBH.hud.hidePause();
    }
  }

  // ---- shot staging ------------------------------------------------------------
  if (query.shot) {
    CBH.shots.stage(query.shot);
  }

  // ---- gull cries near the shore --------------------------------------------------
  let gullTimer = 6;

  // ---- the frame loop --------------------------------------------------------------
  let lastTimestamp = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = Math.min(0.05, (now - lastTimestamp) / 1000);
    lastTimestamp = now;
    if (G.hitStop > 0) {
      G.hitStop -= dt;
      dt *= 0.12; // hit-stop: a punch lands in near-freeze-frame
    }
    if (G.slowmoTimer > 0) {
      G.slowmoTimer -= dt;
      dt *= 0.4; // stunt-jump slow motion
    }
    G.timeScale = dt;
    const rawDt = dt;

    // Pause and dialogue advance keys work in every mode.
    if (CBH.input.wasPressed('Escape') || CBH.input.wasPressed('KeyP')) {
      if (G.mode === 'play' || G.mode === 'pause') togglePause();
    }
    if (G.mode === 'play') {
      G.clockTime += dt;
      CBH.player.update(dt);
      CBH.traffic.update(dt);
      CBH.peds.update(dt);
      CBH.police.update(dt);
      CBH.missions.update(dt);
      // Collisions between every pair of car groups.
      const allCars = G.trafficCars.concat(G.parkedCars, G.policeCars, G.missionCars);
      if (G.inCar) allCars.push(G.inCar);
      CBH.cars.collideCars(allCars, [G.inCar].filter(Boolean), dt);
      CBH.cars.collideCars(G.policeCars, G.trafficCars, dt);
      CBH.peds.checkCarHits(allCars);
      // Engine audio idles down when on foot.
      if (!G.inCar) CBH.audio.updateEngine(0, false);
      // Ambience: rain, waves, gulls.
      const pp = CBH.state.playerPosition();
      const shoreDistance = Math.max(0, 272 - Math.max(Math.abs(pp.x), Math.abs(pp.z)));
      CBH.audio.updateAmbience(G.weather === 'rain', shoreDistance, G.clockTime);
      gullTimer -= dt;
      if (gullTimer <= 0) {
        gullTimer = 5 + Math.random() * 9;
        if (shoreDistance < 60 && G.dayFraction > 0.28 && G.dayFraction < 0.72) CBH.audio.gull();
      }
    } else if (G.mode === 'menu') {
      // A slow menu orbit over the marina while the title screen is up.
      G.clockTime += rawDt * 0.4;
      const t = G.clockTime * 0.05;
      G.camera.position.set(Math.sin(t) * 120, 26 + Math.sin(G.clockTime * 0.13) * 5, 235 + Math.cos(t) * 26);
      G.camera.lookAt(0, 8, 60);
      CBH.traffic.update(rawDt * 0.6);
      CBH.peds.update(rawDt * 0.6);
    }

    // Dialogue advance runs after the world update, so the click or E that
    // closes a conversation can never also fire a shot or jack a car.
    if (G.dialogueOpen && (CBH.input.wasPressed('KeyE') || CBH.input.wasMouseClicked())) {
      CBH.hud.advanceDialogue();
    }

    CBH.sky.update(G.mode === 'play' ? dt : rawDt * 0.25);
    CBH.city.update(dt, G.clockTime);
    CBH.particles.update(dt);
    CBH.particles.updateAmbient(dt);
    CBH.combat.updateTracers(dt);
    if (G.mode === 'play' || G.mode === 'pause') {
      CBH.cameraControl.update(rawDt);
    }
    CBH.hud.update(rawDt);
    renderer.render(G.scene, G.camera);
    CBH.input.endFrame();
  }
  requestAnimationFrame(frame);
})();

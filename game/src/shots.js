// shots.js — the staged screenshot scenes. A URL query (?shot=cover,
// ?shot=drive, ?shot=chase, ?shot=mission, each with &seed=1) sets up the
// real game in a deterministic pose: time of day, camera, traffic, wanted
// level, mission state and HUD all arranged so a screenshot shows the game
// at its most complete. Playing normally never touches this module.
(function () {
  'use strict';
  window.CBH = window.CBH || {};
  const M = CBH.math;

  function readShotQuery() {
    const params = new URLSearchParams(window.location.search);
    const shot = params.get('shot');
    const seedParam = parseInt(params.get('seed') || '1', 10);
    return {
      shot: shot,
      seed: isNaN(seedParam) ? 1 : seedParam,
    };
  }

  function placePlayerOnFoot(x, z, heading) {
    const G = CBH.G;
    G.player.group.position.set(x, 0, z);
    G.player.heading = heading;
    G.player.group.rotation.y = heading;
    G.player.group.visible = true;
  }

  function putPlayerInCar(car) {
    const G = CBH.G;
    car.role = 'player';
    G.inCar = car;
    G.player.group.visible = false;
    const lists = [G.parkedCars, G.trafficCars];
    for (let i = 0; i < lists.length; i++) {
      const idx = lists[i].indexOf(car);
      if (idx >= 0) lists[i].splice(idx, 1);
    }
  }

  function findParkedCarNear(x, z, type) {
    let best = null;
    let bestDist = 1e9;
    for (let i = 0; i < CBH.G.parkedCars.length; i++) {
      const car = CBH.G.parkedCars[i];
      if (type && car.type !== type) continue;
      const d = M.distance2D(car.group.position.x, car.group.position.z, x, z);
      if (d < bestDist) { bestDist = d; best = car; }
    }
    return best;
  }

  function stageCover() {
    // Golden hour on the marina promenade: Mari, the skyline, the sea.
    const G = CBH.G;
    CBH.sky.setTimeOfDay(0.735);
    G.weather = 'clear';
    placePlayerOnFoot(-40, 230, Math.PI * 0.92);
    CBH.player.givePistol(36);
    G.cash = 1840;
    G.missionIndex = 2;
    G.shellsCount = 7;
    // A couple of boats and strollers are already placed by the world;
    // park the coral convertible beside her.
    const car = findParkedCarNear(-28, 208, 'convertible');
    if (car) {
      car.group.position.set(-33, 0, 216);
      car.heading = Math.PI * 0.75;
      car.group.rotation.y = car.heading;
    }
    CBH.cameraRig.yaw = Math.PI * 0.92 + Math.PI;
    CBH.cameraRig.pitch = 0.24;
    CBH.cameraControl.snapBehindPlayer();
    CBH.hud.showToast('Coral Bay — home sweet home');
  }

  function stageDrive() {
    // Midday downtown: driving the convertible among traffic.
    const G = CBH.G;
    CBH.sky.setTimeOfDay(0.5);
    G.weather = 'clear';
    G.cash = 2360;
    G.missionIndex = 3;
    const car = CBH.cars.create('convertible', 0xff7f50, 40, -88, 0);
    car.speed = 17;
    putPlayerInCar(car);
    // Traffic around her on the same avenue and the crossing street.
    const extras = [
      { x: 43.3, z: -52, dir: 2 }, { x: 36.7, z: -128, dir: 3 },
      { x: 8, z: -43.3, dir: 0 }, { x: 76, z: -36.7, dir: 1 },
    ];
    for (let i = 0; i < extras.length; i++) {
      CBH.traffic.spawnCar(extras[i].x, extras[i].z, extras[i].dir);
    }
    CBH.cameraRig.yaw = Math.PI;
    CBH.cameraRig.pitch = 0.3;
    CBH.cameraControl.snapBehindPlayer();
  }

  function stageChase() {
    // Four stars on the coast road: interceptors behind, lights flashing.
    const G = CBH.G;
    CBH.sky.setTimeOfDay(0.44);
    G.weather = 'clear';
    G.cash = 3120;
    G.missionIndex = 5;
    CBH.player.givePistol(48);
    const car = CBH.cars.create('sports', 0xff5030, 246, 60, Math.PI);
    car.speed = 30;
    putPlayerInCar(car);
    CBH.police.setStars(4);
    // Pose three interceptors in pursuit formation behind the player.
    const spots = [
      { x: 249.5, z: 84, heading: Math.PI }, { x: 242.5, z: 92, heading: Math.PI }, { x: 246, z: 104, heading: Math.PI },
    ];
    for (let i = 0; i < spots.length; i++) {
      const cop = CBH.police.spawnCar();
      cop.group.position.set(spots[i].x, 0, spots[i].z);
      cop.heading = spots[i].heading;
      cop.group.rotation.y = spots[i].heading;
      cop.speed = 26;
    }
    // A roadblock further down the coast road.
    const block1 = CBH.police.spawnCar();
    block1.group.position.set(242.5, 0, -6);
    block1.heading = Math.PI / 2;
    block1.group.rotation.y = Math.PI / 2;
    block1.roadblock = true;
    block1.speed = 0;
    const block2 = CBH.police.spawnCar();
    block2.group.position.set(249.5, 0, 2);
    block2.heading = Math.PI / 2;
    block2.group.rotation.y = Math.PI / 2;
    block2.roadblock = true;
    block2.speed = 0;
    CBH.cameraRig.yaw = 0;
    CBH.cameraRig.pitch = 0.3;
    CBH.cameraControl.snapBehindPlayer();
    CBH.hud.showCenterMessage('4 STARS', 'Coral Bay PD is on you', 2500);
    // Photo mode: a live chase busts Mari within seconds (she slows, the
    // interceptors box her in, the Busted meter fills), which ruins any
    // capture that takes longer than a moment. Freeze gameplay progression
    // instead: player and police hold this exact pose indefinitely — no
    // bust, no wasted, no overlay — while the light bars keep flashing.
    G.photoFreeze = true;
  }

  function stageMission() {
    // Night Run in progress: neon shopping street, night, mission marker
    // and dialogue on the HUD.
    const G = CBH.G;
    CBH.sky.setTimeOfDay(0.03);
    G.weather = 'clear';
    G.cash = 4210;
    G.missionIndex = 5;
    CBH.player.givePistol(60);
    const car = CBH.cars.create('sedan', 0x4f7fd9, -40, 96, Math.PI);
    car.speed = 15;
    putPlayerInCar(car);
    CBH.police.setStars(2);
    const cop = CBH.police.spawnCar();
    cop.group.position.set(-36.7, 0, 128);
    cop.heading = Math.PI;
    cop.group.rotation.y = Math.PI;
    cop.speed = 13;
    // Start the Night Run mission and jump straight to the delivery leg
    // with its dialogue card on screen.
    const def = CBH.missionsData.MISSIONS[5];
    G.activeMission = {
      def: def, stepIndex: 1, step: def.steps[1], timer: 118,
      targetCar: null, passengerPed: null, passengerAboard: false,
      gunmen: [], follow: null, defend: null, heatRampTimer: 0, caughtTimer: 0, started: true,
    };
    CBH.hud.showDialogue([
      { who: 'tito', text: 'Package is in the car, Mari. North Port gate, fast as you can — and the PD is bored tonight, so expect company.' },
      { who: 'mari', text: 'Timed, hot and raining headlights. My favourite kind of night.' },
    ], null);
    CBH.cameraRig.yaw = 0;
    CBH.cameraRig.pitch = 0.3;
    CBH.cameraControl.snapBehindPlayer();
  }

  function stage(shotName) {
    const G = CBH.G;
    G.shotName = shotName;
    if (shotName === 'cover') stageCover();
    else if (shotName === 'drive') stageDrive();
    else if (shotName === 'chase') stageChase();
    else if (shotName === 'mission') stageMission();
    // In shot mode the world keeps running (traffic, lights, water) but
    // the day is frozen at the staged hour for a reproducible frame.
    G.mode = 'play';
    CBH.hud.hideStartScreen();
  }

  window.CBH.shots = {
    readQuery: readShotQuery,
    stage: stage,
  };
})();

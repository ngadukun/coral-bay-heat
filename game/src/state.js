// state.js — the single shared game state object. Every module reads and
// writes CBH.G rather than keeping private copies, so the HUD, the minimap,
// the missions and the screenshot staging all see the same world.
(function () {
  'use strict';
  window.CBH = window.CBH || {};

  const G = {
    // three.js handles, filled by main.js
    renderer: null,
    scene: null,
    camera: null,
    clockTime: 0,
    timeScale: 1,
    slowmoTimer: 0,

    mode: 'menu', // menu | play | pause | busted | wasted | won
    shotName: null,
    seed: 1,

    // day / weather
    dayFraction: 0.40,
    isNight: false,
    weather: 'clear', // clear | overcast | rain
    weatherTimer: 30,

    // player
    player: null,       // built by player.js
    inCar: null,        // the Car the player is driving, or null
    cash: 250,
    totalEarned: 0,
    hasPistol: false,
    pistolAmmo: 0,      // rounds in the magazine
    pistolReserve: 0,   // spare rounds
    shellsFound: {},    // shell id -> true
    shellsCount: 0,

    // wanted / police
    wantedPoints: 0,
    wantedStars: 0,
    policeSeePlayer: false,
    searchTimer: 0,
    bustedMeter: 0,

    // world entity lists
    trafficCars: [],
    parkedCars: [],
    policeCars: [],
    missionCars: [],
    pedestrians: [],
    gunmen: [],
    shells: [],
    stuntRamps: [],
    lampLights: [],

    // mission / activity state
    missionIndex: 0,    // next story mission to offer
    activeMission: null,
    activeTaxi: null,
    activeRace: null,
    raceBest: {},
    freeRoamObjective: '',

    // camera feel
    shake: 0,
    hitStop: 0,

    // transient flags
    dialogueOpen: false,
    nearCar: null,
    nearPed: null,
    toastTimer: 0,
  };

  function playerPosition() {
    if (G.inCar) return G.inCar.group.position;
    if (G.player && G.player.group) return G.player.group.position;
    return { x: 0, z: 0 };
  }

  function addCash(amount) {
    G.cash += amount;
    if (amount > 0) G.totalEarned += amount;
  }

  function reportCrime(points, witnessX, witnessZ) {
    // Crimes only raise heat when someone could plausibly witness them:
    // near a road, a pedestrian or a police unit. Deep in an empty alley
    // at 4am, nobody saw a thing.
    const pos = playerPosition();
    let witnessed = false;
    if (G.policeCars.length > 0) witnessed = true;
    for (let i = 0; i < G.pedestrians.length && !witnessed; i++) {
      const p = G.pedestrians[i];
      if (CBH.math.distance2D(p.group.position.x, p.group.position.z, pos.x, pos.z) < 42) witnessed = true;
    }
    if (!witnessed && CBH.city && CBH.city.nearestRoadDistance(pos.x, pos.z) < 26) witnessed = true;
    if (!witnessed) return;
    G.wantedPoints = Math.min(100, G.wantedPoints + points);
    G.searchTimer = 0;
  }

  window.CBH.G = G;
  window.CBH.state = {
    playerPosition: playerPosition,
    addCash: addCash,
    reportCrime: reportCrime,
  };
})();

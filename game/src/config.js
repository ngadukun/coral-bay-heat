// config.js — Coral Bay's constants: the island layout grid, district names
// and palettes, car and pedestrian colour palettes, shop sign names and the
// tuning numbers every other module reads. One place to tune the whole game.
(function () {
  'use strict';
  window.CBH = window.CBH || {};

  const WORLD = {
    islandHalf: 275,        // sand island extends this far from the centre
    cityHalf: 250,          // paved city ground
    seaLevel: -0.6,
    roadHalfWidth: 7,       // a road is 14 units wide
    laneOffset: 3.3,        // traffic lane distance from the road centre line
    sidewalkOffset: 9.6,    // pedestrian path distance from the road centre
    dayLengthSeconds: 360,  // one full day-night cycle
    startDayFraction: 0.40, // mid-morning
  };

  // Avenues run north-south (constant x), streets run east-west (constant z).
  // The outer entries form the coast ring road.
  const AVENUES_X = [-246, -200, -120, -40, 40, 120, 200, 246];
  const STREETS_Z = [-246, -200, -120, -40, 40, 120, 200, 246];

  const DISTRICTS = {
    downtown: { name: 'Downtown', wall: [0x9fd4e8, 0x7fb6d9, 0xb8c9d9, 0x8fd0c8], roof: 0x5a6a75, minFloors: 7, maxFloors: 15 },
    shops:    { name: 'Neon Mile', wall: [0xffd9a0, 0xffb3c8, 0xa0e8ff, 0xfff3b0], roof: 0x8a5a4a, minFloors: 2, maxFloors: 4 },
    marina:   { name: 'Marina', wall: [0xffe3c2, 0xffc9d4, 0xc2f0e3, 0xfff6d9], roof: 0xc96f4a, minFloors: 2, maxFloors: 5 },
    beach:    { name: 'Coral Beach', wall: [0xfff1cf, 0xffd9ec, 0xd6f5ff, 0xffe8b3], roof: 0xd98a5a, minFloors: 2, maxFloors: 4 },
    suburbs:  { name: 'Palm Heights', wall: [0xf7ead7, 0xe8f3d8, 0xfdebd0, 0xe3ecff], roof: 0xa8563c, minFloors: 1, maxFloors: 2 },
    port:     { name: 'The Port', wall: [0xb9c0c7, 0xa8b6bf, 0xc7b299, 0x9fb3a8], roof: 0x606a70, minFloors: 1, maxFloors: 2 },
  };

  const SHOP_SIGNS = [
    'CAFE ROSA', 'CORAL MART', 'HOTEL AZURE', 'PAWN & CO', 'TACO SOL',
    'SURF SHACK', 'BANCO CORAL', 'MARINA INN', 'PALM RECORDS', 'NOODLE BAY',
    'GYM DEL SOL', 'FLORISTERIA', 'MERCADO', 'CINEMA LUZ', 'BAR LUNA',
  ];

  const CAR_COLORS = [0xd94f4f, 0x4f7fd9, 0xf2f2f2, 0x30343a, 0xf2b13c, 0x53b06a, 0x9b59c9, 0xff7f50, 0x38b6c9, 0xc0c6cc];
  const CAR_TYPES = ['sedan', 'sedan', 'hatch', 'hatch', 'convertible', 'sports', 'van', 'pickup'];
  const PED_SHIRTS = [0xff6b6b, 0x4ecdc4, 0xffe66d, 0xf7fff7, 0x95e1d3, 0xf38181, 0xaa96da, 0xfcbad3, 0x2ec1ac, 0xff9f43];
  const PED_PANTS = [0x2d4059, 0x222831, 0x6b4f2a, 0x3a506b, 0x5c374c, 0x1f3a5f];
  const SKIN_TONES = [0xf2c79b, 0xd9a066, 0xa9713f, 0x7a4a21, 0xffdbac];

  const TUNING = {
    playerWalkSpeed: 6.2,
    playerSprintSpeed: 9.8,
    playerRadius: 0.55,
    playerMaxHealth: 100,
    healthRegenPerSecond: 5,
    healthRegenDelay: 6,
    jumpVelocity: 5.6,
    gravity: -15,
    carMaxHealth: 100,
    pistolDamage: 34,
    pistolRange: 60,
    pistolCooldown: 0.24,
    punchRange: 1.9,
    punchDamage: 26,
    enterCarRange: 3.4,
    wantedDecayPerSecond: 4,
    bustedFillRate: 0.55,
    bustedDrainRate: 0.8,
    trafficCount: 22,
    parkedCount: 26,
    pedestrianCount: 30,
    shellTotal: 20,
    shellBonusEvery: 5,
    shellBonusCash: 250,
  };

  const SAVE_KEY = 'coralBayHeatSaveV1';

  window.CBH.config = {
    WORLD: WORLD,
    AVENUES_X: AVENUES_X,
    STREETS_Z: STREETS_Z,
    DISTRICTS: DISTRICTS,
    SHOP_SIGNS: SHOP_SIGNS,
    CAR_COLORS: CAR_COLORS,
    CAR_TYPES: CAR_TYPES,
    PED_SHIRTS: PED_SHIRTS,
    PED_PANTS: PED_PANTS,
    SKIN_TONES: SKIN_TONES,
    TUNING: TUNING,
    SAVE_KEY: SAVE_KEY,
  };
})();

// rng.js — deterministic seeded random number generation for Coral Bay Heat.
// The whole city is generated from one fixed seed so the world, the traffic
// placement and the staged screenshot scenes reproduce exactly every load.
(function () {
  'use strict';
  window.CBH = window.CBH || {};

  // mulberry32: a tiny, fast, well-distributed 32-bit PRNG.
  function createSeededRandom(seed) {
    let state = (seed >>> 0) || 1;
    return function nextRandom() {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  let activeRandom = createSeededRandom(1);

  function reseedWorldRandom(seed) {
    activeRandom = createSeededRandom(seed);
  }

  function randomFloat() {
    return activeRandom();
  }

  function randomRange(min, max) {
    return min + activeRandom() * (max - min);
  }

  function randomInt(minInclusive, maxInclusive) {
    return Math.floor(randomRange(minInclusive, maxInclusive + 1));
  }

  function randomPick(list) {
    return list[Math.floor(activeRandom() * list.length) % list.length];
  }

  function randomChance(probability) {
    return activeRandom() < probability;
  }

  // A separate stream for run-time jitter (horns, footsteps) that must not
  // disturb the deterministic world-generation stream.
  function jitter() {
    return Math.random();
  }

  function clamp(value, min, max) {
    return value < min ? min : value > max ? max : value;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function distance2D(ax, az, bx, bz) {
    const dx = ax - bx;
    const dz = az - bz;
    return Math.sqrt(dx * dx + dz * dz);
  }

  function angleLerp(a, b, t) {
    let diff = (b - a) % (Math.PI * 2);
    if (diff > Math.PI) diff -= Math.PI * 2;
    if (diff < -Math.PI) diff += Math.PI * 2;
    return a + diff * t;
  }

  function headingTo(fromX, fromZ, toX, toZ) {
    return Math.atan2(toX - fromX, toZ - fromZ);
  }

  window.CBH.rng = {
    reseed: reseedWorldRandom,
    float: randomFloat,
    range: randomRange,
    int: randomInt,
    pick: randomPick,
    chance: randomChance,
    jitter: jitter,
  };
  window.CBH.math = {
    clamp: clamp,
    lerp: lerp,
    distance2D: distance2D,
    angleLerp: angleLerp,
    headingTo: headingTo,
  };
})();

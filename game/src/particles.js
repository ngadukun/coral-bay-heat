// particles.js — Coral Bay's particle pool: sparks, engine smoke, fire,
// dust, tyre smoke, muzzle flashes, rain splash rings and sea spray at the
// shore, all from one recycled Points cloud plus a few sprite puffs, so
// effects never allocate in the frame loop.
(function () {
  'use strict';
  window.CBH = window.CBH || {};
  const M = CBH.math;

  const MAX_PARTICLES = 1400;
  let points = null;
  let positions = null;
  let colors = null;
  let velocities = null;
  let lifetimes = null;
  let maxLifetimes = null;
  let gravities = null;
  let nextIndex = 0;

  const PARTICLE_TYPES = {
    sparks:    { color: [1.0, 0.8, 0.3], life: 0.45, speed: 5.5, gravity: -9, size: 0.16 },
    smoke:     { color: [0.25, 0.25, 0.27], life: 1.6, speed: 1.2, gravity: 2.2, size: 0.3 },
    fire:      { color: [1.0, 0.45, 0.12], life: 0.6, speed: 1.8, gravity: 3.5, size: 0.34 },
    dust:      { color: [0.85, 0.76, 0.6], life: 0.9, speed: 2.4, gravity: -1.5, size: 0.26 },
    tireSmoke: { color: [0.8, 0.8, 0.82], life: 1.1, speed: 1.4, gravity: 1.2, size: 0.3 },
    muzzle:    { color: [1.0, 0.9, 0.5], life: 0.09, speed: 2.0, gravity: 0, size: 0.3 },
    spray:     { color: [0.85, 0.95, 1.0], life: 0.8, speed: 3.4, gravity: -6, size: 0.2 },
    rainHit:   { color: [0.7, 0.82, 0.95], life: 0.3, speed: 1.0, gravity: -4, size: 0.12 },
    confetti:  { color: [1.0, 0.6, 0.8], life: 1.2, speed: 4.0, gravity: -3, size: 0.2 },
  };

  function buildParticles(scene) {
    positions = new Float32Array(MAX_PARTICLES * 3);
    colors = new Float32Array(MAX_PARTICLES * 3);
    velocities = new Float32Array(MAX_PARTICLES * 3);
    lifetimes = new Float32Array(MAX_PARTICLES);
    maxLifetimes = new Float32Array(MAX_PARTICLES);
    gravities = new Float32Array(MAX_PARTICLES);
    for (let i = 0; i < MAX_PARTICLES; i++) {
      positions[i * 3 + 1] = -100;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const material = new THREE.PointsMaterial({ size: 0.32, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false });
    points = new THREE.Points(geo, material);
    points.frustumCulled = false;
    scene.add(points);
  }

  function spawnParticles(x, y, z, typeName, count) {
    if (!points) return;
    const type = PARTICLE_TYPES[typeName] || PARTICLE_TYPES.dust;
    for (let n = 0; n < count; n++) {
      const i = nextIndex;
      nextIndex = (nextIndex + 1) % MAX_PARTICLES;
      positions[i * 3] = x + (Math.random() - 0.5) * 0.5;
      positions[i * 3 + 1] = y + (Math.random() - 0.5) * 0.3;
      positions[i * 3 + 2] = z + (Math.random() - 0.5) * 0.5;
      const angle = Math.random() * Math.PI * 2;
      const speed = type.speed * (0.4 + Math.random() * 0.8);
      velocities[i * 3] = Math.cos(angle) * speed;
      velocities[i * 3 + 1] = Math.random() * type.speed * 0.9 + 0.4;
      velocities[i * 3 + 2] = Math.sin(angle) * speed;
      const shade = 0.85 + Math.random() * 0.3;
      colors[i * 3] = type.color[0] * shade;
      colors[i * 3 + 1] = type.color[1] * shade;
      colors[i * 3 + 2] = type.color[2] * shade;
      lifetimes[i] = type.life * (0.6 + Math.random() * 0.7);
      maxLifetimes[i] = lifetimes[i];
      gravities[i] = type.gravity;
    }
  }

  function updateParticles(dt) {
    if (!points) return;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (lifetimes[i] <= 0) continue;
      lifetimes[i] -= dt;
      if (lifetimes[i] <= 0) {
        positions[i * 3 + 1] = -100;
        continue;
      }
      velocities[i * 3 + 1] += gravities[i] * dt;
      positions[i * 3] += velocities[i * 3] * dt;
      positions[i * 3 + 1] += velocities[i * 3 + 1] * dt;
      positions[i * 3 + 2] += velocities[i * 3 + 2] * dt;
      if (positions[i * 3 + 1] < 0.05) {
        positions[i * 3 + 1] = 0.05;
        velocities[i * 3 + 1] = 0;
      }
    }
    points.geometry.attributes.position.needsUpdate = true;
    points.geometry.attributes.color.needsUpdate = true;
  }

  // Ambient shore spray: white flecks where the sea meets the sand.
  let sprayTimer = 0;
  function updateAmbientParticles(dt) {
    sprayTimer -= dt;
    if (sprayTimer > 0) return;
    sprayTimer = 0.24;
    const G = CBH.G;
    const pp = CBH.state.playerPosition();
    // Only bother when the player is near a shore.
    const edge = 272;
    const nearShore = Math.abs(pp.x) > 225 || Math.abs(pp.z) > 225;
    if (!nearShore) return;
    const side = Math.floor(Math.random() * 4);
    let x = pp.x + (Math.random() - 0.5) * 90;
    let z = pp.z + (Math.random() - 0.5) * 90;
    if (side === 0) x = edge;
    if (side === 1) x = -edge;
    if (side === 2) z = edge;
    if (side === 3) z = -edge;
    x = M.clamp(x, -285, 285);
    z = M.clamp(z, -285, 285);
    spawnParticles(x, 0.4, z, 'spray', 3);
    if (G.weather === 'rain') {
      spawnParticles(pp.x + (Math.random() - 0.5) * 30, 0.3, pp.z + (Math.random() - 0.5) * 30, 'rainHit', 2);
    }
  }

  window.CBH.particles = {
    build: buildParticles,
    spawn: spawnParticles,
    update: updateParticles,
    updateAmbient: updateAmbientParticles,
  };
})();

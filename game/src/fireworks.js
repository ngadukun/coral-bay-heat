// Coral Bay Heat — Night fireworks over the bay.
// On clear in-game nights, quiet bursts bloom above the marina so the
// waterfront never feels empty after dark. Purely ambient: no score,
// no interaction, just colour reflected on the water in spirit.
(function () {
  'use strict';
  window.CBH = window.CBH || {};

  var TICK_MS = 120;
  var DT = 0.12;
  var MAX_BURSTS = 4;
  var LAUNCH_GAP_MS = 6000;
  var PARTICLES_PER_BURST = 46;
  var GRAVITY = 3.2;
  var LIFETIME = 1.7;

  var PALETTE = [0xff5d8f, 0x22d3ee, 0xfbbf24, 0xa78bfa, 0x34d399];

  var bursts = [];
  var lastLaunchAt = 0;

  function randomUnitVector() {
    var u = Math.random() * 2 - 1;
    var theta = Math.random() * Math.PI * 2;
    var r = Math.sqrt(Math.max(0, 1 - u * u));
    return {
      x: r * Math.cos(theta),
      y: u,
      z: r * Math.sin(theta)
    };
  }

  function launch(scene) {
    var originX = 30 + Math.random() * 50;
    var originY = 42 + Math.random() * 16;
    var originZ = 245 + Math.random() * 30;

    var positions = new Float32Array(PARTICLES_PER_BURST * 3);
    var velocities = [];

    for (var i = 0; i < PARTICLES_PER_BURST; i++) {
      positions[i * 3] = originX;
      positions[i * 3 + 1] = originY;
      positions[i * 3 + 2] = originZ;

      var dir = randomUnitVector();
      var speed = 9 + Math.random() * 8;
      velocities.push({
        x: dir.x * speed,
        y: dir.y * speed,
        z: dir.z * speed
      });
    }

    var geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    var color = PALETTE[Math.floor(Math.random() * PALETTE.length)];
    var material = new THREE.PointsMaterial({
      color: color,
      size: 1.6,
      transparent: true,
      opacity: 1,
      depthWrite: false
    });

    var points = new THREE.Points(geometry, material);
    scene.add(points);

    bursts.push({
      points: points,
      geometry: geometry,
      material: material,
      velocities: velocities,
      life: 1
    });

    lastLaunchAt = Date.now();
  }

  function updateBursts() {
    for (var b = bursts.length - 1; b >= 0; b--) {
      var burst = bursts[b];
      var attr = burst.geometry.getAttribute('position');
      var arr = attr.array;

      for (var i = 0; i < burst.velocities.length; i++) {
        var v = burst.velocities[i];
        arr[i * 3] += v.x * DT;
        arr[i * 3 + 1] += v.y * DT;
        arr[i * 3 + 2] += v.z * DT;
        v.y -= GRAVITY * DT;
      }
      attr.needsUpdate = true;

      burst.life -= DT / LIFETIME;
      burst.material.opacity = Math.max(burst.life, 0);

      if (burst.life <= 0) {
        if (window.CBH.G && window.CBH.G.scene) {
          window.CBH.G.scene.remove(burst.points);
        }
        burst.geometry.dispose();
        if (burst.material && typeof burst.material.dispose === 'function') {
          burst.material.dispose();
        }
        bursts.splice(b, 1);
      }
    }
  }

  function tick() {
    updateBursts();

    if (!window.CBH.G) return;
    if (!window.CBH.G.scene) return;
    if (!window.CBH.G.isNight) return;
    if (window.CBH.G.mode !== 'play') return;
    if (bursts.length >= MAX_BURSTS) return;
    if (Date.now() - lastLaunchAt < LAUNCH_GAP_MS) return;

    launch(window.CBH.G.scene);
  }

  window.setInterval(tick, TICK_MS);
})();

// Coral Bay Heat — Neon Buoys collectible system.
// Twelve glowing buoys bob just off the shore near familiar landmarks.
// Drift close on foot or by car to light one, earn a small cash bonus,
// and watch the counter climb toward a full set of twelve.
(function () {
  'use strict';
  window.CBH = window.CBH || {};

  var STORAGE_KEY = 'cbh-neon-buoys-v1';
  var TOTAL = 12;
  var REWARD = 25;
  var COLLECT_RADIUS = 10;

  var SPOTS = [
    { x: 46, z: 234 },
    { x: 60, z: 238 },
    { x: 222, z: 74 },
    { x: 206, z: 84 },
    { x: 150, z: -36 },
    { x: -58, z: 58 },
    { x: 30, z: 240 },
    { x: 76, z: 232 },
    { x: 230, z: 60 },
    { x: 196, z: 92 },
    { x: 140, z: -44 },
    { x: -70, z: 66 }
  ];

  var COLORS = [0xff5d8f, 0x22d3ee, 0xa78bfa, 0xfbbf24, 0x34d399];

  function loadFound() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return {};
      var map = {};
      for (var i = 0; i < parsed.length; i++) {
        if (typeof parsed[i] === 'number') map[parsed[i]] = true;
      }
      return map;
    } catch (err) {
      return {};
    }
  }

  function saveFound(foundMap) {
    try {
      var list = [];
      for (var key in foundMap) {
        if (Object.prototype.hasOwnProperty.call(foundMap, key) && foundMap[key]) {
          list.push(Number(key));
        }
      }
      list.sort(function (a, b) { return a - b; });
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (err) {
      // Storage can be unavailable in private windows; the hunt still works for the session.
    }
  }

  function countFound(foundMap) {
    var n = 0;
    for (var key in foundMap) {
      if (Object.prototype.hasOwnProperty.call(foundMap, key) && foundMap[key]) n++;
    }
    return n;
  }

  var builtScene = null;
  var buoys = [];
  var foundMap = loadFound();
  var chip = null;

  function ensureChip() {
    if (chip && document.body && document.body.contains(chip)) return chip;
    if (!document.body) return null;
    var existing = document.getElementById('neon-buoy-chip');
    if (existing) {
      chip = existing;
      return chip;
    }
    chip = document.createElement('div');
    chip.id = 'neon-buoy-chip';
    chip.style.position = 'fixed';
    chip.style.left = '14px';
    chip.style.bottom = '64px';
    chip.style.padding = '6px 10px';
    chip.style.background = 'rgba(10,16,24,0.72)';
    chip.style.color = '#a5f3fc';
    chip.style.font = '600 13px system-ui, sans-serif';
    chip.style.borderRadius = '999px';
    chip.style.zIndex = '40';
    chip.style.pointerEvents = 'none';
    document.body.appendChild(chip);
    updateChip();
    return chip;
  }

  function updateChip() {
    if (!chip) return;
    chip.textContent = 'Neon buoys ' + countFound(foundMap) + ' / ' + TOTAL;
  }

  function build(scene) {
    builtScene = scene;
    buoys = [];
    foundMap = loadFound();

    for (var i = 0; i < SPOTS.length; i++) {
      (function (index) {
        var spot = SPOTS[index];
        var color = COLORS[index % COLORS.length];
        var material = new THREE.MeshBasicMaterial({ color: color });

        var group = new THREE.Group();
        group.position.set(spot.x, 0.35, spot.z);

        var ringGeo = new THREE.TorusGeometry(1.1, 0.28, 8, 18);
        var ring = new THREE.Mesh(ringGeo, material);
        ring.rotation.x = Math.PI / 2;
        group.add(ring);

        var orbGeo = new THREE.SphereGeometry(0.32, 10, 8);
        var orb = new THREE.Mesh(orbGeo, material);
        orb.position.y = 0.5;
        group.add(orb);

        if (foundMap[index]) {
          group.visible = false;
        }

        scene.add(group);
        buoys.push({
          id: index,
          group: group,
          phase: index * 1.37 + 0.6
        });
      })(i);
    }

    ensureChip();
    updateChip();
  }

  function tick() {
    if (!window.CBH.G || window.CBH.G.mode !== 'play') return;
    if (!buoys.length) return;

    var now = Date.now();
    var player = null;
    try {
      if (window.CBH.state && typeof window.CBH.state.playerPosition === 'function') {
        player = window.CBH.state.playerPosition();
      }
    } catch (err) {
      player = null;
    }

    for (var i = 0; i < buoys.length; i++) {
      var buoy = buoys[i];
      if (foundMap[buoy.id]) continue;
      if (!buoy.group.visible && !foundMap[buoy.id]) buoy.group.visible = true;

      buoy.group.position.y = 0.35 + Math.sin(now * 0.0013 + buoy.phase) * 0.18;
      buoy.group.rotation.y += 0.008;

      if (!player) continue;
      var dx = player.x - buoy.group.position.x;
      var dz = player.z - buoy.group.position.z;
      var dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < COLLECT_RADIUS) {
        foundMap[buoy.id] = true;
        buoy.group.visible = false;
        saveFound(foundMap);
        if (typeof window.CBH.G.cash === 'number') {
          window.CBH.G.cash += REWARD;
        }
        var total = countFound(foundMap);
        if (window.CBH.hud && typeof window.CBH.hud.showToast === 'function') {
          window.CBH.hud.showToast('Neon buoy lit — ' + total + ' / ' + TOTAL + ' (+$25)');
        }
        updateChip();
      }
    }
  }

  var poll = window.setInterval(function () {
    if (!window.CBH.G || !window.CBH.G.scene) return;
    if (builtScene === window.CBH.G.scene) return;
    build(window.CBH.G.scene);
  }, 250);

  // Keep the poll handle referenced so linters do not treat it as dead code;
  // the interval itself is the lifetime of the collectible system.
  void poll;

  window.setInterval(tick, 100);
})();

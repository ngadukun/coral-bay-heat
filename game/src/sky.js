// sky.js — Coral Bay's day-night cycle and weather. A full day lasts about
// six real minutes: the sun and moon cross the sky, dawn and dusk burn
// orange, stars come out at night, clouds drift, and the weather wanders
// between clear skies, overcast and warm rain showers.
(function () {
  'use strict';
  window.CBH = window.CBH || {};
  const C = CBH.config;
  const M = CBH.math;

  let sunLight = null;
  let moonLight = null;
  let hemiLight = null;
  let sunDisc = null;
  let moonDisc = null;
  let starField = null;
  let cloudGroup = null;
  let rainPoints = null;
  let rainVelocity = null;
  let seaMaterial = null;
  let lampMaterials = [];

  const SKY_KEYS = [
    // dayFraction, sky colour, fog colour, sun intensity, hemi intensity, ambient warmth
    { t: 0.00, sky: 0x0b1c33, fog: 0x0e2238, sun: 0.05, hemi: 0.16 },
    { t: 0.21, sky: 0x16283f, fog: 0x1a2c42, sun: 0.08, hemi: 0.20 },
    { t: 0.26, sky: 0xff9e5e, fog: 0xf2a56b, sun: 0.55, hemi: 0.42 },
    { t: 0.33, sky: 0x8ec9e8, fog: 0xbfe0ee, sun: 1.05, hemi: 0.62 },
    { t: 0.50, sky: 0x6ec1ee, fog: 0xcfeaf7, sun: 1.25, hemi: 0.72 },
    { t: 0.68, sky: 0x87bfe6, fog: 0xc4dfec, sun: 1.05, hemi: 0.62 },
    { t: 0.75, sky: 0xff8f52, fog: 0xf0a06a, sun: 0.55, hemi: 0.44 },
    { t: 0.81, sky: 0x2c3a5e, fog: 0x35466b, sun: 0.14, hemi: 0.26 },
    { t: 0.88, sky: 0x0d1e36, fog: 0x11263f, sun: 0.05, hemi: 0.17 },
    { t: 1.00, sky: 0x0b1c33, fog: 0x0e2238, sun: 0.05, hemi: 0.16 },
  ];

  function colourLerpHex(a, b, t) {
    const ca = { r: (a >> 16) & 255, g: (a >> 8) & 255, b: a & 255 };
    const cb = { r: (b >> 16) & 255, g: (b >> 8) & 255, b: b & 255 };
    return new THREE.Color(
      M.lerp(ca.r, cb.r, t) / 255,
      M.lerp(ca.g, cb.g, t) / 255,
      M.lerp(ca.b, cb.b, t) / 255
    );
  }

  function sampleSky(fraction) {
    let i = 0;
    while (i < SKY_KEYS.length - 2 && SKY_KEYS[i + 1].t <= fraction) i++;
    const a = SKY_KEYS[i];
    const b = SKY_KEYS[i + 1];
    const span = Math.max(0.0001, b.t - a.t);
    const t = M.clamp((fraction - a.t) / span, 0, 1);
    return {
      sky: colourLerpHex(a.sky, b.sky, t),
      fog: colourLerpHex(a.fog, b.fog, t),
      sun: M.lerp(a.sun, b.sun, t),
      hemi: M.lerp(a.hemi, b.hemi, t),
    };
  }

  function buildSky(scene) {
    const G = CBH.G;
    scene.fog = new THREE.Fog(0xcfeaf7, 190, 720);
    hemiLight = new THREE.HemisphereLight(0xbfe3ff, 0x8a7a5a, 0.7);
    scene.add(hemiLight);
    sunLight = new THREE.DirectionalLight(0xfff2d8, 1.2);
    sunLight.position.set(120, 180, 60);
    scene.add(sunLight);
    scene.add(sunLight.target);
    moonLight = new THREE.DirectionalLight(0x9db8e8, 0.0);
    moonLight.position.set(-80, 160, -40);
    scene.add(moonLight);

    const sunGeo = new THREE.SphereGeometry(16, 12, 12);
    sunDisc = new THREE.Mesh(sunGeo, new THREE.MeshBasicMaterial({ color: 0xffe9a8, fog: false }));
    scene.add(sunDisc);
    moonDisc = new THREE.Mesh(new THREE.SphereGeometry(11, 12, 12), new THREE.MeshBasicMaterial({ color: 0xe8eef7, fog: false }));
    scene.add(moonDisc);

    // Stars: a dome of points that fades in after dark.
    const starCount = 700;
    const starPositions = new Float32Array(starCount * 3);
    const starRandom = CBH.rng;
    for (let i = 0; i < starCount; i++) {
      const theta = starRandom.float() * Math.PI * 2;
      const phi = Math.acos(starRandom.float() * 0.95);
      const radius = 860;
      starPositions[i * 3] = Math.sin(phi) * Math.cos(theta) * radius;
      starPositions[i * 3 + 1] = Math.cos(phi) * radius * 0.6 + 30;
      starPositions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * radius;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starField = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false }));
    scene.add(starField);

    // Drifting clouds: soft flat white blobs high over the island.
    cloudGroup = new THREE.Group();
    const cloudMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, fog: false });
    for (let i = 0; i < 16; i++) {
      const cloud = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), cloudMaterial);
      cloud.scale.set(starRandom.range(26, 60), starRandom.range(4, 7), starRandom.range(14, 26));
      cloud.position.set(starRandom.range(-520, 520), starRandom.range(120, 170), starRandom.range(-520, 520));
      cloudGroup.add(cloud);
    }
    scene.add(cloudGroup);

    // Rain: a cylinder of falling streaks recycled around the camera.
    const rainCount = 900;
    const rainPositions = new Float32Array(rainCount * 3);
    rainVelocity = new Float32Array(rainCount);
    for (let i = 0; i < rainCount; i++) {
      rainPositions[i * 3] = (Math.random() - 0.5) * 130;
      rainPositions[i * 3 + 1] = Math.random() * 55;
      rainPositions[i * 3 + 2] = (Math.random() - 0.5) * 130;
      rainVelocity[i] = 46 + Math.random() * 22;
    }
    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
    rainPoints = new THREE.Points(rainGeo, new THREE.PointsMaterial({ color: 0xaaccee, size: 0.55, transparent: true, opacity: 0 }));
    rainPoints.frustumCulled = false;
    scene.add(rainPoints);

    G.lampLights = [];
  }

  function registerSeaMaterial(material) {
    seaMaterial = material;
  }

  function registerLampMaterial(material) {
    lampMaterials.push(material);
  }

  function setTimeOfDay(fraction) {
    CBH.G.dayFraction = ((fraction % 1) + 1) % 1;
  }

  function formatClock(fraction) {
    const totalMinutes = Math.floor(fraction * 24 * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return (hours < 10 ? '0' : '') + hours + ':' + (minutes < 10 ? '0' : '') + minutes;
  }

  function updateSky(dt) {
    const G = CBH.G;
    const scene = G.scene;
    if (!scene || !sunLight) return;
    if (G.mode === 'play') {
      G.dayFraction = (G.dayFraction + dt / C.WORLD.dayLengthSeconds) % 1;
    }
    const f = G.dayFraction;
    const sample = sampleSky(f);
    const weatherDim = G.weather === 'overcast' ? 0.72 : G.weather === 'rain' ? 0.55 : 1.0;
    scene.background = sample.sky;
    scene.fog.color.copy(sample.fog);
    if (G.weather !== 'clear') scene.fog.color.lerp(new THREE.Color(0x5a6a78), 0.45);

    const sunAngle = (f - 0.25) * Math.PI * 2; // sunrise at 0.25, sunset at 0.75
    const sunHeight = Math.sin(sunAngle);
    const focus = CBH.state.playerPosition();
    sunLight.position.set(focus.x + Math.cos(sunAngle) * 260, Math.max(24, sunHeight * 300), focus.z + 90);
    sunLight.target.position.set(focus.x, 0, focus.z);
    sunLight.intensity = sample.sun * weatherDim;
    sunLight.color.setHex(sunHeight < 0.25 && sunHeight > -0.05 ? 0xffb37a : 0xfff2d8);
    hemiLight.intensity = sample.hemi * (0.55 + 0.45 * weatherDim);
    moonLight.intensity = sunHeight < 0 ? 0.22 : 0.0;

    sunDisc.position.set(focus.x + Math.cos(sunAngle) * 800, sunHeight * 700, focus.z - 260);
    sunDisc.material.opacity = 1;
    const moonAngle = sunAngle + Math.PI;
    moonDisc.position.set(focus.x + Math.cos(moonAngle) * 780, Math.sin(moonAngle) * 640 + 40, focus.z - 240);
    const nightAmount = M.clamp(-sunHeight * 1.6 + 0.25, 0, 1);
    starField.material.opacity = nightAmount * (G.weather === 'clear' ? 0.95 : 0.15);
    G.isNight = sunHeight < 0.06;

    // Clouds drift east and thicken with the weather.
    cloudGroup.position.x += dt * 2.2;
    if (cloudGroup.position.x > 120) cloudGroup.position.x = -120;
    const cloudOpacity = G.weather === 'clear' ? 0.5 : G.weather === 'overcast' ? 0.9 : 1.0;
    cloudGroup.children[0].material.opacity = cloudOpacity;
    cloudGroup.children[0].material.color.setHex(G.weather === 'clear' ? 0xffffff : 0x9aa7b4);

    // Lamp glow + lit windows follow the dark.
    for (let i = 0; i < lampMaterials.length; i++) {
      lampMaterials[i].emissiveIntensity = nightAmount * 1.6;
    }
    if (CBH.city && CBH.city.setNightWindowGlow) CBH.city.setNightWindowGlow(nightAmount);

    // Sea shimmer follows the sun.
    if (seaMaterial) {
      seaMaterial.color.copy(sample.sky).lerp(new THREE.Color(0x1a6f9e), 0.62);
      if (G.weather === 'rain') seaMaterial.color.lerp(new THREE.Color(0x3a4a55), 0.4);
    }

    updateWeather(dt);
    updateRain(dt, focus);
  }

  function updateWeather(dt) {
    const G = CBH.G;
    G.weatherTimer -= dt;
    if (G.weatherTimer > 0 || G.shotName) return;
    const roll = Math.random();
    if (G.weather === 'clear') {
      G.weather = roll < 0.55 ? 'overcast' : roll < 0.72 ? 'rain' : 'clear';
    } else if (G.weather === 'overcast') {
      G.weather = roll < 0.45 ? 'clear' : roll < 0.7 ? 'rain' : 'overcast';
    } else {
      G.weather = roll < 0.6 ? 'overcast' : 'rain';
    }
    G.weatherTimer = 45 + Math.random() * 55;
    if (G.weather === 'rain') CBH.audio.rainSwell();
  }

  function updateRain(dt, focus) {
    const G = CBH.G;
    if (!rainPoints) return;
    const targetOpacity = G.weather === 'rain' ? 0.75 : 0;
    rainPoints.material.opacity += (targetOpacity - rainPoints.material.opacity) * Math.min(1, dt * 2);
    if (rainPoints.material.opacity < 0.02) return;
    const positions = rainPoints.geometry.attributes.position;
    for (let i = 0; i < rainVelocity.length; i++) {
      let y = positions.getY(i) - rainVelocity[i] * dt;
      if (y < 0) {
        y = 50 + Math.random() * 6;
        positions.setX(i, (Math.random() - 0.5) * 130);
        positions.setZ(i, (Math.random() - 0.5) * 130);
      }
      positions.setY(i, y);
    }
    positions.needsUpdate = true;
    rainPoints.position.set(focus.x, 0, focus.z);
  }

  window.CBH.sky = {
    build: buildSky,
    update: updateSky,
    setTimeOfDay: setTimeOfDay,
    formatClock: formatClock,
    registerSeaMaterial: registerSeaMaterial,
    registerLampMaterial: registerLampMaterial,
  };
})();

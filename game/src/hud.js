// hud.js — everything drawn over the 3D view: cash, clock, wanted stars,
// health and Busted bars, weapon and shell readouts, the objective line and
// mission timer, context prompts, toasts, centre announcements, mission
// cards, the dialogue box with speaker avatars, the live minimap, and the
// start / pause / end screens.
(function () {
  'use strict';
  window.CBH = window.CBH || {};
  const C = CBH.config;
  const M = CBH.math;

  const el = {};
  let dialogueQueue = [];
  let dialogueCallback = null;
  let toastTimer = 0;
  let centerTimer = 0;
  let cardTimer = 0;
  let minimapContext = null;

  function grabElements() {
    const ids = ['hud', 'cash', 'stars', 'clockLine', 'healthBar', 'bustedWrap', 'bustedBar',
      'weaponName', 'ammoLine', 'shellLine', 'objectiveLabel', 'objectiveText', 'missionTimer',
      'prompt', 'toast', 'centerMsg', 'centerTitle', 'centerSub', 'dialogue', 'dialogueAvatar',
      'dialogueName', 'dialogueText', 'missionCard', 'missionCardTitle', 'missionCardSub',
      'startScreen', 'pauseScreen', 'endScreen', 'endTitle', 'endSub', 'pauseStats', 'minimap'];
    for (let i = 0; i < ids.length; i++) el[ids[i]] = document.getElementById(ids[i]);
    if (el.minimap) minimapContext = el.minimap.getContext('2d');
  }

  function showToast(text) {
    if (!el.toast) return;
    el.toast.textContent = text;
    el.toast.style.display = 'block';
    toastTimer = 3.2;
    const status = document.getElementById('status');
    if (status) status.textContent = text;
  }

  function showCenterMessage(title, sub, durationMs) {
    if (!el.centerMsg) return;
    el.centerTitle.textContent = title;
    el.centerSub.textContent = sub || '';
    el.centerMsg.style.display = 'block';
    centerTimer = (durationMs || 1800) / 1000;
  }

  function showMissionCard(title, sub) {
    if (!el.missionCard) return;
    el.missionCardTitle.textContent = title;
    el.missionCardSub.textContent = sub || '';
    el.missionCard.style.display = 'block';
    cardTimer = 3.6;
  }

  // ---- dialogue -------------------------------------------------------------
  function showDialogue(lines, onDone) {
    dialogueQueue = lines.slice();
    dialogueCallback = onDone || null;
    CBH.G.dialogueOpen = true;
    el.dialogue.style.display = 'block';
    renderDialogueLine();
  }

  function renderDialogueLine() {
    const line = dialogueQueue[0];
    if (!line) {
      closeDialogue();
      return;
    }
    const person = CBH.missionsData.PEOPLE[line.who] || { name: line.who, color: '#888', initial: '?' };
    el.dialogueAvatar.style.background = person.color;
    el.dialogueAvatar.textContent = person.initial;
    el.dialogueName.textContent = person.name;
    el.dialogueText.textContent = line.text;
  }

  function advanceDialogue() {
    if (!CBH.G.dialogueOpen) return;
    dialogueQueue.shift();
    CBH.audio.click();
    if (dialogueQueue.length === 0) closeDialogue();
    else renderDialogueLine();
  }

  function closeDialogue() {
    el.dialogue.style.display = 'none';
    CBH.G.dialogueOpen = false;
    const cb = dialogueCallback;
    dialogueCallback = null;
    if (cb) cb();
  }

  function isDialogueOpen() {
    return CBH.G.dialogueOpen;
  }

  // ---- screens ---------------------------------------------------------------
  function showEndScreen(title, sub) {
    el.endTitle.textContent = title;
    el.endTitle.style.color = title === 'BUSTED' ? '#57b6ff' : '#ff5f6d';
    el.endSub.textContent = sub;
    el.endScreen.style.display = 'flex';
    el.hud.classList.add('hidden');
  }

  function hideEndScreen() {
    el.endScreen.style.display = 'none';
    el.hud.classList.remove('hidden');
  }

  function showPause() {
    const G = CBH.G;
    const shells = G.shellsCount;
    const bestLines = [];
    for (const id in G.raceBest) bestLines.push(id + ' best ' + G.raceBest[id].toFixed(1) + 's');
    el.pauseStats.innerHTML =
      'Missions complete: <b>' + G.missionIndex + ' / 8</b><br>' +
      'Golden shells: <b>' + shells + ' / 20</b><br>' +
      'Cash earned: <b>$' + G.totalEarned + '</b><br>' +
      'Stunt jumps landed: <b>' + (G.statsJumps || 0) + '</b>' +
      (bestLines.length ? '<br>' + bestLines.join('<br>') : '');
    el.pauseScreen.style.display = 'flex';
  }

  function hidePause() {
    el.pauseScreen.style.display = 'none';
  }

  function hideStartScreen() {
    el.startScreen.style.display = 'none';
    el.hud.classList.remove('hidden');
  }

  // ---- per-frame HUD ---------------------------------------------------------
  function updateHUD(dt) {
    const G = CBH.G;
    if (!el.cash) return;
    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0) el.toast.style.display = 'none';
    }
    if (centerTimer > 0) {
      centerTimer -= dt;
      if (centerTimer <= 0) el.centerMsg.style.display = 'none';
    }
    if (cardTimer > 0) {
      cardTimer -= dt;
      if (cardTimer <= 0) el.missionCard.style.display = 'none';
    }
    if (G.mode === 'menu') return;

    el.cash.textContent = '$' + G.cash;
    el.clockLine.textContent = CBH.sky.formatClock(G.dayFraction) + (G.weather === 'rain' ? ' · RAIN' : G.weather === 'overcast' ? ' · OVERCAST' : '');
    // Wanted stars.
    let starsHtml = '';
    for (let i = 1; i <= 5; i++) {
      starsHtml += '<span class="' + (i <= G.wantedStars ? 'on' : 'off') + '">★</span>';
    }
    el.stars.innerHTML = starsHtml;
    el.stars.className = (!G.policeSeePlayer && G.wantedStars > 0) ? 'searching' : '';
    el.stars.id = 'stars';
    // Health + busted.
    const healthPct = Math.max(0, G.player ? G.player.health : 100);
    el.healthBar.style.width = healthPct + '%';
    el.healthBar.style.background = healthPct < 30 ? '#ff4040' : '';
    if (G.bustedMeter > 0.02) {
      el.bustedWrap.style.display = 'block';
      el.bustedBar.style.width = (G.bustedMeter * 100) + '%';
    } else {
      el.bustedWrap.style.display = 'none';
    }
    // Weapon.
    if (G.hasPistol) {
      el.weaponName.textContent = 'PISTOL';
      el.ammoLine.textContent = G.pistolAmmo + ' / ' + G.pistolReserve;
    } else {
      el.weaponName.textContent = G.inCar ? 'DRIVING' : 'FISTS';
      el.ammoLine.textContent = G.inCar ? Math.round(Math.abs(G.inCar.speed) * 3.6) + ' km/h' : '';
    }
    el.shellLine.textContent = '🐚 ' + G.shellsCount + ' / 20';
    // Objective + timer.
    const active = G.activeMission;
    if (active && active.def) {
      el.objectiveLabel.textContent = active.def.title.toUpperCase();
      if (active.def.timer) {
        const left = Math.max(0, active.timer);
        const mins = Math.floor(left / 60);
        const secs = Math.floor(left % 60);
        el.missionTimer.textContent = mins + ':' + (secs < 10 ? '0' : '') + secs;
        el.missionTimer.style.color = left < 30 ? '#ff4040' : '';
      } else if (active.step && active.step.kind === 'defend' && active.defend) {
        el.missionTimer.textContent = 'Hold out: ' + Math.ceil(active.defend.timeLeft) + 's';
      } else {
        el.missionTimer.textContent = '';
      }
    } else if (G.activeRace) {
      el.objectiveLabel.textContent = G.activeRace.def.name.toUpperCase();
      el.missionTimer.textContent = G.activeRace.time.toFixed(1) + 's / par ' + G.activeRace.def.parSeconds + 's';
    } else if (G.activeTaxi) {
      el.objectiveLabel.textContent = 'TAXI FARE';
      el.missionTimer.textContent = '$' + G.activeTaxi.fare + ' · ' + Math.max(0, Math.ceil(G.activeTaxi.timeLeft)) + 's';
    } else {
      el.objectiveLabel.textContent = 'CORAL BAY';
      el.missionTimer.textContent = '';
    }
    el.objectiveText.textContent = CBH.missions.currentObjective() || G.freeRoamObjective || '';
    if (!G.activeMission && !G.activeTaxi && !G.activeRace && G.freeRoamObjective) {
      el.objectiveText.textContent = CBH.missions.currentObjective();
    }
    updatePrompt();
    drawMinimap();
  }

  function updatePrompt() {
    const G = CBH.G;
    let html = '';
    if (G.dialogueOpen) html = '';
    else if (G.inCar && G.nearRaceStart) html = '<b>Enter</b> — Start ' + G.nearRaceStart.name;
    else if (!G.inCar && G.nearCar) html = '<b>E</b> — Enter ' + (G.nearCar.type === 'police' ? 'police interceptor' : G.nearCar.type) + (G.nearCar.role === 'traffic' ? ' (jack it!)' : '');
    else if (G.inCar && Math.abs(G.inCar.speed) < 4) html = '<b>E</b> — Get out';
    else if (!G.inCar) {
      const def = CBH.missionsData.MISSIONS[G.missionIndex];
      const pp = CBH.state.playerPosition();
      if (def && !G.activeMission && M.distance2D(pp.x, pp.z, def.start.x, def.start.z) < 9) {
        html = 'Walk into the gold marker — <b>' + def.title + '</b>';
      }
    }
    if (html) {
      el.prompt.innerHTML = html;
      el.prompt.style.display = 'block';
    } else {
      el.prompt.style.display = 'none';
    }
  }

  // ---- minimap -----------------------------------------------------------------
  function drawMinimap() {
    if (!minimapContext) return;
    const G = CBH.G;
    const ctx = minimapContext;
    const size = 336;
    const pp = CBH.state.playerPosition();
    const scale = G.inCar ? 0.52 : 0.78; // px per world unit, zooms out when driving
    ctx.fillStyle = '#2e7fb8';
    ctx.fillRect(0, 0, size, size);
    function toMap(x, z) {
      return [size / 2 + (x - pp.x) * scale, size / 2 + (z - pp.z) * scale];
    }
    // Island + beach.
    const island = toMap(-281, -281);
    ctx.fillStyle = '#e8d193';
    ctx.fillRect(island[0], island[1], 562 * scale, 562 * scale);
    const city = toMap(-253, -253);
    ctx.fillStyle = '#9aa0a3';
    ctx.fillRect(city[0], city[1], 506 * scale, 506 * scale);
    // Blocks.
    ctx.fillStyle = '#7e8a90';
    for (let bx = 0; bx < 5; bx++) {
      for (let bz = 0; bz < 5; bz++) {
        const x1 = [-193, -113, -33, 47, 127][bx];
        const z1 = [-193, -113, -33, 47, 127][bz];
        const p = toMap(x1, z1);
        ctx.fillRect(p[0], p[1], 66 * scale, 66 * scale);
      }
    }
    // Roads.
    ctx.strokeStyle = '#3c4147';
    ctx.lineWidth = Math.max(2, 14 * scale);
    for (let i = 0; i < C.AVENUES_X.length; i++) {
      const a = toMap(C.AVENUES_X[i], -253);
      const b = toMap(C.AVENUES_X[i], 253);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
    for (let i = 0; i < C.STREETS_Z.length; i++) {
      const a = toMap(-253, C.STREETS_Z[i]);
      const b = toMap(253, C.STREETS_Z[i]);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
    // Canal.
    ctx.fillStyle = '#2e7fb8';
    const canal = toMap(150, -178);
    ctx.fillRect(canal[0], canal[1], 131 * scale, 20 * scale);
    // Traffic dots.
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    drawDots(ctx, G.trafficCars, toMap, 3);
    drawDots(ctx, G.parkedCars, toMap, 2.4);
    // Police: flashing blue.
    const flash = Math.sin(G.clockTime * 8) > 0;
    ctx.fillStyle = flash ? '#3a9bff' : '#ff4040';
    drawDots(ctx, G.policeCars, toMap, 4.4);
    // Mission / activity target in gold.
    let target = null;
    if (G.activeMission) target = CBH.missions.stepTarget(G.activeMission.step, G.activeMission);
    else if (G.activeTaxi) target = { x: G.activeTaxi.destX, z: G.activeTaxi.destZ };
    else if (G.activeRace) target = G.activeRace.def.checkpoints[G.activeRace.cpIndex];
    else {
      const def = CBH.missionsData.MISSIONS[G.missionIndex];
      if (def) target = def.start;
    }
    if (target) {
      const p = toMap(target.x, target.z);
      ctx.fillStyle = '#ffd23e';
      ctx.beginPath();
      ctx.arc(clampToMap(p[0], size), clampToMap(p[1], size), 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    // Player arrow.
    const heading = G.inCar ? G.inCar.heading : (G.player ? G.player.heading : 0);
    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.rotate(Math.atan2(Math.sin(heading), -Math.cos(heading)));
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(6.5, 8);
    ctx.lineTo(0, 4.5);
    ctx.lineTo(-6.5, 8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#123';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.restore();
    // North label.
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = 'bold 17px Trebuchet MS';
    ctx.fillText('N', size / 2 - 6, 20);
  }

  function clampToMap(v, size) {
    return M.clamp(v, 10, size - 10);
  }

  function drawDots(ctx, cars, toMap, radius) {
    for (let i = 0; i < cars.length; i++) {
      const car = cars[i];
      if (!car.group.visible) continue;
      const p = toMap(car.group.position.x, car.group.position.z);
      if (p[0] < -6 || p[1] < -6 || p[0] > 342 || p[1] > 342) continue;
      ctx.beginPath();
      ctx.arc(p[0], p[1], radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  window.CBH.hud = {
    grab: grabElements,
    showToast: showToast,
    showCenterMessage: showCenterMessage,
    showMissionCard: showMissionCard,
    showDialogue: showDialogue,
    advanceDialogue: advanceDialogue,
    isDialogueOpen: isDialogueOpen,
    showEndScreen: showEndScreen,
    hideEndScreen: hideEndScreen,
    showPause: showPause,
    hidePause: hidePause,
    hideStartScreen: hideStartScreen,
    update: updateHUD,
  };
})();

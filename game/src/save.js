// save.js — Coral Bay Heat progress in the browser's local storage:
// story progress, cash, shells, the pistol and where Mari was standing.
(function () {
  'use strict';
  window.CBH = window.CBH || {};
  const KEY = CBH.config.SAVE_KEY;

  function collectSaveData() {
    const G = CBH.G;
    const pos = G.player && G.player.group ? G.player.group.position : { x: -40, z: 232 };
    return {
      version: 1,
      missionIndex: G.missionIndex,
      cash: G.cash,
      totalEarned: G.totalEarned,
      shellsFound: G.shellsFound,
      hasPistol: G.hasPistol,
      pistolAmmo: G.pistolAmmo,
      pistolReserve: G.pistolReserve,
      dayFraction: G.dayFraction,
      raceBest: G.raceBest,
      playerX: pos.x,
      playerZ: pos.z,
    };
  }

  function writeSave() {
    try {
      localStorage.setItem(KEY, JSON.stringify(collectSaveData()));
      return true;
    } catch (err) {
      return false;
    }
  }

  function readSave() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || data.version !== 1) return null;
      return data;
    } catch (err) {
      return null;
    }
  }

  function hasSave() {
    return readSave() !== null;
  }

  function clearSave() {
    try {
      localStorage.removeItem(KEY);
    } catch (err) {
      // storage unavailable; a fresh game is the fallback
    }
  }

  function applySave(data) {
    const G = CBH.G;
    G.missionIndex = data.missionIndex || 0;
    G.cash = typeof data.cash === 'number' ? data.cash : 250;
    G.totalEarned = data.totalEarned || 0;
    G.shellsFound = data.shellsFound || {};
    G.shellsCount = Object.keys(G.shellsFound).length;
    G.hasPistol = !!data.hasPistol;
    G.pistolAmmo = data.pistolAmmo || 0;
    G.pistolReserve = data.pistolReserve || 0;
    G.dayFraction = typeof data.dayFraction === 'number' ? data.dayFraction : G.dayFraction;
    G.raceBest = data.raceBest || {};
    if (G.player && G.player.group && typeof data.playerX === 'number') {
      G.player.group.position.set(data.playerX, 0, data.playerZ);
    }
    // Mark collected shells in the world.
    if (CBH.city && CBH.city.applyCollectedShells) CBH.city.applyCollectedShells();
  }

  window.CBH.save = {
    write: writeSave,
    read: readSave,
    has: hasSave,
    clear: clearSave,
    apply: applySave,
  };
})();

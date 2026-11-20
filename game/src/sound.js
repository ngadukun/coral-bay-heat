// sound.js — every sound in Coral Bay Heat is synthesised with WebAudio:
// a laid-back menu groove, an engine note that follows speed, two-tone
// sirens, horns, gunshots, punches, rain patter, gulls and shore waves.
// No audio files exist anywhere in the game.
(function () {
  'use strict';
  window.CBH = window.CBH || {};

  let audioContext = null;
  let masterGain = null;
  let musicGain = null;
  let engineOscillator = null;
  let engineGain = null;
  let engineFilter = null;
  let sirenOscillator = null;
  let sirenGain = null;
  let rainGain = null;
  let waveGain = null;
  let musicTimer = null;
  let musicStep = 0;
  let started = false;

  function ensureContext() {
    if (audioContext) {
      if (audioContext.state === 'suspended') audioContext.resume();
      return true;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    audioContext = new AC();
    masterGain = audioContext.createGain();
    masterGain.gain.value = 0.55;
    masterGain.connect(audioContext.destination);
    musicGain = audioContext.createGain();
    musicGain.gain.value = 0.30;
    musicGain.connect(masterGain);
    return true;
  }

  function makeNoiseBuffer(seconds) {
    const length = Math.floor(audioContext.sampleRate * seconds);
    const buffer = audioContext.createBuffer(1, length, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  let sharedNoiseBuffer = null;
  function noiseBuffer() {
    if (!sharedNoiseBuffer) sharedNoiseBuffer = makeNoiseBuffer(1.2);
    return sharedNoiseBuffer;
  }

  function playNoiseBurst(duration, filterFrequency, gainValue, type) {
    if (!ensureContext()) return;
    const source = audioContext.createBufferSource();
    source.buffer = noiseBuffer();
    const filter = audioContext.createBiquadFilter();
    filter.type = type || 'bandpass';
    filter.frequency.value = filterFrequency;
    const gain = audioContext.createGain();
    const now = audioContext.currentTime;
    gain.gain.setValueAtTime(gainValue, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    source.start(now);
    source.stop(now + duration + 0.05);
  }

  function playTone(frequency, duration, gainValue, type, slideTo, destination) {
    if (!ensureContext()) return;
    const osc = audioContext.createOscillator();
    osc.type = type || 'sine';
    const gain = audioContext.createGain();
    const now = audioContext.currentTime;
    osc.frequency.setValueAtTime(frequency, now);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), now + duration);
    gain.gain.setValueAtTime(gainValue, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(destination || masterGain);
    osc.start(now);
    osc.stop(now + duration + 0.05);
  }

  // ---- one-shot effects -------------------------------------------------
  function playGunshot() {
    playNoiseBurst(0.16, 1800, 0.55, 'highpass');
    playTone(150, 0.10, 0.4, 'square', 40);
  }

  function playPunch() {
    playNoiseBurst(0.09, 500, 0.4, 'lowpass');
    playTone(90, 0.08, 0.3, 'sine', 45);
  }

  function playHorn(pitch) {
    playTone(pitch || 370, 0.28, 0.16, 'sawtooth');
    playTone((pitch || 370) * 1.26, 0.28, 0.12, 'sawtooth');
  }

  function playCrash(strength) {
    playNoiseBurst(0.3, 300, 0.3 + 0.4 * Math.min(1, strength), 'lowpass');
    playTone(70, 0.25, 0.3, 'triangle', 35);
  }

  function playCashChime() {
    playTone(1320, 0.12, 0.22, 'square');
    setTimeout(function () { playTone(1760, 0.22, 0.22, 'square'); }, 70);
  }

  function playUiClick() {
    playTone(880, 0.05, 0.15, 'square');
  }

  function playShellPickup() {
    playTone(1040, 0.1, 0.2, 'sine');
    setTimeout(function () { playTone(1560, 0.18, 0.2, 'sine'); }, 80);
  }

  function playSplash() {
    playNoiseBurst(0.5, 900, 0.3, 'lowpass');
  }

  function playSkid(intensity) {
    if (intensity > 0.4) playNoiseBurst(0.12, 2400, 0.05 * intensity, 'bandpass');
  }

  function playThunderFreeRainToggle() {
    // Rain has no thunder in Coral Bay; this hook exists so the weather
    // module can announce a shower with a soft patter swell instead.
    if (rainGain && audioContext) {
      rainGain.gain.linearRampToValueAtTime(0.10, audioContext.currentTime + 1.5);
    }
  }

  // ---- continuous voices ------------------------------------------------
  function startEngineVoice() {
    if (!ensureContext() || engineOscillator) return;
    engineOscillator = audioContext.createOscillator();
    engineOscillator.type = 'sawtooth';
    engineOscillator.frequency.value = 55;
    engineFilter = audioContext.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 320;
    engineGain = audioContext.createGain();
    engineGain.gain.value = 0;
    engineOscillator.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(masterGain);
    engineOscillator.start();
  }

  function updateEngineVoice(speedRatio, running) {
    if (!engineOscillator || !audioContext) return;
    const now = audioContext.currentTime;
    const targetGain = running ? 0.05 + speedRatio * 0.075 : 0;
    engineGain.gain.setTargetAtTime(targetGain, now, 0.08);
    engineOscillator.frequency.setTargetAtTime(52 + speedRatio * 165, now, 0.06);
    engineFilter.frequency.setTargetAtTime(300 + speedRatio * 900, now, 0.1);
  }

  function startSirenVoice() {
    if (!ensureContext() || sirenOscillator) return;
    sirenOscillator = audioContext.createOscillator();
    sirenOscillator.type = 'triangle';
    sirenGain = audioContext.createGain();
    sirenGain.gain.value = 0;
    sirenOscillator.connect(sirenGain);
    sirenGain.connect(masterGain);
    sirenOscillator.start();
  }

  function updateSirenVoice(time, nearestDistance, anyActive) {
    if (!sirenOscillator || !audioContext) return;
    const now = audioContext.currentTime;
    if (!anyActive) {
      sirenGain.gain.setTargetAtTime(0, now, 0.2);
      return;
    }
    const twoTone = Math.sin(time * 5.2) > 0 ? 880 : 660;
    sirenOscillator.frequency.setTargetAtTime(twoTone, now, 0.03);
    const closeness = CBH.math.clamp(1 - nearestDistance / 130, 0, 1);
    sirenGain.gain.setTargetAtTime(0.015 + closeness * 0.075, now, 0.15);
    if (musicGain) musicGain.gain.setTargetAtTime(0.30 - closeness * 0.17, now, 0.4);
  }

  function startAmbienceVoices() {
    if (!ensureContext() || rainGain) return;
    // Rain patter: looped filtered noise, gain follows the weather.
    const rainSource = audioContext.createBufferSource();
    rainSource.buffer = noiseBuffer();
    rainSource.loop = true;
    const rainFilter = audioContext.createBiquadFilter();
    rainFilter.type = 'highpass';
    rainFilter.frequency.value = 1600;
    rainGain = audioContext.createGain();
    rainGain.gain.value = 0;
    rainSource.connect(rainFilter);
    rainFilter.connect(rainGain);
    rainGain.connect(masterGain);
    rainSource.start();
    // Shore waves: slow-breathing low noise, gain follows shore distance.
    const waveSource = audioContext.createBufferSource();
    waveSource.buffer = noiseBuffer();
    waveSource.loop = true;
    waveSource.playbackRate.value = 0.3;
    const waveFilter = audioContext.createBiquadFilter();
    waveFilter.type = 'lowpass';
    waveFilter.frequency.value = 420;
    waveGain = audioContext.createGain();
    waveGain.gain.value = 0;
    waveSource.connect(waveFilter);
    waveFilter.connect(waveGain);
    waveGain.connect(masterGain);
    waveSource.start();
  }

  function updateAmbienceVoices(isRaining, shoreDistance, time) {
    if (!audioContext || !rainGain) return;
    const now = audioContext.currentTime;
    rainGain.gain.setTargetAtTime(isRaining ? 0.085 : 0, now, 0.8);
    const waveLevel = CBH.math.clamp(1 - shoreDistance / 90, 0, 1) * (0.03 + 0.02 * Math.sin(time * 0.5));
    waveGain.gain.setTargetAtTime(Math.max(0, waveLevel), now, 0.6);
  }

  function playGullCry() {
    playTone(1250, 0.16, 0.05, 'sine', 900);
    setTimeout(function () { playTone(1400, 0.13, 0.04, 'sine', 1000); }, 150);
  }

  // ---- the menu groove ----------------------------------------------------
  // A laid-back I–VI–II–V loop in C: sub bass, soft chord pads, hat ticks.
  const CHORD_ROOTS = [130.81, 110.0, 146.83, 98.0];
  const CHORD_TONES = [[1, 1.189, 1.498], [1, 1.189, 1.498], [1, 1.189, 1.498], [1, 1.335, 1.498]];

  function scheduleMusicStep() {
    if (!audioContext) return;
    const bar = Math.floor(musicStep / 8) % 4;
    const beat = musicStep % 8;
    const root = CHORD_ROOTS[bar];
    if (beat === 0) {
      playTone(root / 2, 1.5, 0.20, 'sine', null, musicGain);
      const tones = CHORD_TONES[bar];
      for (let i = 0; i < tones.length; i++) {
        playTone(root * tones[i] * 2, 1.6, 0.045, 'triangle', null, musicGain);
      }
    }
    if (beat === 4) playTone(root / 2, 0.5, 0.14, 'sine', null, musicGain);
    if (beat % 2 === 0) playNoiseBurstToMusic(0.03, 6000, 0.028);
    musicStep++;
  }

  function playNoiseBurstToMusic(duration, frequency, gainValue) {
    const source = audioContext.createBufferSource();
    source.buffer = noiseBuffer();
    const filter = audioContext.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = frequency;
    const gain = audioContext.createGain();
    const now = audioContext.currentTime;
    gain.gain.setValueAtTime(gainValue, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(musicGain);
    source.start(now);
    source.stop(now + duration + 0.05);
  }

  function startMusic() {
    if (!ensureContext() || musicTimer) return;
    musicTimer = setInterval(scheduleMusicStep, 240);
  }

  function initAudio() {
    if (started) return;
    if (!ensureContext()) return;
    started = true;
    startEngineVoice();
    startSirenVoice();
    startAmbienceVoices();
    startMusic();
  }

  window.CBH.audio = {
    init: initAudio,
    gunshot: playGunshot,
    punch: playPunch,
    horn: playHorn,
    crash: playCrash,
    cash: playCashChime,
    click: playUiClick,
    shell: playShellPickup,
    splash: playSplash,
    skid: playSkid,
    gull: playGullCry,
    rainSwell: playThunderFreeRainToggle,
    updateEngine: updateEngineVoice,
    updateSiren: updateSirenVoice,
    updateAmbience: updateAmbienceVoices,
  };
})();

// camera.js — the third-person camera rig: mouse-orbit yaw and pitch
// around Mari on foot, a lower wider chase view when driving, smoothing,
// building collision so the camera never clips through a tower, and the
// impact shake that sells crashes and nearby gunfire.
(function () {
  'use strict';
  window.CBH = window.CBH || {};
  const M = CBH.math;

  const rig = {
    yaw: 0,     // behind Mari, looking north into the city at spawn
    pitch: 0.32,
    distance: 8.5,
    height: 2.6,
    smoothX: -40,
    smoothY: 3,
    smoothZ: 224,
  };

  function updateCamera(dt) {
    const G = CBH.G;
    const camera = G.camera;
    if (!camera) return;
    const delta = CBH.input.consumeMouseDelta();
    if (G.mode === 'play' && !G.dialogueOpen) {
      rig.yaw -= delta.x * 0.0032;
      rig.pitch = M.clamp(rig.pitch + delta.y * 0.0028, -0.12, 1.15);
    }
    const driving = !!G.inCar;
    const targetDistance = driving ? 11.5 : 8.5;
    const targetHeight = driving ? 3.4 : 2.6;
    rig.distance = M.lerp(rig.distance, targetDistance, Math.min(1, dt * 3));
    rig.height = M.lerp(rig.height, targetHeight, Math.min(1, dt * 3));
    if (driving) {
      // The chase camera eases behind the car's heading at speed.
      const car = G.inCar;
      const behindYaw = car.heading + Math.PI;
      let diff = behindYaw - rig.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const speedRatio = Math.abs(car.speed) / car.spec.topSpeed;
      if (Math.abs(diff) > 0.02) {
        rig.yaw += diff * Math.min(1, dt * (1.1 + speedRatio * 1.6));
      }
      rig.pitch = M.lerp(rig.pitch, 0.3, Math.min(1, dt * 1.5));
    }
    const focus = driving ? G.inCar.group.position : G.player.group.position;
    const focusY = driving ? 1.4 : 1.6;
    const backX = Math.sin(rig.yaw) * Math.cos(rig.pitch);
    const backZ = Math.cos(rig.yaw) * Math.cos(rig.pitch);
    const backY = Math.sin(rig.pitch);
    let camX = focus.x + backX * rig.distance;
    let camZ = focus.z + backZ * rig.distance;
    let camY = focus.y + focusY + backY * rig.distance + 0.6;

    // Camera collision: pull in front of any building the camera entered.
    const resolved = CBH.city.collideCircle(camX, camZ, 0.7);
    camX = resolved.x;
    camZ = resolved.z;
    camY = Math.max(1.1, camY);
    // Keep the camera over dry land when hugging the shore.
    if (CBH.city.isPointInWater(camX, camZ)) {
      camX = M.clamp(camX, -272, 272);
      camZ = M.clamp(camZ, -272, 272);
    }
    const smoothing = driving ? 14 : 11;
    rig.smoothX = M.lerp(rig.smoothX, camX, Math.min(1, dt * smoothing));
    rig.smoothY = M.lerp(rig.smoothY, camY, Math.min(1, dt * smoothing));
    rig.smoothZ = M.lerp(rig.smoothZ, camZ, Math.min(1, dt * smoothing));
    camera.position.set(rig.smoothX, rig.smoothY, rig.smoothZ);

    // Impact shake, decaying.
    if (G.shake > 0.003) {
      camera.position.x += (Math.random() - 0.5) * G.shake * 0.9;
      camera.position.y += (Math.random() - 0.5) * G.shake * 0.6;
      G.shake = Math.max(0, G.shake - dt * 1.6);
    }
    camera.lookAt(focus.x, focus.y + focusY + 0.4, focus.z);
  }

  function snapBehindPlayer() {
    const G = CBH.G;
    if (G.inCar) rig.yaw = G.inCar.heading + Math.PI;
    else if (G.player) rig.yaw = G.player.heading + Math.PI;
    const focus = CBH.state.playerPosition();
    rig.smoothX = focus.x + Math.sin(rig.yaw) * rig.distance;
    rig.smoothZ = focus.z + Math.cos(rig.yaw) * rig.distance;
    rig.smoothY = 4;
  }

  window.CBH.cameraRig = rig;
  window.CBH.cameraControl = {
    update: updateCamera,
    snapBehindPlayer: snapBehindPlayer,
  };
})();

// input.js — keyboard and mouse state for Coral Bay Heat. Keeps a held-key
// set, one-frame pressed/released edges, mouse orbit deltas (pointer lock
// with a drag fallback) and the click-to-fire button state.
(function () {
  'use strict';
  window.CBH = window.CBH || {};

  const heldKeys = {};
  const pressedKeys = {};
  const releasedKeys = {};
  let mouseDX = 0;
  let mouseDY = 0;
  let mouseDown = false;
  let mouseClicked = false;
  let pointerLocked = false;
  let dragging = false;
  let lastDragX = 0;
  let lastDragY = 0;

  function bindInput(canvas) {
    window.addEventListener('keydown', function (event) {
      if (!heldKeys[event.code]) pressedKeys[event.code] = true;
      heldKeys[event.code] = true;
      if (event.code === 'Space') event.preventDefault();
    });
    window.addEventListener('keyup', function (event) {
      heldKeys[event.code] = false;
      releasedKeys[event.code] = true;
    });
    window.addEventListener('blur', function () {
      for (const code in heldKeys) heldKeys[code] = false;
      mouseDown = false;
    });
    document.addEventListener('pointerlockchange', function () {
      pointerLocked = document.pointerLockElement === canvas;
    });
    canvas.addEventListener('click', function () {
      if (CBH.G.mode === 'play' && !pointerLocked && !CBH.G.shotName) {
        canvas.requestPointerLock();
      }
    });
    document.addEventListener('mousemove', function (event) {
      if (pointerLocked) {
        mouseDX += event.movementX || 0;
        mouseDY += event.movementY || 0;
      } else if (dragging) {
        mouseDX += (event.clientX - lastDragX) * 2.2;
        mouseDY += (event.clientY - lastDragY) * 2.2;
        lastDragX = event.clientX;
        lastDragY = event.clientY;
      }
    });
    canvas.addEventListener('mousedown', function (event) {
      if (event.button === 0) {
        mouseDown = true;
        mouseClicked = true;
        dragging = true;
        lastDragX = event.clientX;
        lastDragY = event.clientY;
      }
    });
    window.addEventListener('mouseup', function (event) {
      if (event.button === 0) {
        mouseDown = false;
        dragging = false;
      }
    });
  }

  function isHeld(code) {
    return !!heldKeys[code];
  }

  function wasPressed(code) {
    return !!pressedKeys[code];
  }

  function moveAxis() {
    let x = 0;
    let z = 0;
    if (isHeld('KeyW') || isHeld('ArrowUp')) z -= 1;
    if (isHeld('KeyS') || isHeld('ArrowDown')) z += 1;
    if (isHeld('KeyA') || isHeld('ArrowLeft')) x -= 1;
    if (isHeld('KeyD') || isHeld('ArrowRight')) x += 1;
    return { x: x, z: z };
  }

  function consumeMouseDelta() {
    const delta = { x: mouseDX, y: mouseDY };
    mouseDX = 0;
    mouseDY = 0;
    return delta;
  }

  function endFrame() {
    for (const code in pressedKeys) delete pressedKeys[code];
    for (const code in releasedKeys) delete releasedKeys[code];
    mouseClicked = false;
  }

  window.CBH.input = {
    bind: bindInput,
    isHeld: isHeld,
    wasPressed: wasPressed,
    moveAxis: moveAxis,
    consumeMouseDelta: consumeMouseDelta,
    endFrame: endFrame,
    isMouseDown: function () { return mouseDown; },
    wasMouseClicked: function () { return mouseClicked; },
    isPointerLocked: function () { return pointerLocked; },
    exitPointerLock: function () { if (document.exitPointerLock) document.exitPointerLock(); },
  };
})();

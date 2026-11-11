(function attachCharacterCameraControls(global) {
  function create(options) {
    const {
      THREE,
      renderer,
      canvas,
      characters,
      collisionObstacles,
      splitToggle,
      divider,
      turnStepInput,
      onModeChange,
      onSingleDrag
    } = options;
    const splitCameras = {
      alex: new THREE.PerspectiveCamera(72, 0.5, 0.05, 1000),
      steve: new THREE.PerspectiveCamera(72, 0.5, 0.05, 1000)
    };
    const cameraControls = {
      alex: { orbitOffset: 0, pitch: 0.75, yaw: null },
      steve: { orbitOffset: 0, pitch: 0.75, yaw: null }
    };
    const turnStates = {
      alex: { direction: 0, elapsed: 0, targetYaw: null },
      steve: { direction: 0, elapsed: 0, targetYaw: null }
    };
    const repeatSeconds = 0.14;
    let splitMode = false;
    let turnStepDegrees = Number(turnStepInput?.value) || 30;
    let draggingCharacter = null;
    let draggingSingleCamera = false;
    let previousMouseX = 0;
    let previousMouseY = 0;

    function setMode(enabled) {
      splitMode = Boolean(enabled);
      if (divider) divider.hidden = !splitMode;
      if (onModeChange) onModeChange(splitMode);
    }

    if (splitToggle) {
      splitToggle.checked = false;
      splitToggle.addEventListener('change', () => setMode(splitToggle.checked));
    }
    if (turnStepInput) {
      turnStepInput.addEventListener('input', () => {
        const requested = Number(turnStepInput.value);
        turnStepDegrees = Number.isFinite(requested) ? Math.min(90, Math.max(1, requested)) : 30;
        turnStepInput.value = String(turnStepDegrees);
      });
    }

    canvas.addEventListener('mousedown', (event) => {
      if (event.button !== 0) return;
      const bounds = canvas.getBoundingClientRect();
      if (splitMode) {
        draggingCharacter = event.clientX - bounds.left < bounds.width / 2 ? 'alex' : 'steve';
      } else {
        draggingSingleCamera = true;
      }
      previousMouseX = event.clientX;
      previousMouseY = event.clientY;
    });
    global.addEventListener('mouseup', () => {
      draggingCharacter = null;
      draggingSingleCamera = false;
    });
    global.addEventListener('blur', () => {
      draggingCharacter = null;
      draggingSingleCamera = false;
    });
    global.addEventListener('mousemove', (event) => {
      if (splitMode && draggingCharacter) {
        const controls = cameraControls[draggingCharacter];
        controls.orbitOffset -= (event.clientX - previousMouseX) * 0.005;
        controls.pitch = THREE.MathUtils.clamp(
          controls.pitch + (event.clientY - previousMouseY) * 0.005,
          0.15,
          1.25
        );
      } else if (!splitMode && draggingSingleCamera && onSingleDrag) {
        onSingleDrag(event.clientX - previousMouseX, event.clientY - previousMouseY);
      } else {
        return;
      }
      previousMouseX = event.clientX;
      previousMouseY = event.clientY;
    });

    function move(name, input) {
      const character = characters[name];
      const otherCharacter = characters[name === 'alex' ? 'steve' : 'alex'];
      const speed = input.speed;
      if (splitMode) {
        const turnState = turnStates[name];
        if (turnState.targetYaw === null) turnState.targetYaw = character.root.rotation.y;
        const direction = Number(Boolean(input.left)) - Number(Boolean(input.right));
        if (!direction) {
          turnState.direction = 0;
          turnState.elapsed = 0;
        } else if (direction !== turnState.direction) {
          turnState.direction = direction;
          turnState.elapsed = 0;
          turnState.targetYaw += direction * THREE.MathUtils.degToRad(turnStepDegrees);
        } else {
          turnState.elapsed += input.delta;
          while (turnState.elapsed >= repeatSeconds) {
            turnState.elapsed -= repeatSeconds;
            turnState.targetYaw += direction * THREE.MathUtils.degToRad(turnStepDegrees);
          }
        }
        const yawDifference = Math.atan2(
          Math.sin(turnState.targetYaw - character.root.rotation.y),
          Math.cos(turnState.targetYaw - character.root.rotation.y)
        );
        character.root.rotation.y += yawDifference * (1 - Math.exp(-10 * input.delta));

        const forward = Number(Boolean(input.forward)) - Number(Boolean(input.backward));
        if (!forward) return false;
        return global.MinecraftCharacterModel.moveWithCollisions(
          character,
          Math.sin(character.root.rotation.y) * forward * speed,
          Math.cos(character.root.rotation.y) * forward * speed,
          collisionObstacles,
          otherCharacter
        );
      }

      const horizontal = Number(Boolean(input.right)) - Number(Boolean(input.left));
      const forward = Number(Boolean(input.forward)) - Number(Boolean(input.backward));
      const inputLength = Math.hypot(horizontal, forward);
      if (!inputLength) return false;
      const normalizedX = horizontal / inputLength;
      const normalizedForward = forward / inputLength;
      const orbit = input.orbit || 0;
      const directionX = normalizedX * Math.cos(orbit) - normalizedForward * Math.sin(orbit);
      const directionZ = -normalizedX * Math.sin(orbit) - normalizedForward * Math.cos(orbit);
      const moved = global.MinecraftCharacterModel.moveWithCollisions(
        character,
        directionX * speed,
        directionZ * speed,
        collisionObstacles,
        otherCharacter
      );
      character.root.rotation.y = Math.atan2(directionX, directionZ);
      return moved;
    }

    function updateSplitCamera(name, delta) {
      const character = characters[name];
      const camera = splitCameras[name];
      const controls = cameraControls[name];
      const desiredYaw = character.root.rotation.y + Math.PI + controls.orbitOffset;
      if (controls.yaw === null) controls.yaw = desiredYaw;
      const yawDifference = Math.atan2(
        Math.sin(desiredYaw - controls.yaw),
        Math.cos(desiredYaw - controls.yaw)
      );
      controls.yaw += yawDifference * (1 - Math.exp(-8 * delta));
      const horizontalDistance = 4.8;
      camera.position.set(
        character.root.position.x + Math.sin(controls.yaw) * horizontalDistance,
        character.root.position.y + 1 + Math.tan(controls.pitch) * horizontalDistance,
        character.root.position.z + Math.cos(controls.yaw) * horizontalDistance
      );
      camera.lookAt(character.root.position.x, character.root.position.y + 1, character.root.position.z);
      return camera;
    }

    function render(scene, width, height, delta) {
      if (!splitMode) return false;
      const leftWidth = Math.floor(width / 2);
      const views = [
        { name: 'alex', x: 0, width: leftWidth },
        { name: 'steve', x: leftWidth, width: width - leftWidth }
      ];
      renderer.setScissorTest(true);
      views.forEach((view) => {
        const camera = splitCameras[view.name];
        renderer.setViewport(view.x, 0, view.width, height);
        renderer.setScissor(view.x, 0, view.width, height);
        renderer.clear(true, true, true);
        camera.aspect = view.width / height;
        camera.updateProjectionMatrix();
        renderer.render(scene, updateSplitCamera(view.name, delta));
      });
      renderer.setScissorTest(false);
      return true;
    }

    return {
      move,
      render,
      get isSplitMode() { return splitMode; },
      get turnStepDegrees() { return turnStepDegrees; }
    };
  }

  global.MinecraftCharacterCameraControls = { create };
})(window);

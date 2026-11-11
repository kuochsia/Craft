(function (global) {
  const CHARACTER_HEIGHT = 2;
  const MODEL_SOURCE_HEIGHT = 3.2;
  const GRAVITY = 22;
  const JUMP_HEIGHT = 1.25;
  const JUMP_VELOCITY = Math.sqrt(2 * GRAVITY * JUMP_HEIGHT);

  function makeTexture(THREE, asset) {
    const canvas = document.createElement('canvas');
    const width = asset.rows[0].length;
    const height = asset.rows.length;
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        context.fillStyle = asset.palette[asset.rows[y][x]];
        context.fillRect(x, y, 1, 1);
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    return texture;
  }

  function build(THREE, config) {
    const root = new THREE.Group();
    root.scale.setScalar(CHARACTER_HEIGHT / MODEL_SOURCE_HEIGHT);
    root.userData.jumpVelocity = 0;
    root.userData.jumpHeld = false;
    const hairMat = new THREE.MeshLambertMaterial({ color: config.hair });
    const faceTex = makeTexture(THREE, config.face);
    const rightSideTex = makeTexture(THREE, config.sideRight);
    const leftSideTex = makeTexture(THREE, config.sideLeft);
    const headMats = [
      new THREE.MeshLambertMaterial({ map: rightSideTex }),
      new THREE.MeshLambertMaterial({ map: leftSideTex }),
      hairMat, hairMat,
      new THREE.MeshLambertMaterial({ map: faceTex }),
      hairMat
    ];

    const neckPivot = new THREE.Group();
    neckPivot.position.set(0, 2.4, 0);
    const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), headMats);
    headMesh.position.set(0, 0.4, 0);
    headMesh.castShadow = true;
    neckPivot.add(headMesh);
    root.add(neckPivot);

    const torsoShirtMat = new THREE.MeshLambertMaterial({ color: config.shirt });
    const torsoTex = makeTexture(THREE, config.torso);
    const torsoMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 1.2, 0.4),
      [
        torsoShirtMat, torsoShirtMat, torsoShirtMat, torsoShirtMat,
        new THREE.MeshLambertMaterial({ map: torsoTex }),
        torsoShirtMat
      ]
    );
    torsoMesh.position.set(0, 1.8, 0);
    torsoMesh.castShadow = true;
    root.add(torsoMesh);

    const armFrontMat = new THREE.MeshLambertMaterial({ map: makeTexture(THREE, config.arm) });
    const armSideMat = new THREE.MeshLambertMaterial({ color: config.skin });
    const armMats = [armFrontMat, armFrontMat, torsoShirtMat, armSideMat, armFrontMat, armFrontMat];
    const armPivots = [];
    let rightHand;
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * (0.4 + config.armWidth / 2), 2.3, 0);
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(config.armWidth, 1.2, 0.4),
        armMats
      );
      mesh.position.set(0, -0.5, 0);
      mesh.castShadow = true;
      pivot.add(mesh);
      if (side === -1) {
        rightHand = new THREE.Group();
        rightHand.position.set(0, -1.02, 0.16);
        pivot.add(rightHand);
      }
      root.add(pivot);
      armPivots.push(pivot);
    }

    const legFrontMat = new THREE.MeshLambertMaterial({ map: makeTexture(THREE, config.leg.front) });
    const legBackMat = new THREE.MeshLambertMaterial({ map: makeTexture(THREE, config.leg.back) });
    const legRightMat = new THREE.MeshLambertMaterial({ map: makeTexture(THREE, config.leg.right) });
    const legLeftMat = new THREE.MeshLambertMaterial({ map: makeTexture(THREE, config.leg.left) });
    const legSideMat = new THREE.MeshLambertMaterial({ color: config.pants });
    const legMats = [legRightMat, legLeftMat, legSideMat, legSideMat, legFrontMat, legBackMat];
    const legPivots = [];
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.2, 1.2, 0);
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.38, 1.2, 0.38), legMats);
      mesh.position.set(0, -0.6, 0);
      mesh.castShadow = true;
      pivot.add(mesh);
      root.add(pivot);
      legPivots.push(pivot);
    }

    return {
      root,
      neckPivot,
      headPivot: neckPivot,
      leftArmPivot: armPivots[0],
      rightArmPivot: armPivots[1],
      rightHand,
      leftLegPivot: legPivots[0],
      rightLegPivot: legPivots[1],
      arms: armPivots,
      weaponArmPivot: rightHand.parent,
      weaponConfig: null,
      weaponAttackHeld: false,
      weaponAttackRequested: false,
      weaponAttackElapsed: null,
      legs: legPivots,
      isAlex: config.isAlex,
      isTalking: false,
      isSad: false,
      isMoving: false,
      isArmsRaised: false,
      isNodding: false
    };
  }

  function getFloorHeightAt(x, z, obstacles, currentY) {
    let maxFloor = 0; // Sol naturel à y = 0
    const charRadius = 0.32;

    if (!obstacles || !Array.isArray(obstacles)) return maxFloor;

    for (let i = 0; i < obstacles.length; i++) {
      const obs = obstacles[i];
      if (obs.mesh && !obs.mesh.visible) continue;

      const hw = obs.halfWidth;
      const hd = obs.halfDepth;

      // Vérifie le chevauchement horizontal (AABB + rayon du personnage)
      if (
        x + charRadius > obs.position.x - hw &&
        x - charRadius < obs.position.x + hw &&
        z + charRadius > obs.position.z - hd &&
        z - charRadius < obs.position.z + hd
      ) {
        const top = obs.yTop !== undefined ? obs.yTop : (obs.position.y + 0.5);

        // Si le personnage est au-dessus (ou proche du haut du bloc pour atterrir/sauter dessus)
        if (currentY === undefined || currentY >= top - 0.4) {
          if (top > maxFloor) {
            maxFloor = top;
          }
        }
      }
    }

    return maxFloor;
  }

  function startJump(character, obstacles) {
    const root = character.root;
    root.userData.jumpHeld = true;
    const floorY = getFloorHeightAt(root.position.x, root.position.z, obstacles, root.position.y);
    if (root.position.y <= floorY + 0.08 && root.userData.jumpVelocity <= 0) {
      root.userData.jumpVelocity = JUMP_VELOCITY;
    }
  }

  function stopJump(character) {
    character.root.userData.jumpHeld = false;
  }

  function updateJump(character, delta, obstacles) {
    const root = character.root;
    const floorY = getFloorHeightAt(root.position.x, root.position.z, obstacles, root.position.y);

    if (root.position.y <= floorY && root.userData.jumpVelocity <= 0) {
      root.position.y = floorY;
      root.userData.jumpVelocity = root.userData.jumpHeld ? JUMP_VELOCITY : 0;
      return;
    }

    root.position.y += root.userData.jumpVelocity * delta;
    root.userData.jumpVelocity -= GRAVITY * delta;

    if (root.position.y <= floorY) {
      root.position.y = floorY;
      root.userData.jumpVelocity = 0;
    }
  }

  function setWeapon(character, weaponConfig) {
    character.weaponConfig = weaponConfig
      ? {
        armAngle: global.THREE.MathUtils.clamp(
          Number.isFinite(weaponConfig.armAngle) ? weaponConfig.armAngle : 112,
          0,
          160
        ),
        motion: weaponConfig.motion === 'recoil' ? 'recoil' : 'arc'
      }
      : null;
    character.weaponAttackRequested = Boolean(character.weaponConfig && character.weaponAttackHeld);
    character.weaponAttackElapsed = null;
  }

  function updateWeaponArm(character, delta, time) {
    const weaponConfig = character.weaponConfig;
    if (!weaponConfig) return;

    const weaponArm = character.weaponArmPivot;
    const freeArm = character.arms.find((arm) => arm !== weaponArm);

    if (character.weaponAttackRequested) {
      character.weaponAttackRequested = false;
      character.weaponAttackElapsed = 0;
    } else if (character.weaponAttackElapsed !== null) {
      character.weaponAttackElapsed += delta;
    }

    let pose = { x: 0, y: 0, z: 0 };
    if (character.weaponAttackElapsed !== null) {
      const duration = global.MinecraftWeaponMotion.durations[weaponConfig.motion];
      if (character.weaponAttackElapsed >= duration) {
        if (character.weaponAttackHeld) {
          character.weaponAttackElapsed %= duration;
        } else {
          character.weaponAttackElapsed = null;
        }
      }
      if (character.weaponAttackElapsed !== null) {
        pose = global.MinecraftWeaponMotion.getPose(
          weaponConfig.motion,
          character.weaponAttackElapsed / duration
        );
      }
    }

    if (freeArm && character.weaponAttackElapsed !== null) {
      freeArm.rotation.set(0, 0, 0);
    }

    const armAngle = global.THREE.MathUtils.degToRad(weaponConfig.armAngle);
    const walkBob = character.isMoving && character.weaponAttackElapsed === null
      ? Math.sin(time * 13) * 0.06
      : 0;
    weaponArm.rotation.set(-armAngle + walkBob + pose.x, pose.y, pose.z);
  }

  function moveWithCollisions(character, deltaX, deltaZ, obstacles, otherCharacter) {
    const root = character.root;
    const radius = 0.38;
    const startX = root.position.x;
    const startZ = root.position.z;
    const currentY = root.position.y;

    function canOccupy(x, z) {
      if (otherCharacter && otherCharacter.root) {
        const otherRoot = otherCharacter.root;
        // Collision entre personnages seulement s'ils sont à la même hauteur relative
        if (Math.abs(currentY - otherRoot.position.y) < CHARACTER_HEIGHT) {
          if (Math.hypot(x - otherRoot.position.x, z - otherRoot.position.z) < radius * 2) {
            return false;
          }
        }
      }

      if (!obstacles || !Array.isArray(obstacles)) return true;

      return !obstacles.some((obstacle) => {
        if (obstacle.mesh && !obstacle.mesh.visible) return false;

        const obsTop = obstacle.yTop !== undefined ? obstacle.yTop : (obstacle.position.y + 0.5);
        const obsBottom = obstacle.yBottom !== undefined ? obstacle.yBottom : (obstacle.position.y - 0.5);

        // 1. Si les pieds du personnage sont au niveau ou au-dessus du haut du bloc,
        //    ce bloc ne bloque pas horizontalement : le personnage peut marcher dessus !
        if (currentY >= obsTop - 0.25) {
          return false;
        }

        // 2. Si la tête du personnage est sous le bas du bloc (obstacle en hauteur),
        //    il ne bloque pas horizontalement non plus.
        if (currentY + CHARACTER_HEIGHT <= obsBottom) {
          return false;
        }

        // 3. Collision horizontale contre le flanc de l'obstacle
        const closestX = Math.max(
          obstacle.position.x - obstacle.halfWidth,
          Math.min(x, obstacle.position.x + obstacle.halfWidth)
        );
        const closestZ = Math.max(
          obstacle.position.z - obstacle.halfDepth,
          Math.min(z, obstacle.position.z + obstacle.halfDepth)
        );
        return Math.hypot(x - closestX, z - closestZ) < radius;
      });
    }

    const nextX = root.position.x + deltaX;
    if (canOccupy(nextX, root.position.z)) root.position.x = nextX;

    const nextZ = root.position.z + deltaZ;
    if (canOccupy(root.position.x, nextZ)) root.position.z = nextZ;
    return root.position.x !== startX || root.position.z !== startZ;
  }

  global.MinecraftCharacterModel = {
    HEIGHT: CHARACTER_HEIGHT,
    JUMP_HEIGHT,
    build,
    startJump,
    stopJump,
    updateJump,
    setWeapon,
    updateWeaponArm,
    moveWithCollisions
  };
})(window);

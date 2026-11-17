(function (global) {
  // Échelle identique à character-model.js (16 pixels Minecraft = 1 unité monde)
  const SOURCE_TO_WORLD_SCALE = 2 / 3.2;

  // Palette extraite de l'image du mouton Minecraft
  const palette = {
    w: '#f0f0f0', // Laine blanche claire
    l: '#e2e2e2', // Laine blanc cassé
    c: '#d4d4d4', // Ombrage doux de la laine
    g: '#a6a6a6', // Bordure grise du museau
    b: '#655141', // Peau brun clair (front / pattes)
    d: '#493b30', // Peau brun foncé (museau)
    e: '#141414', // Pupille noire
    s: '#f5f5f5', // Blanc de l'œil
    p: '#9a6d6c', // Bouche rose
    h: '#2a221c'  // Sabot sombre
  };

  function makeTexture(THREE, asset) {
    const canvas = document.createElement('canvas');
    canvas.width = asset.rows[0].length;
    canvas.height = asset.rows.length;
    const ctx = canvas.getContext('2d');

    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        ctx.fillStyle = asset.palette[asset.rows[y][x]];
        ctx.fillRect(x, y, 1, 1);
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    return texture;
  }

  function createSheep(THREE, options = {}) {
    const root = new THREE.Group();
    root.scale.setScalar(SOURCE_TO_WORLD_SCALE);

    const woolTint = options.woolColor !== undefined ? options.woolColor : 0xffffff;
    let isSheared = Boolean(options.sheared);

    // --- 1. TEXTURES PIXEL-ART ---
    // Face avant du museau (6x6 pixels) : bordure grise, yeux excentrés et bouche rose
    const faceFrontTex = makeTexture(THREE, {
      palette,
      rows: [
        'gggggg',
        'bbbbbb',
        'esbbse',
        'bbbbbb',
        'gdppdg',
        'gdppdg'
      ]
    });

    // Texture de laine texturée (8x8 pixels)
    const woolTex = makeTexture(THREE, {
      palette,
      rows: [
        'wlwclwlw',
        'lwlwlwcl',
        'cwlwlwlw',
        'lwlwclwl',
        'wlwlwlwc',
        'lclwlwlw',
        'wlwlwclw',
        'cwlwlwlc'
      ]
    });

    // Texture des pattes nues avec sabot en bas (4x6 pixels)
    const legSkinTex = makeTexture(THREE, {
      palette,
      rows: [
        'bbbb',
        'bbbb',
        'bbbb',
        'bbbb',
        'dddd',
        'hhhh'
      ]
    });

    // --- 2. MATÉRIAUX ---
    const woolMat = new THREE.MeshLambertMaterial({ map: woolTex, color: woolTint });
    const skinMat = new THREE.MeshLambertMaterial({ color: 0x655141 });
    const snoutSideMat = new THREE.MeshLambertMaterial({ color: 0x9e9e9e });
    const legSkinMat = new THREE.MeshLambertMaterial({ map: legSkinTex });
    const hoofMat = new THREE.MeshLambertMaterial({ color: 0x2a221c });

    // --- 3. CORPS (PEAU INTERNE + TOISON DE LAINE) ---
    // Corps nu (8x6x16 pixels) visible quand le mouton est tondu
    const nakedBodyMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.6, 1.6),
      skinMat
    );
    nakedBodyMesh.position.set(0, 1.5, 0);
    nakedBodyMesh.castShadow = true;
    root.add(nakedBodyMesh);

    // Manteau de laine épais (10x8x18 pixels)
    const woolCoatMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.0, 0.8, 1.8),
      woolMat
    );
    woolCoatMesh.position.set(0, 1.55, 0);
    woolCoatMesh.castShadow = true;
    root.add(woolCoatMesh);

    // --- 4. TÊTE & CAPUCHE DE LAINE ---
    const headPivot = new THREE.Group();
    headPivot.position.set(0, 1.85, 0.8);

    // Capuche de laine arrière (8x8x6 pixels)
    const headWoolMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.8, 0.6),
      woolMat
    );
    headWoolMesh.position.set(0, 0.1, 0.1);
    headWoolMesh.castShadow = true;
    headPivot.add(headWoolMesh);

    // Museau proéminent (6x6x2 pixels)
    const snoutMats = [
      snoutSideMat,
      snoutSideMat,
      snoutSideMat,
      skinMat,
      new THREE.MeshLambertMaterial({ map: faceFrontTex }),
      skinMat
    ];
    const snoutMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.6, 0.22),
      snoutMats
    );
    snoutMesh.position.set(0, 0.08, 0.5);
    snoutMesh.castShadow = true;
    headPivot.add(snoutMesh);

    root.add(headPivot);

    // --- 5. QUATRE PATTES (MANCHON DE LAINE + PATTE BRUNE) ---
    const legPivots = [];
    const legWoolMeshes = [];
    const legPositions = [
      { x: -0.26, z: 0.52 },  // Avant gauche
      { x: 0.26, z: 0.52 },   // Avant droite
      { x: -0.26, z: -0.52 }, // Arrière gauche
      { x: 0.26, z: -0.52 }   // Arrière droite
    ];

    for (const pos of legPositions) {
      const legPivot = new THREE.Group();
      legPivot.position.set(pos.x, 1.2, pos.z);

      // Patte brune complète (4x12x4 pixels)
      const legMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.38, 1.2, 0.38),
        [legSkinMat, legSkinMat, skinMat, hoofMat, legSkinMat, legSkinMat]
      );
      legMesh.position.set(0, -0.6, 0);
      legMesh.castShadow = true;
      legPivot.add(legMesh);

      // Manchon de laine supérieur (5x6x5 pixels)
      const legWool = new THREE.Mesh(
        new THREE.BoxGeometry(0.48, 0.6, 0.48),
        woolMat
      );
      legWool.position.set(0, -0.3, 0);
      legWool.castShadow = true;
      legPivot.add(legWool);

      root.add(legPivot);
      legPivots.push(legPivot);
      legWoolMeshes.push(legWool);
    }

    function setSheared(sheared) {
      isSheared = Boolean(sheared);
      woolCoatMesh.visible = !isSheared;
      headWoolMesh.scale.setScalar(isSheared ? 0.78 : 1);
      headWoolMesh.material = isSheared ? skinMat : woolMat;
      for (let i = 0; i < legWoolMeshes.length; i++) {
        legWoolMeshes[i].visible = !isSheared;
      }
    }

    setSheared(isSheared);

    // --- 6. PHYSIQUE & IA (PROMENADE + BROUTAGE) ---
    const GRAVITY = 22;
    const JUMP_VELOCITY = Math.sqrt(2 * GRAVITY * 1.15);
    const WALK_SPEED = options.speed || 1.25;
    const HITBOX_RADIUS = 0.45;
    const SHEEP_HEIGHT = 1.3;
    const home = options.home || null;
    const homeMinDistance = Number.isFinite(options.homeMinDistance) ? options.homeMinDistance : 8;
    const homeMaxDistance = Number.isFinite(options.homeMaxDistance) ? options.homeMaxDistance : 24;

    const ai = {
      state: 'idle', // 'idle' | 'wander' | 'graze'
      timer: 1.0 + Math.random() * 2.5,
      targetYaw: Math.random() * Math.PI * 2,
      headTargetYaw: 0,
      headLookTimer: 0.8 + Math.random() * 2.0,
      walkCycle: Math.random() * 10,
      grazeTime: 0,
      velocityY: 0,
      onGround: true
    };

    root.rotation.y = ai.targetYaw;

    function getFloorHeight(x, z, obstacles, currentY) {
      let maxFloor = null;

      if (typeof options.getFloorHeight === 'function') {
        const terrainFloor = options.getFloorHeight(x, z, HITBOX_RADIUS, currentY);
        if (Number.isFinite(terrainFloor)) maxFloor = terrainFloor;
      }

      for (let i = 0; i < obstacles.length; i++) {
        const obs = obstacles[i];
        if (obs.mesh && !obs.mesh.visible) continue;

        if (
          x + HITBOX_RADIUS > obs.position.x - obs.halfWidth &&
          x - HITBOX_RADIUS < obs.position.x + obs.halfWidth &&
          z + HITBOX_RADIUS > obs.position.z - obs.halfDepth &&
          z - HITBOX_RADIUS < obs.position.z + obs.halfDepth
        ) {
          const top = obs.yTop !== undefined ? obs.yTop : obs.position.y + 0.5;
          if (currentY === undefined || currentY >= top - 0.35) {
            if (maxFloor === null || top > maxFloor) maxFloor = top;
          }
        }
      }
      return maxFloor;
    }

    function isWithinHomeRange(x, z) {
      if (!home) return true;
      const distance = Math.hypot(x - home.x, z - home.z);
      return distance >= homeMinDistance && distance <= homeMaxDistance;
    }

    function canOccupy(x, z, obstacles, otherEntities) {
      if (options.bounds) {
        if (
          x < options.bounds.minX || x > options.bounds.maxX ||
          z < options.bounds.minZ || z > options.bounds.maxZ
        ) {
          return false;
        }
      }

      if (!isWithinHomeRange(x, z)) return false;

      const currentY = root.position.y;

      if (otherEntities && Array.isArray(otherEntities)) {
        for (let i = 0; i < otherEntities.length; i++) {
          const other = otherEntities[i];
          if (!other || !other.root || other.root === root) continue;
          const otherY = other.root.position.y;
          const otherH = other.collisionHeight || (other.isChicken ? 0.7 : 2.0);
          const otherR = other.collisionRadius || (other.isChicken ? 0.22 : 0.38);

          if (currentY < otherY + otherH - 0.15 && currentY + SHEEP_HEIGHT > otherY + 0.1) {
            if (Math.hypot(x - other.root.position.x, z - other.root.position.z) < HITBOX_RADIUS + otherR) {
              return false;
            }
          }
        }
      }

      if (!obstacles || !Array.isArray(obstacles)) return true;

      return !obstacles.some((obs) => {
        if (obs.mesh && !obs.mesh.visible) return false;
        const obsTop = obs.yTop !== undefined ? obs.yTop : obs.position.y + 0.5;
        const obsBottom = obs.yBottom !== undefined ? obs.yBottom : obs.position.y - 0.5;

        if (currentY >= obsTop - 0.25) return false;
        if (currentY + SHEEP_HEIGHT <= obsBottom) return false;

        const closestX = Math.max(
          obs.position.x - obs.halfWidth,
          Math.min(x, obs.position.x + obs.halfWidth)
        );
        const closestZ = Math.max(
          obs.position.z - obs.halfDepth,
          Math.min(z, obs.position.z + obs.halfDepth)
        );
        return Math.hypot(x - closestX, z - closestZ) < HITBOX_RADIUS;
      });
    }

    function collidesWithTerrain(x, z) {
      return typeof options.collidesWithTerrain === 'function'
        && options.collidesWithTerrain(x, z, HITBOX_RADIUS, SHEEP_HEIGHT, root.position.y);
    }

    function pickNewBehavior() {
      const roll = Math.random();
      if (roll < 0.5) {
        ai.state = 'wander';
        ai.timer = 1.6 + Math.random() * 3.0;
        ai.targetYaw += (Math.random() - 0.5) * Math.PI * 1.5;
      } else if (roll < 0.78 && ai.onGround) {
        ai.state = 'graze';
        ai.timer = 2.0;
        ai.grazeTime = 0;
        ai.headTargetYaw = 0;
      } else {
        ai.state = 'idle';
        ai.timer = 1.2 + Math.random() * 2.5;
      }
    }

    function update(delta, obstacles, otherEntities) {
      const dt = Math.min(delta, 0.05);

      ai.timer -= dt;
      if (ai.timer <= 0) {
        // Si le mouton était tondu et finit de brouter, sa laine repousse !
        if (ai.state === 'graze' && isSheared) {
          setSheared(false);
        }
        pickNewBehavior();
      }

      // Orientation fluide du corps
      let angleDiff = ai.targetYaw - root.rotation.y;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      root.rotation.y += angleDiff * Math.min(1, dt * 4.5);

      // Déplacement horizontal
      let isMoving = false;
      if (ai.state === 'wander') {
        const stepX = Math.sin(root.rotation.y) * WALK_SPEED * dt;
        const stepZ = Math.cos(root.rotation.y) * WALK_SPEED * dt;
        let blocked = false;

        const nextX = root.position.x + stepX;
        if (canOccupy(nextX, root.position.z, obstacles, otherEntities) && !collidesWithTerrain(nextX, root.position.z)) {
          root.position.x += stepX;
          isMoving = true;
        } else {
          blocked = true;
        }

        const nextZ = root.position.z + stepZ;
        if (canOccupy(root.position.x, nextZ, obstacles, otherEntities) && !collidesWithTerrain(root.position.x, nextZ)) {
          root.position.z += stepZ;
          isMoving = true;
        } else {
          blocked = true;
        }

        if (blocked) {
          if (ai.onGround && Math.random() < 0.6) {
            ai.velocityY = JUMP_VELOCITY;
            ai.onGround = false;
          } else {
            ai.targetYaw += (Math.random() < 0.5 ? 1 : -1) * (Math.PI * 0.5 + Math.random());
          }
        }
      }

      // Gravité
      const floorY = getFloorHeight(root.position.x, root.position.z, obstacles, root.position.y);
      // Sans sol sous ses pattes, le mouton tombe réellement dans le trou.
      if (floorY === null || root.position.y > floorY || ai.velocityY > 0) {
        ai.onGround = false;
        root.position.y += ai.velocityY * dt;
        ai.velocityY -= GRAVITY * dt;

        if (floorY !== null && root.position.y <= floorY) {
          root.position.y = floorY;
          ai.velocityY = 0;
          ai.onGround = true;
        }
      } else {
        root.position.y = floorY;
        ai.onGround = true;
      }

      // Animation des 4 pattes (marche quadrupède croisée)
      if (isMoving && ai.onGround) {
        ai.walkCycle += dt * 10;
        const swing = Math.sin(ai.walkCycle) * 0.55;
        legPivots[0].rotation.x = swing;   // Avant gauche
        legPivots[3].rotation.x = swing;   // Arrière droite
        legPivots[1].rotation.x = -swing;  // Avant droite
        legPivots[2].rotation.x = -swing;  // Arrière gauche
      } else {
        for (let i = 0; i < 4; i++) {
          legPivots[i].rotation.x *= 0.8;
        }
      }

      // Animation de la tête (regard aléatoire vs broutage au sol)
      if (ai.state === 'graze') {
        ai.grazeTime += dt;
        const chew = Math.sin(ai.grazeTime * 18) * 0.08;
        headPivot.position.y += (1.15 - headPivot.position.y) * Math.min(1, dt * 8);
        headPivot.rotation.x += (0.72 + chew - headPivot.rotation.x) * Math.min(1, dt * 8);
        headPivot.rotation.y *= 0.85;
      } else {
        headPivot.position.y += (1.85 - headPivot.position.y) * Math.min(1, dt * 8);

        ai.headLookTimer -= dt;
        if (ai.headLookTimer <= 0) {
          ai.headLookTimer = 1.0 + Math.random() * 2.5;
          ai.headTargetYaw = ai.state === 'idle' ? (Math.random() - 0.5) * 0.9 : 0;
        }

        headPivot.rotation.x += (0 - headPivot.rotation.x) * Math.min(1, dt * 8);
        headPivot.rotation.y += (ai.headTargetYaw - headPivot.rotation.y) * Math.min(1, dt * 6);
      }
    }

    return {
      root,
      headPivot,
      legs: legPivots,
      isSheep: true,
      collisionRadius: HITBOX_RADIUS,
      collisionHeight: SHEEP_HEIGHT,
      setSheared,
      setWorldQueries(getFloorHeight, collidesWithTerrain) {
        options.getFloorHeight = getFloorHeight;
        options.collidesWithTerrain = collidesWithTerrain;
      },
      isSheared: () => isSheared,
      update
    };
  }

  global.MinecraftCharacters = global.MinecraftCharacters || {};
  global.MinecraftCharacters.createSheep = createSheep;
})(window);

(function (global) {
  // Échelle identique à character-model.js (16 pixels Minecraft = 1 unité monde)
  const SOURCE_TO_WORLD_SCALE = 2 / 3.2;

  // Palette fidèle au cochon Minecraft
  const palette = {
    p: '#f0a5a2', // Peau rose principale
    l: '#f6bab7', // Rose clair (reflets)
    m: '#e48f8c', // Rose moyen (ombrage)
    d: '#d47673', // Bordure du groin
    n: '#8c3f3d', // Narines sombres
    w: '#ffffff', // Blanc des yeux
    e: '#1a1a1a', // Pupilles noires
    h: '#b56562'  // Sabots
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

  function createPig(THREE, options = {}) {
    const root = new THREE.Group();
    root.scale.setScalar(SOURCE_TO_WORLD_SCALE);

    // --- 1. TEXTURES PIXEL-ART ---
    // Face avant de la tête (8x8 pixels) : yeux écartés sur les bords
    const headFrontTex = makeTexture(THREE, {
      palette,
      rows: [
        'ppplpppp',
        'plppppmp',
        'pppppppp',
        'ewppppwe',
        'pppppppp',
        'pmppppmp',
        'pppppppp',
        'mppppppm'
      ]
    });

    // Face avant du groin (4x3 pixels)
    const snoutFrontTex = makeTexture(THREE, {
      palette,
      rows: [
        'dddd',
        'nppn',
        'dddd'
      ]
    });

    // Texture de peau marbrée pour le corps (8x8 pixels)
    const bodyTex = makeTexture(THREE, {
      palette,
      rows: [
        'pplppppm',
        'pppppppl',
        'mppplppp',
        'pppppppp',
        'plppppmp',
        'pppppppp',
        'pppmpppl',
        'lppppppm'
      ]
    });

    // Texture des pattes (4x6 pixels)
    const legTex = makeTexture(THREE, {
      palette,
      rows: [
        'pppp',
        'plpp',
        'ppmp',
        'pppp',
        'mmmm',
        'hhhh'
      ]
    });

    // --- 2. MATÉRIAUX ---
    const skinTint = options.skinColor !== undefined ? options.skinColor : 0xffffff;
    const skinMat = new THREE.MeshLambertMaterial({ map: bodyTex, color: skinTint });
    const snoutSideColor = new THREE.Color(0xe48f8c).multiply(new THREE.Color(skinTint));
    const snoutSideMat = new THREE.MeshLambertMaterial({ color: snoutSideColor });
    const legMat = new THREE.MeshLambertMaterial({ map: legTex, color: skinTint });
    const hoofMat = new THREE.MeshLambertMaterial({ color: 0xb56562 });

    // --- 3. CORPS (10x8x16 pixels) ---
    const bodyMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.0, 0.8, 1.6),
      skinMat
    );
    bodyMesh.position.set(0, 1.0, 0);
    bodyMesh.castShadow = true;
    root.add(bodyMesh);

    // --- 4. TÊTE & GROIN EN RELIEF ---
    const headPivot = new THREE.Group();
    headPivot.position.set(0, 1.2, 0.8);

    // Crâne (8x8x8 pixels)
    const headMats = [
      skinMat,
      skinMat,
      skinMat,
      skinMat,
      new THREE.MeshLambertMaterial({ map: headFrontTex }),
      skinMat
    ];
    const headMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.8, 0.8),
      headMats
    );
    headMesh.position.set(0, 0, 0.3);
    headMesh.castShadow = true;
    headPivot.add(headMesh);

    // Groin 3D (4x3x1 pixels)
    const snoutMats = [
      snoutSideMat,
      snoutSideMat,
      snoutSideMat,
      snoutSideMat,
      new THREE.MeshLambertMaterial({ map: snoutFrontTex }),
      snoutSideMat
    ];
    const snoutMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.3, 0.12),
      snoutMats
    );
    snoutMesh.position.set(0, -0.15, 0.75);
    snoutMesh.castShadow = true;
    headPivot.add(snoutMesh);

    root.add(headPivot);

    // --- 5. QUATRE PATTES COURTES (4x6x4 pixels) ---
    const legPivots = [];
    const legPositions = [
      { x: -0.28, z: 0.5 },  // Avant gauche
      { x: 0.28, z: 0.5 },   // Avant droite
      { x: -0.28, z: -0.5 }, // Arrière gauche
      { x: 0.28, z: -0.5 }   // Arrière droite
    ];

    for (const pos of legPositions) {
      const legPivot = new THREE.Group();
      legPivot.position.set(pos.x, 0.6, pos.z);

      const legMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.38, 0.6, 0.38),
        [legMat, legMat, skinMat, hoofMat, legMat, legMat]
      );
      legMesh.position.set(0, -0.3, 0);
      legMesh.castShadow = true;
      legPivot.add(legMesh);

      root.add(legPivot);
      legPivots.push(legPivot);
    }

    // --- 6. PHYSIQUE & IA (PROMENADE + FOUILLE DU SOL) ---
    const GRAVITY = 22;
    const JUMP_VELOCITY = Math.sqrt(2 * GRAVITY * 1.15);
    const WALK_SPEED = options.speed || 1.3;
    const HITBOX_RADIUS = 0.45;
    const PIG_HEIGHT = 0.9;
    const home = options.home || null;
    const homeMinDistance = Number.isFinite(options.homeMinDistance) ? options.homeMinDistance : 8;
    const homeMaxDistance = Number.isFinite(options.homeMaxDistance) ? options.homeMaxDistance : 24;

    const ai = {
      state: 'idle', // 'idle' | 'wander' | 'sniff'
      timer: 1.0 + Math.random() * 2.5,
      targetYaw: Math.random() * Math.PI * 2,
      headTargetYaw: 0,
      headLookTimer: 0.8 + Math.random() * 2.0,
      walkCycle: Math.random() * 10,
      sniffTime: 0,
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

      if (obstacles && Array.isArray(obstacles)) {
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

          if (currentY < otherY + otherH - 0.15 && currentY + PIG_HEIGHT > otherY + 0.1) {
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
        if (currentY + PIG_HEIGHT <= obsBottom) return false;

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
        && options.collidesWithTerrain(x, z, HITBOX_RADIUS, PIG_HEIGHT, root.position.y);
    }

    function pickNewBehavior() {
      const roll = Math.random();
      if (roll < 0.52) {
        ai.state = 'wander';
        ai.timer = 1.6 + Math.random() * 3.0;
        ai.targetYaw += (Math.random() - 0.5) * Math.PI * 1.5;
      } else if (roll < 0.78 && ai.onGround) {
        ai.state = 'sniff';
        ai.timer = 1.8;
        ai.sniffTime = 0;
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
        pickNewBehavior();
      }

      // Orientation fluide du corps
      let angleDiff = ai.targetYaw - root.rotation.y;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      root.rotation.y += angleDiff * Math.min(1, dt * 4.8);

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

      // Gravité (tombe dans les trous s'il n'y a pas de sol sous ses pattes)
      const floorY = getFloorHeight(root.position.x, root.position.z, obstacles, root.position.y);
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
        ai.walkCycle += dt * 11;
        const swing = Math.sin(ai.walkCycle) * 0.6;
        legPivots[0].rotation.x = swing;   // Avant gauche
        legPivots[3].rotation.x = swing;   // Arrière droite
        legPivots[1].rotation.x = -swing;  // Avant droite
        legPivots[2].rotation.x = -swing;  // Arrière gauche
      } else {
        for (let i = 0; i < 4; i++) {
          legPivots[i].rotation.x *= 0.8;
        }
      }

      // Animation de la tête (regard aléatoire vs fouille du sol avec le groin)
      if (ai.state === 'sniff') {
        ai.sniffTime += dt;
        const bob = Math.sin(ai.sniffTime * 16) * 0.09;
        headPivot.position.y += (0.95 - headPivot.position.y) * Math.min(1, dt * 8);
        headPivot.rotation.x += (0.48 + bob - headPivot.rotation.x) * Math.min(1, dt * 8);
        headPivot.rotation.y = Math.sin(ai.sniffTime * 7) * 0.15;
      } else {
        headPivot.position.y += (1.2 - headPivot.position.y) * Math.min(1, dt * 8);

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
      isPig: true,
      collisionRadius: HITBOX_RADIUS,
      collisionHeight: PIG_HEIGHT,
      setWorldQueries(getFloorHeight, collidesWithTerrain) {
        options.getFloorHeight = getFloorHeight;
        options.collidesWithTerrain = collidesWithTerrain;
      },
      update
    };
  }

  global.MinecraftCharacters = global.MinecraftCharacters || {};
  global.MinecraftCharacters.createPig = createPig;
})(window);

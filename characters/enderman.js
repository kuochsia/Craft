(function (global) {
  // Échelle identique à character-model.js (16 pixels Minecraft = 1 unité monde)
  const SOURCE_TO_WORLD_SCALE = 2 / 3.2;

  // Palette extraite de l'Enderman Minecraft
  const palette = {
    k: '#050505', // Noir profond
    c: '#0d0d0d', // Noir charbon
    g: '#161616', // Gris anthracite (marbrures de peau)
    p: '#140c18', // Reflet violacé très sombre
    l: '#e594f7', // Bord externe des yeux (lavande clair)
    m: '#c942eb'  // Centre des yeux (magenta lumineux)
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

  // Génère une texture de particule étoilée violette de l'End
  function makeEndParticleTexture(THREE) {
    const canvas = document.createElement('canvas');
    canvas.width = 8;
    canvas.height = 8;
    const ctx = canvas.getContext('2d');

    const grid = [
      '...m....',
      '.l.m.l..',
      '..lml...',
      'mmmpmmmm',
      '..lml...',
      '.l.m.l..',
      '...m....',
      '........'
    ];
    const pColors = {
      m: '#c942eb',
      l: '#9f36b9',
      p: '#e594f7'
    };

    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const ch = grid[y][x];
        if (ch !== '.') {
          ctx.fillStyle = pColors[ch];
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    return tex;
  }

  function createEnderman(THREE, options = {}) {
    const root = new THREE.Group();
    root.scale.setScalar(SOURCE_TO_WORLD_SCALE);

    // --- 1. TEXTURES MARBRÉES NOIRES ---
    const headTopTex = makeTexture(THREE, {
      palette,
      rows: [
        'kccggcck',
        'ckkcckkc',
        'cgkcckgc',
        'gckppkcg',
        'gckppkcg',
        'cgkcckgc',
        'ckkcckkc',
        'kccggcck'
      ]
    });

    const headSideTex = makeTexture(THREE, {
      palette,
      rows: [
        'kccggcck',
        'ckkcckkc',
        'cggkccgc',
        'kccgkkcg',
        'ckpccgkc',
        'gckkccgc',
        'ckccgkck',
        'kcckccgk'
      ]
    });

    const headFrontTex = makeTexture(THREE, {
      palette,
      rows: [
        'kccggcck',
        'ckkcckkc',
        'cggkccgc',
        'kcckccgk',
        'lmlkklml', // Yeux violets horizontaux (3 pixels chacun)
        'ckpccgkc',
        'gckkccgc',
        'kcckccgk'
      ]
    });

    const torsoFrontTex = makeTexture(THREE, {
      palette,
      rows: [
        'kccggcck',
        'ckkcckkc',
        'cgkcckgc',
        'gckppkcg',
        'ckkcckkc',
        'kccggcck',
        'cgkcckgc',
        'ckkcckkc',
        'kccggcck',
        'gckppkcg',
        'ckkcckkc',
        'kccggcck'
      ]
    });

    const limbTex = makeTexture(THREE, {
      palette,
      rows: [
        'kc', 'ck', 'cg', 'gk', 'kc', 'cp',
        'pk', 'kc', 'cg', 'gc', 'ck', 'kc',
        'kg', 'gc', 'ck', 'kp', 'pc', 'ck',
        'kc', 'cg', 'gk', 'kc', 'ck', 'kg',
        'gc', 'ck', 'kc', 'cg', 'gk', 'kc'
      ]
    });

    const skinMat = new THREE.MeshLambertMaterial({ map: headSideTex });
    const limbMat = new THREE.MeshLambertMaterial({ map: limbTex });

    // --- 2. TÊTE & MÂCHOIRE (8x8x8 pixels) ---
    const headPivot = new THREE.Group();
    headPivot.position.set(0, 3.85, 0);

    // Crâne supérieur (8x6x8)
    const upperHeadMats = [
      skinMat,
      skinMat,
      new THREE.MeshLambertMaterial({ map: headTopTex }),
      skinMat,
      new THREE.MeshLambertMaterial({ map: headFrontTex }),
      skinMat
    ];
    const upperHeadMesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.8), upperHeadMats);
    upperHeadMesh.position.set(0, 0.5, 0);
    upperHeadMesh.castShadow = true;
    headPivot.add(upperHeadMesh);

    // Yeux luminescents (non assombris par l'éclairage, brillent dans le noir)
    const eyeGlowMat = new THREE.MeshBasicMaterial({ color: 0xd966ff });
    const pupilGlowMat = new THREE.MeshBasicMaterial({ color: 0xf4b8ff });
    for (const side of [-1, 1]) {
      const eyeOuter = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.02), eyeGlowMat);
      eyeOuter.position.set(side * 0.25, 0.35, 0.405);
      headPivot.add(eyeOuter);

      const eyeCenter = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.025), pupilGlowMat);
      eyeCenter.position.set(side * 0.25, 0.35, 0.408);
      headPivot.add(eyeCenter);
    }

    // Mâchoire inférieure (8x2x8) : s'ouvre lorsque l'Enderman est en colère
    const jawMesh = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.2, 0.78), skinMat);
    jawMesh.position.set(0, 0.1, 0);
    jawMesh.castShadow = true;
    headPivot.add(jawMesh);

    root.add(headPivot);

    // --- 3. TORSE (8x12x4 pixels) ---
    const torsoMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 1.2, 0.4),
      [
        skinMat,
        skinMat,
        skinMat,
        skinMat,
        new THREE.MeshLambertMaterial({ map: torsoFrontTex }),
        skinMat
      ]
    );
    torsoMesh.position.set(0, 3.25, 0);
    torsoMesh.castShadow = true;
    root.add(torsoMesh);

    // --- 4. BRAS TRÈS LONGS (2x30x2 pixels) ---
    const armPivots = [];
    for (const side of [-1, 1]) {
      const armPivot = new THREE.Group();
      armPivot.position.set(side * 0.5, 3.75, 0);

      const armMesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.0, 0.2), limbMat);
      armMesh.position.set(0, -1.45, 0);
      armMesh.castShadow = true;
      armPivot.add(armMesh);

      root.add(armPivot);
      armPivots.push(armPivot);
    }

    // --- 5. JAMBES TRÈS LONGUES (2x30x2 pixels) ---
    const legPivots = [];
    for (const side of [-1, 1]) {
      const legPivot = new THREE.Group();
      legPivot.position.set(side * 0.2, 2.7, 0);

      const legMesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.7, 0.2), limbMat);
      legMesh.position.set(0, -1.35, 0);
      legMesh.castShadow = true;
      legPivot.add(legMesh);

      root.add(legPivot);
      legPivots.push(legPivot);
    }

    // --- 6. PARTICULES VIOLETTES DE L'END ---
    const particleCount = 26;
    const particlePositions = new Float32Array(particleCount * 3);
    const particleVelocities = [];

    for (let i = 0; i < particleCount; i++) {
      particlePositions[i * 3] = (Math.random() - 0.5) * 1.8;
      particlePositions[i * 3 + 1] = 0.3 + Math.random() * 4.2;
      particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 1.8;

      particleVelocities.push({
        vx: (Math.random() - 0.5) * 0.45,
        vy: 0.15 + Math.random() * 0.45,
        vz: (Math.random() - 0.5) * 0.45,
        life: Math.random()
      });
    }

    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

    const particleMat = new THREE.PointsMaterial({
      size: 0.22,
      map: makeEndParticleTexture(THREE),
      transparent: true,
      alphaTest: 0.2,
      depthWrite: false
    });

    const particles = new THREE.Points(particleGeo, particleMat);
    root.add(particles);

    // --- 7. IA, DÉPLACEMENT & TÉLÉPORTATION ---
    const GRAVITY = 22;
    const JUMP_VELOCITY = Math.sqrt(2 * GRAVITY * 1.25);
    const CALM_SPEED = options.speed || 1.45;
    const ANGRY_SPEED = options.angrySpeed || 3.4;
    const HITBOX_RADIUS = 0.35;
    const ENDERMAN_HEIGHT = 2.9;

    const ai = {
      state: 'idle',
      timer: 1.0 + Math.random() * 2.5,
      targetYaw: Math.random() * Math.PI * 2,
      teleportCooldown: 6 + Math.random() * 8,
      walkCycle: Math.random() * 10,
      velocityY: 0,
      onGround: true,
      isAngry: false
    };

    root.rotation.y = ai.targetYaw;

    function getFloorHeight(x, z, obstacles, currentY) {
      let maxFloor = -Infinity;

      for (let i = 0; Array.isArray(obstacles) && i < obstacles.length; i++) {
        const obs = obstacles[i];
        if (obs.mesh && !obs.mesh.visible) continue;

        if (
          x + HITBOX_RADIUS > obs.position.x - obs.halfWidth &&
          x - HITBOX_RADIUS < obs.position.x + obs.halfWidth &&
          z + HITBOX_RADIUS > obs.position.z - obs.halfDepth &&
          z - HITBOX_RADIUS < obs.position.z + obs.halfDepth
        ) {
          const top = obs.yTop !== undefined ? obs.yTop : obs.position.y + 0.5;
          if (currentY === undefined || currentY >= top - 0.4) {
            if (top > maxFloor) maxFloor = top;
          }
        }
      }
      const terrainFloor = global.MinecraftBlockWorld?.getTerrainFloorHeight?.(
        x, z, HITBOX_RADIUS, currentY
      );
      if (Number.isFinite(terrainFloor)) maxFloor = Math.max(maxFloor, terrainFloor);
      return Number.isFinite(maxFloor) ? maxFloor : null;
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

      const currentY = root.position.y;

      if (global.MinecraftBlockWorld?.collidesWithTerrain?.(
        x, z, HITBOX_RADIUS, ENDERMAN_HEIGHT, currentY
      )) return false;

      if (otherEntities && Array.isArray(otherEntities)) {
        for (let i = 0; i < otherEntities.length; i++) {
          const other = otherEntities[i];
          if (!other || !other.root || other.root === root) continue;
          const otherY = other.root.position.y;
          const otherH = other.collisionHeight || (other.isChicken ? 0.7 : 2.0);
          const otherR = other.collisionRadius || (other.isChicken ? 0.22 : 0.38);

          if (currentY < otherY + otherH - 0.15 && currentY + ENDERMAN_HEIGHT > otherY + 0.1) {
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
        if (currentY + ENDERMAN_HEIGHT <= obsBottom) return false;

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

    function teleportRandomly(obstacles, otherEntities) {
      for (let attempt = 0; attempt < 12; attempt++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 3 + Math.random() * 6;
        const tx = root.position.x + Math.cos(angle) * dist;
        const tz = root.position.z + Math.sin(angle) * dist;
        const floorY = getFloorHeight(tx, tz, obstacles);
        if (!Number.isFinite(floorY)) continue;
        if (canOccupy(tx, tz, obstacles, otherEntities)) {
          root.position.set(tx, floorY, tz);
          ai.velocityY = 0;
          ai.onGround = true;
          return true;
        }
      }
      return false;
    }

    function updateParticles(dt) {
      const posAttr = particleGeo.attributes.position;
      const arr = posAttr.array;

      for (let i = 0; i < particleCount; i++) {
        const v = particleVelocities[i];
        v.life += dt * 0.75;

        arr[i * 3] += v.vx * dt;
        arr[i * 3 + 1] += v.vy * dt;
        arr[i * 3 + 2] += v.vz * dt;

        if (v.life >= 1) {
          v.life = 0;
          arr[i * 3] = (Math.random() - 0.5) * 1.5;
          arr[i * 3 + 1] = 0.2 + Math.random() * 3.8;
          arr[i * 3 + 2] = (Math.random() - 0.5) * 1.5;
        }
      }
      posAttr.needsUpdate = true;
    }

    function update(delta, obstacles, otherEntities) {
      const dt = Math.min(delta, 0.05);

      updateParticles(dt);

      // Téléportation périodique aléatoire
      ai.teleportCooldown -= dt;
      if (ai.teleportCooldown <= 0) {
        ai.teleportCooldown = ai.isAngry ? (3 + Math.random() * 4) : (8 + Math.random() * 10);
        if (Math.random() < 0.65) {
          teleportRandomly(obstacles, otherEntities);
        }
      }

      // Changement d'état (marche calme vs observation)
      ai.timer -= dt;
      if (ai.timer <= 0) {
        if (Math.random() < 0.6) {
          ai.state = 'wander';
          ai.timer = 1.8 + Math.random() * 3.0;
          ai.targetYaw += (Math.random() - 0.5) * Math.PI * 1.5;
        } else {
          ai.state = 'idle';
          ai.timer = 1.5 + Math.random() * 3.0;
        }
      }

      // Rotation fluide
      let angleDiff = ai.targetYaw - root.rotation.y;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      root.rotation.y += angleDiff * Math.min(1, dt * 5);

      // Déplacement
      let isMoving = false;
      const moveSpeed = ai.isAngry ? ANGRY_SPEED : CALM_SPEED;

      if (ai.state === 'wander' || ai.isAngry) {
        const stepX = Math.sin(root.rotation.y) * moveSpeed * dt;
        const stepZ = Math.cos(root.rotation.y) * moveSpeed * dt;
        let blocked = false;

        if (canOccupy(root.position.x + stepX, root.position.z, obstacles, otherEntities)) {
          root.position.x += stepX;
          isMoving = true;
        } else {
          blocked = true;
        }

        if (canOccupy(root.position.x, root.position.z + stepZ, obstacles, otherEntities)) {
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
      if (!Number.isFinite(floorY)) {
        ai.onGround = false;
        root.position.y += ai.velocityY * dt;
        ai.velocityY -= GRAVITY * dt;
        if (root.position.y < -12) {
          const safePosition = global.MinecraftBlockWorld?.findNearestGroundPosition?.(
            root.position.x, root.position.z,
            { character: { collisionRadius: HITBOX_RADIUS, collisionHeight: ENDERMAN_HEIGHT }, maxDistance: 20 }
          );
          if (safePosition) {
            root.position.copy(safePosition);
            ai.velocityY = 0;
            ai.onGround = true;
          }
        }
      } else if (root.position.y > floorY || ai.velocityY > 0) {
        ai.onGround = false;
        root.position.y += ai.velocityY * dt;
        ai.velocityY -= GRAVITY * dt;

        if (root.position.y <= floorY) {
          root.position.y = floorY;
          ai.velocityY = 0;
          ai.onGround = true;
        }
      } else {
        root.position.y = floorY;
        ai.onGround = true;
      }

      // Animation des longs membres
      if (isMoving) {
        const freq = ai.isAngry ? 11 : 6.5;
        const amp = ai.isAngry ? 0.55 : 0.35;
        ai.walkCycle += dt * freq;
        const swing = Math.sin(ai.walkCycle) * amp;

        legPivots[0].rotation.x = swing;
        legPivots[1].rotation.x = -swing;

        if (ai.isAngry) {
          // Bras levés vers l'avant en mode agressif
          armPivots[0].rotation.x = -0.85 + swing * 0.3;
          armPivots[1].rotation.x = -0.85 - swing * 0.3;
        } else {
          armPivots[0].rotation.x = -swing * 0.8;
          armPivots[1].rotation.x = swing * 0.8;
        }
      } else {
        legPivots[0].rotation.x *= 0.85;
        legPivots[1].rotation.x *= 0.85;
        armPivots[0].rotation.x *= 0.85;
        armPivots[1].rotation.x *= 0.85;
      }

      // Animation de colère (mâchoire ouverte + tremblement de tête)
      if (ai.isAngry) {
        upperHeadMesh.position.y = 0.65;
        headPivot.rotation.z = Math.sin(performance.now() * 0.05) * 0.06;
      } else {
        upperHeadMesh.position.y = 0.5;
        headPivot.rotation.z *= 0.8;
      }
    }

    return {
      root,
      headPivot,
      jawMesh,
      arms: armPivots,
      legs: legPivots,
      particles,
      isEnderman: true,
      collisionRadius: HITBOX_RADIUS,
      collisionHeight: ENDERMAN_HEIGHT,
      setAngry: function (angry) {
        ai.isAngry = Boolean(angry);
      },
      teleport: function (obstacles, otherEntities) {
        return teleportRandomly(obstacles, otherEntities);
      },
      update
    };
  }

  global.MinecraftCharacters = global.MinecraftCharacters || {};
  global.MinecraftCharacters.createEnderman = createEnderman;
})(window);

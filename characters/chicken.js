(function (global) {
  // Échelle identique à character-model.js (16 pixels Minecraft = 1 unité monde)
  const SOURCE_TO_WORLD_SCALE = 2 / 3.2;

  // Palette extraite fidèlement du rendu Minecraft
  const palette = {
    w: '#f5f5f5', // Plumes blanches
    l: '#e2e2e2', // Plumes blanc cassé
    g: '#c8c8c8', // Ombrage gris clair
    d: '#a6a6a6', // Ombrage sous les ailes / ventre
    e: '#000000', // Yeux noirs
    b: '#b98d40', // Bec jaune-ocre
    h: '#d7b465', // Reflet supérieur du bec
    n: '#795b27', // Narines / dessous du bec
    r: '#e00000', // Barbillon rouge vif
    a: '#a80000', // Ombre du barbillon
    y: '#f2dc6b', // Pattes jaune doré
    t: '#c9a949'  // Bout des doigts / articulation
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

  function createChicken(THREE, options = {}) {
    const root = new THREE.Group();
    root.scale.setScalar(SOURCE_TO_WORLD_SCALE);

    // --- 1. MATÉRIAUX & TEXTURES ---
    const whiteMat = new THREE.MeshLambertMaterial({ color: 0xf5f5f5 });
    const grayWhiteMat = new THREE.MeshLambertMaterial({ color: 0xd9d9d9 });
    const underBodyMat = new THREE.MeshLambertMaterial({ color: 0xb8b8b8 });
    const beakSideMat = new THREE.MeshLambertMaterial({ color: 0xa9803a });
    const beakBottomMat = new THREE.MeshLambertMaterial({ color: 0x795b27 });
    const wattleFrontMat = new THREE.MeshLambertMaterial({ color: 0xe00000 });
    const wattleSideMat = new THREE.MeshLambertMaterial({ color: 0xa80000 });
    const legMat = new THREE.MeshLambertMaterial({ color: 0xf2dc6b });
    const toeTipMat = new THREE.MeshLambertMaterial({ color: 0xc9a949 });

    // Face avant de la tête (4x6 pixels) : yeux noirs aux coins au-dessus du bec
    const headFrontTex = makeTexture(THREE, {
      palette,
      rows: [
        'wwww',
        'llll',
        'ewwe',
        'wwww',
        'wwww',
        'llll'
      ]
    });

    // Côtés de la tête (3x6 pixels)
    const headSideTex = makeTexture(THREE, {
      palette,
      rows: [
        'www',
        'lll',
        'www',
        'www',
        'lll',
        'ggg'
      ]
    });

    // Dessus du bec (4x2 pixels) avec narines sombres
    const beakTopTex = makeTexture(THREE, {
      palette,
      rows: [
        'nhhn',
        'bbbb'
      ]
    });

    // Dessus du corps (6x8 pixels)
    const bodyTopTex = makeTexture(THREE, {
      palette,
      rows: [
        'lwwwwl',
        'wwwwww',
        'wwllww',
        'wwwwww',
        'wllwww',
        'wwwwlw',
        'lwwwwl',
        'gllllg'
      ]
    });

    // --- 2. CORPS (6x6x8 pixels) ---
    const bodyMats = [
      grayWhiteMat,
      grayWhiteMat,
      new THREE.MeshLambertMaterial({ map: bodyTopTex }),
      underBodyMat,
      whiteMat,
      grayWhiteMat
    ];
    const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.8), bodyMats);
    bodyMesh.position.set(0, 0.8, 0);
    bodyMesh.castShadow = true;
    root.add(bodyMesh);

    // --- 3. TÊTE, BEC & BARBILLON ---
    const headPivot = new THREE.Group();
    headPivot.position.set(0, 0.95, 0.35);

    const headMats = [
      new THREE.MeshLambertMaterial({ map: headSideTex }),
      new THREE.MeshLambertMaterial({ map: headSideTex }),
      whiteMat,
      grayWhiteMat,
      new THREE.MeshLambertMaterial({ map: headFrontTex }),
      grayWhiteMat
    ];
    const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.6, 0.3), headMats);
    headMesh.position.set(0, 0.25, 0.1);
    headMesh.castShadow = true;
    headPivot.add(headMesh);

    // Bec (4x2x2 pixels)
    const beakMats = [
      beakSideMat,
      beakSideMat,
      new THREE.MeshLambertMaterial({ map: beakTopTex }),
      beakBottomMat,
      new THREE.MeshLambertMaterial({ color: 0xb98d40 }),
      beakSideMat
    ];
    const beakMesh = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.2), beakMats);
    beakMesh.position.set(0, 0.15, 0.35);
    beakMesh.castShadow = true;
    headPivot.add(beakMesh);

    // Barbillon rouge (2x2x2 pixels sous le bec)
    const wattleMats = [
      wattleSideMat,
      wattleSideMat,
      wattleSideMat,
      wattleSideMat,
      wattleFrontMat,
      wattleSideMat
    ];
    const wattleMesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), wattleMats);
    wattleMesh.position.set(0, -0.05, 0.32);
    wattleMesh.castShadow = true;
    headPivot.add(wattleMesh);

    root.add(headPivot);

    // --- 4. AILES ARTICULÉES (1x4x6 pixels) ---
    const wingPivots = [];
    for (const side of [-1, 1]) {
      const wingPivot = new THREE.Group();
      // Pivot placé sur l'arête supérieure du flanc pour battre vers l'extérieur
      wingPivot.position.set(side * 0.3, 1.1, 0);

      const wingMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.4, 0.6),
        [grayWhiteMat, grayWhiteMat, whiteMat, underBodyMat, grayWhiteMat, grayWhiteMat]
      );
      wingMesh.position.set(side * 0.05, -0.2, 0);
      wingMesh.castShadow = true;
      wingPivot.add(wingMesh);

      root.add(wingPivot);
      wingPivots.push(wingPivot);
    }

    // --- 5. PATTES & DOIGTS JAUNES (3x5x3 pixels) ---
    const legPivots = [];
    for (const side of [-1, 1]) {
      const legPivot = new THREE.Group();
      legPivot.position.set(side * 0.15, 0.5, -0.05);

      // Tige de la patte
      const shinMesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.1), legMat);
      shinMesh.position.set(0, -0.25, 0);
      shinMesh.castShadow = true;
      legPivot.add(shinMesh);

      // Doigt central (plus long vers l'avant)
      const centerToe = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.02, 0.2), legMat);
      centerToe.position.set(0, -0.49, 0.05);
      legPivot.add(centerToe);

      const centerTip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.02, 0.1), toeTipMat);
      centerTip.position.set(0, -0.49, 0.2);
      legPivot.add(centerTip);

      // Doigts latéraux gauche et droit
      for (const toeSide of [-1, 1]) {
        const sideToe = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.02, 0.1), legMat);
        sideToe.position.set(toeSide * 0.1, -0.49, 0.05);
        legPivot.add(sideToe);

        const sideTip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.02, 0.1), toeTipMat);
        sideTip.position.set(toeSide * 0.1, -0.49, 0.15);
        legPivot.add(sideTip);
      }

      root.add(legPivot);
      legPivots.push(legPivot);
    }

    // --- 6. PHYSIQUE & IA DE MOUVEMENT ALÉATOIRE MINECRAFT ---
    const GRAVITY = 22;
    const GLIDE_MAX_FALL_SPEED = -2.2; // Chute lente en battant des ailes
    const JUMP_VELOCITY = Math.sqrt(2 * GRAVITY * 1.15);
    const WALK_SPEED = options.speed || 1.35;
    const HITBOX_RADIUS = 0.22;
    const CHICKEN_HEIGHT = 0.7;

    const ai = {
      state: 'idle', // 'idle' | 'wander'
      timer: 0.5 + Math.random() * 2.0,
      targetYaw: Math.random() * Math.PI * 2,
      headTargetYaw: 0,
      headTargetPitch: 0,
      headLookTimer: 0.5 + Math.random() * 1.5,
      isPecking: false,
      walkCycle: Math.random() * 10,
      flapCycle: 0,
      velocityY: 0,
      onGround: true
    };

    root.rotation.y = ai.targetYaw;

    function getFloorHeight(x, z, obstacles, currentY) {
      let maxFloor = 0;
      if (!obstacles || !Array.isArray(obstacles)) return maxFloor;

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
            if (top > maxFloor) maxFloor = top;
          }
        }
      }
      return maxFloor;
    }

    function canOccupy(x, z, obstacles, otherEntities) {
      // Limites optionnelles de zone (enclos / monde)
      if (options.bounds) {
        if (
          x < options.bounds.minX || x > options.bounds.maxX ||
          z < options.bounds.minZ || z > options.bounds.maxZ
        ) {
          return false;
        }
      }

      const currentY = root.position.y;

      // Évitement des autres personnages / poulets
      if (otherEntities && Array.isArray(otherEntities)) {
        for (let i = 0; i < otherEntities.length; i++) {
          const other = otherEntities[i];
          if (!other || !other.root || other.root === root) continue;
          const otherY = other.root.position.y;
          const otherHeight = other.collisionHeight || (other.isVillager ? 1.95 : 1.8);
          if (currentY < otherY + otherHeight && currentY + CHICKEN_HEIGHT > otherY) {
            const dist = Math.hypot(x - other.root.position.x, z - other.root.position.z);
            const otherRadius = other.collisionRadius || (other.isChicken ? HITBOX_RADIUS : 0.38);
            if (dist < HITBOX_RADIUS + otherRadius) return false;
          }
        }
      }

      if (!obstacles || !Array.isArray(obstacles)) return true;

      return !obstacles.some((obs) => {
        if (obs.mesh && !obs.mesh.visible) return false;
        const obsTop = obs.yTop !== undefined ? obs.yTop : obs.position.y + 0.5;
        const obsBottom = obs.yBottom !== undefined ? obs.yBottom : obs.position.y - 0.5;

        if (currentY >= obsTop - 0.25) return false;
        if (currentY + CHICKEN_HEIGHT <= obsBottom) return false;

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

    function pickNewBehavior() {
      // 55 % de chance de marcher, 45 % de rester sur place à picorer/observer
      if (Math.random() < 0.55) {
        ai.state = 'wander';
        ai.timer = 1.5 + Math.random() * 2.8;
        // Changement de direction progressif ou demi-tour aléatoire
        ai.targetYaw += (Math.random() - 0.5) * Math.PI * 1.6;
        ai.isPecking = false;
      } else {
        ai.state = 'idle';
        ai.timer = 1.2 + Math.random() * 3.0;
        ai.isPecking = Math.random() < 0.35; // Picore parfois le sol à l'arrêt
      }
    }

    function update(delta, obstacles, otherEntities) {
      const dt = Math.min(delta, 0.05);

      // 1. Décision d'état (Idle vs Wander)
      ai.timer -= dt;
      if (ai.timer <= 0) {
        pickNewBehavior();
      }

      // 2. Orientation fluide du corps vers la direction cible
      let angleDiff = ai.targetYaw - root.rotation.y;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      root.rotation.y += angleDiff * Math.min(1, dt * 6);

      // 3. Déplacement horizontal
      let isMoving = false;
      if (ai.state === 'wander') {
        const dirX = Math.sin(root.rotation.y);
        const dirZ = Math.cos(root.rotation.y);
        const stepX = dirX * WALK_SPEED * dt;
        const stepZ = dirZ * WALK_SPEED * dt;

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

        // Si bloqué par un bloc : tente de sauter par-dessus (auto-jump Minecraft)
        // ou change de direction si le mur est trop haut
        if (blocked) {
          if (ai.onGround && Math.random() < 0.65) {
            ai.velocityY = JUMP_VELOCITY;
            ai.onGround = false;
          } else {
            ai.targetYaw += (Math.random() < 0.5 ? 1 : -1) * (Math.PI * 0.6 + Math.random() * 0.8);
          }
        }
      }

      // 4. Gravité et vol plané (chute lente signature du poulet Minecraft)
      const floorY = getFloorHeight(root.position.x, root.position.z, obstacles, root.position.y);
      if (root.position.y > floorY || ai.velocityY > 0) {
        ai.onGround = false;
        root.position.y += ai.velocityY * dt;
        ai.velocityY -= GRAVITY * dt;

        // Plafonne la vitesse de chute (plane en battant des ailes)
        if (ai.velocityY < GLIDE_MAX_FALL_SPEED) {
          ai.velocityY = GLIDE_MAX_FALL_SPEED;
        }

        if (root.position.y <= floorY) {
          root.position.y = floorY;
          ai.velocityY = 0;
          ai.onGround = true;
        }
      } else {
        root.position.y = floorY;
        ai.onGround = true;
      }

      // 5. Animation des pattes (marche)
      if (isMoving && ai.onGround) {
        ai.walkCycle += dt * 14;
        const swing = Math.sin(ai.walkCycle) * 0.65;
        legPivots[0].rotation.x = swing;
        legPivots[1].rotation.x = -swing;
      } else {
        legPivots[0].rotation.x *= 0.8;
        legPivots[1].rotation.x *= 0.8;
      }

      // 6. Animation des ailes (battement rapide en l'air, repliées au sol)
      if (!ai.onGround) {
        ai.flapCycle += dt * 28;
        const flap = 0.25 + Math.abs(Math.sin(ai.flapCycle)) * 1.15;
        wingPivots[0].rotation.z = -flap;
        wingPivots[1].rotation.z = flap;
      } else {
        wingPivots[0].rotation.z *= 0.75;
        wingPivots[1].rotation.z *= 0.75;
      }

      // 7. Animation de la tête (regard aléatoire, picorage et hochement en marchant)
      ai.headLookTimer -= dt;
      if (ai.headLookTimer <= 0) {
        ai.headLookTimer = 0.6 + Math.random() * 2.0;
        if (ai.state === 'idle') {
          ai.headTargetYaw = (Math.random() - 0.5) * 1.2;
          ai.headTargetPitch = ai.isPecking ? 0.55 : (Math.random() - 0.5) * 0.35;
        } else {
          ai.headTargetYaw = (Math.random() - 0.5) * 0.4;
          ai.headTargetPitch = 0;
        }
      }

      // Petit hochement de tête d'avant en arrière pendant la marche
      const walkHeadBob = isMoving && ai.onGround ? Math.sin(ai.walkCycle * 2) * 0.14 : 0;
      const peckBob = ai.isPecking && ai.state === 'idle' ? Math.abs(Math.sin(performance.now() * 0.012)) * 0.45 : 0;

      headPivot.rotation.y += (ai.headTargetYaw - headPivot.rotation.y) * Math.min(1, dt * 8);
      headPivot.rotation.x += (ai.headTargetPitch + walkHeadBob + peckBob - headPivot.rotation.x) * Math.min(1, dt * 10);
    }

    return {
      root,
      headPivot,
      wingPivots,
      legs: legPivots,
      isChicken: true,
      collisionRadius: HITBOX_RADIUS,
      collisionHeight: CHICKEN_HEIGHT,
      update
    };
  }

  global.MinecraftCharacters = global.MinecraftCharacters || {};
  global.MinecraftCharacters.createChicken = createChicken;
})(window);

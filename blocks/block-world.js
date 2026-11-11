/**
 * Minecraft 3D - Intégration des Blocs dans le Monde 3D
 * - Éparpille les arbres en blocs loin du spawn pour dégager la plaine
 * - Gère la pose de blocs empilés en face des personnages (touches A / I)
 * - Gère la casse des blocs avec les armes et les animations d'explosion en poussière
 */
(function (global) {
  'use strict';

  const placedBlocks = [];
  const activeParticles = [];
  const shakingBlocks = [];
  const burningBlocks = [];
  const FLAMMABLE_BLOCKS = new Set(['oak_wood', 'oak_planks', 'leaves', 'bookshelf']);
  let worldScene = null;
  let worldCollisionObstacles = null;
  let characterAlex = null;
  let characterSteve = null;

  // Géométries partagées pour optimiser les performances des particules
  let debrisGeometry = null;
  let dustGeometry = null;
  let firePlaneGeometry = null;
  const fireFrameMaterialSets = new Map();

  // Durabilités de base des blocs et armes optimales
  const BLOCK_DURABILITY = {
    glass: { baseHp: 1, bestTools: ['sword', 'pickaxe', 'axe', 'crossbow', 'none'], bonusDamage: 2 },
    tnt: { baseHp: 1, bestTools: ['sword', 'pickaxe', 'axe', 'crossbow', 'none'], bonusDamage: 2 },
    grass: { baseHp: 2, bestTools: ['sword', 'axe', 'pickaxe'], bonusDamage: 2 },
    leaves: { baseHp: 1, bestTools: ['sword', 'axe', 'none'], bonusDamage: 2 },
    bookshelf: { baseHp: 3, bestTools: ['axe'], bonusDamage: 3 },
    oak_planks: { baseHp: 3, bestTools: ['axe'], bonusDamage: 2 },
    oak_wood: { baseHp: 4, bestTools: ['axe'], bonusDamage: 2 },
    stone: { baseHp: 4, bestTools: ['pickaxe'], bonusDamage: 2 },
    bricks: { baseHp: 4, bestTools: ['pickaxe'], bonusDamage: 2 },
    magma: { baseHp: 4, bestTools: ['pickaxe'], bonusDamage: 2 },
    gold_block: { baseHp: 6, bestTools: ['pickaxe'], bonusDamage: 2 },
    diamond_ore: { baseHp: 7, bestTools: ['pickaxe'], bonusDamage: 3 },
    obsidian: { baseHp: 12, bestTools: ['pickaxe'], bonusDamage: 3 }
  };

  /**
   * Synthèse audio Web Audio API pour bruitages de coups et d'explosion de blocs
   */
  let audioContext = null;
  function playMinecraftSound(soundType, action = 'hit') {
    try {
      if (!audioContext) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) audioContext = new AudioContextClass();
      }
      if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume();
      }
      if (!audioContext) return;

      const now = audioContext.currentTime;

      if (action === 'hit') {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);

        const freq = soundType === 'wood' ? 140 : soundType === 'glass' ? 880 : soundType === 'grass' ? 180 : 240;
        osc.type = soundType === 'glass' ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq + Math.random() * 30, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.08);

        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

        osc.start(now);
        osc.stop(now + 0.08);
      } else {
        const duration = 0.24;
        const bufferSize = audioContext.sampleRate * duration;
        const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
        const channel = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          channel[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.35));
        }

        const noise = audioContext.createBufferSource();
        noise.buffer = buffer;

        const filter = audioContext.createBiquadFilter();
        filter.type = soundType === 'glass' ? 'highpass' : soundType === 'wood' ? 'lowpass' : 'bandpass';
        filter.frequency.setValueAtTime(soundType === 'glass' ? 1800 : soundType === 'wood' ? 360 : 700, now);

        const gain = audioContext.createGain();
        gain.gain.setValueAtTime(soundType === 'tnt' ? 0.45 : 0.28, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(audioContext.destination);

        noise.start(now);
        noise.stop(now + duration);
      }
    } catch (e) {
      // Ignore
    }
  }

  /**
   * Crée un bloc unique et l'ajoute à la scène et aux collisions
   */
  function spawnBlock(THREE, scene, collisionObstacles, blockId, x, y, z) {
    if (!global.MinecraftBlocks) return null;
    const blockDef = global.MinecraftBlocks.get(blockId);
    if (!blockDef) {
      console.warn(`[MinecraftBlockWorld] Bloc "${blockId}" introuvable.`);
      return null;
    }

    const mesh = global.MinecraftBlocks.createBlockMesh(THREE, blockDef, {
      size: 1.0,
      castShadow: true,
      receiveShadow: true
    });
    mesh.position.set(x, y + 0.5, z);
    scene.add(mesh);
    placedBlocks.push(mesh);

    const durability = BLOCK_DURABILITY[blockId] || { baseHp: 3 };
    mesh.userData.maxHp = durability.baseHp;
    mesh.userData.currentHp = durability.baseHp;

    const obstacle = {
      position: mesh.position,
      halfWidth: 0.5,
      halfDepth: 0.5,
      yTop: mesh.position.y + 0.5,
      yBottom: mesh.position.y - 0.5,
      isBlock: true,
      mesh: mesh
    };
    collisionObstacles.push(obstacle);
    mesh.userData.collisionObstacle = obstacle;

    return mesh;
  }

  /**
   * Construit un arbre voxel en blocs de bois superposés et feuillage en feuilles transparentes
   */
  function buildVoxelTree(THREE, scene, collisionObstacles, x, z, trunkHeight = 4) {
    const rx = Math.round(x);
    const rz = Math.round(z);

    // 1. Tronc en blocs de bois
    for (let y = 0; y < trunkHeight; y++) {
      spawnBlock(THREE, scene, collisionObstacles, 'oak_wood', rx, y, rz);
    }

    // 2. Feuilles vertes transparentes
    const l1Y = trunkHeight - 2;
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
        if (dx === 0 && dz === 0) continue;
        spawnBlock(THREE, scene, collisionObstacles, 'leaves', rx + dx, l1Y, rz + dz);
      }
    }

    const l2Y = trunkHeight - 1;
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
        if (dx === 0 && dz === 0) continue;
        spawnBlock(THREE, scene, collisionObstacles, 'leaves', rx + dx, l2Y, rz + dz);
      }
    }

    const l3Y = trunkHeight;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        spawnBlock(THREE, scene, collisionObstacles, 'leaves', rx + dx, l3Y, rz + dz);
      }
    }

    const l4Y = trunkHeight + 1;
    [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dz]) => {
      spawnBlock(THREE, scene, collisionObstacles, 'leaves', rx + dx, l4Y, rz + dz);
    });
  }

  // Arbres du décor principal : chaque partie est un vrai bloc cassable.
  function addVoxelTree(THREE, scene, collisionObstacles, x, z, trunkHeight = 4) {
    worldScene = scene;
    worldCollisionObstacles = collisionObstacles;
    buildVoxelTree(THREE, scene, collisionObstacles, x, z, trunkHeight);
  }

  /**
   * Construit une colline naturelle en véritables blocs voxels :
   * - En surface / bordure : de l'herbe et de la terre (grass)
   * - En profondeur : de la pierre minérale (stone)
   * - Éparpillés aléatoirement : des minerais rares (diamant, or, obsidienne, magma, briques)
   */
  function buildVoxelHill(THREE, scene, collisionObstacles, centerX, centerZ, radiusX, radiusZ, maxLevels = 3) {
    const rx = Math.round(centerX);
    const rz = Math.round(centerZ);

    const rareMinerals = ['diamond_ore', 'gold_block', 'obsidian', 'magma', 'bricks'];

    for (let level = 0; level < maxLevels; level++) {
      const curRadiusX = Math.max(1, Math.round(radiusX * (1 - level * 0.28)));
      const curRadiusZ = Math.max(1, Math.round(radiusZ * (1 - level * 0.28)));
      const isTopLevel = (level === maxLevels - 1);

      for (let dx = -curRadiusX; dx <= curRadiusX; dx++) {
        for (let dz = -curRadiusZ; dz <= curRadiusZ; dz++) {
          // Forme elliptique naturelle avec contour adouci
          const distNorm = (dx * dx) / (curRadiusX * curRadiusX) + (dz * dz) / (curRadiusZ * curRadiusZ);
          if (distNorm > 1.05) continue;

          const isEdge = distNorm > 0.65 || Math.abs(dx) === curRadiusX || Math.abs(dz) === curRadiusZ;
          let blockType;

          if (isTopLevel || isEdge) {
            // Surface et flancs : terre / herbe
            blockType = 'grass';
          } else {
            // En profondeur : pierres diverses et minerais éparpillés
            const rand = Math.random();
            if (rand < 0.08) {
              blockType = rareMinerals[Math.floor(Math.random() * rareMinerals.length)];
            } else if (rand < 0.16) {
              blockType = 'bricks';
            } else {
              blockType = 'stone';
            }
          }

          spawnBlock(THREE, scene, collisionObstacles, blockType, rx + dx, level, rz + dz);
        }
      }
    }
  }

  /**
   * Construit l'environnement naturel :
   * - Zone de spawn (autour de 0,0) totalement dégagée de tout bloc au démarrage
   * - Arbres voxels éparpillés dans la plaine loin du spawn
   */
  function buildDecorativeStructures(THREE, scene, collisionObstacles) {
    if (!global.MinecraftBlocks) return;
    worldScene = scene;
    worldCollisionObstacles = collisionObstacles;

    // --- ARBRES VOXELS ÉPARPILLÉS DANS LA PLAINE (LOIN DU SPAWN) ---
    // Aucun arbre dans un rayon de 18 mètres autour de (0,0) pour laisser la plaine bien dégagée
    const distantTreeSpots = [
      [22, -18, 4],
      [-24, -20, 5],
      [32, 16, 4],
      [-26, 24, 4],
      [18, 32, 4],
      [-34, -14, 5],
      [36, -30, 4],
      [-20, -38, 4],
      [38, 2, 5],
      [-38, 4, 4],
      [6, 38, 4],
      [-6, -42, 5]
    ];

    distantTreeSpots.forEach(([tx, tz, th]) => {
      buildVoxelTree(THREE, scene, collisionObstacles, tx, tz, th);
    });

    // Quelques collines de taille variable, réparties dans la plaine sans
    // recouvrir le spawn ni les arbres déjà générés.
    const hillCount = 5 + Math.floor(Math.random() * 3);
    for (let hillIndex = 0; hillIndex < hillCount; hillIndex++) {
      const radiusX = 3 + Math.floor(Math.random() * 4);
      const radiusZ = 3 + Math.floor(Math.random() * 4);
      let center = null;

      for (let attempt = 0; attempt < 30 && !center; attempt++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = 24 + Math.random() * 48;
        const x = Math.round(Math.cos(angle) * distance);
        const z = Math.round(Math.sin(angle) * distance);
        if (Math.hypot(x, z) < 18) continue;

        const overlapsBlocks = placedBlocks.some((block) =>
          Math.abs(block.position.x - x) < radiusX + 2
          && Math.abs(block.position.z - z) < radiusZ + 2
        );
        if (!overlapsBlocks) center = { x, z };
      }

      if (center) {
        const levels = 2 + Math.floor(Math.random() * 3);
        buildVoxelHill(THREE, scene, collisionObstacles, center.x, center.z, radiusX, radiusZ, levels);
      }
    }
  }

  /**
   * Trouve le bloc directement en face du personnage
   */
  function findBlockInFrontOfCharacter(character) {
    if (!character || !character.root) return null;

    const charPos = character.root.position;
    const charRotY = character.root.rotation.y;

    const forwardX = Math.sin(charRotY);
    const forwardZ = Math.cos(charRotY);

    let bestBlock = null;
    let minScore = Infinity;
    const MAX_REACH = 2.6;
    const MIN_DOT = 0.45;
    const characterHeight = global.MinecraftCharacterModel?.HEIGHT || 2;

    for (let i = 0; i < placedBlocks.length; i++) {
      const block = placedBlocks[i];
      if (!block.visible) continue;

      const dx = block.position.x - charPos.x;
      const dy = block.position.y - (charPos.y + characterHeight / 2);
      const dz = block.position.z - charPos.z;

      if (Math.abs(dy) > characterHeight) continue;

      const distXZ = Math.hypot(dx, dz);
      if (distXZ < 0.2 || distXZ > MAX_REACH) continue;

      const normX = dx / distXZ;
      const normZ = dz / distXZ;

      const dot = forwardX * normX + forwardZ * normZ;
      if (dot < MIN_DOT) continue;

      const score = distXZ * 0.7 + (1 - dot) * 1.5;
      if (score < minScore) {
        minScore = score;
        bestBlock = block;
      }
    }

    return bestBlock;
  }

  /**
   * Calcule les dégâts d'une arme sur un bloc
   */
  function getAttackDamage(weaponId, blockId, blockDef) {
    const config = BLOCK_DURABILITY[blockId] || {
      baseHp: Math.max(2, Math.round((blockDef?.hardness || 1) * 3))
    };

    if (config.bestTools && config.bestTools.includes(weaponId)) {
      return config.bonusDamage || 2;
    }
    if (weaponId === 'sword' && (blockId === 'glass' || blockId === 'tnt' || blockId === 'grass' || blockId === 'leaves')) {
      return 2;
    }
    if (weaponId === 'crossbow') return 1.5;
    if (weaponId === 'pickaxe' || weaponId === 'axe' || weaponId === 'sword') return 1;
    return 0.8;
  }

  /**
   * Secousse visuelle d'un bloc lors d'un coup
   */
  function triggerBlockShake(block) {
    if (block.userData.isShaking) return;
    block.userData.isShaking = true;
    block.userData.origScale = block.scale.clone();
    block.scale.multiplyScalar(0.92);
    shakingBlocks.push({ block, timer: 0.09 });
  }

  /**
   * Texture de fissures dynamiques
   */
  const crackTextures = {};
  function getCrackTexture(stage) {
    if (crackTextures[stage]) return crackTextures[stage];
    const c = document.createElement('canvas');
    c.width = 16;
    c.height = 16;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 16, 16);
    ctx.fillStyle = '#000000';

    if (stage >= 1) {
      [[7,7],[8,7],[8,8],[9,8],[6,8],[6,9],[7,9],[5,10],[10,7]].forEach(([x,y]) => ctx.fillRect(x, y, 1, 1));
    }
    if (stage >= 2) {
      [[4,5],[5,6],[6,6],[3,4],[2,3],[10,9],[11,10],[12,11],[13,11],[7,5],[7,4],[8,3],[8,10],[8,11],[9,12]].forEach(([x,y]) => ctx.fillRect(x, y, 1, 1));
    }
    if (stage >= 3) {
      [[1,2],[2,2],[14,12],[13,13],[4,11],[3,12],[12,4],[13,5],[5,2],[9,13],[11,3],[2,10],[4,8],[11,7],[7,2],[9,2],[6,13]].forEach(([x,y]) => ctx.fillRect(x, y, 1, 1));
    }

    const tex = new global.THREE.CanvasTexture(c);
    tex.magFilter = global.THREE.NearestFilter;
    tex.minFilter = global.THREE.NearestFilter;
    tex.generateMipmaps = false;
    crackTextures[stage] = tex;
    return tex;
  }

  function updateBlockCrackOverlay(block, scene) {
    const damageRatio = 1 - (block.userData.currentHp / block.userData.maxHp);
    if (damageRatio <= 0.05) return;

    const stage = damageRatio < 0.35 ? 1 : damageRatio < 0.7 ? 2 : 3;
    let crackMesh = block.userData.crackMesh;

    if (!crackMesh) {
      const crackGeo = new global.THREE.BoxGeometry(1.006, 1.006, 1.006);
      const crackMat = new global.THREE.MeshBasicMaterial({
        map: getCrackTexture(stage),
        transparent: true,
        opacity: 0.85,
        depthWrite: false
      });
      crackMesh = new global.THREE.Mesh(crackGeo, crackMat);
      crackMesh.position.copy(block.position);
      scene.add(crackMesh);
      block.userData.crackMesh = crackMesh;
    } else {
      crackMesh.material.map = getCrackTexture(stage);
      crackMesh.material.map.needsUpdate = true;
    }
  }

  function getBlockColors(blockDef, blockId) {
    const colors = [];
    if (blockDef && blockDef.textures) {
      const tex = blockDef.textures.top || blockDef.textures.all || blockDef.textures.side;
      if (Array.isArray(tex)) {
        for (let y = 0; y < 16; y += 3) {
          for (let x = 0; x < 16; x += 3) {
            const c = tex[y] ? tex[y][x] : null;
            if (c && c !== 'transparent') colors.push(c);
          }
        }
      }
    }
    if (colors.length > 0) return colors;

    const colorMap = {
      grass: ['#6ebc32', '#5ea329', '#68482f', '#5a3d28'],
      leaves: ['#5ea329', '#488220', '#6bb832', '#386619', '#79cb3a'],
      stone: ['#797979', '#6d6d6d', '#858585', '#5b5b5b'],
      oak_wood: ['#5e452c', '#4b3520', '#a27e4e', '#3d2b19'],
      oak_planks: ['#a27e4e', '#b68f5a', '#8e6c40'],
      diamond_ore: ['#2be7e8', '#4ffffb', '#797979', '#18bcbe'],
      gold_block: ['#f4ce36', '#fae058', '#e2b924', '#d4a717'],
      bricks: ['#9b4637', '#b15343', '#85372b', '#b9afa2'],
      tnt: ['#b82a1e', '#f0f0f0', '#333333'],
      glass: ['#ffffff', '#e2f4f7', '#c8edf2'],
      obsidian: ['#150e21', '#392156', '#492b6e', '#1f1430'],
      bookshelf: ['#a27e4e', '#a2261e', '#1e4da2', '#228a38'],
      magma: ['#ff4400', '#ff7700', '#1a0f0a', '#ffa600']
    };
    return colorMap[blockId] || ['#888888', '#666666', '#aaaaaa'];
  }

  function createFireEffect(block, isTnt = false) {
    const flame = new global.THREE.Group();
    const materials = getFireFrameMaterials(isTnt);
    if (!firePlaneGeometry) firePlaneGeometry = new global.THREE.PlaneGeometry(0.95, 1.15);
    flame.userData.fireSprites = [];
    flame.userData.fireMaterials = materials;
    flame.userData.firePhase = Math.random() * materials.length;
    for (let i = 0; i < 2; i++) {
      const sprite = new global.THREE.Mesh(firePlaneGeometry, materials[0]);
      sprite.position.y = 0.56;
      sprite.rotation.y = i * Math.PI / 2;
      sprite.castShadow = false;
      flame.add(sprite);
      flame.userData.fireSprites.push(sprite);
    }
    const sideFaces = [
      { x: 0, z: 0.51, rotation: 0 },
      { x: 0, z: -0.51, rotation: 0 },
      { x: 0.51, z: 0, rotation: Math.PI / 2 },
      { x: -0.51, z: 0, rotation: Math.PI / 2 }
    ];
    sideFaces.forEach((face) => {
      const sprite = new global.THREE.Mesh(firePlaneGeometry, materials[0]);
      sprite.position.set(face.x, -0.5, face.z);
      sprite.rotation.y = face.rotation;
      sprite.scale.set(0.78, 0.9, 1);
      sprite.castShadow = false;
      flame.add(sprite);
      flame.userData.fireSprites.push(sprite);
    });
    flame.position.set(block.position.x, block.position.y + 0.5, block.position.z);
    worldScene.add(flame);
    return flame;
  }

  function getFireFrameMaterials(isTnt) {
    const cacheKey = isTnt ? 'tnt' : 'normal';
    if (fireFrameMaterialSets.has(cacheKey)) return fireFrameMaterialSets.get(cacheKey);

    const frameCount = 8;
    const materials = [];
    for (let frame = 0; frame < frameCount; frame++) {
      const canvas = document.createElement('canvas');
      canvas.width = 16;
      canvas.height = 16;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, 16, 16);
      ctx.imageSmoothingEnabled = false;
      const phase = (frame / frameCount) * Math.PI * 2;
      const tongues = [
        { x: 3.5, peak: 4, width: 2.3 },
        { x: 7.8, peak: 1, width: 3.0 },
        { x: 12.1, peak: 3, width: 2.4 },
        { x: 5.8, peak: 6, width: 2.5 },
        { x: 10.2, peak: 5, width: 2.4 }
      ].map((tongue, index) => ({
        ...tongue,
        x: tongue.x + Math.sin(phase + index * 1.8) * 1.05,
        peak: Math.max(1, Math.min(8, tongue.peak + Math.round(Math.sin(phase * 1.2 + index) * 1.5)))
      }));

      tongues.forEach((tongue, tongueIndex) => {
        const baseX = tongue.x + Math.sin(phase + tongueIndex) * 0.25;
        for (let y = tongue.peak; y < 16; y++) {
          const progress = (y - tongue.peak) / (15 - tongue.peak);
          const halfWidth = 0.65 + (tongue.width - 0.65) * Math.sqrt(progress);
          const centerX = baseX + Math.sin(phase + y * 0.55 + tongueIndex) * 0.35;
          for (let x = 0; x < 16; x++) {
            const edgeDistance = Math.abs(x + 0.5 - centerX);
            if (edgeDistance > halfWidth) continue;
            ctx.fillStyle = isTnt
              ? (edgeDistance > halfWidth * 0.72 ? '#a9230b' : '#ed4b0b')
              : (edgeDistance > halfWidth * 0.72 ? '#a92c08' : '#ec5709');
            ctx.fillRect(x, y, 1, 1);
          }
        }
      });

      tongues.forEach((tongue, tongueIndex) => {
        const baseX = tongue.x + Math.sin(phase + tongueIndex) * 0.25;
        for (let y = tongue.peak + 2; y < 16; y++) {
          const progress = (y - tongue.peak) / (15 - tongue.peak);
          const halfWidth = (0.65 + (tongue.width - 0.65) * Math.sqrt(progress)) * 0.68;
          const centerX = baseX + Math.sin(phase + y * 0.55 + tongueIndex) * 0.35;
          for (let x = 0; x < 16; x++) {
            if (Math.abs(x + 0.5 - centerX) <= halfWidth) {
              ctx.fillStyle = '#ff9410';
              ctx.fillRect(x, y, 1, 1);
            }
          }
        }
      });

      tongues.slice(0, 3).forEach((tongue, tongueIndex) => {
        const baseX = tongue.x + Math.sin(phase + tongueIndex) * 0.25;
        for (let y = tongue.peak + 4; y < 16; y++) {
          const progress = (y - tongue.peak) / (15 - tongue.peak);
          const halfWidth = (0.65 + (tongue.width - 0.65) * Math.sqrt(progress)) * 0.34;
          const centerX = baseX + Math.sin(phase + y * 0.55 + tongueIndex) * 0.35;
          const x = Math.floor(centerX);
          if (x >= 0 && x < 16 && halfWidth > 0.34) {
            ctx.fillStyle = y > 12 && (x + frame + tongueIndex) % 4 === 0 ? '#fff5c7' : '#ffd638';
            ctx.fillRect(x, y, 1, 1);
          }
        }
      });

      ctx.fillStyle = '#ffd638';
      [[4, 14], [5, 14], [7, 15], [9, 14], [11, 15]].forEach(([x, y], index) => {
        if ((index + frame) % 3 !== 0) ctx.fillRect(x, y, 1, 1);
      });
      ctx.fillStyle = '#fff5c7';
      [[5, 15], [8, 14], [10, 15]].forEach(([x, y], index) => {
        if ((index + frame) % 2 === 0) ctx.fillRect(x, y, 1, 1);
      });

      const texture = new global.THREE.CanvasTexture(canvas);
      texture.magFilter = global.THREE.NearestFilter;
      texture.minFilter = global.THREE.NearestFilter;
      texture.generateMipmaps = false;
      texture.needsUpdate = true;
      materials.push(new global.THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        alphaTest: 0.04,
        depthWrite: false,
        side: global.THREE.DoubleSide
      }));
    }

    fireFrameMaterialSets.set(cacheKey, materials);
    return materials;
  }

  function removeFireEffect(fire) {
    if (!fire) return;
    if (worldScene) worldScene.remove(fire);
  }

  function removeBlockFire(block) {
    for (let i = burningBlocks.length - 1; i >= 0; i--) {
      if (burningBlocks[i].block !== block) continue;
      removeFireEffect(burningBlocks[i].flame);
      burningBlocks.splice(i, 1);
    }
    if (block?.userData) delete block.userData.isIgnited;
  }

  function igniteBlock(block, silent = false) {
    if (!block || !block.visible || block.userData.isIgnited) return false;
    const blockId = block.userData.blockId;
    const isTnt = blockId === 'tnt';
    if (!isTnt && !FLAMMABLE_BLOCKS.has(blockId)) return false;

    const flame = createFireEffect(block, isTnt);
    const fuse = isTnt ? 4 : 10;
    block.userData.isIgnited = true;
    block.userData.fuseTimer = fuse;
    burningBlocks.push({ block, flame, timer: fuse, spreadTimer: 1, isTnt });
    if (!silent) playMinecraftSound(isTnt ? 'tnt' : 'wood', 'hit');
    return true;
  }

  function attemptIgniteBlock(character) {
    if (!character || !character.root || character.root.userData?.enteredPortal) return false;
    return igniteBlock(findBlockInFrontOfCharacter(character));
  }

  function spawnHitChips(scene, block, blockDef) {
    if (!debrisGeometry) {
      debrisGeometry = new global.THREE.BoxGeometry(0.14, 0.14, 0.14);
    }
    const colors = getBlockColors(blockDef, block.userData.blockId);
    const origin = block.position;

    for (let i = 0; i < 4; i++) {
      const col = colors[Math.floor(Math.random() * colors.length)];
      const mat = new global.THREE.MeshLambertMaterial({ color: col });
      const mesh = new global.THREE.Mesh(debrisGeometry, mat);

      mesh.position.set(
        origin.x + (Math.random() - 0.5) * 0.6,
        origin.y + (Math.random() - 0.5) * 0.6,
        origin.z + (Math.random() - 0.5) * 0.6
      );

      scene.add(mesh);

      activeParticles.push({
        mesh,
        type: 'chip',
        vx: (Math.random() - 0.5) * 2.5,
        vy: 1.5 + Math.random() * 2.0,
        vz: (Math.random() - 0.5) * 2.5,
        rotX: (Math.random() - 0.5) * 8,
        rotY: (Math.random() - 0.5) * 8,
        rotZ: (Math.random() - 0.5) * 8,
        gravity: -13.0,
        life: 0.35,
        maxLife: 0.35
      });
    }
  }

  /**
   * Animation d'explosion complète du bloc lors de sa destruction
   */
  function destroyAndExplodeBlock(block, blockDef, scene, collisionObstacles, options = {}) {
    const origin = block.position.clone();
    const blockId = block.userData.blockId || 'stone';
    const colors = getBlockColors(blockDef, blockId);

    removeBlockFire(block);
    if (!options.skipSound) playMinecraftSound(blockDef?.sound || 'stone', 'break');

    if (block.userData.crackMesh) {
      scene.remove(block.userData.crackMesh);
      if (block.userData.crackMesh.geometry) block.userData.crackMesh.geometry.dispose();
      if (block.userData.crackMesh.material) block.userData.crackMesh.material.dispose();
      delete block.userData.crackMesh;
    }

    scene.remove(block);
    const pIdx = placedBlocks.indexOf(block);
    if (pIdx !== -1) placedBlocks.splice(pIdx, 1);

    if (block.userData.collisionObstacle && collisionObstacles) {
      const oIdx = collisionObstacles.indexOf(block.userData.collisionObstacle);
      if (oIdx !== -1) collisionObstacles.splice(oIdx, 1);
    }
    if (block.geometry) block.geometry.dispose();
    if (block.material) {
      const mats = Array.isArray(block.material) ? block.material : [block.material];
      mats.forEach((material) => {
        if (!global.MinecraftBlocks?.isSharedBlockMaterial?.(material)) material.dispose();
      });
    }

    if (!debrisGeometry) {
      debrisGeometry = new global.THREE.BoxGeometry(0.16, 0.16, 0.16);
    }
    if (!dustGeometry) {
      dustGeometry = new global.THREE.BoxGeometry(0.26, 0.26, 0.26);
    }

    const debrisCount = options.debrisCount !== undefined
      ? options.debrisCount
      : blockId === 'tnt' ? 48 : 28;

    for (let i = 0; i < debrisCount; i++) {
      const col = colors[Math.floor(Math.random() * colors.length)];
      const mat = new global.THREE.MeshLambertMaterial({ color: col });
      const mesh = new global.THREE.Mesh(debrisGeometry, mat);

      mesh.position.set(
        origin.x + (Math.random() - 0.5) * 0.75,
        origin.y + (Math.random() - 0.5) * 0.75,
        origin.z + (Math.random() - 0.5) * 0.75
      );

      const initialScale = 0.75 + Math.random() * 0.5;
      mesh.scale.setScalar(initialScale);
      scene.add(mesh);

      const angle = Math.random() * Math.PI * 2;
      const speed = 1.8 + Math.random() * 4.2;

      activeParticles.push({
        mesh,
        type: 'debris',
        vx: Math.cos(angle) * speed,
        vy: 2.4 + Math.random() * 4.0,
        vz: Math.sin(angle) * speed,
        rotX: (Math.random() - 0.5) * 12,
        rotY: (Math.random() - 0.5) * 12,
        rotZ: (Math.random() - 0.5) * 12,
        gravity: -14.0,
        life: 1.3 + Math.random() * 0.3,
        maxLife: 1.6,
        initialScale
      });
    }

    const dustCount = 10;
    for (let i = 0; i < dustCount; i++) {
      const dustMat = new global.THREE.MeshBasicMaterial({
        color: 0xe6e0ed,
        transparent: true,
        opacity: 0.65,
        depthWrite: false
      });
      const dustMesh = new global.THREE.Mesh(dustGeometry, dustMat);

      dustMesh.position.set(
        origin.x + (Math.random() - 0.5) * 0.4,
        origin.y + (Math.random() - 0.5) * 0.4,
        origin.z + (Math.random() - 0.5) * 0.4
      );
      dustMesh.scale.setScalar(0.3);
      scene.add(dustMesh);

      activeParticles.push({
        mesh: dustMesh,
        type: 'dust',
        vx: (Math.random() - 0.5) * 0.9,
        vy: 0.7 + Math.random() * 0.9,
        vz: (Math.random() - 0.5) * 0.9,
        rotX: (Math.random() - 0.5) * 2,
        rotY: (Math.random() - 0.5) * 2,
        rotZ: (Math.random() - 0.5) * 2,
        gravity: -1.0,
        life: 0.75 + Math.random() * 0.25,
        maxLife: 0.9
      });
    }
  }

  function detonateTnt(tntBlock) {
    if (!tntBlock || !tntBlock.visible || !worldScene) return;
    const origin = tntBlock.position.clone();
    const blastRadius = 8;
    const affectedBlocks = placedBlocks.filter((block) =>
      block.visible && block.position.distanceTo(origin) <= blastRadius
    );
    playMinecraftSound('tnt', 'break');

    affectedBlocks.forEach((block) => {
      const blockDef = block.userData.blockDef || global.MinecraftBlocks?.get(block.userData.blockId);
      destroyAndExplodeBlock(block, blockDef, worldScene, worldCollisionObstacles, {
        skipSound: true,
        debrisCount: block === tntBlock ? 48 : 2
      });
    });
  }

  function strikeBlock(block, damage, character) {
    if (!block || !block.userData.isMinecraftBlock) return;
    const scene = worldScene;
    const obstacles = worldCollisionObstacles;
    if (!scene) return;

    const blockId = block.userData.blockId || 'stone';
    const blockDef = block.userData.blockDef || global.MinecraftBlocks?.get(blockId);

    if (block.userData.currentHp === undefined) {
      const durability = BLOCK_DURABILITY[blockId] || { baseHp: 3 };
      block.userData.maxHp = durability.baseHp;
      block.userData.currentHp = durability.baseHp;
    }

    block.userData.currentHp -= damage;
    triggerBlockShake(block);
    spawnHitChips(scene, block, blockDef);
    playMinecraftSound(blockDef?.sound || 'stone', 'hit');

    if (block.userData.currentHp <= 0) {
      destroyAndExplodeBlock(block, blockDef, scene, obstacles);
    } else {
      updateBlockCrackOverlay(block, scene);
    }
  }

  function attemptCharacterAttack(character) {
    if (!character || !character.root || character.root.userData?.enteredPortal) return false;

    const targetBlock = findBlockInFrontOfCharacter(character);
    if (!targetBlock) return false;

    const weaponId = character.currentWeaponId || character.weaponId || null;
    const blockId = targetBlock.userData.blockId;
    const blockDef = targetBlock.userData.blockDef;

    const damage = getAttackDamage(weaponId, blockId, blockDef);
    strikeBlock(targetBlock, damage, character);
    return true;
  }

  /**
   * Action de pose de bloc :
   * Place le bloc sélectionné en face du personnage.
   * Si un bloc est déjà en place, l'ajoute au-dessus de celui existant (empilement vertical) !
   */
  function attemptPlaceBlock(character) {
    if (!character || !character.root || !character.selectedBlockId || !worldScene) return false;

    const blockId = character.selectedBlockId;
    const blockDef = global.MinecraftBlocks ? global.MinecraftBlocks.get(blockId) : null;
    const charPos = character.root.position;
    const charRotY = character.root.rotation.y;

    // Calcul de la position de grille juste en face du regard
    const dirX = Math.sin(charRotY);
    const dirZ = Math.cos(charRotY);
    const px = Math.round(charPos.x + dirX * 1.35);
    const pz = Math.round(charPos.z + dirZ * 1.35);

    // Détection du bloc le plus haut déjà présent à ces coordonnées (px, pz)
    let highestY = -1;
    for (let i = 0; i < placedBlocks.length; i++) {
      const b = placedBlocks[i];
      if (!b.visible) continue;
      if (Math.round(b.position.x) === px && Math.round(b.position.z) === pz) {
        const by = Math.round(b.position.y - 0.5);
        if (by > highestY) {
          highestY = by;
        }
      }
    }

    // Si un bloc existe déjà, on empile au-dessus (highestY + 1), sinon au sol
    let targetY = 0;
    if (highestY >= 0) {
      targetY = highestY + 1;
    } else {
      targetY = Math.max(0, Math.round(charPos.y));
    }

    // Pose du bloc
    spawnBlock(global.THREE, worldScene, worldCollisionObstacles, blockId, px, targetY, pz);

    // Bruitage et animation de pose
    playMinecraftSound(blockDef?.sound || 'wood', 'hit');
    character.weaponAttackRequested = true;

    return true;
  }

  let alexActionTimer = 0;
  let steveActionTimer = 0;
  const ACTION_INTERVAL = 0.35;

  /**
   * Déclenché par la touche A (Alex) ou I (Steve) :
   * - Si le personnage tient un bloc : il le pose en face (s'empile au-dessus si existant)
   * - Si le personnage tient une arme / mains nues : il frappe et casse le bloc en face
   */
  function triggerAction(character) {
    if (!character) return;
    const isAlex = character === characterAlex || character.characterName === 'alex';
    // L'action est exécutée immédiatement ici. Démarrer ensuite le délai de
    // répétition évite que update() ne la rejoue dès la première frame.
    if (isAlex) alexActionTimer = ACTION_INTERVAL;
    else steveActionTimer = ACTION_INTERVAL;

    performCharacterAction(character);
  }

  function performCharacterAction(character) {
    if (character.isHoldingBlock && character.selectedBlockId) {
      attemptPlaceBlock(character);
    } else if ((character.currentWeaponId || character.weaponId) === 'flint_and_steel') {
      attemptIgniteBlock(character);
    } else {
      attemptCharacterAttack(character);
    }
  }

  function updateBurningBlocks(delta, time) {
    let blocksByPosition = null;
    const neighborOffsets = [
      [1, 0, 0], [-1, 0, 0],
      [0, 1, 0], [0, -1, 0],
      [0, 0, 1], [0, 0, -1]
    ];

    for (let i = burningBlocks.length - 1; i >= 0; i--) {
      const burning = burningBlocks[i];
      const block = burning.block;
      if (!placedBlocks.includes(block)) {
        removeFireEffect(burning.flame);
        burningBlocks.splice(i, 1);
        continue;
      }

      burning.timer -= delta;
      burning.spreadTimer -= delta;
      block.userData.fuseTimer = Math.max(0, burning.timer);
      burning.flame.position.set(
        block.position.x,
        block.position.y + 0.5 + Math.sin(time * 12 + burning.flame.userData.firePhase) * 0.035,
        block.position.z
      );
      const frames = burning.flame.userData.fireMaterials;
      const frameIndex = Math.floor(time * 12 + burning.flame.userData.firePhase) % frames.length;
      burning.flame.userData.fireSprites.forEach((sprite) => {
        sprite.material = frames[frameIndex];
      });
      burning.flame.rotation.y = Math.sin(time * 2 + i) * 0.06;
      burning.flame.scale.x = 0.92 + Math.sin(time * 15 + i) * 0.06;
      burning.flame.scale.y = 0.96 + Math.sin(time * 12 + i) * 0.06;
      burning.flame.scale.z = 0.92 + Math.cos(time * 13 + i) * 0.06;

      if (burning.spreadTimer <= 0 && burning.timer > 0) {
        if (!blocksByPosition) {
          blocksByPosition = new Map();
          placedBlocks.forEach((placedBlock) => {
            if (!placedBlock.visible) return;
            const position = placedBlock.position;
            const key = `${Math.round(position.x)},${Math.round(position.y)},${Math.round(position.z)}`;
            blocksByPosition.set(key, placedBlock);
          });
        }

        neighborOffsets.forEach(([dx, dy, dz]) => {
          const position = block.position;
          const key = `${Math.round(position.x + dx)},${Math.round(position.y + dy)},${Math.round(position.z + dz)}`;
          const neighbor = blocksByPosition.get(key);
          if (neighbor && !neighbor.userData.isIgnited) igniteBlock(neighbor, true);
        });
        burning.spreadTimer = 1;
      }

      if (burning.timer > 0) continue;
      burningBlocks.splice(i, 1);
      removeFireEffect(burning.flame);
      delete block.userData.isIgnited;
      delete block.userData.fuseTimer;

      if (burning.isTnt) {
        detonateTnt(block);
      } else {
        const blockDef = block.userData.blockDef || global.MinecraftBlocks?.get(block.userData.blockId);
        destroyAndExplodeBlock(block, blockDef, worldScene, worldCollisionObstacles, { debrisCount: 8 });
      }
    }
  }

  function update(delta, time) {
    updateBurningBlocks(delta, time);

    // Actions maintenues
    if (characterAlex && characterAlex.weaponAttackHeld) {
      alexActionTimer -= delta;
      if (alexActionTimer <= 0) {
        alexActionTimer = ACTION_INTERVAL;
        performCharacterAction(characterAlex);
      }
    } else {
      alexActionTimer = 0;
    }

    if (characterSteve && characterSteve.weaponAttackHeld) {
      steveActionTimer -= delta;
      if (steveActionTimer <= 0) {
        steveActionTimer = ACTION_INTERVAL;
        performCharacterAction(characterSteve);
      }
    } else {
      steveActionTimer = 0;
    }

    // Secousses des blocs touchés
    for (let i = shakingBlocks.length - 1; i >= 0; i--) {
      const item = shakingBlocks[i];
      item.timer -= delta;
      if (item.timer <= 0) {
        if (item.block && item.block.userData.origScale) {
          item.block.scale.copy(item.block.userData.origScale);
        }
        item.block.userData.isShaking = false;
        shakingBlocks.splice(i, 1);
      }
    }

    // Particules physiques
    for (let i = activeParticles.length - 1; i >= 0; i--) {
      const p = activeParticles[i];
      const m = p.mesh;

      m.position.x += p.vx * delta;
      m.position.y += p.vy * delta;
      m.position.z += p.vz * delta;

      p.vy += p.gravity * delta;

      m.rotation.x += p.rotX * delta;
      m.rotation.y += p.rotY * delta;
      m.rotation.z += p.rotZ * delta;

      if (m.position.y < 0.08) {
        m.position.y = 0.08;
        p.vy = -p.vy * 0.35;
        p.vx *= 0.65;
        p.vz *= 0.65;
      }

      p.life -= delta;

      if (p.type === 'debris' || p.type === 'chip') {
        if (p.life < 0.45) {
          const factor = Math.max(0, p.life / 0.45);
          m.scale.setScalar(p.initialScale ? p.initialScale * factor : factor);
        }
      } else if (p.type === 'dust') {
        const progress = 1 - Math.max(0, p.life / p.maxLife);
        m.material.opacity = Math.max(0, 0.65 * (1 - progress));
        m.scale.setScalar(0.3 + progress * 0.9);
      }

      if (p.life <= 0) {
        if (worldScene) worldScene.remove(m);
        if (m.material) m.material.dispose();
        activeParticles.splice(i, 1);
      }
    }
  }

  function setupBlockInteraction(THREE, scene, camera, canvas, collisionObstacles, alex, steve) {
    worldScene = scene;
    worldCollisionObstacles = collisionObstacles;
    characterAlex = alex;
    characterSteve = steve;
    // Plus de contrôle de blocs à la souris : la souris est exclusivement réservée à la caméra
  }

  global.MinecraftBlockWorld = {
    spawnBlock,
    buildDecorativeStructures,
    addVoxelTree,
    buildVoxelHill,
    buildVoxelTree,
    setupBlockInteraction,
    triggerAction,
    triggerAttack: triggerAction,
    update,
    placedBlocks
  };

})(window);

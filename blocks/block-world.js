/**
 * Minecraft 3D - Intégration des Blocs dans le Monde 3D
 * - Éparpille les arbres en blocs loin du spawn pour dégager la plaine
 * - Gère la pose de blocs empilés en face des personnages (touches A / I)
 * - Gère la casse des blocs avec les armes et les animations d'explosion en poussière
 */
(function (global) {
  'use strict';

  const placedBlocks = [];
  const mineableVoxelFields = [];
  const activeParticles = [];
  const shakingBlocks = [];
  const burningBlocks = [];
  const FLAMMABLE_BLOCKS = new Set(['oak_wood', 'oak_planks', 'leaves', 'bookshelf']);
  let worldScene = null;
  let worldCollisionObstacles = null;
  let characterAlex = null;
  let characterSteve = null;
  let characterEntities = [];
  let villagerHouseRecord = null;
  let mineableTerrain = null;

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
    dirt: { baseHp: 2, bestTools: ['sword', 'axe', 'pickaxe'], bonusDamage: 2 },
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

  function getBlockWorldPosition(block, target = new global.THREE.Vector3()) {
    target.copy(block.position);
    const field = block.userData?.instancedVoxelField;
    if (field) target.add(field.root.position);
    return target;
  }

  function registerMineableInstancedIsland(THREE, root, geometry, materials, blocksByColor) {
    const field = { root, columns: new Map() };
    const getColumn = (x, z) => {
      const key = `${x},${z}`;
      let column = field.columns.get(key);
      if (!column) {
        column = { x, z, blocks: [], surfaceY: -Infinity };
        field.columns.set(key, column);
      }
      return column;
    };
    const transform = new THREE.Object3D();
    field.removeBlock = (block) => {
      const instance = block.userData.instancedVoxel;
      if (!instance || !block.visible) return;
      transform.position.set(0, 0, 0);
      transform.rotation.set(0, 0, 0);
      transform.scale.set(0, 0, 0);
      transform.updateMatrix();
      instance.mesh.setMatrixAt(instance.index, transform.matrix);
      instance.mesh.instanceMatrix.needsUpdate = true;
      instance.mesh.boundingSphere = null;
      block.visible = false;
      const blockIndex = instance.column.blocks.indexOf(block);
      if (blockIndex !== -1) instance.column.blocks.splice(blockIndex, 1);
      instance.column.surfaceY = instance.column.blocks.reduce(
        (highest, current) => Math.max(highest, current.position.y + 0.5),
        -Infinity
      );
    };
    const grassDef = global.MinecraftBlocks?.get('grass') || null;
    const stoneDef = global.MinecraftBlocks?.get('stone') || grassDef;

    blocksByColor.forEach((positions, colorIndex) => {
      if (!positions.length) return;
      const mesh = new THREE.InstancedMesh(geometry, materials[colorIndex], positions.length);
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      root.add(mesh);

      positions.forEach((position, index) => {
        transform.position.set(position.x, position.y, position.z);
        transform.updateMatrix();
        mesh.setMatrixAt(index, transform.matrix);

        const isGreenBlock = colorIndex <= 2;
        const blockDef = isGreenBlock ? grassDef : stoneDef;
        const blockId = isGreenBlock ? 'grass' : 'stone';
        const durability = BLOCK_DURABILITY[blockId];
        const column = getColumn(position.x, position.z);
        const block = {
          position: new THREE.Vector3(position.x, position.y, position.z),
          visible: true,
          userData: {
            isMinecraftBlock: true,
            blockId,
            blockDef,
            breakColors: materials[colorIndex].color
              ? [materials[colorIndex].color.getHex()]
              : null,
            maxHp: durability.baseHp,
            currentHp: durability.baseHp,
            instancedVoxelField: field,
            instancedVoxel: { mesh, index, column }
          }
        };
        column.blocks.push(block);
        column.surfaceY = Math.max(column.surfaceY, position.y + 0.5);
        placedBlocks.push(block);
      });
      mesh.instanceMatrix.needsUpdate = true;
    });

    field.getFloorHeight = (x, z, radius = 0.32, currentY) => {
      const localX = x - root.position.x;
      const localZ = z - root.position.z;
      const minX = Math.ceil(localX - radius - 0.5);
      const maxX = Math.floor(localX + radius + 0.5);
      const minZ = Math.ceil(localZ - radius - 0.5);
      const maxZ = Math.floor(localZ + radius + 0.5);
      let floor = -Infinity;
      for (let blockX = minX; blockX <= maxX; blockX++) {
        for (let blockZ = minZ; blockZ <= maxZ; blockZ++) {
          const column = field.columns.get(`${blockX},${blockZ}`);
          const top = column ? column.surfaceY + root.position.y : -Infinity;
          if (!Number.isFinite(top) || (currentY !== undefined && currentY < top - 0.08)) continue;
          floor = Math.max(floor, top);
        }
      }
      return Number.isFinite(floor) ? floor : null;
    };

    field.collides = (x, z, radius, height, feetY) => {
      const localX = x - root.position.x;
      const localZ = z - root.position.z;
      const minX = Math.ceil(localX - radius - 0.5);
      const maxX = Math.floor(localX + radius + 0.5);
      const minZ = Math.ceil(localZ - radius - 0.5);
      const maxZ = Math.floor(localZ + radius + 0.5);
      for (let blockX = minX; blockX <= maxX; blockX++) {
        for (let blockZ = minZ; blockZ <= maxZ; blockZ++) {
          const column = field.columns.get(`${blockX},${blockZ}`);
          if (!column) continue;
          for (const block of column.blocks) {
            const top = block.position.y + root.position.y + 0.5;
            const bottom = block.position.y + root.position.y - 0.5;
            if (feetY >= top - 0.005 || feetY + height <= bottom + 0.005) continue;
            const worldX = block.position.x + root.position.x;
            const worldZ = block.position.z + root.position.z;
            if (x + radius > worldX - 0.5 && x - radius < worldX + 0.5
              && z + radius > worldZ - 0.5 && z - radius < worldZ + 0.5) return true;
          }
        }
      }
      return false;
    };

    mineableVoxelFields.push(field);
    return field;
  }

  function getWorldFloorHeight(x, z, radius, currentY) {
    let floor = mineableTerrain ? mineableTerrain.getFloorHeight(x, z, radius, currentY) : null;
    for (const field of mineableVoxelFields) {
      const fieldFloor = field.getFloorHeight(x, z, radius, currentY);
      if (Number.isFinite(fieldFloor) && (!Number.isFinite(floor) || fieldFloor > floor)) floor = fieldFloor;
    }
    return Number.isFinite(floor) ? floor : null;
  }

  function collidesWithTerrainFields(x, z, radius, height, feetY) {
    if (mineableTerrain?.collidesWithTerrain(x, z, radius, height, feetY)) return true;
    return mineableVoxelFields.some((field) => field.collides(x, z, radius, height, feetY));
  }

  function collidesWithWorld(x, z, radius, height, feetY) {
    if (collidesWithTerrainFields(x, z, radius, height, feetY)) return true;
    return Boolean(worldCollisionObstacles?.some((obstacle) => {
      if (obstacle.mesh && !obstacle.mesh.visible) return false;
      const top = obstacle.yTop ?? obstacle.position.y + 0.5;
      const bottom = obstacle.yBottom ?? obstacle.position.y - 0.5;
      if (feetY >= top - 0.005 || feetY + height <= bottom + 0.005) return false;
      return x + radius > obstacle.position.x - obstacle.halfWidth
        && x - radius < obstacle.position.x + obstacle.halfWidth
        && z + radius > obstacle.position.z - obstacle.halfDepth
        && z - radius < obstacle.position.z + obstacle.halfDepth;
    }));
  }

  function findNearestGroundPosition(x, z, options = {}) {
    const step = 0.5;
    const maxDistance = Math.max(step, options.maxDistance || 80);
    const character = options.character || null;
    const radius = character?.collisionRadius || 0.38;
    const height = character?.collisionHeight || global.MinecraftCharacterModel?.HEIGHT || 1.8;
    const supportOffsets = [
      [0, 0], [radius * 0.72, 0], [-radius * 0.72, 0],
      [0, radius * 0.72], [0, -radius * 0.72]
    ];
    const maxRing = Math.ceil(maxDistance / step);
    const minimumPreferredFloor = Number.isFinite(options.preferredY)
      ? options.preferredY - 0.25
      : null;
    const floorPasses = minimumPreferredFloor === null
      ? [null]
      : [minimumPreferredFloor, null];

    for (const minimumFloor of floorPasses) {
      for (let ring = 0; ring <= maxRing; ring++) {
        const candidates = [];
        for (let dx = -ring; dx <= ring; dx++) {
          for (let dz = -ring; dz <= ring; dz++) {
            if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue;
            const candidateX = x + dx * step;
            const candidateZ = z + dz * step;
            const distance = Math.hypot(candidateX - x, candidateZ - z);
            if (distance <= maxDistance) candidates.push({ x: candidateX, z: candidateZ, distance });
          }
        }
        candidates.sort((a, b) => a.distance - b.distance);

        for (const candidate of candidates) {
          const floor = getWorldFloorHeight(candidate.x, candidate.z, 0.08);
          if (!Number.isFinite(floor) || (minimumFloor !== null && floor < minimumFloor)) continue;
          const fullySupported = supportOffsets.every(([offsetX, offsetZ]) => {
            const sample = getWorldFloorHeight(candidate.x + offsetX, candidate.z + offsetZ, 0.04);
            return Number.isFinite(sample) && Math.abs(sample - floor) < 0.08;
          });
          if (!fullySupported || collidesWithWorld(candidate.x, candidate.z, radius, height, floor)) continue;

          const overlapsCharacter = characterEntities.some((other) => {
            if (!other || other === character || !other.root) return false;
            const otherRadius = other.collisionRadius || 0.38;
            const verticalOverlap = floor < other.root.position.y + (other.collisionHeight || height)
              && floor + height > other.root.position.y;
            return verticalOverlap
              && Math.hypot(candidate.x - other.root.position.x, candidate.z - other.root.position.z)
                < radius + otherRadius + 0.05;
          });
          if (!overlapsCharacter) return new global.THREE.Vector3(candidate.x, floor, candidate.z);
        }
      }
    }
    return null;
  }

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

  function createMineableTerrain(THREE, scene, collisionObstacles, options = {}) {
    const chunkSize = options.chunkSize || 24;
    const chunkRadius = options.chunkRadius === undefined ? 1 : options.chunkRadius;
    const cellCount = chunkSize * chunkSize;
    const initialLayerCapacity = Math.max(2, options.initialLayerCapacity || 2);
    const staticWorld = options.staticWorld === true;
    const grassDef = global.MinecraftBlocks.get('grass');
    const dirtDef = global.MinecraftBlocks.get('dirt');
    if (!grassDef || !dirtDef) throw new Error('Les blocs grass et dirt doivent être chargés avant le terrain.');

    function createAtlasMaterial(blockDef) {
      const textures = blockDef.textures || {};
      const side = textures.side || textures.front || textures.all || textures.top;
      const faces = [
        textures.right || side,
        textures.left || side,
        textures.top || textures.all || side,
        textures.bottom || textures.all || side,
        textures.front || side,
        textures.back || side
      ];
      const canvas = document.createElement('canvas');
      canvas.width = 48;
      canvas.height = 32;
      const context = canvas.getContext('2d');
      faces.forEach((pixels, index) => {
        const tileX = index % 3;
        const tileY = Math.floor(index / 3);
        if (Array.isArray(pixels)) {
          for (let y = 0; y < 16; y++) {
            for (let x = 0; x < 16; x++) {
              const color = pixels[y] && pixels[y][x];
              if (!color || color === 'transparent') continue;
              context.fillStyle = color;
              context.fillRect(tileX * 16 + x, tileY * 16 + y, 1, 1);
            }
          }
        }
      });
      const texture = new THREE.CanvasTexture(canvas);
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.NearestFilter;
      texture.generateMipmaps = false;
      return new THREE.MeshLambertMaterial({ map: texture });
    }

    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const uv = geometry.getAttribute('uv');
    for (let face = 0; face < 6; face++) {
      const tileX = face % 3;
      const tileY = Math.floor(face / 3);
      for (let vertex = face * 4; vertex < face * 4 + 4; vertex++) {
        uv.setXY(vertex, (tileX + uv.getX(vertex)) / 3, (1 - tileY + uv.getY(vertex)) / 2);
      }
    }
    uv.needsUpdate = true;

    const materials = {
      grass: createAtlasMaterial(grassDef),
      dirt: createAtlasMaterial(dirtDef)
    };
    const storedColumnBlocks = new Map();
    const minedVoxels = new Set();
    let terrainBounds = options.bounds || null;
    const chunks = new Map();
    const chunkPool = [];
    const activeColumns = new Map();
    const zeroScale = new THREE.Vector3(0, 0, 0);
    const unitScale = new THREE.Vector3(1, 1, 1);
    const dummyPosition = new THREE.Vector3();
    const dummyQuaternion = new THREE.Quaternion();
    const dummyMatrix = new THREE.Matrix4();
    let centerChunkX = null;
    let centerChunkZ = null;
    let centerWorldX = options.centerX || 0;
    let centerWorldZ = options.centerZ || 0;

    const columnKey = (x, z) => `${x},${z}`;
    const voxelKey = (x, y, z) => `${x},${y},${z}`;

    function setInstance(mesh, index, localX, centerY, localZ, active = true) {
      dummyPosition.set(localX, centerY, localZ);
      dummyMatrix.compose(dummyPosition, dummyQuaternion, active ? unitScale : zeroScale);
      mesh.setMatrixAt(index, dummyMatrix);
      mesh.instanceMatrix.needsUpdate = true;
      mesh.boundingSphere = null;
    }

    function createChunk(chunkX, chunkZ) {
      let chunk = chunkPool.pop();
      const group = chunk ? chunk.group : new THREE.Group();
      const grassMesh = chunk ? chunk.grassMesh : new THREE.InstancedMesh(geometry, materials.grass, cellCount);
      const dirtMesh = chunk ? chunk.dirtMesh : new THREE.InstancedMesh(
        geometry, materials.dirt, cellCount * Math.max(2, initialLayerCapacity - 1)
      );
      grassMesh.count = 0;
      dirtMesh.count = 0;
      grassMesh.castShadow = dirtMesh.castShadow = false;
      grassMesh.receiveShadow = dirtMesh.receiveShadow = true;
      const originX = chunkX * chunkSize - chunkSize / 2;
      const originZ = chunkZ * chunkSize - chunkSize / 2;
      group.position.set(originX, 0, originZ);
      group.visible = true;
      if (!chunk) {
        group.add(grassMesh, dirtMesh);
        scene.add(group);
        chunk = {
          group,
          grassMesh,
          dirtMesh
        };
      }
      grassMesh.boundingSphere = null;
      dirtMesh.boundingSphere = null;
      Object.assign(chunk, {
        key: `${chunkX},${chunkZ}`,
        chunkX,
        chunkZ,
        grassNextSlot: 0,
        dirtNextSlot: 0,
        dirtFreeSlots: [],
        columns: []
      });

      for (let localX = 0; localX < chunkSize; localX++) {
        for (let localZ = 0; localZ < chunkSize; localZ++) {
          const x = originX + localX;
          const z = originZ + localZ;
          if (terrainBounds && (x < terrainBounds.minX || x > terrainBounds.maxX
            || z < terrainBounds.minZ || z > terrainBounds.maxZ)) continue;
          if (terrainBounds?.radius !== undefined
            && Math.hypot(x - (terrainBounds.centerX || 0), z - (terrainBounds.centerZ || 0)) > terrainBounds.radius) continue;
          const key = columnKey(x, z);
          const savedBlocks = storedColumnBlocks.get(key);
          const column = { x, z, localX, localZ, surfaceY: 0, blocks: [], chunk };
          chunk.columns.push(column);
          activeColumns.set(key, column);

          if (savedBlocks) {
            savedBlocks.forEach((savedBlock) => addTerrainBlock(
              chunk, column, savedBlock.blockId, savedBlock.centerY, savedBlock.supportLayerY
            ));
            refreshColumnSurface(column);
          } else {
            const surfaceY = Number.isFinite(options.surfaceHeightAt?.(x, z))
              ? options.surfaceHeightAt(x, z)
              : 0;
            const minimumLevel = Number.isFinite(options.minimumLevelAt?.(x, z, surfaceY))
              ? options.minimumLevelAt(x, z, surfaceY)
              : Number.isFinite(options.minimumLevel) ? options.minimumLevel : -1;
            column.surfaceY = surfaceY;
            for (let level = surfaceY; level >= minimumLevel; level--) {
              addTerrainBlock(chunk, column, level === surfaceY ? 'grass' : 'dirt', level - 0.5);
            }
          }
        }
      }
      return chunk;
    }

    function growDirtMesh(chunk, requiredCapacity) {
      const oldMesh = chunk.dirtMesh;
      const capacity = Math.max(requiredCapacity, oldMesh.instanceMatrix.count * 2);
      const nextMesh = new THREE.InstancedMesh(geometry, materials.dirt, capacity);
      nextMesh.count = oldMesh.count;
      nextMesh.instanceMatrix.array.set(oldMesh.instanceMatrix.array);
      nextMesh.castShadow = oldMesh.castShadow;
      nextMesh.receiveShadow = oldMesh.receiveShadow;
      chunk.group.remove(oldMesh);
      chunk.group.add(nextMesh);
      chunk.columns.forEach((column) => column.blocks.forEach((block) => {
        const instance = block.userData.terrainInstance;
        if (instance && instance.mesh === oldMesh) instance.mesh = nextMesh;
      }));
      oldMesh.dispose?.();
      chunk.dirtMesh = nextMesh;
      return nextMesh;
    }

    function addTerrainBlock(chunk, column, blockId, centerY, supportLayerY = null) {
      const isGrass = blockId === 'grass';
      let mesh = isGrass ? chunk.grassMesh : chunk.dirtMesh;
      let index;
      if (isGrass) {
        index = chunk.grassNextSlot++;
      } else {
        index = chunk.dirtFreeSlots.length ? chunk.dirtFreeSlots.pop() : chunk.dirtNextSlot++;
      }
      if (index >= mesh.instanceMatrix.count) {
        if (isGrass) return null;
        mesh = growDirtMesh(chunk, index + 1);
      }
      mesh.count = Math.max(mesh.count, index + 1);
      setInstance(mesh, index, column.localX, centerY, column.localZ);

      const blockDef = isGrass ? grassDef : dirtDef;
      const block = {
        position: new THREE.Vector3(column.x, centerY, column.z),
        visible: true,
        userData: {
          isMinecraftBlock: true,
          blockId,
          blockDef,
          maxHp: BLOCK_DURABILITY[blockId].baseHp,
          currentHp: BLOCK_DURABILITY[blockId].baseHp,
          terrainInstance: { chunk, mesh, index, blockId },
          terrainColumn: column,
          terrainSupportLayerY: supportLayerY
        }
      };
      column.blocks.push(block);
      placedBlocks.push(block);
      return block;
    }

    function addSupportBlock(column, centerY) {
      if (minedVoxels.has(voxelKey(column.x, centerY, column.z))) return null;
      if (column.blocks.some((block) => Math.abs(block.position.y - centerY) < 0.01)) return null;
      const block = addTerrainBlock(column.chunk, column, 'dirt', centerY, centerY);
      saveColumnState(column);
      return block;
    }

    function ensureSupportLayer(column, centerY) {
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          const neighbor = activeColumns.get(columnKey(column.x + dx, column.z + dz));
          if (neighbor) addSupportBlock(neighbor, centerY);
        }
      }
    }

    function deactivateTerrainBlock(block) {
      const instance = block.userData.terrainInstance;
      if (!instance) return;
      setInstance(instance.mesh, instance.index, 0, 0, 0, false);
      if (instance.blockId === 'dirt') instance.chunk.dirtFreeSlots.push(instance.index);
      block.visible = false;
    }

    function refreshColumnSurface(column) {
      if (!column.blocks.length) {
        column.surfaceY = null;
        return;
      }
      const highest = column.blocks.reduce((best, block) =>
        block.position.y > best.position.y ? block : best, column.blocks[0]);
      column.surfaceY = highest.position.y + 0.5;
    }

    function saveColumnState(column) {
      refreshColumnSurface(column);
      storedColumnBlocks.set(columnKey(column.x, column.z), column.blocks.map((block) => ({
        blockId: block.userData.blockId,
        centerY: block.position.y,
        supportLayerY: block.userData.terrainSupportLayerY
      })));
    }

    function maintainTerrainColumn(column) {
      saveColumnState(column);
    }

    function removeChunk(chunk) {
      const chunkBlocks = new Set();
      chunk.columns.forEach((column) => {
        activeColumns.delete(columnKey(column.x, column.z));
        column.blocks.forEach((block) => {
          chunkBlocks.add(block);
          if (block.userData.crackMesh) {
            scene.remove(block.userData.crackMesh);
            block.userData.crackMesh.geometry.dispose();
            block.userData.crackMesh.material.dispose();
          }
        });
      });
      for (let i = placedBlocks.length - 1; i >= 0; i--) {
        if (chunkBlocks.has(placedBlocks[i])) placedBlocks.splice(i, 1);
      }
      chunk.group.visible = false;
      chunks.delete(chunk.key);
      chunkPool.push(chunk);
    }

    function updateCenter(x, z) {
      centerWorldX = x;
      centerWorldZ = z;
      if (staticWorld) return;
      const nextChunkX = Math.floor((x + chunkSize / 2) / chunkSize);
      const nextChunkZ = Math.floor((z + chunkSize / 2) / chunkSize);
      if (nextChunkX === centerChunkX && nextChunkZ === centerChunkZ) return;
      centerChunkX = nextChunkX;
      centerChunkZ = nextChunkZ;

      const desired = new Set();
      for (let dx = -chunkRadius; dx <= chunkRadius; dx++) {
        for (let dz = -chunkRadius; dz <= chunkRadius; dz++) {
          const chunkX = centerChunkX + dx;
          const chunkZ = centerChunkZ + dz;
          const key = `${chunkX},${chunkZ}`;
          desired.add(key);
        }
      }
      Array.from(chunks.values()).forEach((chunk) => {
        if (!desired.has(chunk.key)) removeChunk(chunk);
      });
      desired.forEach((key) => {
        if (chunks.has(key)) return;
        const [chunkX, chunkZ] = key.split(',').map(Number);
        chunks.set(key, createChunk(chunkX, chunkZ));
      });
    }

    function setBounds(bounds) {
      const unchanged = JSON.stringify(terrainBounds) === JSON.stringify(bounds || null);
      if (unchanged) return;
      terrainBounds = bounds || null;
      Array.from(chunks.values()).forEach(removeChunk);
      centerChunkX = null;
      centerChunkZ = null;
      if (staticWorld && terrainBounds) {
        createBoundedChunks();
      } else {
        updateCenter(centerWorldX, centerWorldZ);
      }
    }

    function createBoundedChunks() {
      if (!terrainBounds) return;
      const minChunkX = Math.floor((terrainBounds.minX + chunkSize / 2) / chunkSize);
      const maxChunkX = Math.floor((terrainBounds.maxX + chunkSize / 2) / chunkSize);
      const minChunkZ = Math.floor((terrainBounds.minZ + chunkSize / 2) / chunkSize);
      const maxChunkZ = Math.floor((terrainBounds.maxZ + chunkSize / 2) / chunkSize);
      for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX++) {
        for (let chunkZ = minChunkZ; chunkZ <= maxChunkZ; chunkZ++) {
          if (terrainBounds.radius !== undefined) {
            const centerX = terrainBounds.centerX || 0;
            const centerZ = terrainBounds.centerZ || 0;
            const originX = chunkX * chunkSize - chunkSize / 2;
            const originZ = chunkZ * chunkSize - chunkSize / 2;
            const nearestX = Math.max(originX, Math.min(centerX, originX + chunkSize - 1));
            const nearestZ = Math.max(originZ, Math.min(centerZ, originZ + chunkSize - 1));
            if (Math.hypot(nearestX - centerX, nearestZ - centerZ) > terrainBounds.radius) continue;
          }
          const key = `${chunkX},${chunkZ}`;
          if (!chunks.has(key)) chunks.set(key, createChunk(chunkX, chunkZ));
        }
      }
    }

    function collidesWithTerrain(x, z, radius, height, feetY) {
      const minX = Math.ceil(x - radius - 0.5);
      const maxX = Math.floor(x + radius + 0.5);
      const minZ = Math.ceil(z - radius - 0.5);
      const maxZ = Math.floor(z + radius + 0.5);
      for (let blockX = minX; blockX <= maxX; blockX++) {
        for (let blockZ = minZ; blockZ <= maxZ; blockZ++) {
          const column = activeColumns.get(columnKey(blockX, blockZ));
          if (!column) continue;
          for (const block of column.blocks) {
            const top = block.position.y + 0.5;
            const bottom = block.position.y - 0.5;
            // Un bloc ne bloque pas si le personnage est déjà au-dessus,
            // ou si sa tête reste entièrement sous le bloc.
            if (feetY >= top - 0.005 || feetY + height <= bottom + 0.005) continue;
            const overlapsX = x + radius > blockX - 0.5 && x - radius < blockX + 0.5;
            const overlapsZ = z + radius > blockZ - 0.5 && z - radius < blockZ + 0.5;
            if (overlapsX && overlapsZ) return true;
          }
        }
      }
      return false;
    }

    if (staticWorld && terrainBounds) {
      createBoundedChunks();
      centerChunkX = Math.floor(((options.centerX || 0) + chunkSize / 2) / chunkSize);
      centerChunkZ = Math.floor(((options.centerZ || 0) + chunkSize / 2) / chunkSize);
    } else {
      updateCenter(options.centerX || 0, options.centerZ || 0);
    }
    mineableTerrain = {
      updateCenter,
      setBounds,
      collidesWithTerrain,
      hasHeightMap: typeof options.surfaceHeightAt === 'function',
      houseAreaRadius: Number.isFinite(options.houseAreaRadius) ? options.houseAreaRadius : null,
      isWaterAt: (x, z) => Boolean(options.isWaterAt?.(x, z)),
      clampToBounds(x, z, margin = 0) {
        if (!terrainBounds) return { x, z };
        if (terrainBounds.radius !== undefined) {
          const centerX = terrainBounds.centerX || 0;
          const centerZ = terrainBounds.centerZ || 0;
          const maxRadius = Math.max(0, terrainBounds.radius - margin);
          const dx = x - centerX;
          const dz = z - centerZ;
          const distance = Math.hypot(dx, dz);
          if (distance <= maxRadius || distance === 0) return { x, z };
          const scale = maxRadius / distance;
          return { x: centerX + dx * scale, z: centerZ + dz * scale };
        }
        return {
          x: Math.max(terrainBounds.minX + margin, Math.min(terrainBounds.maxX - margin, x)),
          z: Math.max(terrainBounds.minZ + margin, Math.min(terrainBounds.maxZ - margin, z))
        };
      },
      notifyColumnChanged(column) {
        options.onTerrainColumnChanged?.(column.x, column.z, column.surfaceY);
      },
      getSurfaceHeightAt(x, z) {
        const blockX = Math.round(x);
        const blockZ = Math.round(z);
        const column = activeColumns.get(columnKey(blockX, blockZ));
        if (column && Number.isFinite(column.surfaceY)) return column.surfaceY;
        const generatedHeight = options.surfaceHeightAt?.(blockX, blockZ);
        return Number.isFinite(generatedHeight) ? generatedHeight : null;
      },
      getFloorHeight(x, z, radius = 0.32, currentY) {
        let floor = -Infinity;
        const minX = Math.ceil(x - radius - 0.5);
        const maxX = Math.floor(x + radius + 0.5);
        const minZ = Math.ceil(z - radius - 0.5);
        const maxZ = Math.floor(z + radius + 0.5);
        for (let blockX = minX; blockX <= maxX; blockX++) {
          for (let blockZ = minZ; blockZ <= maxZ; blockZ++) {
            const column = activeColumns.get(columnKey(blockX, blockZ));
            if (!column || !Number.isFinite(column.surfaceY)
              || (currentY !== undefined && currentY < column.surfaceY - 0.08)) continue;
            if (column.surfaceY > floor) floor = column.surfaceY;
          }
        }
        return Number.isFinite(floor) ? floor : null;
      },
      maintainColumn: maintainTerrainColumn,
      ensureSupportLayer,
      markVoxelMined(block) {
        minedVoxels.add(voxelKey(block.position.x, block.position.y, block.position.z));
      },
      deactivateTerrainBlock
    };
    return mineableTerrain;
  }

  /**
   * Construit un arbre voxel en blocs de bois superposés et feuillage en feuilles transparentes
   */
  function buildVoxelTree(THREE, scene, collisionObstacles, x, z, trunkHeight = 4, baseY = 0) {
    const rx = Math.round(x);
    const rz = Math.round(z);

    // 1. Tronc en blocs de bois
    for (let y = 0; y < trunkHeight; y++) {
      spawnBlock(THREE, scene, collisionObstacles, 'oak_wood', rx, baseY + y, rz);
    }

    // 2. Feuilles vertes transparentes
    const l1Y = baseY + trunkHeight - 2;
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
        if (dx === 0 && dz === 0) continue;
        spawnBlock(THREE, scene, collisionObstacles, 'leaves', rx + dx, l1Y, rz + dz);
      }
    }

    const l2Y = baseY + trunkHeight - 1;
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
        if (dx === 0 && dz === 0) continue;
        spawnBlock(THREE, scene, collisionObstacles, 'leaves', rx + dx, l2Y, rz + dz);
      }
    }

    const l3Y = baseY + trunkHeight;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        spawnBlock(THREE, scene, collisionObstacles, 'leaves', rx + dx, l3Y, rz + dz);
      }
    }

    const l4Y = baseY + trunkHeight + 1;
    [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dz]) => {
      spawnBlock(THREE, scene, collisionObstacles, 'leaves', rx + dx, l4Y, rz + dz);
    });
  }

  // Arbres du décor principal : chaque partie est un vrai bloc cassable.
  function addVoxelTree(THREE, scene, collisionObstacles, x, z, trunkHeight = 4, baseY = null) {
    worldScene = scene;
    worldCollisionObstacles = collisionObstacles;
    const groundY = Number.isFinite(baseY)
      ? baseY
      : mineableTerrain?.getSurfaceHeightAt(Math.round(x), Math.round(z)) ?? 0;
    buildVoxelTree(THREE, scene, collisionObstacles, x, z, trunkHeight, groundY);
  }

  function buildVillagerHouse(THREE, scene, collisionObstacles, centerX, centerZ, baseY = 0) {
    if (!global.MinecraftBlocks) return;
    worldScene = scene;
    worldCollisionObstacles = collisionObstacles;
    const house = { centerX, centerZ, baseY, blocks: [], flammableBlocks: [], rebuilding: false };
    const addHouseBlock = (blockId, x, y, z) => {
      const block = spawnBlock(THREE, scene, collisionObstacles, blockId, x, y, z);
      if (block) {
        block.userData.villagerHouse = house;
        house.blocks.push(block);
        if (FLAMMABLE_BLOCKS.has(blockId)) house.flammableBlocks.push(block);
      }
      return block;
    };

    // Petite maison 5 x 5, avec une porte de deux blocs et des fenêtres.
    for (let level = 0; level <= 2; level++) {
      for (let offset = -2; offset <= 2; offset++) {
        const y = baseY + level;
        const frontIsDoor = offset === 0 && level < 2;
        if (!frontIsDoor) addHouseBlock('oak_planks', centerX + offset, y, centerZ + 2);
        addHouseBlock('oak_planks', centerX + offset, y, centerZ - 2);

        for (const side of [-2, 2]) {
          const isWindow = offset === 0 && level === 1;
          if (isWindow) {
            addHouseBlock('glass', centerX + side, y, centerZ + offset);
          } else {
            addHouseBlock('oak_planks', centerX + side, y, centerZ + offset);
          }
        }
      }
    }

    for (let x = -2; x <= 2; x++) {
      for (let z = -2; z <= 2; z++) {
        addHouseBlock('oak_planks', centerX + x, baseY + 3, centerZ + z);
      }
    }
    villagerHouseRecord = house;
    return house;
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
      if (mineableTerrain?.isWaterAt(tx, tz)) return;
      const baseY = mineableTerrain?.getSurfaceHeightAt(tx, tz) ?? 0;
      buildVoxelTree(THREE, scene, collisionObstacles, tx, tz, th, baseY);
    });

    // Quelques collines de taille variable, réparties dans la plaine sans
    // recouvrir le spawn ni les arbres déjà générés.
    const hillCount = mineableTerrain?.hasHeightMap ? 0 : 5 + Math.floor(Math.random() * 3);
    for (let hillIndex = 0; hillIndex < hillCount; hillIndex++) {
      const radiusX = 3 + Math.floor(Math.random() * 4);
      const radiusZ = 3 + Math.floor(Math.random() * 4);
      let center = null;

      for (let attempt = 0; attempt < 30 && !center; attempt++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = 24 + Math.random() * 24;
        const x = Math.round(Math.cos(angle) * distance);
        const z = Math.round(Math.sin(angle) * distance);
        if (Math.hypot(x, z) < 18) continue;

        const overlapsBlocks = placedBlocks.some((block) =>
          !block.userData.terrainInstance
          && !block.userData.vegetationInstance
          && Math.abs(block.position.x - x) < radiusX + 2
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
  function findBlockInFrontOfCharacter(character, predicate = null) {
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
    const worldPosition = new global.THREE.Vector3();

    for (let i = 0; i < placedBlocks.length; i++) {
      const block = placedBlocks[i];
      if (!block.visible) continue;
      if (predicate && !predicate(block)) continue;
      getBlockWorldPosition(block, worldPosition);
      const column = block.userData.terrainColumn || block.userData.instancedVoxel?.column;
      if (column && column.blocks.some((other) => other !== block
        && other.position.y > block.position.y
        && other.position.y - block.position.y <= 1.01)) continue;

      const dx = worldPosition.x - charPos.x;
      const dy = worldPosition.y - (charPos.y + characterHeight / 2);
      const dz = worldPosition.z - charPos.z;

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
    if (block.userData.terrainInstance || block.userData.vegetationInstance
      || block.userData.instancedVoxel) return;
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
      crackMesh.position.copy(getBlockWorldPosition(block));
      scene.add(crackMesh);
      block.userData.crackMesh = crackMesh;
    } else {
      crackMesh.material.map = getCrackTexture(stage);
      crackMesh.material.map.needsUpdate = true;
    }
  }

  function getBlockColors(blockDef, blockId, block = null) {
    if (block?.userData?.breakColors?.length) return block.userData.breakColors;
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
    const blockPosition = getBlockWorldPosition(block);
    flame.position.set(blockPosition.x, blockPosition.y + 0.5, blockPosition.z);
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
    const target = findBlockInFrontOfCharacter(character, (block) => {
      const blockId = block.userData.blockId;
      return blockId === 'tnt' || FLAMMABLE_BLOCKS.has(blockId);
    });
    return igniteBlock(target);
  }

  function spawnHitChips(scene, block, blockDef) {
    if (!debrisGeometry) {
      debrisGeometry = new global.THREE.BoxGeometry(0.14, 0.14, 0.14);
    }
    const colors = getBlockColors(blockDef, block.userData.blockId, block);
    const origin = getBlockWorldPosition(block);

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
        floorY: origin.y - 0.5,
        life: 0.35,
        maxLife: 0.35
      });
    }
  }

  /**
   * Animation d'explosion complète du bloc lors de sa destruction
   */
  function destroyAndExplodeBlock(block, blockDef, scene, collisionObstacles, options = {}) {
    const origin = getBlockWorldPosition(block).clone();
    const blockId = block.userData.blockId || 'stone';
    const terrainColumn = block.userData.terrainColumn;
    const isTerrainBlock = Boolean(block.userData.terrainInstance);
    const isVegetationBlock = Boolean(block.userData.vegetationInstance);
    const isInstancedVoxelBlock = Boolean(block.userData.instancedVoxel);
    const nextSupportY = block.position.y - 1;
    const colors = getBlockColors(blockDef, blockId, block);

    removeBlockFire(block);
    if (!options.skipSound) playMinecraftSound(blockDef?.sound || 'stone', 'break');

    if (block.userData.crackMesh) {
      scene.remove(block.userData.crackMesh);
      if (block.userData.crackMesh.geometry) block.userData.crackMesh.geometry.dispose();
      if (block.userData.crackMesh.material) block.userData.crackMesh.material.dispose();
      delete block.userData.crackMesh;
    }

    if (isTerrainBlock) {
      const columnIndex = terrainColumn.blocks.indexOf(block);
      if (columnIndex !== -1) terrainColumn.blocks.splice(columnIndex, 1);
      mineableTerrain.markVoxelMined(block);
      mineableTerrain.deactivateTerrainBlock(block);
    } else if (isVegetationBlock) {
      block.userData.vegetationInstance.remove();
    } else if (isInstancedVoxelBlock) {
      block.userData.instancedVoxelField.removeBlock(block);
    } else {
      scene.remove(block);
    }
    const pIdx = placedBlocks.indexOf(block);
    if (pIdx !== -1) placedBlocks.splice(pIdx, 1);

    if (block.userData.collisionObstacle && collisionObstacles) {
      const oIdx = collisionObstacles.indexOf(block.userData.collisionObstacle);
      if (oIdx !== -1) collisionObstacles.splice(oIdx, 1);
    }
    if (!isTerrainBlock && !isInstancedVoxelBlock && block.geometry) block.geometry.dispose();
    if (!isTerrainBlock && !isInstancedVoxelBlock && block.material) {
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
      : blockId === 'tnt' ? 48
        : isTerrainBlock || isInstancedVoxelBlock ? 8
          : isVegetationBlock ? 4 : 28;

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
        floorY: origin.y - 0.5,
        life: 1.3 + Math.random() * 0.3,
        maxLife: 1.6,
        initialScale
      });
    }

    const dustCount = isTerrainBlock || isInstancedVoxelBlock ? 3 : isVegetationBlock ? 2 : 10;
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
        floorY: origin.y - 0.5,
        life: 0.75 + Math.random() * 0.25,
        maxLife: 0.9
      });
    }

    if (isTerrainBlock && terrainColumn) {
      mineableTerrain.ensureSupportLayer(terrainColumn, nextSupportY);
      mineableTerrain.maintainColumn(terrainColumn);
      mineableTerrain.notifyColumnChanged(terrainColumn);
    }
  }

  function detonateTnt(tntBlock) {
    if (!tntBlock || !tntBlock.visible || !worldScene) return;
    const origin = tntBlock.position.clone();
    const blastRadius = 8;
    const testPosition = new global.THREE.Vector3();
    const affectedBlocks = placedBlocks.filter((block) =>
      block.visible && getBlockWorldPosition(block, testPosition).distanceTo(origin) <= blastRadius
    );
    const affectedHouses = new Set();
    playMinecraftSound('tnt', 'break');

    affectedBlocks.forEach((block) => {
      if (block.userData.villagerHouse) affectedHouses.add(block.userData.villagerHouse);
      const blockDef = block.userData.blockDef || global.MinecraftBlocks?.get(block.userData.blockId);
      destroyAndExplodeBlock(block, blockDef, worldScene, worldCollisionObstacles, {
        skipSound: true,
        debrisCount: block === tntBlock ? 48 : 2
      });
    });

    affectedHouses.forEach((house) => {
      if (house.flammableBlocks.every((houseBlock) => !placedBlocks.includes(houseBlock))) {
        replaceBurnedVillagerHouse(house);
      }
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

    const targetCharacter = findCharacterInFrontOfCharacter(character);
    if (targetCharacter) {
      applyCharacterHit(character, targetCharacter);
      return true;
    }

    const targetBlock = findBlockInFrontOfCharacter(character);
    if (!targetBlock) return false;

    const weaponId = character.currentWeaponId || character.weaponId || null;
    const blockId = targetBlock.userData.blockId;
    const blockDef = targetBlock.userData.blockDef;

    const damage = getAttackDamage(weaponId, blockId, blockDef);
    strikeBlock(targetBlock, damage, character);
    return true;
  }

  function findCharacterInFrontOfCharacter(attacker) {
    const root = attacker.root;
    const forwardX = Math.sin(root.rotation.y);
    const forwardZ = Math.cos(root.rotation.y);
    const attackHeight = root.position.y + 1;
    let bestTarget = null;
    let bestScore = Infinity;

    for (const target of characterEntities) {
      if (!target || target === attacker || !target.root || !target.root.visible
        || target.root.userData?.enteredPortal) continue;
      if (!(target.isChicken || target.isVillager || target.weaponArmPivot || target.characterName)) continue;

      const targetHeight = target.collisionHeight || (target.isChicken ? 0.7 : target.isVillager ? 1.95 : 1.8);
      const targetCenterY = target.root.position.y + targetHeight / 2;
      if (Math.abs(targetCenterY - attackHeight) > 1.5) continue;

      const dx = target.root.position.x - root.position.x;
      const dz = target.root.position.z - root.position.z;
      const distance = Math.hypot(dx, dz);
      const reach = 1.35 + (attacker.collisionRadius || 0.38) + (target.collisionRadius || 0.3);
      if (distance < 0.15 || distance > reach) continue;

      const dot = (forwardX * dx + forwardZ * dz) / distance;
      if (dot < 0.45) continue;
      const score = distance + (1 - dot) * 1.2;
      if (score < bestScore) {
        bestScore = score;
        bestTarget = target;
      }
    }
    return bestTarget;
  }

  function applyCharacterHit(attacker, target) {
    const dx = target.root.position.x - attacker.root.position.x;
    const dz = target.root.position.z - attacker.root.position.z;
    const length = Math.hypot(dx, dz) || 1;
    const continuingReaction = target.hitReaction && target.hitReaction.elapsed < 0.45;
    const reaction = continuingReaction ? target.hitReaction : {
      elapsed: 0,
      velocityX: 0,
      velocityZ: 0,
      originalMaterials: [],
      flashMaterials: [],
      materialsRestored: false,
      jumpVelocity: 0
    };
    reaction.elapsed = 0;
    reaction.velocityX = (dx / length) * 2.4;
    reaction.velocityZ = (dz / length) * 2.4;
    if (!continuingReaction) reaction.baseY = target.root.position.y;
    target.hitReaction = reaction;

    if (target.isChicken && typeof target.applyHitJump === 'function') {
      target.applyHitJump();
    } else if (target.isAlex || target.weaponArmPivot) {
      target.root.userData.jumpVelocity = Math.max(target.root.userData.jumpVelocity || 0, 3.6);
    } else if (target.isVillager) {
      reaction.jumpVelocity = Math.max(reaction.jumpVelocity || 0, 3.8);
    }

    if (reaction.originalMaterials.length === 0) {
      const materialClones = new Map();
      target.root.traverse((object) => {
        if (!object.material) return;
        const original = object.material;
        const materials = Array.isArray(original) ? original : [original];
        const clones = materials.map((material) => {
          if (!material || !material.color) return material;
          if (!materialClones.has(material)) materialClones.set(material, material.clone());
          return materialClones.get(material);
        });
        if (clones.some((material, index) => material !== materials[index])) {
          reaction.originalMaterials.push({ object, material: original });
          object.material = Array.isArray(original) ? clones : clones[0];
        }
      });
      reaction.flashMaterials = Array.from(materialClones.values());
    }
    reaction.flashMaterials.forEach((material) => material.color.set(0xff5555));
    reaction.materialsRestored = false;
  }

  function restoreHitFlashMaterials(reaction) {
    reaction.originalMaterials.forEach(({ object, material }) => { object.material = material; });
    reaction.flashMaterials.forEach((material) => material.dispose());
    reaction.originalMaterials.length = 0;
    reaction.flashMaterials.length = 0;
    reaction.materialsRestored = true;
  }

  function updateCharacterHitReactions(delta) {
    for (const target of characterEntities) {
      const reaction = target && target.hitReaction;
      if (!reaction) continue;

      reaction.elapsed += delta;
      if (reaction.elapsed <= 0.32) {
        global.MinecraftCharacterModel.moveWithCollisions(
          target,
          reaction.velocityX * delta,
          reaction.velocityZ * delta,
          worldCollisionObstacles,
          characterEntities
        );
        if (target.isVillager) {
          const safePosition = mineableTerrain?.clampToBounds(
            target.root.position.x, target.root.position.z, 2
          );
          if (safePosition) target.root.position.setX(safePosition.x).setZ(safePosition.z);
        }
        const damping = Math.exp(-7 * delta);
        reaction.velocityX *= damping;
        reaction.velocityZ *= damping;
      }

      if (target.isVillager) {
        reaction.jumpVelocity -= 18 * delta;
        target.root.position.y += reaction.jumpVelocity * delta;
        if (target.root.position.y <= reaction.baseY && reaction.jumpVelocity <= 0) {
          target.root.position.y = reaction.baseY;
          reaction.jumpVelocity = 0;
        }
      }

      if (reaction.elapsed >= 0.28 && !reaction.materialsRestored) {
        restoreHitFlashMaterials(reaction);
      }
      if (reaction.elapsed >= 0.45) {
        if (!reaction.materialsRestored) restoreHitFlashMaterials(reaction);
        if (target.isVillager) {
          target.root.position.y = reaction.baseY;
          reaction.jumpVelocity = 0;
        }
        target.hitReaction = null;
      }
    }
    updateVillagerRelocation(delta);
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

    // Niveaux occupés à l’emplacement visé. Le bloc peut se trouver sous le
    // niveau zéro quand le joueur construit ou bouche un trou.
    const occupiedLevels = new Set();
    let highestY = -Infinity;
    let lowestY = Infinity;
    for (let i = 0; i < placedBlocks.length; i++) {
      const b = placedBlocks[i];
      if (!b.visible || b.userData.vegetationInstance) continue;
      if (Math.round(b.position.x) === px && Math.round(b.position.z) === pz) {
        const level = Math.round(b.position.y - 0.5);
        occupiedLevels.add(level);
        highestY = Math.max(highestY, level);
        lowestY = Math.min(lowestY, level);
      }
    }

    const playerLevel = Math.round(charPos.y);
    let targetY = null;

    if (occupiedLevels.size) {
      // Sous le joueur : remplir le premier vide qui a déjà un bloc de
      // soutien plus bas. Les cases excavées restent vides à leur niveau.
      for (let level = playerLevel - 1; level > lowestY; level--) {
        if (!occupiedLevels.has(level) && occupiedLevels.has(level - 1)) {
          targetY = level;
          break;
        }
      }

      // Au niveau du joueur ou au-dessus : remplir un vide seulement s’il est
      // soutenu en dessous et relié à un bloc plus haut.
      if (targetY === null) {
        for (let level = playerLevel; level < highestY; level++) {
          if (!occupiedLevels.has(level) && occupiedLevels.has(level - 1)) {
            targetY = level;
            break;
          }
        }
      }
    }

    // Aucun trou utile devant le joueur : conserver la pose classique au
    // sommet de la pile, ou au sol si l’emplacement est vide.
    if (targetY === null) {
      targetY = occupiedLevels.size
        ? highestY + 1
        : Math.max(0, playerLevel);
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

  function findReplacementHouseSite(previousHouse) {
    const villager = characterEntities.find((entity) => entity && entity.isVillager);
    const buildRadius = Math.max(6, mineableTerrain?.houseAreaRadius || 16);
    const previousX = previousHouse?.centerX;
    const previousZ = previousHouse?.centerZ;

    function isUsableSite(x, z, requireDistance) {
      if (Math.hypot(x, z) > buildRadius) return null;
      if (mineableTerrain?.isWaterAt(x, z)) return null;
      if (requireDistance && Number.isFinite(previousX)
        && Math.hypot(x - previousX, z - previousZ) < 8) return null;

      const baseY = mineableTerrain?.getSurfaceHeightAt(x, z);
      if (!Number.isFinite(baseY) || baseY < 0) return null;
      for (let dx = -2; dx <= 2; dx++) {
        for (let dz = -2; dz <= 2; dz++) {
          if (mineableTerrain?.isWaterAt(x + dx, z + dz)) return null;
          if (mineableTerrain?.getSurfaceHeightAt(x + dx, z + dz) !== baseY) return null;
        }
      }

      const overlapsBlocks = placedBlocks.some((block) => block.visible
        && !block.userData.terrainInstance && !block.userData.vegetationInstance
        && block.userData.blockId !== 'grass'
        && block.position.y < baseY + 4.5
        && Math.abs(block.position.x - x) < 4
        && Math.abs(block.position.z - z) < 4);
      const tooCloseToCharacter = characterEntities.some((entity) => entity && entity !== villager
        && Math.hypot(entity.root.position.x - x, entity.root.position.z - z) < 9);
      return !overlapsBlocks && !tooCloseToCharacter ? { x, z, baseY } : null;
    }

    // Deux passes : préférer un emplacement différent, puis accepter tout
    // emplacement plat sûr de la plaine si les reconstructions se répètent.
    for (const requireDistance of [true, false]) {
      for (let attempt = 0; attempt < 500; attempt++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.sqrt(Math.random()) * buildRadius;
        const x = Math.round(Math.cos(angle) * distance);
        const z = Math.round(Math.sin(angle) * distance);
        const site = isUsableSite(x, z, requireDistance);
        if (site) return site;
      }
    }

    const fallback = { x: -12, z: 0 };
    return {
      ...fallback,
      baseY: mineableTerrain?.getSurfaceHeightAt(fallback.x, fallback.z) ?? 0
    };
  }

  function removeHouseBlock(block) {
    if (!block || !placedBlocks.includes(block)) return;
    removeBlockFire(block);
    if (block.userData.crackMesh) {
      worldScene.remove(block.userData.crackMesh);
      block.userData.crackMesh.geometry?.dispose();
      block.userData.crackMesh.material?.dispose();
    }
    worldScene.remove(block);
    placedBlocks.splice(placedBlocks.indexOf(block), 1);
    const obstacleIndex = worldCollisionObstacles.indexOf(block.userData.collisionObstacle);
    if (obstacleIndex >= 0) worldCollisionObstacles.splice(obstacleIndex, 1);
    block.geometry?.dispose();
    const materials = Array.isArray(block.material) ? block.material : [block.material];
    materials.forEach((material) => {
      if (material && !global.MinecraftBlocks?.isSharedBlockMaterial?.(material)) material.dispose();
    });
  }

  function replaceBurnedVillagerHouse(house) {
    if (!house || house !== villagerHouseRecord || house.rebuilding) return;
    house.rebuilding = true;
    house.blocks.forEach(removeHouseBlock);

    const site = findReplacementHouseSite(house);
    buildVillagerHouse(global.THREE, worldScene, worldCollisionObstacles, site.x, site.z, site.baseY);
    const villager = characterEntities.find((entity) => entity && entity.isVillager);
    if (villager) {
      const side = villager.root.position.x <= site.x ? -1 : 1;
      const depthSide = villager.root.position.z <= site.z ? -1 : 1;
      villager.relocation = {
        x: site.x,
        z: site.z + 3.5,
        baseY: site.baseY,
        waypoints: [
          { x: site.x + side * 4.5, z: site.z + depthSide * 4.5 },
          { x: site.x + side * 4.5, z: site.z + 4.5 },
          { x: site.x, z: site.z + 4.5 }
        ],
        waypointIndex: 0,
        elapsed: 0
      };
    }
  }

  function updateVillagerRelocation(delta) {
    const villager = characterEntities.find((entity) => entity && entity.isVillager && entity.relocation);
    if (!villager) return;
    const route = villager.relocation;
    const waypoint = route.waypoints[route.waypointIndex];
    const dx = waypoint.x - villager.root.position.x;
    const dz = waypoint.z - villager.root.position.z;
    const distance = Math.hypot(dx, dz);
    route.elapsed += delta;

    if (distance <= 0.35) {
      route.waypointIndex++;
      if (route.waypointIndex >= route.waypoints.length) {
        villager.root.position.set(route.x, route.baseY, route.z);
        villager.root.rotation.y = 0;
        villager.legs.forEach((leg) => { leg.rotation.x = 0; });
        villager.relocation = null;
        return;
      }
      return;
    }

    villager.root.rotation.y = Math.atan2(dx, dz);
    const step = Math.min(distance, 1.8 * delta);
    global.MinecraftCharacterModel.moveWithCollisions(
      villager,
      dx / distance * step,
      dz / distance * step,
      worldCollisionObstacles,
      characterEntities
    );
    const safePosition = mineableTerrain?.clampToBounds(
      villager.root.position.x, villager.root.position.z, 2
    );
    if (safePosition) villager.root.position.setX(safePosition.x).setZ(safePosition.z);
    const swing = Math.sin(route.elapsed * 12) * 0.45;
    villager.legs[0].rotation.x = swing;
    villager.legs[1].rotation.x = -swing;
  }

  function registerMineableVegetation(field) {
    const vegetationBlocks = field?.getMineableBlocks?.() || [];
    vegetationBlocks.forEach((block) => {
      if (block && !placedBlocks.includes(block)) placedBlocks.push(block);
    });
    return vegetationBlocks.length;
  }

  function updateVillagerPhysics(delta) {
    const villager = characterEntities.find((entity) => entity && entity.isVillager);
    if (!villager || villager.hitReaction || !global.MinecraftCharacterModel) return;

    global.MinecraftCharacterModel.updateJump(villager, delta, worldCollisionObstacles);

    const root = villager.root;
    const localFloor = mineableTerrain?.getFloorHeight(
      root.position.x, root.position.z, villager.collisionRadius || 0.38, root.position.y
    );
    const nearbyFloor = mineableTerrain?.getFloorHeight(root.position.x, root.position.z, 1.15);
    if (Number.isFinite(localFloor) && Number.isFinite(nearbyFloor)
      && nearbyFloor > localFloor + 0.5
      && Math.abs(root.position.y - localFloor) < 0.08
      && root.userData.jumpVelocity <= 0) {
      global.MinecraftCharacterModel.startJump(villager, worldCollisionObstacles);
      global.MinecraftCharacterModel.stopJump(villager);
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
        const house = block.userData.villagerHouse;
        const blockDef = block.userData.blockDef || global.MinecraftBlocks?.get(block.userData.blockId);
        destroyAndExplodeBlock(block, blockDef, worldScene, worldCollisionObstacles, { debrisCount: 8 });
        if (house && house.flammableBlocks.every((houseBlock) => !placedBlocks.includes(houseBlock))) {
          replaceBurnedVillagerHouse(house);
        }
      }
    }
  }

  function update(delta, time) {
    updateBurningBlocks(delta, time);
    updateVillagerPhysics(delta);

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

      const particleFloorY = Number.isFinite(p.floorY) ? p.floorY : 0.08;
      if (m.position.y < particleFloorY) {
        m.position.y = particleFloorY;
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

  function setupBlockInteraction(THREE, scene, camera, canvas, collisionObstacles, alex, steve, entities = []) {
    worldScene = scene;
    worldCollisionObstacles = collisionObstacles;
    characterAlex = alex;
    characterSteve = steve;
    characterEntities = Array.isArray(entities) && entities.length ? entities : [alex, steve];
    // Plus de contrôle de blocs à la souris : la souris est exclusivement réservée à la caméra
  }

  global.MinecraftBlockWorld = {
    spawnBlock,
    createMineableTerrain,
    registerMineableInstancedIsland,
    registerMineableVegetation,
    getTerrainFloorHeight: getWorldFloorHeight,
    collidesWithTerrain: collidesWithTerrainFields,
    findNearestGroundPosition,
    buildVillagerHouse,
    buildDecorativeStructures,
    addVoxelTree,
    buildVoxelHill,
    buildVoxelTree,
    setupBlockInteraction,
    triggerAction,
    triggerAttack: triggerAction,
    updateCharacterHitReactions,
    update,
    placedBlocks
  };

})(window);

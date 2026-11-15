(function (global) {
  'use strict';

  const STORAGE_KEY = 'minecraft-grass-preset-v1';
  const WIDTH = 16;
  const HEIGHT = 24;
  const PALETTE = ['#4f9e24', '#69bd2d', '#80d83b', '#a0e45a'];

  function makeDefaultRows() {
    const rows = [];
    for (let y = 0; y < HEIGHT; y++) {
      const center = 7.5 + Math.sin(y * 0.45) * 2;
      const halfWidth = y < 5 ? 1 : Math.min(6, 2 + Math.floor((y - 4) / 3));
      let row = '';
      for (let x = 0; x < WIDTH; x++) {
        const blade = Math.abs(x - center) <= halfWidth
          || (y > 8 && Math.abs(x - (center + (y % 2 ? 3 : -3))) <= 1);
        row += blade && Math.random() > 0.12
          ? String(1 + Math.floor(Math.random() * PALETTE.length))
          : '0';
      }
      rows.push(row);
    }
    return rows;
  }

  const DEFAULT_PRESET = {
    width: WIDTH,
    height: HEIGHT,
    rows: makeDefaultRows(),
    palette: PALETTE.slice(),
    panelWidth: 0.48,
    panelHeight: 0.75
  };

  function normalizePreset(preset) {
    const source = preset && Array.isArray(preset.rows) ? preset : DEFAULT_PRESET;
    const width = Math.max(1, Math.min(64, Number(source.width) || WIDTH));
    const height = Math.max(1, Math.min(64, Number(source.height) || HEIGHT));
    const palette = Array.isArray(source.palette) && source.palette.length === 4
      ? source.palette.slice()
      : PALETTE.slice();
    const rows = Array.from({ length: height }, (_, y) => {
      const row = String(source.rows[y] || '').slice(0, width);
      return row.padEnd(width, '0').replace(/[^0-4]/g, '0');
    });
    return {
      width, height, rows, palette,
      panelWidth: Math.max(0.1, Math.min(2, Number(source.panelWidth) || 0.48)),
      panelHeight: Math.max(0.1, Math.min(2, Number(source.panelHeight) || 0.75))
    };
  }

  function getPreset() {
    try {
      const stored = global.localStorage.getItem(STORAGE_KEY);
      return normalizePreset(stored ? JSON.parse(stored) : DEFAULT_PRESET);
    } catch (error) {
      return normalizePreset(DEFAULT_PRESET);
    }
  }

  function savePreset(preset) {
    const normalized = normalizePreset(preset);
    global.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  }

  function createTexture(THREE, preset = getPreset()) {
    const data = normalizePreset(preset);
    const canvas = document.createElement('canvas');
    canvas.width = data.width;
    canvas.height = data.height;
    const context = canvas.getContext('2d');
    for (let y = 0; y < data.height; y++) {
      for (let x = 0; x < data.width; x++) {
        const colorIndex = Number(data.rows[y][x]);
        if (colorIndex > 0) {
          context.fillStyle = data.palette[colorIndex - 1];
          context.fillRect(x, y, 1, 1);
        }
      }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    return texture;
  }

  function createMaterial(THREE, preset = getPreset()) {
    const texture = createTexture(THREE, preset);
    return new THREE.MeshLambertMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.5,
      side: THREE.DoubleSide
    });
  }

  function createField(THREE, scene, count = 180, terrainDesign = null) {
    const preset = getPreset();
    const geometry = new THREE.PlaneGeometry(preset.panelWidth, preset.panelHeight);
    const material = createMaterial(THREE, preset);
    const instances = new THREE.InstancedMesh(geometry, material, count * 2);
    instances.castShadow = false;
    instances.receiveShadow = false;
    scene.add(instances);

    const plants = [];
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const matrix = new THREE.Matrix4();
    const up = new THREE.Vector3(0, 1, 0);
    const projected = new THREE.Vector3();

    function updatePlant(plant) {
      for (let panel = 0; panel < 2; panel++) {
        const size = plant.alive ? plant.panelScales[panel] * plant.growScale : 0;
        position.set(plant.position.x, plant.position.y + preset.panelHeight * size / 2, plant.position.z);
        rotation.setFromAxisAngle(up, plant.rotation + panel * Math.PI / 2);
        scale.set(size, size, size);
        matrix.compose(position, rotation, scale);
        instances.setMatrixAt(plant.instanceIndex + panel, matrix);
      }
      instances.instanceMatrix.needsUpdate = true;
      if (plant.mineableBlock) plant.mineableBlock.visible = plant.alive;
    }

    function randomPosition(centerX, centerZ, minRadius, maxRadius) {
      for (let attempt = 0; attempt < 80; attempt++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = minRadius + Math.random() * (maxRadius - minRadius);
        const x = centerX + Math.cos(angle) * radius;
        const z = centerZ + Math.sin(angle) * radius;
        if (terrainDesign?.isWaterAt?.(x, z)) continue;
        const height = terrainDesign?.getSurfaceHeightAt?.(x, z);
        if (terrainDesign && !Number.isFinite(height)) continue;
        return new THREE.Vector3(x, Number.isFinite(height) ? height : 0, z);
      }
      const height = terrainDesign?.getSurfaceHeightAt?.(centerX, centerZ);
      return new THREE.Vector3(centerX, Number.isFinite(height) ? height : 0, centerZ);
    }

    for (let i = 0; i < count; i++) {
      const plant = {
        position: randomPosition(0, 0, 7, 55),
        finitePosition: null,
        rotation: Math.random() * Math.PI,
        panelScales: [0.55 + Math.random() * 0.8, 0.55 + Math.random() * 0.8],
        growScale: 1,
        growProgress: null,
        instanceIndex: i * 2,
        alive: true
      };
      plant.finitePosition = plant.position.clone();
      plant.mineableBlock = {
        position: plant.position,
        visible: true,
        userData: {
          isMinecraftBlock: true,
          blockId: 'leaves',
          blockDef: global.MinecraftBlocks?.get('leaves') || null,
          maxHp: 0.75,
          currentHp: 0.75,
          vegetationInstance: {
            remove() {
              if (!plant.alive) return;
              plant.alive = false;
              plant.growScale = 0;
              plant.growProgress = null;
              updatePlant(plant);
            }
          }
        }
      };
      plants.push(plant);
      updatePlant(plant);
    }

    return {
      update(delta, targetX, targetZ, infinite, camera) {
        let changed = false;
        for (const plant of plants) {
          if (!plant.alive) continue;
          if (infinite
            && Math.hypot(plant.position.x - targetX, plant.position.z - targetZ) > 82) {
            projected.set(plant.position.x, 2.5, plant.position.z).project(camera);
            if (projected.z < -1 || projected.z > 1
              || Math.abs(projected.x) > 1.15 || Math.abs(projected.y) > 1.15) {
              plant.position.copy(randomPosition(targetX, targetZ, 34, 76));
              plant.growScale = 0.04;
              plant.growProgress = 0;
              updatePlant(plant);
              changed = true;
            }
          }
          if (plant.growProgress !== null) {
            plant.growProgress = Math.min(1, plant.growProgress + delta / 1.4);
            const eased = plant.growProgress * plant.growProgress * (3 - 2 * plant.growProgress);
            plant.growScale = 0.04 + 0.96 * eased;
            updatePlant(plant);
            if (plant.growProgress === 1) plant.growProgress = null;
            changed = true;
          }
        }
        return changed;
      },
      restoreFinite() {
        for (const plant of plants) {
          if (!plant.alive) continue;
          plant.position.copy(plant.finitePosition);
          plant.growScale = 1;
          plant.growProgress = null;
          updatePlant(plant);
        }
      },
      getMineableBlocks() {
        return plants.map((plant) => plant.mineableBlock);
      }
    };
  }

  global.MinecraftVegetation = { DEFAULT_PRESET, getPreset, savePreset, createTexture, createMaterial, createField };
})(window);

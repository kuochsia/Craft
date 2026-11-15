(function (global) {
  'use strict';

  const clamp01 = (value) => Math.max(0, Math.min(1, value));
  const smoothstep = (edge0, edge1, value) => {
    const t = clamp01((value - edge0) / (edge1 - edge0));
    return t * t * (3 - 2 * t);
  };

  function createIsland(options = {}) {
    const radius = options.radius || 76;
    const plainRadius = options.plainRadius || 24;
    const lake = {
      x: options.lakeX === undefined ? -30 : options.lakeX,
      z: options.lakeZ === undefined ? -18 : options.lakeZ,
      radiusX: options.lakeRadiusX || 11,
      radiusZ: options.lakeRadiusZ || 8,
      bedY: -2,
      waterY: -1.35
    };
    const waterCapacity = (Math.ceil(radius * 2) + 1) ** 2;
    const bounds = {
      minX: -radius,
      maxX: radius,
      minZ: -radius,
      maxZ: radius,
      centerX: 0,
      centerZ: 0,
      radius
    };

    function contains(x, z) {
      return Math.hypot(x, z) <= radius;
    }

    function lakeDistance(x, z) {
      const dx = (x - lake.x) / lake.radiusX;
      const dz = (z - lake.z) / lake.radiusZ;
      return Math.hypot(dx, dz);
    }

    function isWaterAt(x, z) {
      return contains(x, z) && lakeDistance(x, z) <= 1;
    }

    function getSurfaceHeightAt(x, z) {
      if (!contains(x, z)) return null;
      if (isWaterAt(x, z)) return lake.bedY;

      const distance = Math.hypot(x, z);
      if (distance <= plainRadius) return 0;

      const rolling = 1.15
        + Math.sin(x * 0.11) * 0.65
        + Math.cos(z * 0.12) * 0.55
        + Math.sin((x + z) * 0.065) * 0.45;
      const hillStrength = smoothstep(plainRadius, 41, distance);
      const hills = hillStrength * Math.max(0, rolling);

      const ridgeA = 1 - Math.abs(Math.sin(x * 0.092 + Math.sin(z * 0.037) * 1.6));
      const ridgeB = 1 - Math.abs(Math.sin(z * 0.083 + Math.cos(x * 0.041) * 1.8));
      const ridge = Math.max(ridgeA, ridgeB * 0.86);
      const mountainBand = smoothstep(38, 49, distance) * (1 - smoothstep(64, 76, distance));
      let height = hills + mountainBand * (1.2 + ridge * 7.2);

      const shoreDistance = lakeDistance(x, z);
      if (shoreDistance < 1.5) {
        height = Math.max(height, smoothstep(1, 1.5, shoreDistance));
      }

      const coast = 1 - smoothstep(radius - 10, radius - 1, distance);
      return Math.max(0, Math.round(height * coast));
    }

    function getMinimumLevelAt(x, z) {
      return isWaterAt(x, z) ? -3 : -1;
    }

    function addWaterMeshes(THREE, scene) {
      const waterGeometry = new THREE.PlaneGeometry(1, 1);
      const waterMaterial = new THREE.MeshLambertMaterial({
        color: 0x3c9fc3,
        transparent: true,
        opacity: 0.78,
        depthWrite: false,
        side: THREE.DoubleSide
      });
      const waterSurface = new THREE.InstancedMesh(waterGeometry, waterMaterial, waterCapacity);
      waterSurface.count = 0;
      waterSurface.renderOrder = 1;
      waterSurface.receiveShadow = false;
      scene.add(waterSurface);

      const wetCells = new Set();
      const excavatedCells = new Set();
      const cellKey = (x, z) => `${x},${z}`;
      const position = new THREE.Vector3();
      const rotation = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(1, 0, 0), -Math.PI / 2
      );
      const scale = new THREE.Vector3(1, 1, 1);
      const matrix = new THREE.Matrix4();

      function addWaterCell(x, z) {
        const key = cellKey(x, z);
        if (wetCells.has(key) || waterSurface.count >= waterCapacity) return;
        position.set(x, lake.waterY, z);
        matrix.compose(position, rotation, scale);
        waterSurface.setMatrixAt(waterSurface.count, matrix);
        waterSurface.count++;
        waterSurface.instanceMatrix.needsUpdate = true;
        waterSurface.boundingSphere = null;
        wetCells.add(key);
      }

      for (let x = Math.ceil(lake.x - lake.radiusX); x <= Math.floor(lake.x + lake.radiusX); x++) {
        for (let z = Math.ceil(lake.z - lake.radiusZ); z <= Math.floor(lake.z + lake.radiusZ); z++) {
          if (lakeDistance(x, z) <= 1) addWaterCell(x, z);
        }
      }

      function updateColumn(x, z, surfaceY) {
        const blockX = Math.round(x);
        const blockZ = Math.round(z);
        if (!contains(blockX, blockZ)
          || (Number.isFinite(surfaceY) && surfaceY > lake.waterY)) return;

        const key = cellKey(blockX, blockZ);
        excavatedCells.add(key);
        const queue = [];
        const adjacent = [
          [blockX + 1, blockZ], [blockX - 1, blockZ],
          [blockX, blockZ + 1], [blockX, blockZ - 1]
        ];
        if (adjacent.some(([nx, nz]) => wetCells.has(cellKey(nx, nz)))) {
          addWaterCell(blockX, blockZ);
          queue.push([blockX, blockZ]);
        }

        for (let cursor = 0; cursor < queue.length; cursor++) {
          const [currentX, currentZ] = queue[cursor];
          for (const [nextX, nextZ] of [
            [currentX + 1, currentZ], [currentX - 1, currentZ],
            [currentX, currentZ + 1], [currentX, currentZ - 1]
          ]) {
            const nextKey = cellKey(nextX, nextZ);
            if (!excavatedCells.has(nextKey) || wetCells.has(nextKey)) continue;
            addWaterCell(nextX, nextZ);
            queue.push([nextX, nextZ]);
          }
        }
      }

      return { waterSurface, updateColumn };
    }

    return {
      radius,
      plainRadius,
      lake,
      bounds,
      contains,
      isWaterAt,
      getSurfaceHeightAt,
      getMinimumLevelAt,
      addWaterMeshes
    };
  }

  global.MinecraftWorldDesign = { createIsland };
})(window);

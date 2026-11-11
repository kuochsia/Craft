(function (global) {
  const hand = { x: 4, y: 9 };
  const front = { x: 4, y: 1 };
  const preview = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 16 16\" shape-rendering=\"crispEdges\"><path fill=\"#474747\" d=\"M4 1h1v1h-1zM5 1h1v1h-1zM3 2h1v1h-1zM6 2h1v1h-1zM2 3h1v1h-1zM2 4h1v1h-1zM2 5h1v1h-1zM4 5h1v1h-1zM2 6h1v1h-1zM4 6h1v1h-1zM2 7h1v1h-1zM4 7h1v1h-1zM6 7h1v1h-1zM5 8h1v1h-1z\"/><path fill=\"#b9b9b9\" d=\"M4 2h1v1h-1zM5 2h1v1h-1zM3 3h1v1h-1zM3 4h1v1h-1z\"/><path fill=\"#9e9e9e\" d=\"M4 3h1v1h-1zM3 5h1v1h-1zM3 6h1v1h-1zM4 8h1v1h-1zM6 8h1v1h-1zM5 9h1v1h-1z\"/><path fill=\"#323232\" d=\"M5 3h1v1h-1zM7 3h1v1h-1zM4 4h1v1h-1zM6 4h1v1h-1zM7 4h1v1h-1zM7 7h1v1h-1zM2 8h1v1h-1zM7 8h1v1h-1zM3 9h1v1h-1zM6 9h1v1h-1zM4 10h1v1h-1zM5 10h1v1h-1z\"/><path fill=\"#717171\" d=\"M6 3h1v1h-1zM3 7h1v1h-1zM3 8h1v1h-1zM4 9h1v1h-1z\"/></svg>";
  const pixels = [
    [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [-1, -1, -1, -1, 4671303, 4671303, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [-1, -1, -1, 4671303, 12171705, 12171705, 4671303, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [-1, -1, 4671303, 12171705, 10395294, 3289650, 7434609, 3289650, -1, -1, -1, -1, -1, -1, -1, -1],
    [-1, -1, 4671303, 12171705, 3289650, -1, 3289650, 3289650, -1, -1, -1, -1, -1, -1, -1, -1],
    [-1, -1, 4671303, 10395294, 4671303, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [-1, -1, 4671303, 10395294, 4671303, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [-1, -1, 4671303, 7434609, 4671303, -1, 4671303, 3289650, -1, -1, -1, -1, -1, -1, -1, -1],
    [-1, -1, 3289650, 7434609, 10395294, 4671303, 10395294, 3289650, -1, -1, -1, -1, -1, -1, -1, -1],
    [-1, -1, -1, 3289650, 7434609, 10395294, 3289650, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [-1, -1, -1, -1, 3289650, 3289650, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]
  ];

  function create(THREE) {
    const weapon = new THREE.Group();
    const pixelSize = 1.2 / 16;
    const pixelGeometry = new THREE.BoxGeometry(pixelSize, pixelSize, pixelSize);
    const materials = new Map();

    pixels.forEach((row, y) => {
      row.forEach((color, x) => {
        if (color < 0) return;
        if (!materials.has(color)) {
          materials.set(color, new THREE.MeshLambertMaterial({ color }));
        }
        const voxel = new THREE.Mesh(pixelGeometry, materials.get(color));
        voxel.position.set(
          (x - hand.x) * pixelSize,
          (hand.y - y) * pixelSize,
          0
        );
        voxel.castShadow = true;
        weapon.add(voxel);
      });
    });

    const directionX = front.x - hand.x;
    const directionY = hand.y - front.y;
    weapon.rotation.set(
      21 * Math.PI / 180,
      34 * Math.PI / 180,
      Math.atan2(-directionX, directionY) + (0 * Math.PI / 180)
    );
    return weapon;
  }

  global.MinecraftWeapons = global.MinecraftWeapons || {};
  global.MinecraftWeapons.flint_and_steel = {
    create,
    preview,
    pixelData: pixels,
    hand,
    front,
    angles: { x: 21, y: 34, z: 0 },
    armAngle: 60,
    motion: "arc"
  };
})(window);

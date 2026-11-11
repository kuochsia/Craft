(function (global) {
  const hand = { x: 3, y: 13 };
  const front = { x: 13, y: 3 };
  const pixels = [
    [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [-1, -1, -1, -1, -1, -1, 933686, 933686, 933686, 933686, 933686, -1, -1, -1, -1, -1],
    [-1, -1, -1, -1, -1, 933686, 3402699, 2869164, 2601626, 2601626, 2869164, 933686, 4797973, 6835742, -1, -1],
    [-1, -1, -1, -1, -1, -1, 933686, 533792, 533792, 533792, 2601626, 2601626, 9004839, 2629131, -1, -1],
    [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 4797973, 2869164, 2601626, 533792, -1, -1],
    [-1, -1, -1, -1, -1, -1, -1, -1, -1, 4797973, 6835742, 2629131, 2601626, 2869164, 533792, -1],
    [-1, -1, -1, -1, -1, -1, -1, -1, 4797973, 9004839, 2629131, -1, 533792, 2601626, 533792, -1],
    [-1, -1, -1, -1, -1, -1, -1, 4797973, 6835742, 2629131, -1, -1, 533792, 2601626, 533792, -1],
    [-1, -1, -1, -1, -1, -1, 4797973, 9004839, 2629131, -1, -1, -1, 533792, 2869164, 533792, -1],
    [-1, -1, -1, -1, -1, 4797973, 6835742, 2629131, -1, -1, -1, -1, 533792, 3402699, 533792, -1],
    [-1, -1, -1, -1, 4797973, 9004839, 2629131, -1, -1, -1, -1, -1, -1, 533792, -1, -1],
    [-1, -1, -1, 4797973, 6835742, 2629131, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [-1, -1, 4797973, 9004839, 2629131, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [-1, -1, 2629131, 2629131, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]
  ];
  const preview = global.MinecraftWeaponPreview.create(pixels);

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
      -90 * Math.PI / 180,
      -90 * Math.PI / 180,
      Math.atan2(-directionX, directionY) + (0 * Math.PI / 180)
    );
    return weapon;
  }

  global.MinecraftWeapons = global.MinecraftWeapons || {};
  global.MinecraftWeapons.pickaxe = { create, preview, armAngle: 60, motion: 'arc' };
})(window);

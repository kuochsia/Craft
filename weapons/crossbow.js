(function (global) {
  const hand = { x: 14, y: 14 };
  const front = { x: 4, y: 4 };
  const pixels = [
    [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 5058065, -1, -1, -1],
    [-1, -1, -1, -1, -1, -1, -1, -1, 5058065, 5058065, 5058065, 2759177, 7160344, 5058065, -1, -1],
    [-1, -1, -1, 9934743, 7171437, -1, 5058065, 9459743, 9459743, 7160344, 7160344, 7160344, 5058065, 5058065, -1, -1],
    [-1, -1, 9934743, -1, -1, 4473924, 11891503, 3875853, 3875853, 3875853, 2759177, -1, 4473924, -1, -1, -1],
    [-1, -1, 7171437, -1, 5058065, 11891503, 3875853, 2036230, -1, -1, -1, 4473924, -1, -1, -1, -1],
    [-1, -1, -1, 4473924, 9459743, 3875853, 5058065, 5058065, 2036230, -1, 7171437, -1, -1, -1, -1, -1],
    [-1, -1, 5058065, 9459743, 3875853, 5058065, 5058065, 7160344, 5058065, 9868950, -1, -1, -1, -1, -1, -1],
    [-1, -1, 7160344, 4729616, 2036230, 5058065, 7160344, 5058065, 9868950, 5058065, 2036230, -1, -1, -1, -1, -1],
    [-1, 5058065, 9459743, 2759177, -1, 2036230, 5058065, 9868950, 5058065, 7160344, 5058065, 2036230, -1, -1, -1, -1],
    [-1, 5058065, 9459743, 2759177, -1, -1, 9868950, 5058065, 7160344, 5058065, 7160344, 5058065, 2036230, -1, -1, -1],
    [-1, 5058065, 7160344, -1, -1, 7171437, -1, 2036230, 5058065, 7160344, 5058065, 7160344, 3547147, -1, -1, -1],
    [-1, 2759177, 9459743, -1, 4473924, -1, -1, -1, 2036230, 5058065, 7160344, 5058065, 7160344, 2036230, -1, -1],
    [5058065, 7160344, 5058065, 4473924, -1, -1, -1, -1, -1, 2036230, 3547147, 7160344, 5058065, 3547147, 2036230, -1],
    [-1, 2759177, 2759177, -1, -1, -1, -1, -1, -1, -1, -1, 2036230, 3547147, 5058065, 7160344, 2036230],
    [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2036230, 7160344, 2036230, 2036230],
    [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 2036230, 2036230, -1]
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
      90 * Math.PI / 180,
      0 * Math.PI / 180,
      Math.atan2(-directionX, directionY) + (-90 * Math.PI / 180)
    );
    return weapon;
  }

  global.MinecraftWeapons = global.MinecraftWeapons || {};
  global.MinecraftWeapons.crossbow = { create, preview, armAngle: 90, motion: 'recoil' };
})(window);

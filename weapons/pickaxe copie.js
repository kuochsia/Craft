(function (global) {
  const hand = { x: 3, y: 12 };
  const front = { x: 2, y: 11 };
  const pixels = [
    [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 6237212, 6237212, 6237212],
    [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 6237212, 16635083, 16635083, 4332561],
    [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 6237212, 16635083, 14910060, 16635083, 4332561],
    [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 6237212, 16635083, 14910060, 16635083, 4332561, -1],
    [-1, -1, -1, -1, -1, -1, -1, -1, -1, 6237212, 16635083, 14910060, 16554370, 4332561, -1, -1],
    [-1, -1, -1, -1, -1, -1, -1, -1, 6237212, 16635083, 14910060, 16554370, 4332561, -1, -1, -1],
    [-1, -1, 6237212, 6237212, -1, -1, -1, 6237212, 16554370, 14910060, 16554370, 4332561, -1, -1, -1, -1],
    [-1, -1, 6237212, 8403233, 6237212, -1, 6237212, 16554370, 14910060, 16554370, 4332561, -1, -1, -1, -1, -1],
    [-1, -1, -1, 6237212, 10243633, 4332561, 16554370, 10243633, 16554370, 4332561, -1, -1, -1, -1, -1, -1],
    [-1, -1, -1, 6237212, 10243633, 10243633, 8403233, 16554370, 4332561, -1, -1, -1, -1, -1, -1, -1],
    [-1, -1, -1, -1, 6237212, 8403233, 6237212, 4332561, -1, -1, -1, -1, -1, -1, -1, -1],
    [-1, -1, -1, 4797973, 6835742, 4332561, 6237212, 6237212, 4332561, -1, -1, -1, -1, -1, -1, -1],
    [-1, -1, 4797973, 9004839, 2629131, -1, 4332561, 4332561, 6237212, 4332561, -1, -1, -1, -1, -1, -1],
    [6237212, 6237212, 6835742, 2629131, -1, -1, -1, -1, 4332561, 4332561, -1, -1, -1, -1, -1, -1],
    [6237212, 8403233, 4332561, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [4332561, 4332561, 4332561, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]
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
    weapon.rotation.z = Math.atan2(-directionX, directionY);
    return weapon;
  }

  global.MinecraftWeapons = global.MinecraftWeapons || {};
  global.MinecraftWeapons.pickaxe = { create };
})(window);

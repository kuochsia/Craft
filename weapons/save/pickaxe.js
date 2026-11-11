(function (global) {
  function create(THREE) {
    const weapon = new THREE.Group();
    const handle = new THREE.MeshLambertMaterial({ color: 0x67401f });
    const handleLight = new THREE.MeshLambertMaterial({ color: 0x95602c });
    const gold = new THREE.MeshLambertMaterial({ color: 0xe6b923 });
    const goldLight = new THREE.MeshLambertMaterial({ color: 0xffe45c });
    const goldDark = new THREE.MeshLambertMaterial({ color: 0xb87912 });

    function box(width, height, depth, material, x, y, z) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      weapon.add(mesh);
    }

    box(0.14, 0.94, 0.14, handle, 0, 0.32, 0);
    box(0.045, 0.73, 0.15, handleLight, -0.035, 0.32, 0.078);

    box(0.86, 0.18, 0.2, gold, 0, 0.8, 0);
    for (const side of [-1, 1]) {
      box(0.2, 0.22, 0.2, gold, side * 0.34, 0.73, 0);
      box(0.16, 0.2, 0.2, gold, side * 0.46, 0.52, 0);
      box(0.16, 0.16, 0.21, goldDark, side * 0.46, 0.5, 0);
   //   box(0.16, 0.16, 0.21, goldLight, side * 0.31, 0.94, 0);
    }
    box(0.14, 0.15, 0.21, goldLight, 0, 0.94, 0);

    weapon.rotation.z = -0.2;
    return weapon;
  }

  global.MinecraftWeapons = global.MinecraftWeapons || {};
  global.MinecraftWeapons.pickaxe = { create };
})(window);

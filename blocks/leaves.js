(function (global) {
  'use strict';

  // Texture pixel-art 16x16 de feuilles de chêne Minecraft avec transparence découpée
  const G1 = '#386619'; // Vert foncé ombre
  const G2 = '#488220'; // Vert moyen
  const G3 = '#59a029'; // Vert classique
  const G4 = '#6bb832'; // Vert clair reflet
  const G5 = '#2c5013'; // Vert très sombre creux
  const G6 = '#79cb3a'; // Vert vif bourgeon
  const __ = null;      // Pixel transparent

  const leavesTexture = [
    [G2, G3, __, G1, G3, G4, __, G2, G3, G1, __, G4, G3, G2, __, G3],
    [G3, G4, G2, G3, __, G2, G1, G4, __, G3, G2, G1, __, G3, G4, G2],
    [__, G2, G1, __, G3, G4, G2, __, G1, G2, G4, G3, G2, __, G1, G3],
    [G1, G3, G4, G2, G1, __, G3, G2, G3, G4, __, G2, G1, G3, G2, __],
    [G3, __, G2, G3, G4, G2, __, G1, G2, __, G3, G1, G3, G4, G3, G1],
    [G4, G2, __, G1, G3, __, G2, G3, G4, G2, G1, __, G2, G1, __, G2],
    [__, G1, G3, G2, __, G3, G4, G1, __, G3, G2, G4, G3, __, G3, G4],
    [G2, G3, G4, __, G2, G1, __, G2, G3, G4, G2, __, G1, G2, G4, G2],
    [G3, __, G1, G2, G3, G4, G2, __, G1, G3, __, G2, G3, G4, G2, __],
    [G1, G2, G3, G4, __, G2, G1, G3, G2, __, G4, G3, G1, __, G3, G2],
    [__, G4, G2, __, G1, G3, G4, G2, __, G1, G2, G4, G2, G3, G1, __],
    [G2, G1, __, G3, G2, __, G1, G3, G4, G2, __, G3, G1, __, G2, G4],
    [G3, G4, G2, G1, G3, G4, G2, __, G2, G3, G4, G1, __, G3, G4, G2],
    [__, G2, G3, __, G1, G2, __, G3, G4, G1, __, G2, G3, G2, __, G1],
    [G1, __, G4, G2, G3, __, G2, G1, __, G3, G2, G4, G1, __, G3, G4],
    [G2, G3, G1, __, G4, G3, G2, G1, G3, G4, __, G1, G2, G3, G4, G2]
  ];

  const blockDef = {
    id: 'leaves',
    name: 'Feuilles de Chêne',
    category: 'nature',
    hardness: 0.2,
    sound: 'grass',
    transparent: true,
    opacity: 0.92,
    alphaTest: 0.35,
    roughness: 0.8,
    metalness: 0.0,
    textures: {
      all: leavesTexture
    }
  };

  function create(THREE, options = {}) {
    if (global.MinecraftBlocks && global.MinecraftBlocks.createBlockMesh) {
      return global.MinecraftBlocks.createBlockMesh(THREE, blockDef, options);
    }
    const size = options.size || 1.0;
    const geometry = new THREE.BoxGeometry(size, size, size);
    return new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({
      color: 0x4caf50,
      transparent: true,
      opacity: 0.9
    }));
  }

  blockDef.create = create;

  global.MinecraftBlocks = global.MinecraftBlocks || {};
  global.MinecraftBlocks.registry = global.MinecraftBlocks.registry || {};
  global.MinecraftBlocks.registry[blockDef.id] = blockDef;
  if (typeof global.MinecraftBlocks.register === 'function') {
    global.MinecraftBlocks.register(blockDef);
  }
})(window);

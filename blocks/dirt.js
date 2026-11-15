(function (global) {
  'use strict';

  const shades = ['#59402a', '#65492f', '#705235', '#795a3b', '#846342', '#674a30'];
  const all = [];
  for (let y = 0; y < 16; y++) {
    const row = [];
    for (let x = 0; x < 16; x++) {
      const hash = Math.abs(Math.sin((x + 13) * 12.9898 + (y + 7) * 78.233) * 43758.5453);
      row.push(shades[Math.floor((hash % 1) * shades.length)]);
    }
    all.push(row);
  }

  const blockDef = {
    id: 'dirt',
    name: 'Terre',
    category: 'nature',
    hardness: 0.5,
    sound: 'grass',
    transparent: false,
    opacity: 1,
    emissive: false,
    textures: { all }
  };

  global.MinecraftBlocks = global.MinecraftBlocks || {};
  if (typeof global.MinecraftBlocks.register === 'function') {
    global.MinecraftBlocks.register(blockDef);
  }
})(window);

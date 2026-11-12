/**
 * Minecraft 3D - Système & Registre des Blocs
 * Permet de définir, charger, texturer et manipuler des blocs 3D dans le monde Minecraft.
 */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'minecraft_3d_custom_blocks_v1';
  const blockMaterialsCache = new WeakMap();
  const sharedBlockMaterials = new WeakSet();

  // Palette standard Minecraft pour génération rapide
  const DEFAULT_PALETTE = {
    dirt: '#6d4d31',
    dirtDark: '#573d26',
    dirtLight: '#866043',
    grassTop: '#6cb33e',
    grassTopDark: '#528e2c',
    grassTopLight: '#83ce4e',
    stone: '#7a7a7a',
    stoneDark: '#5e5e5e',
    stoneLight: '#949494',
    woodBark: '#5b442b',
    woodBarkDark: '#43311e',
    woodBarkLight: '#745939',
    woodInside: '#a88854',
    woodInsideDark: '#8f7243',
    woodInsideLight: '#be9d68',
    brick: '#9c483b',
    brickDark: '#7d372d',
    brickMortar: '#c2b8a3',
    diamond: '#4eedea',
    diamondDark: '#29b8b5',
    gold: '#f7d23e',
    goldDark: '#cca31d',
    tntRed: '#c73024',
    tntWhite: '#eeeeee',
    obsidian: '#1b1228',
    obsidianPurple: '#3b2554'
  };

  /**
   * Convertit une grille de pixels 16x16 (tableau de chaînes hex ou null) en THREE.CanvasTexture
   */
  function createTextureFromPixels(THREE, pixels, width = 16, height = 16) {
    if (!THREE) {
      console.error('[MinecraftBlocks] THREE.js non chargé.');
      return null;
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (Array.isArray(pixels)) {
      for (let y = 0; y < height; y++) {
        const row = pixels[y];
        if (!row) continue;
        for (let x = 0; x < width; x++) {
          const color = Array.isArray(row) ? row[x] : row[x];
          if (color && color !== 'transparent') {
            ctx.fillStyle = color;
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
    } else if (typeof pixels === 'string' && pixels.startsWith('data:image')) {
      // Image data URL
      const img = new Image();
      img.src = pixels;
      ctx.drawImage(img, 0, 0, width, height);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    return texture;
  }

  /**
   * Génère les 6 matériaux Three.js pour un BoxGeometry (dans l'ordre +X, -X, +Y, -Y, +Z, -Z)
   */
  function createMaterials(THREE, blockDef) {
    if (!THREE) return [];
    const cachedMaterials = blockMaterialsCache.get(blockDef);
    if (cachedMaterials) return cachedMaterials;

    const textures = blockDef.textures || {};
    const hasSides = textures.side || textures.sides;
    const sideTexture = textures.side || textures.sides;

    // Ordre BoxGeometry Three.js :
    // 0: +X (Droite / Est)
    // 1: -X (Gauche / Ouest)
    // 2: +Y (Haut)
    // 3: -Y (Bas)
    // 4: +Z (Face / Sud)
    // 5: -Z (Arrière / Nord)
    const facePixels = [
      textures.right || sideTexture || textures.all || textures.top,
      textures.left || sideTexture || textures.all || textures.top,
      textures.top || textures.all,
      textures.bottom || textures.all || textures.top,
      textures.front || sideTexture || textures.all || textures.top,
      textures.back || sideTexture || textures.all || textures.top
    ];

    const isTransparent = Boolean(blockDef.transparent);
    const opacity = blockDef.opacity !== undefined ? blockDef.opacity : 1.0;
    const isEmissive = Boolean(blockDef.emissive);
    const emissiveColor = blockDef.emissiveColor || 0x000000;
    const emissiveIntensity = blockDef.emissiveIntensity !== undefined ? blockDef.emissiveIntensity : 0.8;
    const alphaTest = blockDef.alphaTest !== undefined ? blockDef.alphaTest : (isTransparent && opacity >= 0.85 ? 0.35 : 0);

    const materials = facePixels.map((face) => {
      const texture = createTextureFromPixels(THREE, face);
      const matConfig = {
        map: texture,
        transparent: isTransparent,
        opacity: opacity,
        alphaTest: alphaTest,
  //      roughness: blockDef.roughness !== undefined ? blockDef.roughness : 0.9,
  //      metalness: blockDef.metalness !== undefined ? blockDef.metalness : 0.05
      };

      if (isEmissive) {
        matConfig.emissive = new THREE.Color(emissiveColor);
        matConfig.emissiveIntensity = emissiveIntensity;
        matConfig.emissiveMap = texture;
      }

      // Matériau standard ou Lambert pour rester cohérent avec le style Three.js du projet
      const material = new THREE.MeshLambertMaterial(matConfig);
      sharedBlockMaterials.add(material);
      return material;
    });
    blockMaterialsCache.set(blockDef, materials);
    return materials;
  }

  /**
   * Crée un Mesh 3D pour un bloc
   */
  function createBlockMesh(THREE, blockDef, options = {}) {
    if (!THREE) return null;
    const size = options.size || 1.0;
    const geometry = new THREE.BoxGeometry(size, size, size);
    const materials = createMaterials(THREE, blockDef);
    const mesh = new THREE.Mesh(geometry, materials);

    mesh.castShadow = options.castShadow !== undefined ? options.castShadow : true;
    mesh.receiveShadow = options.receiveShadow !== undefined ? options.receiveShadow : true;
    mesh.userData.isMinecraftBlock = true;
    mesh.userData.blockId = blockDef.id;
    mesh.userData.blockDef = blockDef;

    if (options.position) {
      mesh.position.copy(options.position);
    }
    return mesh;
  }

  /**
   * Crée une icône 2.5D isométrique d'un bloc sur un canvas HTML et retourne un dataURL
   */
  function createBlockIcon(blockDef, size = 48) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    const textures = blockDef.textures || {};
    const topPixels = textures.top || textures.all;
    const sidePixels = textures.front || textures.side || textures.all || topPixels;
    const rightPixels = textures.right || textures.side || textures.all || topPixels;

    // Helper pour dessiner une face isométrique
    function getPixelColor(pixels, x, y) {
      if (!pixels || !pixels[y] || !pixels[y][x]) return null;
      return pixels[y][x];
    }

    // Si on n'a pas de pixels détaillés, on dessine un cube isométrique simple
    const cx = size / 2;
    const cy = size / 2 - 2;
    const r = size * 0.42;
    const h = r * 0.55;

    // Face supérieure (losange)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, cy - h);
    ctx.lineTo(cx + r, cy);
    ctx.lineTo(cx, cy + h);
    ctx.lineTo(cx - r, cy);
    ctx.closePath();
    ctx.fillStyle = blockDef.previewColor || '#76b62c';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Face gauche
    ctx.beginPath();
    ctx.moveTo(cx - r, cy);
    ctx.lineTo(cx, cy + h);
    ctx.lineTo(cx, cy + h + r);
    ctx.lineTo(cx - r, cy + r);
    ctx.closePath();
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fill();
    ctx.stroke();

    // Face droite
    ctx.beginPath();
    ctx.moveTo(cx, cy + h);
    ctx.lineTo(cx + r, cy);
    ctx.lineTo(cx + r, cy + r);
    ctx.lineTo(cx, cy + h + r);
    ctx.closePath();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Rendu pixelisé par échantillonnage 4x4 si pixels disponibles
    if (topPixels && Array.isArray(topPixels)) {
      const step = 4;
      const topCanvas = document.createElement('canvas');
      topCanvas.width = 16;
      topCanvas.height = 16;
      const tCtx = topCanvas.getContext('2d');
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const col = topPixels[y] ? topPixels[y][x] : null;
          if (col) {
            tCtx.fillStyle = col;
            tCtx.fillRect(x, y, 1, 1);
          }
        }
      }
      // On redessine le losange avec la texture transformée
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(1, 0.58);
      ctx.rotate(-Math.PI / 4);
      ctx.drawImage(topCanvas, -r * 0.68, -r * 0.68, r * 1.36, r * 1.36);
      ctx.restore();
    }

    return canvas.toDataURL('image/png');
  }

  /**
   * Registre central des blocs
   */
  const registry = {};

  function register(blockDef) {
    if (!blockDef || !blockDef.id) {
      console.warn('[MinecraftBlocks] Bloc invalide', blockDef);
      return;
    }
    registry[blockDef.id] = blockDef;
    if (!blockDef.icon) {
      blockDef.icon = createBlockIcon(blockDef);
    }
  }

  function get(id) {
    return registry[id] || null;
  }

  function getAll() {
    return Object.values(registry);
  }

  /**
   * Sauvegarde et persistance des blocs personnalisés dans le navigateur
   */
  function saveCustomBlock(blockDef) {
    if (!blockDef || !blockDef.id) return false;
    register(blockDef);
    try {
      const saved = loadSavedCustomBlocks();
      saved[blockDef.id] = blockDef;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
      return true;
    } catch (e) {
      console.error('[MinecraftBlocks] Erreur lors de la sauvegarde locale:', e);
      return false;
    }
  }

  function loadSavedCustomBlocks() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : {};
    } catch (e) {
      return {};
    }
  }

  function loadAllSaved() {
    const saved = loadSavedCustomBlocks();
    Object.values(saved).forEach((def) => {
      register(def);
    });
  }

  function deleteCustomBlock(id) {
    delete registry[id];
    try {
      const saved = loadSavedCustomBlocks();
      delete saved[id];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Génère le code JS propre pour exporter un bloc sous forme de fichier autonome
   */
  function generateBlockJS(blockDef) {
    const safeId = blockDef.id.replace(/[^a-zA-Z0-9_-]/g, '_');
    const jsonTextures = JSON.stringify(blockDef.textures, null, 2);
    return `(function (global) {
  'use strict';

  const blockDef = {
    id: ${JSON.stringify(blockDef.id)},
    name: ${JSON.stringify(blockDef.name || blockDef.id)},
    category: ${JSON.stringify(blockDef.category || 'construction')},
    hardness: ${blockDef.hardness !== undefined ? blockDef.hardness : 1.0},
    sound: ${JSON.stringify(blockDef.sound || 'stone')},
    transparent: ${Boolean(blockDef.transparent)},
    opacity: ${blockDef.opacity !== undefined ? blockDef.opacity : 1.0},
    emissive: ${Boolean(blockDef.emissive)},
    emissiveColor: ${blockDef.emissiveColor ? `0x${Number(blockDef.emissiveColor).toString(16).padStart(6, '0')}` : '0x000000'},
    emissiveIntensity: ${blockDef.emissiveIntensity !== undefined ? blockDef.emissiveIntensity : 0.8},
    roughness: ${blockDef.roughness !== undefined ? blockDef.roughness : 0.9},
    metalness: ${blockDef.metalness !== undefined ? blockDef.metalness : 0.05},
    textures: ${jsonTextures}
  };

  function create(THREE, options = {}) {
    if (global.MinecraftBlocks && global.MinecraftBlocks.createBlockMesh) {
      return global.MinecraftBlocks.createBlockMesh(THREE, blockDef, options);
    }
    const size = options.size || 1.0;
    const geometry = new THREE.BoxGeometry(size, size, size);
    const mat = new THREE.MeshLambertMaterial({ color: 0x888888 });
    return new THREE.Mesh(geometry, mat);
  }

  blockDef.create = create;

  global.MinecraftBlocks = global.MinecraftBlocks || {};
  global.MinecraftBlocks.registry = global.MinecraftBlocks.registry || {};
  global.MinecraftBlocks.registry[blockDef.id] = blockDef;
  if (typeof global.MinecraftBlocks.register === 'function') {
    global.MinecraftBlocks.register(blockDef);
  }
})(window);
`;
  }

  // Chargement automatique des blocs personnalisés stockés
  try {
    loadAllSaved();
  } catch (err) {
    // Ignore
  }

  // Export API publique
  global.MinecraftBlocks = {
    DEFAULT_PALETTE,
    createTextureFromPixels,
    createMaterials,
    createBlockMesh,
    isSharedBlockMaterial: (material) => sharedBlockMaterials.has(material),
    createBlockIcon,
    register,
    get,
    getAll,
    saveCustomBlock,
    loadSavedCustomBlocks,
    loadAllSaved,
    deleteCustomBlock,
    generateBlockJS,
    registry
  };

})(window);

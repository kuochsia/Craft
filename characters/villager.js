(function (global) {
  const VILLAGER_HEIGHT = 1.95;
  const MODEL_SOURCE_HEIGHT = 3.2;

  // Palette fidèle extraite de la texture Plains Villager JE2
  const palette = {
    s: '#86604e', // Peau (front, menton)
    d: '#674430', // Ombrage / joues
    u: '#231809', // Monosourcil sombre
    w: '#b6b6b7', // Blanc des yeux
    e: '#037105', // Vert émeraude des pupilles
    c: '#adaaa8', // Échancrure blanche du col sous le menton
    r: '#5f453e', // Tunique marron chiné
    l: '#755750', // Reflets clairs sur les manches
    k: '#2b1f1d', // Pli central / coutures sombres
    p: '#3b2a25', // Pantalon visible sous la robe
    g: '#505051', // Bottes grises de plaine
    b: '#383838'  // Semelle des bottes
  };

  function makeTexture(THREE, asset) {
    const canvas = document.createElement('canvas');
    canvas.width = asset.rows[0].length;
    canvas.height = asset.rows.length;
    const ctx = canvas.getContext('2d');

    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        ctx.fillStyle = asset.palette[asset.rows[y][x]];
        ctx.fillRect(x, y, 1, 1);
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    return texture;
  }

  function createVillager(THREE) {
    const root = new THREE.Group();
    root.scale.setScalar(VILLAGER_HEIGHT / MODEL_SOURCE_HEIGHT);

    // --- MATÉRIAUX DE BASE ---
    const skinMat = new THREE.MeshLambertMaterial({ color: 0x86604e });
    const robeMat = new THREE.MeshLambertMaterial({ color: 0x5f453e });
    const bootMat = new THREE.MeshLambertMaterial({ color: 0x505051 });

    // --- 1. TÊTE & NEZ 3D (8x10x8 pixels) ---
    // Texture de face 8x10 pixels
    const faceTex = makeTexture(THREE, {
      palette,
      rows: [
        'ssssssss', // Ligne 0 : Haut du front
        'ssssssss', // Ligne 1
        'ssssssss', // Ligne 2
        'ssssssss', // Ligne 3 : Bas du front
        'ssssssss', // Ligne 4 : Monosourcil complet
        'suuuuuus', // Ligne 5 : Yeux (blanc + émeraude)
        'swessews', // Ligne 6 : Haut des joues
        'dssssssd', // Ligne 7 : Joues ombrées
        'dsdssdsd', // Ligne 8 : Bouche / menton
        'dssssssd'  // Ligne 9 : Bord du menton avec liseré blanc du col
      ]
    });

    const headPivot = new THREE.Group();
    headPivot.position.set(0, 2.0, 0);

    const headMats = [
      skinMat, skinMat, skinMat, skinMat,
      new THREE.MeshLambertMaterial({ map: faceTex }),
      skinMat
    ];

    // Tête : 0.8 large, 1.0 haut (10 pixels), 0.8 profond
    const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, 0.8), headMats);
    headMesh.position.set(0, 0.5, 0);
    headMesh.castShadow = true;
    headPivot.add(headMesh);

    // Nez 3D (2x4x2 pixels)
    // Texture dédiée pour le nez avec arête et côtés ombrés
    const noseTex = makeTexture(THREE, {
      palette,
      rows: [
        'dd',
        'dd',
        'dd',
        'dd'
      ]
    });
    const noseSideTex = makeTexture(THREE, {
      palette,
      rows: [
        'dd',
        'dd',
        'dd',
        'dd'
      ]
    });
    const noseMats = [
      new THREE.MeshLambertMaterial({ map: noseSideTex }),
      new THREE.MeshLambertMaterial({ map: noseSideTex }),
      skinMat, skinMat,
      new THREE.MeshLambertMaterial({ map: noseTex }),
      skinMat
    ];

    const noseMesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.4, 0.2), noseMats);
    // Descend du niveau des yeux jusqu'à dépasser légèrement sous le menton
    noseMesh.position.set(0, 0.1, 0.5);
    noseMesh.castShadow = true;
    headPivot.add(noseMesh);

    root.add(headPivot);

    // --- 2. COL ET TORSE (ROBE LONGUE) ---
    // Texture de la robe : pli sombre central et fente verticale
    const robeFrontTex = makeTexture(THREE, {
      palette,
      rows: [
        'kksssskk', // Col
        'rkkkkkkr',
        'rrrkkrrr',
        'rrrkkrrr',
        'rrrkkrrr',
        'rrrkkrrr',
        'rrrkkrrr',
        'rrrkkrrr',
        'rrrkkrrr',
        'rrrkkrrr',
        'rrkrrkrr',
        'kkrrrrkk'  // Ourlet bas
      ]
    });

    // Torse et robe descendante
    const robeMats = [
      robeMat, robeMat, robeMat, robeMat,
      new THREE.MeshLambertMaterial({ map: robeFrontTex }),
      robeMat
    ];

    const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(0.84, 1.7, 0.54), robeMats);
    bodyMesh.position.set(0, 1.15, 0);
    bodyMesh.castShadow = true;
    root.add(bodyMesh);

    // --- 3. BRAS CROISÉS OFFICIELS MINECRAFT ---
    // Groupe incliné vers l'avant à ~43° (-0.75 rad)
    const armsPivot = new THREE.Group();
    armsPivot.position.set(0, 1.8, -0.05);
    armsPivot.rotation.x = -0.75;

    // Texture de face des bras croisés (16x4 pixels)
    const armsFrontTex = makeTexture(THREE, {
      palette,
      rows: [
        'llllrrrkrrrrrrll',
        'rrrrrrrkrrrrrrrr',
        'rrrlllrkrllrrrrr',
        'rlllllrkrlllllrr'
      ]
    });

    const armsMats = [
      robeMat, robeMat, robeMat, robeMat,
      new THREE.MeshLambertMaterial({ map: armsFrontTex }),
      robeMat
    ];

    // Manche gauche et droite (épaules descendantes)
    for (const side of [-1, 1]) {
      const shoulderMesh = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.8, 0.4), robeMat);
      shoulderMesh.position.set(side * 0.6, -0.2, 0);
      shoulderMesh.castShadow = true;
      armsPivot.add(shoulderMesh);
    }

    // Bloc horizontal central reliant les deux bras
    const crossMesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.4, 0.4), armsMats);
    crossMesh.position.set(0, -0.4, 0);
    crossMesh.castShadow = true;
    armsPivot.add(crossMesh);

    root.add(armsPivot);

    // --- 4. JAMBES & BOTTES GRISES ---
    // Bottes grises de plaine avec semelle sombre
    const bootTex = makeTexture(THREE, {
      palette,
      rows: [
        'pppp',
        'pppp',
        'pppp',
        'pppp',
        'gggg', // Début botte grise
        'gggg',
        'gggg',
        'bbbb'  // Semelle
      ]
    });

    const legMats = [
      bootMat, bootMat, bootMat, bootMat,
      new THREE.MeshLambertMaterial({ map: bootTex }),
      bootMat
    ];

    const legPivots = [];
    for (const side of [-1, 1]) {
      const legPivot = new THREE.Group();
      legPivot.position.set(side * 0.2, 0.6, 0);
      const legMesh = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.6, 0.38), legMats);
      legMesh.position.set(0, -0.3, 0);
      legMesh.castShadow = true;
      legPivot.add(legMesh);
      root.add(legPivot);
      legPivots.push(legPivot);
    }

    // --- 5. INTERFACE DE CONTRÔLE ---
    return {
      root,
      headPivot,
      noseMesh,
      armsPivot,
      legs: legPivots,
      isVillager: true,
      collisionRadius: 0.38,
      collisionHeight: VILLAGER_HEIGHT,

      lookAt: function (targetPos) {
        const local = targetPos.clone();
        root.worldToLocal(local);
        headPivot.rotation.y = THREE.MathUtils.clamp(-Math.atan2(local.x, local.z), -0.75, 0.75);
      },

      shakeNo: function (time) {
        headPivot.rotation.y = Math.sin(time * 10) * 0.3;
      },

      resetPose: function () {
        headPivot.rotation.set(0, 0, 0);
      }
    };
  }

  global.MinecraftCharacters = global.MinecraftCharacters || {};
  global.MinecraftCharacters.createVillager = createVillager;
})(window);

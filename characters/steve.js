(function (global) {
  const palette = {
    h: '#47210e',
    s: '#aa7c65',
    w: '#ffffff',
    e: '#2a4794',
    n: '#8c532d',
    g: '#00abaa',
    c: '#9e663a',
    p: '#44389e',
    q: '#382f84',
    t: '#656565'
  };

  const config = {
    isAlex: false,
    hair: 0x4a2d18,
    skin: 0xbc8458,
    shirt: 0x00a3a7,
    pants: 0x233777,
    armWidth: 0.4,
    face: {
      palette,
      rows: [
        'hhhhhhhh',
        'hhhhhhhh',
        'hssssssh',
        'ssssssss',
        'swessews',
        'sssnnsss',
        'sshsshss',
        'sshhhhss'
      ]
    },
    sideRight: {
      palette,
      rows: [
        'hhhhhhhh',
        'hhhhhhhh',
        'hhhhhhhh',
        'hhhhhhhh',
        'sshhhhhh',
        'sshhhhhh',
        'sssshhhh',
        'sssssshh'
      ]
    },
    sideLeft: {
      palette,
      rows: [
        'hhhhhhhh',
        'hhhhhhhh',
        'hhhhhhhh',
        'hhhhhhhh',
        'hhhhhhss',
        'hhhhssss',
        'hhhhssss',
        'hhssssss'
      ]
    },
    torso: {
      palette,
      rows: [
        'ggccccgg',
        'ggccccgg',
        'gggccggg',
        'gggggggg',
        'gggggggg',
        'gggggggg',
        'gggggggg',
        'gggggggg',
        'gggggggg',
        'gggggggg',
        'ppppppgg',
        'pppppppg'
      ]
    },
    arm: {
      palette,
      rows: ['gggg', 'gggg', 'gggg', 'ssss', 'ssss', 'ssss', 'ssss', 'ssss', 'ssss', 'ssss', 'ssss', 'ssss']
    },
    leg: {
      front: {
        palette,
        rows: ['pppp', 'pppp', 'pppp', 'pppp', 'pppp', 'pqqp', 'pppp', 'pppp', 'pppp', 'tttt', 'tttt', 'tttt']
      },
      back: {
        palette,
        rows: ['pppp', 'pppp', 'pppp', 'pppp', 'pppp', 'pppp', 'pppp', 'pppp', 'tttt', 'tttt', 'tttt', 'tttt']
      },
      left: {
        palette,
        rows: ['pppp', 'pppp', 'pppp', 'pppp', 'pppp', 'pppp', 'pppp', 'pppp', 'ttpp', 'tttt', 'tttt', 'tttt']
      },
      right: {
        palette,
        rows: ['pppp', 'pppp', 'pppp', 'pppp', 'pppp', 'pppp', 'pppp', 'pppp', 'pptt', 'tttt', 'tttt', 'tttt']
      }
    }
  };

  global.MinecraftCharacters = global.MinecraftCharacters || {};
  global.MinecraftCharacters.createSteve = function (THREE) {
    return global.MinecraftCharacterModel.build(THREE, config);
  };
})(window);

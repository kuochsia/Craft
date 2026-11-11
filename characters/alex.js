(function (global) {
  const palette = {
    h: '#d86b24',
    s: '#dbb594',
    n: '#be9573',
    m: '#5e5327',
    w: '#ffffff',
    e: '#2f8e43',
    m: '#b87c68',
    g: '#94ba67',
    b: '#28432a',
    p: '#823f2a',
    q: '#50271c',
    t: '#695754',
    r: '#2d2e35'
  };

  const config = {
    isAlex: true,
    hair: 0xd86b24,
    skin: 0xdbb594,
    shirt: 0x5d8935,
    pants: 0x5b3d26,
    armWidth: 0.3,
    face: {
      palette,
      rows: [
        'hhhhhhhh',
        'hhhhhhhh',
        'hhhhsshh',
        'hhhssssh',
        'swessews',
        'ssssssss',
        'sssmmsss',
        'ssssssss'
      ]
    },
    sideRight: {
      palette,
      rows: [
        'hhhhhhhh',
        'hhhhhhhh',
        'hhhhhhhh',
        'hhhhhhhh',
        'hhhhhhhh',
        'shhhhhhh',
        'sshhhhhh',
        'shhhhhhh'
      ]
    },
    sideLeft: {
      palette,
      rows: [
        'hhhhhhhh',
        'hhhhhhhh',
        'hhhhhhhh',
        'hhhhhssh',
        'hhhhssss',
        'hhhhssss',
        'hhhhssss',
        'hhhsssss'
      ]
    },
    torso: {
      palette,
      rows: [
        'gmnnnhhh',
        'gmnnnnhh',
        'ggmnnhhg',
        'gggmmhgg',
        'gggggggg',
        'gggggggg',
        'gggggggg',
        'gggggggg',
        'bggggggb',
        'bbbbbbbb',
        'gggggggg',
        'gppppppg'
      ]
    },
    arm: {
      palette,
      rows: ['ggg', 'ggg', 'ggg', 'mmm', 'sss', 'sss', 'sss', 'sss', 'sss', 'sss', 'sss', 'sss']
    },
    leg: {
      front: {
        palette,
        rows: ['pppp', 'pppp', 'pppp', 'pppp', 'pppp', 'pppp', 'rrrr', 'tttt', 'tttt', 'rrrr', 'tttt', 'tttt']
      },
      back: {
        palette,
        rows: ['pppp', 'pppp', 'pppp', 'pppp', 'pppp', 'rrrr', 'tttt', 'tttt', 'tttt', 'rrrr', 'tttt', 'tttt']
      },
      left: {
        palette,
        rows: ['pppp', 'pppp', 'pppp', 'pppp', 'pppp', 'rrrp', 'tttr', 'tttt', 'ttrt', 'tttr', 'tttt', 'tttt']
      },
      right: {
        palette,
        rows: ['pppp', 'pppp', 'pppp', 'pppp', 'pppp', 'prrr', 'rttt', 'tttt', 'trtt', 'rttt', 'tttt', 'tttt']
      }
    }
  };

  global.MinecraftCharacters = global.MinecraftCharacters || {};
  global.MinecraftCharacters.createAlex = function (THREE) {
    return global.MinecraftCharacterModel.build(THREE, config);
  };
})(window);

(function (global) {
  'use strict';

  // Liste complète des objets : Armes + Blocs de matières pour Alex et Steve
  const items = [
    { name: 'Mains nues', type: 'empty' },
    // Armes
    { id: 'pickaxe', name: 'Pioche', type: 'weapon' },
    { id: 'sword', name: 'Épée', type: 'weapon' },
    { id: 'axe', name: 'Hache', type: 'weapon' },
    { id: 'crossbow', name: 'Arbalète', type: 'weapon' },
    { id: 'flint_and_steel', name: 'Briquet', type: 'weapon' },
    // Blocs de construction & matières
    { id: 'grass', name: 'Herbe / Terre', type: 'block' },
    { id: 'stone', name: 'Pierre', type: 'block' },
    { id: 'oak_wood', name: 'Bûche', type: 'block' },
    { id: 'oak_planks', name: 'Planches', type: 'block' },
    { id: 'leaves', name: 'Feuilles', type: 'block' },
    { id: 'bricks', name: 'Briques', type: 'block' },
    { id: 'glass', name: 'Verre', type: 'block' },
    { id: 'diamond_ore', name: 'Diamant', type: 'block' },
    { id: 'gold_block', name: 'Or', type: 'block' },
    { id: 'tnt', name: 'TNT', type: 'block' },
    { id: 'obsidian', name: 'Obsidienne', type: 'block' },
    { id: 'magma', name: 'Magma', type: 'block' },
    { id: 'bookshelf', name: 'Bibliothèque', type: 'block' }
  ];

  function createInventory(character) {
    const charKey = character.toLowerCase();
    const inventory = document.createElement('section');
    inventory.className = `inventory inventory-${charKey}`;
    inventory.setAttribute('aria-label', character === 'Alex' ? "Inventaire d'Alex" : 'Inventaire de Steve');

    const header = document.createElement('div');
    header.className = 'inventory-header';

    const name = document.createElement('div');
    name.className = 'inventory-name';
    name.textContent = `${character.toUpperCase()} [${charKey === 'alex' ? 'R' : 'U'}]`;
    header.appendChild(name);

    const activeItemLabel = document.createElement('div');
    activeItemLabel.className = 'inventory-active-name';
    activeItemLabel.textContent = 'Mains nues';
    header.appendChild(activeItemLabel);

    inventory.appendChild(header);

    const slotsContainer = document.createElement('div');
    slotsContainer.className = 'inventory-slots';

    items.forEach((item, index) => {
      const slot = document.createElement('div');
      slot.className = `inventory-slot ${index === 0 ? 'selected' : ''}`;
      slot.title = `${item.name} (${charKey === 'alex' ? 'Touche R' : 'Touche U'} ou Clic)`;
      slot.setAttribute('data-index', String(index));

      // Événement clic direct pour sélectionner n'importe quel objet/bloc
      slot.addEventListener('click', () => {
        selectedSlots[charKey] = index;
        updateSelection(charKey);
      });

      if (item.type === 'weapon') {
        const weaponType = global.MinecraftWeapons ? global.MinecraftWeapons[item.id] : null;
        if (weaponType && weaponType.icon) {
          const icon = document.createElement('img');
          icon.alt = item.name;
          icon.src = weaponType.icon;
          slot.appendChild(icon);
        } else if (weaponType && typeof weaponType.preview === 'string') {
          const icon = document.createElement('img');
          icon.alt = item.name;
          icon.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(weaponType.preview)}`;
          slot.appendChild(icon);
        }
      } else if (item.type === 'block') {
        const blockDef = global.MinecraftBlocks ? global.MinecraftBlocks.get(item.id) : null;
        if (blockDef) {
          const iconSrc = blockDef.icon || (global.MinecraftBlocks.createBlockIcon ? global.MinecraftBlocks.createBlockIcon(blockDef) : '');
          if (iconSrc) {
            const icon = document.createElement('img');
            icon.alt = item.name;
            icon.src = iconSrc;
            slot.appendChild(icon);
          }
        }
      }

      slotsContainer.appendChild(slot);
    });

    inventory.appendChild(slotsContainer);
    document.body.appendChild(inventory);
    return inventory;
  }

  const inventories = {
    alex: createInventory('Alex'),
    steve: createInventory('Steve')
  };

  const selectedSlots = { alex: 0, steve: 0 };
  const characters = {};
  const heldModels = { alex: [], steve: [] };

  function updateSelection(character) {
    const selectedItem = items[selectedSlots[character]];
    const charObj = characters[character];

    if (charObj) {
      if (selectedItem.type === 'block') {
        // Le personnage tient un bloc : configuration d'armement pour bloc
        charObj.isHoldingBlock = true;
        charObj.selectedBlockId = selectedItem.id;
        charObj.currentWeaponId = null;
        charObj.weaponId = null;
        charObj.selectedItem = selectedItem;
        global.MinecraftCharacterModel.setWeapon(charObj, { armAngle: 68, motion: 'arc' });
      } else if (selectedItem.type === 'weapon') {
        // Le personnage tient une arme
        charObj.isHoldingBlock = false;
        charObj.selectedBlockId = null;
        charObj.currentWeaponId = selectedItem.id;
        charObj.weaponId = selectedItem.id;
        charObj.selectedItem = selectedItem;
        global.MinecraftCharacterModel.setWeapon(
          charObj,
          global.MinecraftWeapons ? global.MinecraftWeapons[selectedItem.id] : null
        );
      } else {
        // Mains nues
        charObj.isHoldingBlock = false;
        charObj.selectedBlockId = null;
        charObj.currentWeaponId = null;
        charObj.weaponId = null;
        charObj.selectedItem = selectedItem;
        global.MinecraftCharacterModel.setWeapon(charObj, null);
      }
    }

    // Mise à jour de l'affichage des cases
    const invEl = inventories[character];
    if (invEl) {
      const activeLabel = invEl.querySelector('.inventory-active-name');
      if (activeLabel) activeLabel.textContent = selectedItem.name;

      invEl.querySelectorAll('.inventory-slot').forEach((slot, index) => {
        const isSelected = index === selectedSlots[character];
        slot.classList.toggle('selected', isSelected);
        slot.setAttribute('aria-pressed', String(isSelected));

        const model = heldModels[character] ? heldModels[character][index] : null;
        if (model) model.visible = isSelected;
      });
    }
  }

  function setCharacters(alex, steve) {
    characters.alex = alex;
    characters.steve = steve;
    alex.characterName = 'alex';
    steve.characterName = 'steve';

    // Remplissage des modèles 3D tenus en main (armes ET blocs miniatures)
    for (const name of ['alex', 'steve']) {
      heldModels[name] = items.map((item) => {
        if (item.type === 'empty') return null;

        const grip = new global.THREE.Group();

        if (item.type === 'weapon') {
          const weaponType = global.MinecraftWeapons ? global.MinecraftWeapons[item.id] : null;
          if (!weaponType) return null;
          grip.rotation.x = Math.PI / 2;
          const weaponMesh = weaponType.create(global.THREE);
          grip.add(weaponMesh);
        } else if (item.type === 'block') {
          // Création d'un bloc miniature 3D dans la main
          const blockDef = global.MinecraftBlocks ? global.MinecraftBlocks.get(item.id) : null;
          if (!blockDef) return null;

          const miniBlock = global.MinecraftBlocks.createBlockMesh(global.THREE, blockDef, {
            size: 0.36,
            castShadow: true,
            receiveShadow: false
          });
          // Légère inclinaison isométrique pour valoriser les 3 faces du cube miniature
          miniBlock.rotation.set(0.2, 0.45, -0.1);
          miniBlock.position.set(0, 0.08, 0.05);
          grip.add(miniBlock);
        }

        grip.visible = false;
        characters[name].rightHand.add(grip);
        return grip;
      });

      // Rafraîchir les icônes de bloc dans les slots si elles ont été enregistrées après
      const invEl = inventories[name];
      if (invEl) {
        items.forEach((item, idx) => {
          if (item.type === 'block') {
            const slot = invEl.querySelector(`.inventory-slot[data-index="${idx}"]`);
            if (slot && !slot.querySelector('img')) {
              const def = global.MinecraftBlocks ? global.MinecraftBlocks.get(item.id) : null;
              if (def) {
                const iconSrc = def.icon || (global.MinecraftBlocks.createBlockIcon ? global.MinecraftBlocks.createBlockIcon(def) : '');
                if (iconSrc) {
                  const icon = document.createElement('img');
                  icon.alt = item.name;
                  icon.src = iconSrc;
                  slot.appendChild(icon);
                }
              }
            }
          }
        });
      }

      updateSelection(name);
    }
  }

  updateSelection('alex');
  updateSelection('steve');

  // Gestion des touches du clavier pour l'inventaire et les actions
  document.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    const key = event.key.toLowerCase();

    // Touches de cycle d'inventaire : R pour Alex, U pour Steve
    const selectionCharacter = key === 'r' ? 'alex' : key === 'u' ? 'steve' : null;
    if (selectionCharacter) {
      selectedSlots[selectionCharacter] = (selectedSlots[selectionCharacter] + 1) % items.length;
      updateSelection(selectionCharacter);
      return;
    }

    // Touches d'action : A pour Alex, I pour Steve
    const actionCharacter = key === 'a' ? 'alex' : key === 'i' ? 'steve' : null;
    if (actionCharacter && characters[actionCharacter]) {
      const charObj = characters[actionCharacter];
      charObj.weaponAttackHeld = true;
      charObj.weaponAttackRequested = Boolean(charObj.weaponConfig || charObj.isHoldingBlock);

      // Déclenche l'action (pose de bloc empilé si bloc tenu, ou frappe si arme/main)
      if (global.MinecraftBlockWorld && global.MinecraftBlockWorld.triggerAction) {
        global.MinecraftBlockWorld.triggerAction(charObj);
      }
    }
  });

  document.addEventListener('keyup', (event) => {
    const key = event.key.toLowerCase();
    const character = key === 'a' ? 'alex' : key === 'i' ? 'steve' : null;
    if (character && characters[character]) {
      characters[character].weaponAttackHeld = false;
    }
  });

  global.addEventListener('blur', () => {
    for (const character of Object.values(characters)) {
      if (character) character.weaponAttackHeld = false;
    }
  });

  global.MinecraftWeaponsInventory = { setCharacters, updateSelection, items };
})(window);

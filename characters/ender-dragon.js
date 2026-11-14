(function (global) {
  function create(THREE) {
    const root = new THREE.Group();
    const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0x17151b });
    const armorMaterial = new THREE.MeshLambertMaterial({ color: 0x292630 });
    const crestMaterial = new THREE.MeshLambertMaterial({
      color: 0x78358b,
      emissive: 0x24102b
    });
    const wingMaterial = new THREE.MeshLambertMaterial({
      color: 0x78358b,
      emissive: 0x24102b,
      side: THREE.DoubleSide
    });
    const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xe349ff });
    const pupilMaterial = new THREE.MeshBasicMaterial({ color: 0x16091c });
    const clawMaterial = new THREE.MeshLambertMaterial({ color: 0x09090d });

    function addBox(parent, width, height, depth, material, x, y, z) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    }

    function addBone(parent, start, end, thickness, material, depth = 0.22) {
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const length = Math.hypot(dx, dy);
      const bone = addBox(
        parent,
        length,
        thickness,
        depth,
        material,
        (start.x + end.x) / 2,
        (start.y + end.y) / 2,
        0
      );
      bone.rotation.z = Math.atan2(dy, dx);
      return bone;
    }

    const body = new THREE.Group();
    root.add(body);
    addBox(body, 1.8, 1.35, 3.8, bodyMaterial, 0, 3.65, 0);
    addBox(body, 2.05, 0.38, 2.3, armorMaterial, 0, 4.15, -0.1);
    addBox(body, 1.1, 0.55, 1.5, armorMaterial, 0, 3.55, 1.15);

    const neckSegments = [
      { z: 1.7, y: 3.95, size: 1.05 },
      { z: 2.65, y: 4.3, size: 0.9 },
      { z: 3.5, y: 4.65, size: 0.78 }
    ];
    neckSegments.forEach(({ z, y, size }) => {
      addBox(body, size, size, 1.05, bodyMaterial, 0, y, z);
      addBox(body, size * 0.36, 0.16, 0.65, crestMaterial, 0, y + size * 0.48, z);
    });

    const head = new THREE.Group();
    head.position.set(0, 4.8, 4.05);
    body.add(head);
    addBox(head, 1.35, 1.15, 1.25, bodyMaterial, 0, 0, 0);
    addBox(head, 0.96, 0.58, 0.85, bodyMaterial, 0, -0.34, 0.87);
    addBox(head, 0.28, 0.25, 0.3, armorMaterial, 0, -0.05, 1.22);
    for (const side of [-1, 1]) {
      addBox(head, 0.22, 0.18, 0.16, eyeMaterial, side * 0.47, 0.14, 0.64);
      addBox(head, 0.07, 0.13, 0.08, pupilMaterial, side * 0.47, 0.14, 0.73);
      addBox(head, 0.2, 0.62, 0.22, armorMaterial, side * 0.48, 0.78, -0.18)
        .rotation.z = side * -0.25;
      addBox(head, 0.18, 0.22, 0.75, armorMaterial, side * 0.57, 0.68, 0.25)
        .rotation.y = side * 0.35;
    }
    addBox(head, 0.52, 0.12, 0.2, clawMaterial, 0, -0.64, 0.93);

    for (let i = 0; i < 10; i++) {
      const progress = i / 9;
      const z = -2.05 - progress * 7.5;
      const size = 0.9 * (1 - progress * 0.78);
      const y = 3.65 - Math.sin(progress * Math.PI) * 0.35;
      addBox(body, size, size * 0.82, 0.95 - progress * 0.3, bodyMaterial, 0, y, z);
      if (i % 2 === 0 && i < 8) {
        addBox(body, 0.22, 0.32, 0.28, crestMaterial, 0, y + size * 0.56, z - 0.1);
      }
    }
    addBox(body, 0.18, 0.18, 0.8, bodyMaterial, 0, 3.65, -10.05);

    for (let i = 0; i < 6; i++) {
      const z = 1.05 - i * 0.53;
      const height = i % 2 === 0 ? 0.38 : 0.28;
      addBox(body, 0.32, height, 0.34, crestMaterial, 0, 4.34 + height / 2, z);
    }

    const legs = [];
    for (const side of [-1, 1]) {
      for (const z of [-1.25, 1.15]) {
        const leg = new THREE.Group();
        leg.position.set(side * 0.68, 3.15, z);
        body.add(leg);
        addBox(leg, 0.78, 0.8, 0.78, bodyMaterial, side * 0.13, 0.08, 0);
        addBox(leg, 0.62, 1.25, 0.58, bodyMaterial, side * 0.23, -0.82, 0.14);
        addBox(leg, 0.82, 0.22, 0.88, armorMaterial, side * 0.23, -1.48, 0.27);
        for (let claw = -1; claw <= 1; claw++) {
          addBox(leg, 0.16, 0.18, 0.42, clawMaterial, side * 0.23 + claw * 0.22, -1.54, 0.75);
        }
        legs.push(leg);
      }
    }

    const wings = [];
    for (const side of [-1, 1]) {
      const wing = new THREE.Group();
      wing.position.set(side * 0.82, 4.15, -0.45);
      wing.scale.x = side;
      wing.rotation.x = Math.PI / 2;
      body.add(wing);

      const outline = new THREE.Shape();
      outline.moveTo(0, 0);
      outline.quadraticCurveTo(1.45, 0.72, 3.05, 0.92);
      outline.quadraticCurveTo(5.55, 1.28, 7.55, 2.45);
      outline.lineTo(7.16, 1.35);
      outline.quadraticCurveTo(7.04, 1.12, 7.5, 0.72);
      outline.lineTo(6.55, 0.38);
      outline.quadraticCurveTo(6.32, 0.22, 6.85, -0.24);
      outline.lineTo(5.8, -0.37);
      outline.quadraticCurveTo(5.55, -0.48, 5.94, -0.96);
      outline.lineTo(4.85, -0.82);
      outline.quadraticCurveTo(4.45, -0.9, 4.58, -1.32);
      outline.lineTo(3.7, -1.02);
      outline.quadraticCurveTo(3.08, -0.95, 2.65, -1.25);
      outline.lineTo(1.4, -0.48);
      outline.closePath();
      const membrane = new THREE.Mesh(new THREE.ShapeGeometry(outline), wingMaterial);
      membrane.position.z = -0.12;
      membrane.castShadow = true;
      wing.add(membrane);

      const rootPoint = { x: 0, y: 0 };
      const tip = { x: 7.55, y: 2.45 };
      const fingers = [
        { x: 7.16, y: 1.35 },
        { x: 7.5, y: 0.72 },
        { x: 6.55, y: 0.38 },
        { x: 6.85, y: -0.24 },
        { x: 5.8, y: -0.37 },
        { x: 5.94, y: -0.96 },
        { x: 4.85, y: -0.82 },
        { x: 3.7, y: -1.02 }
      ];
      addBone(wing, rootPoint, tip, 0.3, armorMaterial, 0.28);
      fingers.forEach((point, index) => {
        addBone(
          wing,
          {
            x: 1.15 + index * 0.38,
            y: 0.22 - index * 0.13
          },
          point,
          index < 2 ? 0.17 : 0.13,
          bodyMaterial,
          0.24
        );
      });
      addBone(wing, { x: 0.1, y: 0.08 }, { x: 3.7, y: -1.02 }, 0.24, armorMaterial, 0.28);
      wings.push(wing);
    }

    root.position.set(7, 4.5, -22);
    const flight = {
      waypoint: null,
      waitTime: 0,
      facingPlayers: false,
      faceTime: 0,
      pauseCooldown: 0,
      conversation: false,
      landed: false
    };

    function chooseWaypoint(targetX, targetZ) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 11 + Math.random() * 18;
      flight.waypoint = new THREE.Vector3(
        targetX + Math.cos(angle) * radius,
        3.5 + Math.random() * 3,
        targetZ + Math.sin(angle) * radius
      );
      flight.waitTime = 0;
    }

    function turnToward(yaw, delta) {
      const difference = Math.atan2(
        Math.sin(yaw - root.rotation.y),
        Math.cos(yaw - root.rotation.y)
      );
      root.rotation.y += THREE.MathUtils.clamp(difference, -1.8 * delta, 1.8 * delta);
    }

    chooseWaypoint(0, 0);

    root.userData.update = function (time, delta, targetX, targetZ) {
      const frameDelta = Math.min(delta, 0.05);
      wings[0].rotation.z = 0.12 + Math.sin(time * 2.2) * 0.22;
      wings[1].rotation.z = -0.12 - Math.sin(time * 2.2) * 0.22;
      legs[0].rotation.x = Math.sin(time * 2.2) * 0.08;
      legs[1].rotation.x = -Math.sin(time * 2.2) * 0.08;
      legs[2].rotation.x = -Math.sin(time * 2.2) * 0.08;
      legs[3].rotation.x = Math.sin(time * 2.2) * 0.08;

      if (flight.conversation) {
        const landingX = targetX;
        const landingZ = targetZ - 7;
        const dx = landingX - root.position.x;
        const dz = landingZ - root.position.z;
        const distance = Math.hypot(dx, dz);
        if (distance > 0.12) {
          const step = Math.min(4.2 * frameDelta, distance);
          root.position.x += (dx / distance) * step;
          root.position.z += (dz / distance) * step;
        }
        root.position.y = Math.max(-1.5, root.position.y - 4.2 * frameDelta);
        turnToward(Math.atan2(targetX - root.position.x, targetZ - root.position.z), frameDelta);
        root.rotation.x = 0;
        body.position.y = Math.sin(time * 1.4) * 0.05;
        head.rotation.x = Math.sin(time * 3.5) * 0.045;
        flight.landed = distance <= 0.2 && root.position.y <= -1.45;
        return;
      }

      body.position.y = Math.sin(time * 1.4) * 0.18;
      head.rotation.x = 0;

      const playerDirectionX = targetX - root.position.x;
      const playerDirectionZ = targetZ - root.position.z;
      const distanceToPlayers = Math.hypot(playerDirectionX, playerDirectionZ);
      flight.pauseCooldown = Math.max(0, flight.pauseCooldown - frameDelta);

      if (!flight.facingPlayers && flight.pauseCooldown === 0 && distanceToPlayers < 16) {
        flight.facingPlayers = true;
        flight.faceTime = 2.5 + Math.random() * 1.5;
        flight.waitTime = 0;
      }

      if (flight.facingPlayers) {
        turnToward(Math.atan2(playerDirectionX, playerDirectionZ), frameDelta);
        flight.faceTime -= frameDelta;
        if (flight.faceTime <= 0 || distanceToPlayers > 21) {
          flight.facingPlayers = false;
          flight.pauseCooldown = 3;
          chooseWaypoint(targetX, targetZ);
        }
      } else {
        if (flight.waitTime > 0) {
          flight.waitTime -= frameDelta;
          if (flight.waitTime <= 0) chooseWaypoint(targetX, targetZ);
        } else if (flight.waypoint) {
          const direction = flight.waypoint.clone().sub(root.position);
          const distanceToWaypoint = direction.length();
          if (distanceToWaypoint < 1.5) {
            flight.waitTime = 0.5 + Math.random() * 1.2;
            flight.waypoint = null;
          } else {
            direction.normalize();
            root.position.addScaledVector(direction, Math.min(5.5 * frameDelta, distanceToWaypoint));
            const horizontalDistance = Math.hypot(direction.x, direction.z);
            turnToward(Math.atan2(direction.x, direction.z), frameDelta);
            root.rotation.x = THREE.MathUtils.clamp(-Math.atan2(direction.y, horizontalDistance), -0.3, 0.3);
          }
        } else {
          chooseWaypoint(targetX, targetZ);
        }
      }
    };

    root.userData.startConversation = function () {
      flight.conversation = true;
      flight.landed = false;
      flight.waypoint = null;
      flight.facingPlayers = true;
    };
    root.userData.resumeRandomFlight = function (targetX, targetZ) {
      flight.conversation = false;
      flight.landed = false;
      flight.facingPlayers = false;
      flight.pauseCooldown = 0;
      chooseWaypoint(targetX, targetZ);
    };
    root.userData.isReadyToTalk = function (targetX, targetZ) {
      const desiredYaw = Math.atan2(targetX - root.position.x, targetZ - root.position.z);
      const yawDifference = Math.atan2(
        Math.sin(desiredYaw - root.rotation.y),
        Math.cos(desiredYaw - root.rotation.y)
      );
      return flight.landed && Math.abs(yawDifference) < 0.12;
    };

    return root;
  }

  global.EnderDragon = { create };
})(window);

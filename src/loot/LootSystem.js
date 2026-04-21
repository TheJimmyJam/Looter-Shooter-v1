import * as THREE from 'three';
import { getTerrainHeight } from '../world/World.js';

const PICKUP_RANGE = 2.2;
const INTERACT_RANGE = 3.5;
const FLOAT_SPEED = 1.5;
const FLOAT_AMP = 0.18;

const ITEM_CONFIG = {
  crystal:  { color: 0xa78bfa, emissive: 0x7c3aed, icon: '💎', label: 'Crystal Shard',   geo: 'octahedron' },
  scrap:    { color: 0x9ca3af, emissive: 0x4b5563, icon: '⚙️',  label: 'Metal Scrap',     geo: 'box' },
  health:   { color: 0x34d399, emissive: 0x059669, icon: '💊',  label: 'Med Pack (+25HP)', geo: 'sphere' },
  ore:      { color: 0xf59e0b, emissive: 0xb45309, icon: '🪨',  label: 'Ore Chunk',        geo: 'octahedron' },
};

export class LootSystem {
  constructor(scene, world, player) {
    this.scene = scene;
    this.world = world;
    this.player = player;
    this.drops = [];      // enemy loot drops
    this.time = 0;

    // Setup resource node interaction
    this.interactCooldown = 0;
  }

  // Called by enemies on death — spawns glowing loot orbs
  spawnDrop(position, type, count = 1) {
    for (let i = 0; i < count; i++) {
      const config = ITEM_CONFIG[type] || ITEM_CONFIG.scrap;

      let geo;
      if (config.geo === 'octahedron') geo = new THREE.OctahedronGeometry(0.22, 0);
      else if (config.geo === 'sphere') geo = new THREE.SphereGeometry(0.22, 5, 5);
      else geo = new THREE.BoxGeometry(0.22, 0.22, 0.22);

      const mat = new THREE.MeshLambertMaterial({
        color: config.color,
        flatShading: true,
        emissive: config.emissive,
        emissiveIntensity: 0.5,
      });

      const mesh = new THREE.Mesh(geo, mat);

      // Offset slightly so multiple drops don't stack
      const ox = (Math.random() - 0.5) * 1.5;
      const oz = (Math.random() - 0.5) * 1.5;
      const groundY = getTerrainHeight(position.x + ox, position.z + oz);
      mesh.position.set(position.x + ox, groundY + 0.6, position.z + oz);

      // Glow
      const light = new THREE.PointLight(config.color, 0.7, 3.5);
      light.position.copy(mesh.position);
      this.scene.add(light);

      this.scene.add(mesh);
      this.drops.push({
        mesh,
        light,
        type,
        config,
        baseY: groundY + 0.6,
        phaseOffset: Math.random() * Math.PI * 2,
        collected: false,
      });
    }
  }

  update(delta, player) {
    this.time += delta;
    this.interactCooldown = Math.max(0, this.interactCooldown - delta);

    const playerPos = player.camera.position;

    // Update floating drops
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const drop = this.drops[i];
      if (drop.collected) {
        this.drops.splice(i, 1);
        continue;
      }

      // Float animation
      const floatY = drop.baseY + Math.sin(this.time * FLOAT_SPEED + drop.phaseOffset) * FLOAT_AMP;
      drop.mesh.position.y = floatY;
      drop.light.position.copy(drop.mesh.position);
      drop.mesh.rotation.y += delta * 1.5;

      // Proximity pickup
      const dist = drop.mesh.position.distanceTo(playerPos);
      if (dist < PICKUP_RANGE) {
        this.collectDrop(drop, player);
      }
    }

    // Resource node interaction (E key, once per press)
    if (player.controls.keys.interact && this.interactCooldown <= 0) {
      this.interactCooldown = 0.8;
      this.tryHarvestNode(playerPos, player);
    }
  }

  collectDrop(drop, player) {
    drop.collected = true;
    this.scene.remove(drop.mesh);
    this.scene.remove(drop.light);

    // Apply effect
    if (drop.type === 'health') {
      player.heal(25);
    }
    player.addItem(drop.type, 1);

    // HUD notification
    this.showLootNotification(drop.config.icon, drop.config.label, drop.type);
  }

  tryHarvestNode(playerPos, player) {
    let closest = null;
    let closestDist = INTERACT_RANGE;

    for (const node of this.world.resourceNodes) {
      if (node.userData.collected) continue;
      const dist = node.position.distanceTo(playerPos);
      if (dist < closestDist) {
        closestDist = dist;
        closest = node;
      }
    }

    if (closest) {
      closest.userData.collected = true;

      // Dim the crystal node
      closest.traverse(child => {
        if (child.isMesh) {
          child.material.emissiveIntensity = 0.05;
          child.material.color.multiplyScalar(0.4);
        }
        if (child.isLight) child.intensity = 0;
      });

      // Spawn crystal drops
      const count = 2 + Math.floor(Math.random() * 3);
      this.spawnDrop(closest.position, 'crystal', count);

      // Respawn node after 45s
      setTimeout(() => {
        if (closest) {
          closest.userData.collected = false;
          closest.traverse(child => {
            if (child.isMesh) {
              child.material.emissiveIntensity = 0.4;
            }
            if (child.isLight) child.intensity = 0.8;
          });
        }
      }, 45000);

      this.showLootNotification('💎', `Crystal Deposit (+${count})`, 'crystal');
    }
  }

  showLootNotification(icon, label, type) {
    const log = document.getElementById('loot-log');
    if (!log) return;

    const el = document.createElement('div');
    el.className = `loot-item ${type}`;
    el.textContent = `${icon} ${label}`;
    log.appendChild(el);

    setTimeout(() => el.remove(), 2600);
  }

  reset() {
    for (const drop of this.drops) {
      this.scene.remove(drop.mesh);
      this.scene.remove(drop.light);
    }
    this.drops = [];
  }
}

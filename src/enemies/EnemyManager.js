import * as THREE from 'three';
import { Enemy } from './Enemy.js';
import { getTerrainHeight } from '../world/World.js';

const MAX_ENEMIES = 16;
const SPAWN_INTERVAL = 8; // seconds between spawn waves
const MIN_SPAWN_DIST = 25;
const MAX_SPAWN_DIST = 70;

export class EnemyManager {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.enemies = [];
    this.spawnTimer = 3; // first wave at 3s
    this.camera = null; // set by Game after creation

    this.initialSpawn();
  }

  initialSpawn() {
    // Seed the world with enemies right away
    for (let i = 0; i < 8; i++) {
      this.spawnEnemy('scavenger');
    }
    for (let i = 0; i < 2; i++) {
      this.spawnEnemy('brute');
    }
  }

  spawnEnemy(type = null) {
    if (this.enemies.length >= MAX_ENEMIES) return;

    const eType = type || (Math.random() < 0.25 ? 'brute' : 'scavenger');
    const angle = Math.random() * Math.PI * 2;
    const dist = MIN_SPAWN_DIST + Math.random() * (MAX_SPAWN_DIST - MIN_SPAWN_DIST);
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    const y = getTerrainHeight(x, z);

    const enemy = new Enemy(this.scene, eType);
    enemy.setPosition(x, y, z);
    this.enemies.push(enemy);
  }

  update(delta, player, lootSystem) {
    this.camera = player.camera || null;

    // Spawn timer
    this.spawnTimer -= delta;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = SPAWN_INTERVAL;
      const needed = MAX_ENEMIES - this.enemies.length;
      const toSpawn = Math.min(needed, 3);
      for (let i = 0; i < toSpawn; i++) this.spawnEnemy();
    }

    const playerPos = player.camera.position;

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];

      if (enemy.removed) {
        this.enemies.splice(i, 1);
        player.kills++;
        continue;
      }

      enemy.update(delta, playerPos, lootSystem);

      // Update health bar to face camera
      enemy.updateHealthBar(player.camera);

      // Check if enemy attacks player this frame
      if (enemy.consumeAttack()) {
        player.takeDamage(enemy.damage);
      }
    }
  }

  // Returns all hittable meshes for raycasting
  getHitMeshes() {
    const meshes = [];
    for (const enemy of this.enemies) {
      if (!enemy.isDead) meshes.push(...enemy.hitMeshes);
    }
    return meshes;
  }

  reset() {
    for (const enemy of this.enemies) {
      if (!enemy.removed) enemy.removeFromScene();
    }
    this.enemies = [];
    this.spawnTimer = 3;
    this.initialSpawn();
  }
}

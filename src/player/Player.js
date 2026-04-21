import * as THREE from 'three';
import { getTerrainHeight } from '../world/World.js';

const EYE_HEIGHT = 1.65;
const MOVE_SPEED = 8;
const SPRINT_MULT = 1.7;
const JUMP_FORCE = 7;
const GRAVITY = -20;

export class Player {
  constructor(scene, camera, controls, world) {
    this.scene = scene;
    this.camera = camera;
    this.controls = controls;
    this.world = world;

    // Store camera reference so other systems can access it via player.camera
    this.camera = camera;

    // Position — camera IS the player (first-person)
    this.position = new THREE.Vector3(0, EYE_HEIGHT, 0);
    this.velocity = new THREE.Vector3();

    // Physics
    this.onGround = true;
    this.justJumped = false;

    // Stats
    this.maxHealth = 100;
    this.health = 100;
    this.isDead = false;
    this.kills = 0;

    // Inventory: map of itemType -> count
    this.inventory = new Map();

    // Working vectors (avoid allocations in hot path)
    this._forward = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._move = new THREE.Vector3();

    // Start position
    camera.position.copy(this.position);

    // Damage cooldown (invincibility frames)
    this.damageCooldown = 0;
  }

  update(delta) {
    if (this.isDead) return;

    // Damage cooldown
    if (this.damageCooldown > 0) this.damageCooldown -= delta;

    this.handleMovement(delta);
    this.handleGravity(delta);
    this.snapToTerrain();

    // Sync camera
    this.camera.position.copy(this.position);
  }

  handleMovement(delta) {
    const k = this.controls.keys;
    const speed = MOVE_SPEED * (k.sprint ? SPRINT_MULT : 1);

    // Get forward/right from camera yaw only (no pitch for movement)
    this.camera.getWorldDirection(this._forward);
    this._forward.y = 0;
    this._forward.normalize();

    this._right.crossVectors(this._forward, new THREE.Vector3(0, 1, 0));

    this._move.set(0, 0, 0);
    if (k.forward) this._move.add(this._forward);
    if (k.back)    this._move.sub(this._forward);
    if (k.right)   this._move.add(this._right);
    if (k.left)    this._move.sub(this._right);

    if (this._move.lengthSq() > 0) {
      this._move.normalize().multiplyScalar(speed * delta);
      this.position.x += this._move.x;
      this.position.z += this._move.z;

      // World boundary clamp
      const half = this.world.size / 2 - 3;
      this.position.x = Math.max(-half, Math.min(half, this.position.x));
      this.position.z = Math.max(-half, Math.min(half, this.position.z));
    }

    // Jump
    if (k.jump && this.onGround && !this.justJumped) {
      this.velocity.y = JUMP_FORCE;
      this.onGround = false;
      this.justJumped = true;
    }
    if (!k.jump) this.justJumped = false;
  }

  handleGravity(delta) {
    if (!this.onGround) {
      this.velocity.y += GRAVITY * delta;
      this.position.y += this.velocity.y * delta;
    }
  }

  snapToTerrain() {
    const groundY = getTerrainHeight(this.position.x, this.position.z) + EYE_HEIGHT;

    if (this.position.y <= groundY) {
      this.position.y = groundY;
      this.velocity.y = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }
  }

  takeDamage(amount) {
    if (this.isDead || this.damageCooldown > 0) return;
    this.health = Math.max(0, this.health - amount);
    this.damageCooldown = 0.5; // 500ms invincibility

    // Flash damage vignette
    const vignette = document.getElementById('damage-vignette');
    if (vignette) {
      vignette.classList.add('active');
      setTimeout(() => vignette.classList.remove('active'), 250);
    }

    if (this.health <= 0) {
      this.die();
    }
  }

  heal(amount) {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  die() {
    this.isDead = true;
    this.health = 0;
  }

  respawn() {
    this.health = this.maxHealth;
    this.isDead = false;
    this.kills = 0;
    this.velocity.set(0, 0, 0);
    this.position.set(0, EYE_HEIGHT, 0);
    this.camera.position.copy(this.position);
    this.inventory.clear();
    this.damageCooldown = 0;
  }

  addItem(type, count = 1) {
    this.inventory.set(type, (this.inventory.get(type) || 0) + count);
  }

  getInventoryList() {
    return Array.from(this.inventory.entries()).map(([type, count]) => ({ type, count }));
  }
}

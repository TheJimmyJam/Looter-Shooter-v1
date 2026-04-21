import * as THREE from 'three';
import { getTerrainHeight } from '../world/World.js';

const STATES = { IDLE: 0, PATROL: 1, CHASE: 2, ATTACK: 3, DEAD: 4 };

export class Enemy {
  constructor(scene, type = 'scavenger') {
    this.scene = scene;
    this.type = type;
    this.state = STATES.PATROL;

    // Stats per type
    if (type === 'brute') {
      this.maxHealth = 80;
      this.health = 80;
      this.speed = 3.2;
      this.damage = 18;
      this.detectionRange = 22;
      this.attackRange = 2.2;
      this.attackCooldown = 1.8;
      this.xpValue = 3;
    } else { // scavenger
      this.maxHealth = 30;
      this.health = 30;
      this.speed = 4.8;
      this.damage = 8;
      this.detectionRange = 18;
      this.attackRange = 1.8;
      this.attackCooldown = 1.2;
      this.xpValue = 1;
    }

    this.attackTimer = 0;
    this.stateTimer = 0;
    this.patrolDir = new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();

    this.isDead = false;
    this.deathTimer = 0;
    this.deathDuration = 0.6;

    this.group = new THREE.Group();
    this.buildMesh();
    this.scene.add(this.group);

    // Build health bar in world space
    this.buildHealthBar();

    // Temp vectors
    this._toPlayer = new THREE.Vector3();
    this._flatPos = new THREE.Vector3();
    this._flatPlayer = new THREE.Vector3();
  }

  buildMesh() {
    const isbrute = this.type === 'brute';
    const scale = isbrute ? 1.45 : 1.0;

    // Body
    const bodyGeo = new THREE.BoxGeometry(0.7 * scale, 0.9 * scale, 0.45 * scale);
    const bodyMat = new THREE.MeshLambertMaterial({
      color: isbrute ? 0x7c1a1a : 0x2d4a2d,
      flatShading: true
    });
    this.bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    this.bodyMesh.position.y = 1.2 * scale;
    this.bodyMesh.castShadow = true;
    this.bodyMesh.userData.enemy = this;
    this.group.add(this.bodyMesh);

    // Head
    const headGeo = new THREE.BoxGeometry(0.5 * scale, 0.5 * scale, 0.5 * scale);
    const headMat = new THREE.MeshLambertMaterial({
      color: isbrute ? 0x5c1010 : 0x1e3a1e,
      flatShading: true
    });
    this.headMesh = new THREE.Mesh(headGeo, headMat);
    this.headMesh.position.y = 1.9 * scale;
    this.headMesh.castShadow = true;
    this.headMesh.userData.enemy = this;
    this.group.add(this.headMesh);

    // Eyes (glowing)
    const eyeGeo = new THREE.SphereGeometry(0.06 * scale, 4, 4);
    const eyeMat = new THREE.MeshLambertMaterial({
      color: isbrute ? 0xff2200 : 0xffaa00,
      emissive: isbrute ? 0xff2200 : 0xffaa00,
      emissiveIntensity: 1.0,
      flatShading: true
    });
    [-0.12, 0.12].forEach(xOff => {
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(xOff * scale, 1.92 * scale, 0.24 * scale);
      this.group.add(eye);
    });

    // Arms
    const armGeo = new THREE.BoxGeometry(0.2 * scale, 0.75 * scale, 0.2 * scale);
    const armMat = bodyMat.clone();
    [-0.48, 0.48].forEach(xOff => {
      const arm = new THREE.Mesh(armGeo, armMat);
      arm.position.set(xOff * scale, 1.1 * scale, 0);
      arm.userData.enemy = this;
      this.group.add(arm);
      if (xOff < 0) this.leftArm = arm;
      else this.rightArm = arm;
    });

    // Legs
    const legGeo = new THREE.BoxGeometry(0.28 * scale, 0.7 * scale, 0.28 * scale);
    const legMat = new THREE.MeshLambertMaterial({
      color: isbrute ? 0x3a0a0a : 0x0f2a0f,
      flatShading: true
    });
    [-0.2, 0.2].forEach(xOff => {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(xOff * scale, 0.45 * scale, 0);
      leg.userData.enemy = this;
      this.group.add(leg);
      if (xOff < 0) this.leftLeg = leg;
      else this.rightLeg = leg;
    });

    // Eye glow light
    const glow = new THREE.PointLight(isbrute ? 0xff2200 : 0xffaa00, 0.5, 4);
    glow.position.y = 1.9 * scale;
    this.group.add(glow);

    // Collect all hittable meshes
    this.hitMeshes = [this.bodyMesh, this.headMesh];
  }

  buildHealthBar() {
    // Use a sprite-like canvas texture for health bar
    this.healthBarGroup = new THREE.Group();
    this.healthBarGroup.position.y = this.type === 'brute' ? 3.5 : 2.5;

    // Background
    const bgGeo = new THREE.PlaneGeometry(1.2, 0.18);
    const bgMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a, depthTest: false });
    this.healthBarBg = new THREE.Mesh(bgGeo, bgMat);
    this.healthBarGroup.add(this.healthBarBg);

    // Foreground (health)
    const fgGeo = new THREE.PlaneGeometry(1.2, 0.18);
    const fgMat = new THREE.MeshBasicMaterial({ color: 0x22c55e, depthTest: false });
    this.healthBarFg = new THREE.Mesh(fgGeo, fgMat);
    this.healthBarFg.position.z = 0.001;
    this.healthBarGroup.add(this.healthBarFg);

    this.group.add(this.healthBarGroup);
  }

  updateHealthBar(camera) {
    if (!this.healthBarGroup || this.isDead) return;
    // Face camera
    this.healthBarGroup.lookAt(camera.position);

    const pct = this.health / this.maxHealth;
    this.healthBarFg.scale.x = Math.max(0, pct);
    this.healthBarFg.position.x = -(1 - pct) * 0.6;
    this.healthBarFg.material.color.setHex(
      pct > 0.5 ? 0x22c55e : pct > 0.25 ? 0xf59e0b : 0xef4444
    );
  }

  setPosition(x, y, z) {
    this.group.position.set(x, y, z);
  }

  getPosition() {
    return this.group.position;
  }

  takeDamage(amount, isHeadshot = false) {
    if (this.isDead) return;
    const dmg = isHeadshot ? amount * 2 : amount;
    this.health = Math.max(0, this.health - dmg);
    if (this.health <= 0) this.die();
  }

  die() {
    if (this.isDead) return;
    this.isDead = true;
    this.state = STATES.DEAD;
    this.health = 0;
    this.deathTimer = 0;

    // Hide health bar immediately
    if (this.healthBarGroup) this.healthBarGroup.visible = false;
  }

  update(delta, playerPos, lootSystem) {
    if (this.isDead) {
      this.updateDeath(delta, lootSystem);
      return;
    }

    this.stateTimer += delta;
    this.attackTimer = Math.max(0, this.attackTimer - delta);

    const dist = this.group.position.distanceTo(playerPos);

    // State transitions
    switch (this.state) {
      case STATES.PATROL:
        if (dist < this.detectionRange) this.state = STATES.CHASE;
        if (this.stateTimer > 3 + Math.random() * 2) {
          this.patrolDir.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
          this.stateTimer = 0;
        }
        break;

      case STATES.CHASE:
        if (dist > this.detectionRange * 1.4) this.state = STATES.PATROL;
        if (dist < this.attackRange) this.state = STATES.ATTACK;
        break;

      case STATES.ATTACK:
        if (dist > this.attackRange * 1.5) this.state = STATES.CHASE;
        break;
    }

    // Behaviour
    switch (this.state) {
      case STATES.PATROL:
        this.moveInDirection(this.patrolDir, this.speed * 0.5 * delta);
        this.animateWalk(delta, 0.5);
        break;

      case STATES.CHASE:
        this._toPlayer.copy(playerPos).sub(this.group.position).normalize();
        this._toPlayer.y = 0;
        this.moveInDirection(this._toPlayer, this.speed * delta);
        this.animateWalk(delta, 1.0);
        break;

      case STATES.ATTACK:
        // Face player
        this._toPlayer.copy(playerPos).sub(this.group.position);
        this._toPlayer.y = 0;
        if (this._toPlayer.lengthSq() > 0.001) {
          this.group.lookAt(
            this.group.position.x + this._toPlayer.x,
            this.group.position.y,
            this.group.position.z + this._toPlayer.z
          );
        }
        this.animateAttack(delta);

        if (this.attackTimer <= 0) {
          this.attackTimer = this.attackCooldown;
          // Damage returned — Game/Weapon checks this
          this._dealingDamage = true;
        }
        break;
    }

    // Snap to terrain
    const groundY = getTerrainHeight(this.group.position.x, this.group.position.z);
    this.group.position.y = groundY;
  }

  moveInDirection(dir, amount) {
    this.group.position.x += dir.x * amount;
    this.group.position.z += dir.z * amount;

    // Face direction
    if (dir.lengthSq() > 0.001) {
      const angle = Math.atan2(dir.x, dir.z);
      this.group.rotation.y = angle;
    }

    // Keep in bounds
    const half = 115;
    this.group.position.x = Math.max(-half, Math.min(half, this.group.position.x));
    this.group.position.z = Math.max(-half, Math.min(half, this.group.position.z));
  }

  animateWalk(delta, speedMult) {
    const t = Date.now() * 0.006 * speedMult;
    if (this.leftLeg)  this.leftLeg.rotation.x  =  Math.sin(t) * 0.5;
    if (this.rightLeg) this.rightLeg.rotation.x  = -Math.sin(t) * 0.5;
    if (this.leftArm)  this.leftArm.rotation.x  = -Math.sin(t) * 0.4;
    if (this.rightArm) this.rightArm.rotation.x  =  Math.sin(t) * 0.4;
    // Body bob
    if (this.bodyMesh) this.bodyMesh.position.y = 1.2 + Math.abs(Math.sin(t)) * 0.06;
  }

  animateAttack(delta) {
    const t = Date.now() * 0.01;
    if (this.rightArm) {
      this.rightArm.rotation.x = Math.sin(t) * 1.2;
    }
  }

  updateDeath(delta, lootSystem) {
    this.deathTimer += delta;
    const progress = this.deathTimer / this.deathDuration;

    // Shrink and sink into ground
    const s = Math.max(0, 1 - progress);
    this.group.scale.set(s, s, s);
    this.group.rotation.z = progress * Math.PI * 0.5;

    if (this.deathTimer >= this.deathDuration) {
      this.dropLoot(lootSystem);
      this.removeFromScene();
    }
  }

  dropLoot(lootSystem) {
    if (!lootSystem) return;
    const pos = this.group.position.clone();

    if (this.type === 'brute') {
      lootSystem.spawnDrop(pos, 'crystal', 2);
      lootSystem.spawnDrop(pos, 'scrap', 3);
      if (Math.random() < 0.4) lootSystem.spawnDrop(pos, 'health', 1);
    } else {
      lootSystem.spawnDrop(pos, 'scrap', 1 + Math.floor(Math.random() * 2));
      if (Math.random() < 0.25) lootSystem.spawnDrop(pos, 'crystal', 1);
      if (Math.random() < 0.15) lootSystem.spawnDrop(pos, 'health', 1);
    }
  }

  removeFromScene() {
    this.scene.remove(this.group);
    this.removed = true;
  }

  consumeAttack() {
    const was = this._dealingDamage;
    this._dealingDamage = false;
    return was;
  }
}

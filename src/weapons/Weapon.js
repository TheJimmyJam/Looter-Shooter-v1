import * as THREE from 'three';

const FIRE_RATE = 0.12;    // seconds between shots
const MAX_AMMO = 30;
const RESERVE_AMMO = 90;
const RELOAD_TIME = 1.8;
const BULLET_DAMAGE = 12;
const HEADSHOT_MULT = 2;
const BULLET_RANGE = 120;

export class Weapon {
  constructor(scene, camera, player, enemyManager) {
    this.scene = scene;
    this.camera = camera;
    this.player = player;
    this.enemyManager = enemyManager;

    this.ammo = MAX_AMMO;
    this.reserveAmmo = RESERVE_AMMO;
    this.maxAmmo = MAX_AMMO;
    this.fireTimer = 0;
    this.reloading = false;
    this.reloadTimer = 0;

    this.raycaster = new THREE.Raycaster();
    this.rayDir = new THREE.Vector3();

    // Muzzle flash light
    this.muzzleLight = new THREE.PointLight(0xffe066, 0, 6);
    this.scene.add(this.muzzleLight);
    this.muzzleFlashTimer = 0;

    // Bullet tracer pool
    this.tracers = [];
    this.tracerMat = new THREE.LineBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.7 });

    // Hit spark geometry
    this.sparks = [];

    // Weapon model (gun silhouette attached to camera)
    this.buildGunModel();

    // Keyboard for reload
    document.addEventListener('keydown', e => {
      if (e.code === 'KeyR' && !this.reloading && this.ammo < this.maxAmmo && this.reserveAmmo > 0) {
        this.startReload();
      }
    });
  }

  buildGunModel() {
    this.gunGroup = new THREE.Group();

    // Main body
    const bodyGeo = new THREE.BoxGeometry(0.06, 0.07, 0.28);
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x2a2a2a, flatShading: true });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    this.gunGroup.add(body);

    // Barrel
    const barrelGeo = new THREE.BoxGeometry(0.03, 0.03, 0.18);
    const barrel = new THREE.Mesh(barrelGeo, bodyMat);
    barrel.position.set(0, 0.02, -0.2);
    this.gunGroup.add(barrel);

    // Magazine
    const magGeo = new THREE.BoxGeometry(0.04, 0.1, 0.05);
    const magMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a, flatShading: true });
    const mag = new THREE.Mesh(magGeo, magMat);
    mag.position.set(0, -0.07, 0.03);
    this.gunGroup.add(mag);

    // Accent stripe
    const stripeGeo = new THREE.BoxGeometry(0.061, 0.01, 0.25);
    const stripeMat = new THREE.MeshLambertMaterial({ color: 0x7c3aed, flatShading: true });
    const stripe = new THREE.Mesh(stripeGeo, stripeMat);
    stripe.position.set(0, 0.04, 0);
    this.gunGroup.add(stripe);

    // Position relative to camera (lower right)
    this.gunGroup.position.set(0.16, -0.14, -0.32);
    this.camera.add(this.gunGroup);

    this.gunBobOffset = 0;
    this.gunSwayX = 0;
    this.gunSwayY = 0;
  }

  update(delta) {
    this.fireTimer = Math.max(0, this.fireTimer - delta);
    this.muzzleFlashTimer = Math.max(0, this.muzzleFlashTimer - delta);

    // Muzzle light falloff
    if (this.muzzleFlashTimer <= 0) {
      this.muzzleLight.intensity = 0;
    }

    // Reload countdown
    if (this.reloading) {
      this.reloadTimer -= delta;
      if (this.reloadTimer <= 0) {
        this.finishReload();
      }
    }

    // Shoot on left mouse
    if (this.player.controls.shootPressed && !this.reloading) {
      this.tryShoot();
    }

    // Auto reload when empty
    if (this.ammo <= 0 && !this.reloading && this.reserveAmmo > 0) {
      this.startReload();
    }

    // Update tracers
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= delta;
      t.mesh.material.opacity = Math.max(0, t.life / t.maxLife) * 0.7;
      if (t.life <= 0) {
        this.scene.remove(t.mesh);
        this.tracers.splice(i, 1);
      }
    }

    // Update sparks
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.life -= delta;
      s.mesh.material.opacity = Math.max(0, s.life / s.maxLife);
      s.mesh.position.addScaledVector(s.velocity, delta);
      s.velocity.y -= 8 * delta;
      if (s.life <= 0) {
        this.scene.remove(s.mesh);
        this.sparks.splice(i, 1);
      }
    }

    // Gun bob
    this.animateGun(delta);
  }

  tryShoot() {
    if (this.fireTimer > 0 || this.ammo <= 0 || this.player.isDead) return;
    this.fireTimer = FIRE_RATE;
    this.ammo--;

    // Raycast from center of screen
    this.raycaster.setFromCamera({ x: 0, y: 0 }, this.camera);
    const hitMeshes = this.enemyManager.getHitMeshes();
    const hits = this.raycaster.intersectObjects(hitMeshes);

    if (hits.length > 0) {
      const hit = hits[0];
      const enemy = hit.object.userData.enemy;

      if (enemy && !enemy.isDead) {
        const isHeadshot = hit.object === enemy.headMesh;
        const dmg = isHeadshot ? BULLET_DAMAGE * HEADSHOT_MULT : BULLET_DAMAGE;
        enemy.takeDamage(dmg, false);
        this.showHitMarker(isHeadshot);
        this.spawnHitSparks(hit.point, hit.face.normal);
        this.spawnTracer(this.camera.position, hit.point);
      }
    } else {
      // Tracer into distance
      const end = this.camera.position.clone()
        .add(this.raycaster.ray.direction.clone().multiplyScalar(BULLET_RANGE));
      this.spawnTracer(this.camera.position, end);
    }

    this.fireMuzzleFlash();
    this.gunRecoil();
  }

  fireMuzzleFlash() {
    // Light flash
    this.muzzleLight.position.copy(this.camera.position)
      .add(this.camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(1));
    this.muzzleLight.intensity = 3.5;
    this.muzzleFlashTimer = 0.06;

    // Gun model flash
    if (this.gunGroup) {
      this.gunGroup.children.forEach(c => {
        if (c.material && c.material.emissive) {
          c.material.emissive.setHex(0xffe066);
          c.material.emissiveIntensity = 0.5;
          setTimeout(() => {
            c.material.emissiveIntensity = 0;
          }, 60);
        }
      });
    }
  }

  gunRecoil() {
    if (!this.gunGroup) return;
    // Snap back
    this.gunGroup.position.z += 0.04;
    this.gunGroup.rotation.x -= 0.08;
  }

  animateGun(delta) {
    if (!this.gunGroup) return;
    const k = this.player.controls.keys;
    const moving = k.forward || k.back || k.left || k.right;

    // Bob
    this.gunBobOffset += delta * (moving ? 8 : 2);
    const bob = moving ? Math.sin(this.gunBobOffset) * 0.008 : 0;

    // Smooth return from recoil
    const targetZ = -0.32;
    const targetRX = 0;
    this.gunGroup.position.z += (targetZ - this.gunGroup.position.z) * delta * 12;
    this.gunGroup.rotation.x += (targetRX - this.gunGroup.rotation.x) * delta * 12;
    this.gunGroup.position.y = -0.14 + bob;
  }

  spawnTracer(from, to) {
    const points = [from.clone(), to.clone()];
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = this.tracerMat.clone();
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.tracers.push({ mesh: line, life: 0.08, maxLife: 0.08 });
  }

  spawnHitSparks(position, normal) {
    const count = 5;
    for (let i = 0; i < count; i++) {
      const geo = new THREE.SphereGeometry(0.04, 3, 3);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffe066, transparent: true, opacity: 1
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(position);

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 5 + normal.x,
        (Math.random() - 0.5) * 5 + normal.y + 2,
        (Math.random() - 0.5) * 5 + normal.z
      );

      this.scene.add(mesh);
      this.sparks.push({ mesh, velocity: vel, life: 0.25, maxLife: 0.25 });
    }
  }

  showHitMarker(headshot = false) {
    const el = document.getElementById('hit-marker');
    if (!el) return;
    el.classList.add('active');
    if (headshot) el.style.filter = 'hue-rotate(0deg) brightness(2)';
    setTimeout(() => {
      el.classList.remove('active');
      el.style.filter = '';
    }, 120);
  }

  startReload() {
    this.reloading = true;
    this.reloadTimer = RELOAD_TIME;
  }

  finishReload() {
    const needed = this.maxAmmo - this.ammo;
    const take = Math.min(needed, this.reserveAmmo);
    this.ammo += take;
    this.reserveAmmo -= take;
    this.reloading = false;
  }

  reset() {
    this.ammo = MAX_AMMO;
    this.reserveAmmo = RESERVE_AMMO;
    this.reloading = false;
    this.reloadTimer = 0;
    this.fireTimer = 0;
    // Clear tracers/sparks
    this.tracers.forEach(t => this.scene.remove(t.mesh));
    this.sparks.forEach(s => this.scene.remove(s.mesh));
    this.tracers = [];
    this.sparks = [];
  }
}

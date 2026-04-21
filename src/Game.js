import * as THREE from 'three';
import { World } from './world/World.js';
import { Player } from './player/Player.js';
import { Controls } from './player/Controls.js';
import { EnemyManager } from './enemies/EnemyManager.js';
import { Weapon } from './weapons/Weapon.js';
import { LootSystem } from './loot/LootSystem.js';
import { HUD } from './ui/HUD.js';

export class Game {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.clock = new THREE.Clock();
    this.paused = true;
    this.started = false;

    this.setupRenderer();
    this.setupLighting();
    this.setupFog();

    // Build world first so other systems can query terrain height
    this.world = new World(this.scene);

    // Controls handles pointer lock + keyboard/mouse input
    this.controls = new Controls(this.camera, this);

    // Player manages state: health, inventory, position
    this.player = new Player(this.scene, this.camera, this.controls, this.world);

    // Enemy AI + spawning
    this.enemyManager = new EnemyManager(this.scene, this.world);

    // Weapon: raycasting shoot against enemies
    this.weapon = new Weapon(this.scene, this.camera, this.player, this.enemyManager);

    // Loot: drops + resource nodes
    this.lootSystem = new LootSystem(this.scene, this.world, this.player);

    // HUD: HTML overlay
    this.hud = new HUD(this.player, this.weapon, this.lootSystem);

    this.setupEventListeners();
    this.animate();
  }

  setupRenderer() {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    document.body.appendChild(this.renderer.domElement);
  }

  setupLighting() {
    // Sky/ground ambient
    const hemi = new THREE.HemisphereLight(0xb9d5ff, 0x4a7c30, 0.7);
    this.scene.add(hemi);

    // Sun
    const sun = new THREE.DirectionalLight(0xfff4e0, 1.4);
    sun.position.set(60, 120, 40);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 400;
    sun.shadow.camera.left = -120;
    sun.shadow.camera.right = 120;
    sun.shadow.camera.top = 120;
    sun.shadow.camera.bottom = -120;
    sun.shadow.bias = -0.001;
    this.scene.add(sun);
    this.sun = sun;
  }

  setupFog() {
    this.scene.background = new THREE.Color(0x7ec8e3);
    this.scene.fog = new THREE.FogExp2(0x9ed8f0, 0.012);
  }

  setupEventListeners() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Start screen click
    const startScreen = document.getElementById('start-screen');
    startScreen.addEventListener('click', () => {
      this.controls.requestLock();
    });

    // Pause screen click to resume
    const pauseScreen = document.getElementById('pause-screen');
    pauseScreen.addEventListener('click', () => {
      if (this.started && !this.player.isDead) {
        this.controls.requestLock();
      }
    });

    // Respawn button
    document.getElementById('respawn-btn').addEventListener('click', () => {
      this.respawn();
    });

    // Pointer lock events — drive game state
    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement !== null;
      if (locked) {
        this.resume();
      } else {
        this.pause();
      }
    });
  }

  resume() {
    if (this.player.isDead) return;
    this.paused = false;
    this.started = true;
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('pause-screen').classList.remove('visible');
    document.getElementById('hud').classList.add('visible');
  }

  pause() {
    this.paused = true;
    if (this.started && !this.player.isDead) {
      document.getElementById('pause-screen').classList.add('visible');
    }
  }

  respawn() {
    document.getElementById('death-screen').classList.remove('visible');
    this.player.respawn();
    this.enemyManager.reset();
    this.lootSystem.reset();
    this.weapon.reset();
    this.hud.reset();
    this.controls.requestLock();
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    if (!this.paused) {
      const delta = Math.min(this.clock.getDelta(), 0.05);

      this.player.update(delta);
      this.enemyManager.update(delta, this.player, this.lootSystem);
      this.weapon.update(delta);
      this.lootSystem.update(delta, this.player);
      this.hud.update();

      // Check death
      if (this.player.isDead && !this.deathShown) {
        this.deathShown = true;
        this.paused = true;
        setTimeout(() => {
          document.getElementById('death-screen').classList.add('visible');
          document.getElementById('hud').classList.remove('visible');
          this.deathShown = false;
        }, 800);
      }
    } else {
      this.clock.getDelta(); // drain delta so we don't get a spike on resume
    }

    this.renderer.render(this.scene, this.camera);
  }
}

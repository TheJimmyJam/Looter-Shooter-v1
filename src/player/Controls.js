import * as THREE from 'three';

export class Controls {
  constructor(camera, game) {
    this.camera = camera;
    this.game = game;
    this.isLocked = false;

    // Movement keys
    this.keys = {
      forward: false,
      back: false,
      left: false,
      right: false,
      jump: false,
      sprint: false,
      interact: false,
      inventory: false,
    };

    // Mouse state
    this.mouseX = 0;
    this.mouseY = 0;
    this.shootPressed = false;

    // First-person look euler
    this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
    this.sensitivity = 0.002;

    this.bindEvents();

    // Keep isLocked in sync with browser pointer lock state
    document.addEventListener('pointerlockchange', () => {
      this.isLocked = document.pointerLockElement !== null;
    });
  }

  requestLock() {
    document.body.requestPointerLock();
  }

  bindEvents() {
    document.addEventListener('keydown', e => this.onKeyDown(e));
    document.addEventListener('keyup', e => this.onKeyUp(e));
    document.addEventListener('mousemove', e => this.onMouseMove(e));
    document.addEventListener('mousedown', e => { if (e.button === 0) this.shootPressed = true; });
    document.addEventListener('mouseup', e => { if (e.button === 0) this.shootPressed = false; });
  }

  onKeyDown(e) {
    switch (e.code) {
      case 'KeyW': case 'ArrowUp':    this.keys.forward  = true; break;
      case 'KeyS': case 'ArrowDown':  this.keys.back     = true; break;
      case 'KeyA': case 'ArrowLeft':  this.keys.left     = true; break;
      case 'KeyD': case 'ArrowRight': this.keys.right    = true; break;
      case 'Space':                   this.keys.jump     = true; e.preventDefault(); break;
      case 'ShiftLeft':               this.keys.sprint   = true; break;
      case 'KeyE':                    this.keys.interact = true; break;
      case 'KeyI':
        this.keys.inventory = !this.keys.inventory;
        this.game.hud?.toggleInventory(this.keys.inventory);
        break;
    }
  }

  onKeyUp(e) {
    switch (e.code) {
      case 'KeyW': case 'ArrowUp':    this.keys.forward  = false; break;
      case 'KeyS': case 'ArrowDown':  this.keys.back     = false; break;
      case 'KeyA': case 'ArrowLeft':  this.keys.left     = false; break;
      case 'KeyD': case 'ArrowRight': this.keys.right    = false; break;
      case 'Space':                   this.keys.jump     = false; break;
      case 'ShiftLeft':               this.keys.sprint   = false; break;
      case 'KeyE':                    this.keys.interact = false; break;
    }
  }

  onMouseMove(e) {
    if (!this.isLocked) return;
    this.euler.setFromQuaternion(this.camera.quaternion);
    this.euler.y -= e.movementX * this.sensitivity;
    this.euler.x -= e.movementY * this.sensitivity;
    // Clamp vertical look
    this.euler.x = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, this.euler.x));
    this.camera.quaternion.setFromEuler(this.euler);
  }
}

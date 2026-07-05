import * as THREE from "three";
import { BLOCK, isSolid } from "./blocks.js";

const EYE_HEIGHT = 1.62;
const PLAYER_HEIGHT = 1.8;
const PLAYER_RADIUS = 0.3;
const GRAVITY = 24;
const JUMP_SPEED = 8.2;
const WALK_SPEED = 4.6;
const SPRINT_SPEED = 7.2;
const REACH = 6;

export class Player {
  constructor(camera, domElement, world) {
    this.camera = camera;
    this.domElement = domElement;
    this.world = world;

    this.position = new THREE.Vector3(0, 40, 0);
    this.velocity = new THREE.Vector3();
    this.euler = new THREE.Euler(0, 0, 0, "YXZ");
    this.onGround = false;

    this.keys = {};
    this.locked = false;

    this.selectedBlock = BLOCK.GRASS;
    this.targetBlock = null; // {x,y,z, faceNormal}

    this._bindEvents();
    this._raycaster = new THREE.Raycaster();
  }

  _bindEvents() {
    document.addEventListener("keydown", (e) => (this.keys[e.code] = true));
    document.addEventListener("keyup", (e) => (this.keys[e.code] = false));

    document.addEventListener("pointerlockchange", () => {
      this.locked = document.pointerLockElement === this.domElement;
    });

    document.addEventListener("mousemove", (e) => {
      if (!this.locked) return;
      const sensitivity = 0.0022;
      this.euler.y -= e.movementX * sensitivity;
      this.euler.x -= e.movementY * sensitivity;
      this.euler.x = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.euler.x));
      this.camera.quaternion.setFromEuler(this.euler);
    });

    this.domElement.addEventListener("mousedown", (e) => {
      if (!this.locked) return;
      if (e.button === 0) this.breakBlock();
      if (e.button === 2) this.placeBlock();
    });
    this.domElement.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  lock() {
    this.domElement.requestPointerLock();
  }

  unlock() {
    document.exitPointerLock();
  }

  // ボクセルDDA(格子ステップ)によるレイキャストで、視線が最初に当たるブロックを求める
  raycastVoxel() {
    const origin = this.camera.getWorldPosition(new THREE.Vector3());
    const dir = this.camera.getWorldDirection(new THREE.Vector3());

    let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
    const stepX = dir.x > 0 ? 1 : -1;
    const stepY = dir.y > 0 ? 1 : -1;
    const stepZ = dir.z > 0 ? 1 : -1;

    const tDeltaX = dir.x !== 0 ? Math.abs(1 / dir.x) : Infinity;
    const tDeltaY = dir.y !== 0 ? Math.abs(1 / dir.y) : Infinity;
    const tDeltaZ = dir.z !== 0 ? Math.abs(1 / dir.z) : Infinity;

    const boundX = stepX > 0 ? x + 1 : x;
    const boundY = stepY > 0 ? y + 1 : y;
    const boundZ = stepZ > 0 ? z + 1 : z;

    let tMaxX = dir.x !== 0 ? (boundX - origin.x) / dir.x : Infinity;
    let tMaxY = dir.y !== 0 ? (boundY - origin.y) / dir.y : Infinity;
    let tMaxZ = dir.z !== 0 ? (boundZ - origin.z) / dir.z : Infinity;

    let lastNormal = [0, 0, 0];
    let dist = 0;

    while (dist < REACH) {
      const block = this.world.getBlock(x, y, z);
      if (isSolid(block)) {
        return { x, y, z, normal: lastNormal };
      }
      if (tMaxX < tMaxY) {
        if (tMaxX < tMaxZ) {
          x += stepX; dist = tMaxX; tMaxX += tDeltaX; lastNormal = [-stepX, 0, 0];
        } else {
          z += stepZ; dist = tMaxZ; tMaxZ += tDeltaZ; lastNormal = [0, 0, -stepZ];
        }
      } else {
        if (tMaxY < tMaxZ) {
          y += stepY; dist = tMaxY; tMaxY += tDeltaY; lastNormal = [0, -stepY, 0];
        } else {
          z += stepZ; dist = tMaxZ; tMaxZ += tDeltaZ; lastNormal = [0, 0, -stepZ];
        }
      }
    }
    return null;
  }

  breakBlock() {
    const hit = this.raycastVoxel();
    if (!hit) return;
    this.world.setBlock(hit.x, hit.y, hit.z, BLOCK.AIR);
  }

  placeBlock() {
    const hit = this.raycastVoxel();
    if (!hit) return;
    const px = hit.x + hit.normal[0];
    const py = hit.y + hit.normal[1];
    const pz = hit.z + hit.normal[2];

    // プレイヤー自身の位置と重なる場所には設置しない
    const feet = this.position.clone().sub(new THREE.Vector3(0, EYE_HEIGHT, 0));
    const overlapsPlayer =
      Math.floor(px) === Math.floor(this.position.x) &&
      Math.floor(pz) === Math.floor(this.position.z) &&
      (Math.floor(py) === Math.floor(feet.y) || Math.floor(py) === Math.floor(feet.y) + 1);
    if (overlapsPlayer) return;

    this.world.setBlock(px, py, pz, this.selectedBlock);
  }

  _collides(pos) {
    const minX = Math.floor(pos.x - PLAYER_RADIUS);
    const maxX = Math.floor(pos.x + PLAYER_RADIUS);
    const minY = Math.floor(pos.y - PLAYER_HEIGHT + 0.02);
    const maxY = Math.floor(pos.y - 0.02);
    const minZ = Math.floor(pos.z - PLAYER_RADIUS);
    const maxZ = Math.floor(pos.z + PLAYER_RADIUS);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          if (isSolid(this.world.getBlock(x, y, z))) return true;
        }
      }
    }
    return false;
  }

  update(delta) {
    delta = Math.min(delta, 0.05);
    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();
    forward.set(0, 0, -1).applyEuler(new THREE.Euler(0, this.euler.y, 0));
    right.set(1, 0, 0).applyEuler(new THREE.Euler(0, this.euler.y, 0));

    let moveX = 0, moveZ = 0;
    if (this.keys["KeyW"]) { moveX += forward.x; moveZ += forward.z; }
    if (this.keys["KeyS"]) { moveX -= forward.x; moveZ -= forward.z; }
    if (this.keys["KeyA"]) { moveX -= right.x; moveZ -= right.z; }
    if (this.keys["KeyD"]) { moveX += right.x; moveZ += right.z; }

    const len = Math.hypot(moveX, moveZ);
    if (len > 0) { moveX /= len; moveZ /= len; }

    const speed = this.keys["ShiftLeft"] || this.keys["ShiftRight"] ? SPRINT_SPEED : WALK_SPEED;
    this.velocity.x = moveX * speed;
    this.velocity.z = moveZ * speed;

    if (this.keys["Space"] && this.onGround) {
      this.velocity.y = JUMP_SPEED;
      this.onGround = false;
    }

    this.velocity.y -= GRAVITY * delta;
    if (this.velocity.y < -50) this.velocity.y = -50;

    // 軸ごとに移動して衝突判定(すり抜け防止)
    const next = this.position.clone();

    next.x += this.velocity.x * delta;
    if (this._collides(next)) next.x = this.position.x;
    this.position.x = next.x;

    next.z = this.position.z + this.velocity.z * delta;
    if (this._collides(new THREE.Vector3(this.position.x, this.position.y, next.z))) {
      next.z = this.position.z;
    }
    this.position.z = next.z;

    next.y = this.position.y + this.velocity.y * delta;
    const testPos = new THREE.Vector3(this.position.x, next.y, this.position.z);
    if (this._collides(testPos)) {
      if (this.velocity.y < 0) this.onGround = true;
      this.velocity.y = 0;
      next.y = this.position.y;
    } else {
      this.onGround = false;
    }
    this.position.y = next.y;

    this.camera.position.set(this.position.x, this.position.y, this.position.z);
  }

  respawnIfFallen() {
    if (this.position.y < -10) {
      this.position.set(this.position.x, 45, this.position.z);
      this.velocity.set(0, 0, 0);
    }
  }
}

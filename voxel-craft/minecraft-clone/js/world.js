import * as THREE from "three";
import { BLOCK, BLOCK_MATERIALS, isOpaque, isSolid } from "./blocks.js";
import { Noise2D } from "./noise.js";

export const CHUNK_SIZE = 16;
export const CHUNKS_X = 6; // ワールド全体のチャンク数(X方向)
export const CHUNKS_Z = 6; // ワールド全体のチャンク数(Z方向)
export const WORLD_HEIGHT = 48;
export const WATER_LEVEL = 11;
export const WORLD_W = CHUNKS_X * CHUNK_SIZE;
export const WORLD_D = CHUNKS_Z * CHUNK_SIZE;

// 面の定義: [法線, 4頂点(反時計回り), 隣接オフセット]
const FACES = [
  { normal: [1, 0, 0], corners: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], off: [1, 0, 0] },
  { normal: [-1, 0, 0], corners: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]], off: [-1, 0, 0] },
  { normal: [0, 1, 0], corners: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]], off: [0, 1, 0] },
  { normal: [0, -1, 0], corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], off: [0, -1, 0] },
  { normal: [0, 0, 1], corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], off: [0, 0, 1] },
  { normal: [0, 0, -1], corners: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], off: [0, 0, -1] },
];
const FACE_UV = [[0, 0], [1, 0], [1, 1], [0, 1]];

export class World {
  constructor(scene) {
    this.scene = scene;
    this.data = new Uint8Array(WORLD_W * WORLD_D * WORLD_HEIGHT);
    this.chunkMeshes = new Map(); // "cx,cz" -> { [blockId]: THREE.Mesh }
    this.heightNoise = new Noise2D(20260705);
    this.treeNoise = new Noise2D(99887766);
  }

  index(x, y, z) {
    return x + z * WORLD_W + y * WORLD_W * WORLD_D;
  }

  inBounds(x, y, z) {
    return x >= 0 && x < WORLD_W && y >= 0 && y < WORLD_HEIGHT && z >= 0 && z < WORLD_D;
  }

  getBlock(x, y, z) {
    if (!this.inBounds(x, y, z)) return BLOCK.AIR;
    return this.data[this.index(x, y, z)];
  }

  setBlockRaw(x, y, z, id) {
    if (!this.inBounds(x, y, z)) return;
    this.data[this.index(x, y, z)] = id;
  }

  // プレイヤーによるブロック設置/破壊。関連チャンクの再構築も行う
  setBlock(x, y, z, id) {
    if (!this.inBounds(x, y, z)) return;
    this.setBlockRaw(x, y, z, id);
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    this.rebuildChunk(cx, cz);
    // チャンク境界なら隣接チャンクも面カリングのため再構築
    const lx = x - cx * CHUNK_SIZE;
    const lz = z - cz * CHUNK_SIZE;
    if (lx === 0) this.rebuildChunk(cx - 1, cz);
    if (lx === CHUNK_SIZE - 1) this.rebuildChunk(cx + 1, cz);
    if (lz === 0) this.rebuildChunk(cx, cz - 1);
    if (lz === CHUNK_SIZE - 1) this.rebuildChunk(cx, cz + 1);
  }

  heightAt(x, z) {
    const base = this.heightNoise.fractal(x, z, { octaves: 4, persistence: 0.5, scale: 0.02 });
    return Math.floor(6 + base * 22); // 6〜28程度
  }

  generate() {
    for (let x = 0; x < WORLD_W; x++) {
      for (let z = 0; z < WORLD_D; z++) {
        const h = this.heightAt(x, z);
        for (let y = 0; y <= h; y++) {
          let id;
          if (y === h) {
            id = h <= WATER_LEVEL + 1 ? BLOCK.SAND : BLOCK.GRASS;
          } else if (y > h - 4) {
            id = h <= WATER_LEVEL + 1 ? BLOCK.SAND : BLOCK.DIRT;
          } else {
            id = BLOCK.STONE;
          }
          this.setBlockRaw(x, y, z, id);
        }
        for (let y = h + 1; y <= WATER_LEVEL; y++) {
          this.setBlockRaw(x, y, z, BLOCK.WATER);
        }
      }
    }
    this.plantTrees();
  }

  plantTrees() {
    for (let x = 2; x < WORLD_W - 2; x++) {
      for (let z = 2; z < WORLD_D - 2; z++) {
        const h = this.heightAt(x, z);
        if (h <= WATER_LEVEL + 1) continue;
        const n = this.treeNoise.fractal(x, z, { octaves: 1, scale: 1 });
        if (n > 0.965) {
          this.placeTree(x, h + 1, z);
        }
      }
    }
  }

  placeTree(x, y, z) {
    const trunkHeight = 4 + Math.floor(Math.random() * 2);
    for (let i = 0; i < trunkHeight; i++) {
      this.setBlockRaw(x, y + i, z, BLOCK.WOOD);
    }
    const topY = y + trunkHeight;
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        for (let dy = -2; dy <= 1; dy++) {
          const dist = Math.abs(dx) + Math.abs(dz) + Math.abs(dy);
          if (dist > 3) continue;
          if (dx === 0 && dz === 0 && dy <= 0) continue;
          const bx = x + dx, by = topY + dy, bz = z + dz;
          if (this.getBlock(bx, by, bz) === BLOCK.AIR) {
            this.setBlockRaw(bx, by, bz, BLOCK.LEAVES);
          }
        }
      }
    }
  }

  buildAllChunks() {
    for (let cx = 0; cx < CHUNKS_X; cx++) {
      for (let cz = 0; cz < CHUNKS_Z; cz++) {
        this.rebuildChunk(cx, cz);
      }
    }
  }

  rebuildChunk(cx, cz) {
    if (cx < 0 || cz < 0 || cx >= CHUNKS_X || cz >= CHUNKS_Z) return;
    const key = `${cx},${cz}`;
    const existing = this.chunkMeshes.get(key);
    if (existing) {
      for (const id in existing) {
        this.scene.remove(existing[id]);
        existing[id].geometry.dispose();
      }
    }

    const buffers = {}; // blockId -> {positions, normals, uvs, indices}
    const startX = cx * CHUNK_SIZE;
    const startZ = cz * CHUNK_SIZE;

    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        for (let y = 0; y < WORLD_HEIGHT; y++) {
          const x = startX + lx;
          const z = startZ + lz;
          const id = this.getBlock(x, y, z);
          if (id === BLOCK.AIR) continue;

          for (const face of FACES) {
            const nx = x + face.off[0];
            const ny = y + face.off[1];
            const nz = z + face.off[2];
            const neighbor = this.getBlock(nx, ny, nz);

            let draw;
            if (id === BLOCK.WATER) {
              draw = neighbor === BLOCK.AIR;
            } else {
              draw = neighbor === BLOCK.AIR || (!isOpaque(neighbor) && neighbor !== id);
            }
            if (!draw) continue;

            if (!buffers[id]) buffers[id] = { positions: [], normals: [], uvs: [], indices: [] };
            const buf = buffers[id];
            const vertStart = buf.positions.length / 3;
            for (let i = 0; i < 4; i++) {
              const c = face.corners[i];
              buf.positions.push(x + c[0], y + c[1], z + c[2]);
              buf.normals.push(...face.normal);
              buf.uvs.push(...FACE_UV[i]);
            }
            buf.indices.push(vertStart, vertStart + 1, vertStart + 2, vertStart, vertStart + 2, vertStart + 3);
          }
        }
      }
    }

    const meshes = {};
    for (const idStr in buffers) {
      const id = Number(idStr);
      const buf = buffers[id];
      const geom = new THREE.BufferGeometry();
      geom.setAttribute("position", new THREE.Float32BufferAttribute(buf.positions, 3));
      geom.setAttribute("normal", new THREE.Float32BufferAttribute(buf.normals, 3));
      geom.setAttribute("uv", new THREE.Float32BufferAttribute(buf.uvs, 2));
      geom.setIndex(buf.indices);

      // マテリアル配列の最初(px面)の材質を代表として使用(ブロックごとに面差分がある場合は簡略化)
      const matSet = BLOCK_MATERIALS[id];
      const material = id === BLOCK.GRASS || id === BLOCK.WOOD ? this.buildMultiMaterialMesh(geom, matSet, buf) : matSet[0];

      const mesh = new THREE.Mesh(geom, material);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.userData.chunkKey = key;
      mesh.userData.blockId = id;
      this.scene.add(mesh);
      meshes[id] = mesh;
    }
    this.chunkMeshes.set(key, meshes);
  }

  // 草/丸太は面ごとに異なるテクスチャを使うため、面法線でグループ分けしマルチマテリアル化する
  buildMultiMaterialMesh(geom, matSet, buf) {
    const faceCount = buf.indices.length / 6;
    const normals = buf.normals;
    geom.clearGroups();
    for (let f = 0; f < faceCount; f++) {
      const nIdx = f * 4 * 3; // 4 verts * 3 comps per face
      const nx = normals[nIdx], ny = normals[nIdx + 1], nz = normals[nIdx + 2];
      let matIndex = 0;
      if (nx === 1) matIndex = 0;
      else if (nx === -1) matIndex = 1;
      else if (ny === 1) matIndex = 2;
      else if (ny === -1) matIndex = 3;
      else if (nz === 1) matIndex = 4;
      else matIndex = 5;
      geom.addGroup(f * 6, 6, matIndex);
    }
    return matSet;
  }
}

import * as THREE from "three";
import { World, WORLD_W, WORLD_D } from "./world.js";
import { Player } from "./player.js";
import { HOTBAR_ORDER, BLOCK_NAMES } from "./blocks.js";

const canvas = document.getElementById("game-canvas");
const blocker = document.getElementById("blocker");
const fpsDisplay = document.getElementById("fps");

// ---------- シーン初期化 ----------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fd0ff);
scene.fog = new THREE.Fog(0x8fd0ff, 40, 140);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const hemi = new THREE.HemisphereLight(0xffffff, 0x445544, 0.9);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff4d6, 0.9);
sun.position.set(80, 120, 40);
scene.add(sun);
scene.add(new THREE.AmbientLight(0xffffff, 0.25));

// ---------- ワールド生成 ----------
const world = new World(scene);
world.generate();
world.buildAllChunks();

// ---------- プレイヤー ----------
const player = new Player(camera, renderer.domElement, world);
const spawnX = Math.floor(WORLD_W / 2);
const spawnZ = Math.floor(WORLD_D / 2);
const spawnY = world.heightAt(spawnX, spawnZ) + 3;
player.position.set(spawnX + 0.5, spawnY, spawnZ + 0.5);

// ---------- ポインターロック / メニュー ----------
blocker.addEventListener("click", () => player.lock());
document.addEventListener("pointerlockchange", () => {
  blocker.style.display = player.locked ? "none" : "flex";
});

// ---------- ホットバーUI ----------
const hotbarEl = document.getElementById("hotbar");
function renderHotbar() {
  hotbarEl.innerHTML = "";
  HOTBAR_ORDER.forEach((id, i) => {
    const slot = document.createElement("div");
    slot.className = "hotbar-slot" + (player.selectedBlock === id ? " active" : "");
    slot.innerHTML = `<span class="key">${i + 1}</span><span>${BLOCK_NAMES[id]}</span>`;
    hotbarEl.appendChild(slot);
  });
}
renderHotbar();

document.addEventListener("keydown", (e) => {
  const num = Number(e.code.replace("Digit", ""));
  if (num >= 1 && num <= HOTBAR_ORDER.length) {
    player.selectedBlock = HOTBAR_ORDER[num - 1];
    renderHotbar();
  }
});

window.addEventListener("wheel", (e) => {
  if (!player.locked) return;
  const dir = e.deltaY > 0 ? 1 : -1;
  const idx = HOTBAR_ORDER.indexOf(player.selectedBlock);
  const next = (idx + dir + HOTBAR_ORDER.length) % HOTBAR_ORDER.length;
  player.selectedBlock = HOTBAR_ORDER[next];
  renderHotbar();
});

// ---------- リサイズ対応 ----------
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- ゲームループ ----------
let lastTime = performance.now();
let fpsAccum = 0, fpsFrames = 0, fpsTimer = 0;

function animate(now) {
  requestAnimationFrame(animate);
  const delta = (now - lastTime) / 1000;
  lastTime = now;

  if (player.locked) {
    player.update(delta);
    player.respawnIfFallen();
  }

  fpsFrames++;
  fpsTimer += delta;
  if (fpsTimer >= 0.5) {
    fpsDisplay.textContent = `FPS: ${Math.round(fpsFrames / fpsTimer)}`;
    fpsFrames = 0;
    fpsTimer = 0;
  }

  renderer.render(scene, camera);
}
requestAnimationFrame(animate);

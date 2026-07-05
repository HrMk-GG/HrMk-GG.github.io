import * as THREE from "three";

// ブロック種類の定義。id 0 は「空気（ブロックなし）」
export const BLOCK = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  SAND: 4,
  WOOD: 5,
  LEAVES: 6,
  WATER: 7,
  PLANK: 8,
};

export const HOTBAR_ORDER = [
  BLOCK.GRASS,
  BLOCK.DIRT,
  BLOCK.STONE,
  BLOCK.SAND,
  BLOCK.WOOD,
  BLOCK.LEAVES,
  BLOCK.PLANK,
];

export const BLOCK_NAMES = {
  [BLOCK.GRASS]: "草",
  [BLOCK.DIRT]: "土",
  [BLOCK.STONE]: "石",
  [BLOCK.SAND]: "砂",
  [BLOCK.WOOD]: "丸太",
  [BLOCK.LEAVES]: "葉",
  [BLOCK.WATER]: "水",
  [BLOCK.PLANK]: "板材",
};

// 手続き的にドット絵風のテクスチャをcanvasで生成する
function makeTexture(drawFn) {
  const size = 16;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  drawFn(ctx, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function noisyFill(ctx, size, baseColor, variance, speckDensity = 0.35) {
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, size, size);
  const [r, g, b] = baseColor.match(/\d+/g).map(Number);
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      if (Math.random() < speckDensity) {
        const d = (Math.random() - 0.5) * variance;
        ctx.fillStyle = `rgb(${clamp(r + d)},${clamp(g + d)},${clamp(b + d)})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
}

function clamp(v) {
  return Math.max(0, Math.min(255, Math.round(v)));
}

const texGrassTop = makeTexture((ctx, s) => noisyFill(ctx, s, "rgb(86,158,58)", 60));
const texGrassSide = makeTexture((ctx, s) => {
  noisyFill(ctx, s, "rgb(134,96,60)", 40);
  ctx.fillStyle = "rgb(86,158,58)";
  ctx.fillRect(0, 0, s, 4);
  for (let x = 0; x < s; x++) {
    const h = 3 + Math.floor(Math.random() * 2);
    ctx.fillRect(x, h, 1, 1);
  }
});
const texDirt = makeTexture((ctx, s) => noisyFill(ctx, s, "rgb(134,96,60)", 40));
const texStone = makeTexture((ctx, s) => noisyFill(ctx, s, "rgb(130,130,130)", 30));
const texSand = makeTexture((ctx, s) => noisyFill(ctx, s, "rgb(219,207,150)", 25));
const texWoodSide = makeTexture((ctx, s) => {
  noisyFill(ctx, s, "rgb(107,76,45)", 20, 0.15);
  ctx.strokeStyle = "rgba(60,40,20,0.6)";
  for (let x = 1; x < s; x += 4) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, s);
    ctx.stroke();
  }
});
const texWoodTop = makeTexture((ctx, s) => {
  noisyFill(ctx, s, "rgb(170,130,80)", 20, 0.15);
  ctx.strokeStyle = "rgba(107,76,45,0.7)";
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, s / 2 - 1, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, s / 4, 0, Math.PI * 2);
  ctx.stroke();
});
const texLeaves = makeTexture((ctx, s) => noisyFill(ctx, s, "rgb(53,110,40)", 50, 0.5));
const texWater = makeTexture((ctx, s) => noisyFill(ctx, s, "rgb(60,110,200)", 30, 0.2));
const texPlank = makeTexture((ctx, s) => {
  noisyFill(ctx, s, "rgb(180,140,90)", 15, 0.1);
  ctx.strokeStyle = "rgba(120,90,55,0.6)";
  for (let y = 3; y < s; y += 4) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(s, y);
    ctx.stroke();
  }
});

function mat(tex, opts = {}) {
  return new THREE.MeshLambertMaterial({ map: tex, transparent: !!opts.transparent, opacity: opts.opacity ?? 1 });
}

// 各ブロックの6面 [px, nx, py, ny, pz, nz] のマテリアル
export const BLOCK_MATERIALS = {
  [BLOCK.GRASS]: [mat(texGrassSide), mat(texGrassSide), mat(texGrassTop), mat(texDirt), mat(texGrassSide), mat(texGrassSide)],
  [BLOCK.DIRT]: Array(6).fill(null).map(() => mat(texDirt)),
  [BLOCK.STONE]: Array(6).fill(null).map(() => mat(texStone)),
  [BLOCK.SAND]: Array(6).fill(null).map(() => mat(texSand)),
  [BLOCK.WOOD]: [mat(texWoodSide), mat(texWoodSide), mat(texWoodTop), mat(texWoodTop), mat(texWoodSide), mat(texWoodSide)],
  [BLOCK.LEAVES]: Array(6).fill(null).map(() => mat(texLeaves, { transparent: true, opacity: 0.95 })),
  [BLOCK.WATER]: Array(6).fill(null).map(() => mat(texWater, { transparent: true, opacity: 0.7 })),
  [BLOCK.PLANK]: Array(6).fill(null).map(() => mat(texPlank)),
};

export function isSolid(id) {
  return id !== BLOCK.AIR && id !== BLOCK.WATER;
}

export function isOpaque(id) {
  return id !== BLOCK.AIR && id !== BLOCK.WATER && id !== BLOCK.LEAVES;
}

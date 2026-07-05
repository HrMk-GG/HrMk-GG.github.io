// 依存ライブラリなしの軽量2Dパーリン風ノイズ実装
export class Noise2D {
  constructor(seed = 1337) {
    this.perm = new Uint8Array(512);
    let s = seed >>> 0;
    const rand = () => {
      // xorshift32
      s ^= s << 13; s >>>= 0;
      s ^= s >>> 17;
      s ^= s << 5; s >>>= 0;
      return s / 4294967295;
    };
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }

  static fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  static lerp(a, b, t) { return a + t * (b - a); }
  static grad(hash, x, y) {
    const h = hash & 7;
    const gradients = [
      [1, 0], [-1, 0], [0, 1], [0, -1],
      [1, 1], [-1, 1], [1, -1], [-1, -1],
    ];
    const [gx, gy] = gradients[h];
    return gx * x + gy * y;
  }

  get(x, y) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const topRight = this.perm[this.perm[X + 1] + Y + 1];
    const topLeft = this.perm[this.perm[X] + Y + 1];
    const bottomRight = this.perm[this.perm[X + 1] + Y];
    const bottomLeft = this.perm[this.perm[X] + Y];

    const u = Noise2D.fade(xf);
    const v = Noise2D.fade(yf);

    const bl = Noise2D.grad(bottomLeft, xf, yf);
    const br = Noise2D.grad(bottomRight, xf - 1, yf);
    const tl = Noise2D.grad(topLeft, xf, yf - 1);
    const tr = Noise2D.grad(topRight, xf - 1, yf - 1);

    const x1 = Noise2D.lerp(bl, br, u);
    const x2 = Noise2D.lerp(tl, tr, u);
    return Noise2D.lerp(x1, x2, v); // -1 .. 1
  }

  // 複数オクターブを重ねたフラクタルノイズ (0..1に正規化)
  fractal(x, y, { octaves = 4, persistence = 0.5, scale = 1 } = {}) {
    let total = 0;
    let freq = scale;
    let amp = 1;
    let maxAmp = 0;
    for (let i = 0; i < octaves; i++) {
      total += this.get(x * freq, y * freq) * amp;
      maxAmp += amp;
      amp *= persistence;
      freq *= 2;
    }
    return (total / maxAmp + 1) / 2;
  }
}

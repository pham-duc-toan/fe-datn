import type { Rle } from "./schema";

/**
 * RLE không nén kiểu COCO (mục 6.3 mask): duyệt pixel THEO CỘT, đoạn 0 / 1 xen kẽ, bắt đầu bằng đoạn 0.
 * mask: Uint8Array dài width*height theo HÀNG (index = y*width + x).
 */
export function encodeRle(mask: Uint8Array, width: number, height: number): Rle {
  const counts: number[] = [];
  let cur = 0;
  let run = 0;
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const v = mask[y * width + x] ? 1 : 0;
      if (v === cur) run++;
      else {
        counts.push(run);
        cur = v;
        run = 1;
      }
    }
  }
  counts.push(run);
  return { size: [height, width], counts };
}

export function decodeRle(rle: Rle): Uint8Array {
  const [height, width] = rle.size;
  const mask = new Uint8Array(width * height);
  let p = 0;
  let on = 0;
  for (const len of rle.counts) {
    if (on) for (let i = p; i < p + len; i++) mask[(i % height) * width + Math.floor(i / height)] = 1;
    p += len;
    on ^= 1;
  }
  return mask;
}

export function rleEmpty(rle: Rle): boolean {
  return rle.counts.length <= 1;
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const cache = new WeakMap<Rle, HTMLCanvasElement>();

/** Canvas tô màu của một mặt nạ, cache theo đối tượng rle (đổi rle = vẽ lại). */
export function maskCanvas(rle: Rle, color: string): HTMLCanvasElement {
  const hit = cache.get(rle);
  if (hit && hit.dataset.color === color) return hit;
  const [h, w] = rle.size;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  c.dataset.color = color;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(w, h);
  const m = decodeRle(rle);
  const [r, g, b] = hexToRgb(color);
  for (let i = 0; i < m.length; i++) {
    if (m[i]) {
      img.data[i * 4] = r;
      img.data[i * 4 + 1] = g;
      img.data[i * 4 + 2] = b;
      img.data[i * 4 + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  cache.set(rle, c);
  return c;
}

/** Đọc mặt nạ từ kênh alpha của canvas đang tô. */
export function canvasToMask(c: HTMLCanvasElement): Uint8Array {
  const ctx = c.getContext("2d")!;
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  const m = new Uint8Array(c.width * c.height);
  for (let i = 0; i < m.length; i++) m[i] = d[i * 4 + 3] > 0 ? 1 : 0;
  return m;
}

export function rememberCanvas(rle: Rle, c: HTMLCanvasElement, color: string) {
  c.dataset.color = color;
  cache.set(rle, c);
}

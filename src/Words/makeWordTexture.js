import { CanvasTexture } from 'three';

// Canvas 512×128 (haute résolution pour rester net sur un plan plus grand),
// ratio 4:1 conservé.
export function makeWordTexture(word) {
  const W = 512, H = 128;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, W, H);
  ctx.font         = '400 36px "Inter", monospace';
  ctx.fillStyle    = 'rgb(255, 255, 255)';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(word, W / 2, H / 2);
  return new CanvasTexture(c);
}

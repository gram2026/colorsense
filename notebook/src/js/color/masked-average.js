import { hexToRgb, rgbToHsl, rgbToHex } from './color-convert.js';
import { paintPreserveLightnessBuffer } from './mask-renderer.js';

// Entries represent every selected source pixel, grouped by identical RGBA and mask.
export function maskedAverages(entries, pickHex) {
  const pick = hexToRgb(pickHex);
  const hsl = rgbToHsl(pick);
  const source = new Uint8ClampedArray(entries.length * 4);
  const output = new Uint8ClampedArray(source.length);
  const lightness = new Float32Array(entries.length);
  const saturation = new Float32Array(entries.length);
  const strengths = new Float32Array(entries.length);
  entries.forEach(([r,g,b,alpha,mask], i) => {
    source.set([r,g,b,alpha], i*4);
    const base = rgbToHsl({r,g,b});
    lightness[i] = base.l;
    saturation[i] = base.s;
    strengths[i] = mask/65025;
  });
  // Same byte rounding and compositing as the full-resolution result snapshot.
  paintPreserveLightnessBuffer(source, output, lightness, saturation, strengths, entries.length, hsl.h, hsl.s, hsl.l);
  let weight = 0;
  const original = [0, 0, 0], applied = [0, 0, 0];
  for (let i = 0; i < entries.length; i++) {
    const [r, g, b, alpha, mask, count] = entries[i];
    const strength = mask / 65025;
    const w = strength * alpha / 255 * count;
    if (!w) continue;
    weight += w;
    [r, g, b].forEach((v, i) => original[i] += v * w);
    for (let c = 0; c < 3; c++) applied[c] += output[i*4+c] * w;
  }
  if (!weight) throw new Error('Empty scoring mask');
  const hex = sum => rgbToHex({ r: sum[0] / weight, g: sum[1] / weight, b: sum[2] / weight });
  return { answer: hex(original), applied: hex(applied) };
}

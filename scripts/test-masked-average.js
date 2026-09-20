import assert from 'node:assert/strict';
import { maskedAverages } from '../src/js/color/masked-average.js';
import { calculateScore, scoreFromSimilarity } from '../src/js/color/scoring.js';
import { paintPreserveLightnessBuffer } from '../src/js/color/mask-renderer.js';
import { rgbToHsl, hexToRgb, rgbToHex } from '../src/js/color/color-convert.js';
const pixels = [[255,0,0,255,65025,2],[0,0,255,255,65025,1],[0,255,0,255,0,100],[255,255,255,0,65025,100]];
const a = maskedAverages(pixels, '#FF0000', 'preserve-lightness');
assert.equal(a.answer, '#AA0055');
assert.equal(a.applied, '#FF0000');
assert.equal(maskedAverages([[0,0,255,255,65025,1]], '#0000FF', 'preserve-lightness').applied, '#0000FF');
assert.throws(() => maskedAverages([], '#000000'));
// Compare scoring against the actual snapshot renderer, including a soft edge,
// a transparent pixel, highlights and the near-black recoloring correction.
const source = new Uint8ClampedArray([0,0,0,255, 140,30,15,255, 240,210,200,128, 255,255,255,0]);
const strengths = [1, 0.5, 1, 1];
const bases = strengths.map((_, i) => rgbToHsl({r:source[i*4],g:source[i*4+1],b:source[i*4+2]}));
const entries = strengths.map((s, i) => [...source.slice(i*4,i*4+4),s*65025,1]);
for (const pick of ['#23BADA','#000000','#FFFFFF','#EA2345']) {
  const out = new Uint8ClampedArray(source.length);
  const hsl = rgbToHsl(hexToRgb(pick));
  paintPreserveLightnessBuffer(source, out, Float32Array.from(bases,b=>b.l), Float32Array.from(bases,b=>b.s), Float32Array.from(strengths), 4, hsl.h, hsl.s, hsl.l);
  let weight = 0;
  const sum = [0,0,0];
  strengths.forEach((s,i) => {
    const w = s*source[i*4+3]/255;
    weight += w;
    sum.forEach((_,c) => sum[c] += out[i*4+c]*w);
  });
  assert.equal(maskedAverages(entries,pick).applied, rgbToHex({r:sum[0]/weight,g:sum[1]/weight,b:sum[2]/weight}));
}
assert.equal(calculateScore('#AA0055', '#AA0055').score, 100);
assert(calculateScore('#DA3030', '#FF0000').score < calculateScore('#DA3030', '#FF0000', {curve:'power',perfectThreshold:3,zeroScoreThreshold:100,curveExponent:0.75,hardTopExponent:1}).score);
assert.equal(scoreFromSimilarity(0),0);
assert.equal(scoreFromSimilarity(1),100);
assert(Math.abs(scoreFromSimilarity(0.5)-42.5) < 1e-9);
assert(Math.abs(scoreFromSimilarity(0.8)-80) < 1e-9);
let previous = 0;
for(let i=0;i<=10000;i++) {
  const score = scoreFromSimilarity(i/10000);
  assert(score >= previous && score <= 100, 'Curve must remain monotone and bounded');
  assert(score - previous < 0.015, 'Small similarity changes must not cause a score jump');
  previous = score;
}
console.log('Masked average, render parity and stricter S-curve checks passed.');

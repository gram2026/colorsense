/**
 * 색상 계산 유틸리티 (문제 제작기 전용 추가분)
 * ---------------------------------------------------------------
 * sRGB<->HSL<->LAB 기본 변환은 게임 본체 src/js/color/color-convert.js를
 * 그대로 재사용한다 (점수 계산과 다른 공식을 쓰면 게임과 결과가 어긋나기 때문).
 * 이 파일은 게임에는 없는, 제작기에만 필요한 기능(LAB -> sRGB 역변환,
 * 가중 평균/중앙값, 결정적 LAB k-평균 군집화)만 추가한다.
 */

import {
  clamp,
  hexToRgb,
  rgbToHex,
  rgbToHsl,
  hslToRgb,
  hexToHsl,
  hslToHex,
  isValidHex,
  rgbToLab,
  hexToLab,
} from "../../../src/js/color/color-convert.js";
import { deltaE76 } from "../../../src/js/color/delta-e.js";

export {
  clamp,
  hexToRgb,
  rgbToHex,
  rgbToHsl,
  hslToRgb,
  hexToHsl,
  hslToHex,
  isValidHex,
  rgbToLab,
  hexToLab,
  deltaE76,
};

// D65 기준 백색점 (게임의 color-convert.js와 동일한 상수를 사용해야 왕복 변환이 어긋나지 않는다)
const REF_X = 95.047;
const REF_Y = 100.0;
const REF_Z = 108.883;

function labChannelToXyz(t) {
  const t3 = t * t * t;
  return t3 > 0.008856 ? t3 : (t - 16 / 116) / 7.787;
}

export function labToXyz({ l, a, b }) {
  const fy = (l + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;
  return {
    x: labChannelToXyz(fx) * REF_X,
    y: labChannelToXyz(fy) * REF_Y,
    z: labChannelToXyz(fz) * REF_Z,
  };
}

function linearToSrgbChannel(v) {
  const c = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  return clamp(Math.round(c * 255), 0, 255);
}

export function xyzToRgb({ x, y, z }) {
  const xn = x / 100;
  const yn = y / 100;
  const zn = z / 100;

  const rl = xn * 3.2406 + yn * -1.5372 + zn * -0.4986;
  const gl = xn * -0.9689 + yn * 1.8758 + zn * 0.0415;
  const bl = xn * 0.0557 + yn * -0.204 + zn * 1.057;

  return {
    r: linearToSrgbChannel(rl),
    g: linearToSrgbChannel(gl),
    b: linearToSrgbChannel(bl),
  };
}

export function labToRgb(lab) {
  return xyzToRgb(labToXyz(lab));
}

export function labToHex(lab) {
  return rgbToHex(labToRgb(lab));
}

/** 알파(마스크 강도) 가중 평균 (LAB 공간에서 계산 후 sRGB로 되돌림) */
export function weightedMeanLab(samples) {
  let sumW = 0;
  let sl = 0;
  let sa = 0;
  let sb = 0;
  for (const s of samples) {
    const w = s.weight ?? 1;
    sumW += w;
    sl += s.lab.l * w;
    sa += s.lab.a * w;
    sb += s.lab.b * w;
  }
  if (sumW <= 0) return { l: 0, a: 0, b: 0 };
  return { l: sl / sumW, a: sa / sumW, b: sb / sumW };
}

/** 채널별 가중 중앙값 (하이라이트/그림자 같은 극단값에 평균보다 덜 흔들린다) */
export function weightedMedianLab(samples) {
  const channels = ["l", "a", "b"];
  const out = {};
  const totalWeight = samples.reduce((s, x) => s + (x.weight ?? 1), 0);
  for (const ch of channels) {
    const sorted = [...samples].sort((a, b) => a.lab[ch] - b.lab[ch]);
    const half = totalWeight / 2;
    let acc = 0;
    let value = sorted.length ? sorted[sorted.length - 1].lab[ch] : 0;
    for (const s of sorted) {
      acc += s.weight ?? 1;
      if (acc >= half) {
        value = s.lab[ch];
        break;
      }
    }
    out[ch] = value;
  }
  return out;
}

function lab2(a, b) {
  const dl = a.l - b.l;
  const da = a.a - b.a;
  const db = a.b - b.b;
  return dl * dl + da * da + db * db;
}

/**
 * 초기 중심을 결정적으로 고른다 ("k-means++"와 같은 아이디어이지만 확률 대신
 * 매번 "이미 고른 중심들로부터 가장 먼 점"을 고르는 최댓값 선택이라 완전히
 * 결정적이다). 단순히 명도(L) 백분위수로 고르면 하이라이트처럼 픽셀 수가
 * 적은 군집은 초기 중심에 아예 배정되지 않아 그림자/기본색과 섞여버릴 수
 * 있어서, 데이터가 실제로 갈라지는 지점을 찾아가는 이 방식을 쓴다.
 */
function pickInitialCentroids(sortedByL, k) {
  const centroids = [{ ...sortedByL[Math.floor(sortedByL.length / 2)].lab }];
  while (centroids.length < k) {
    let bestIdx = 0;
    let bestMinDist = -1;
    for (let i = 0; i < sortedByL.length; i++) {
      const lab = sortedByL[i].lab;
      let minDist = Infinity;
      for (const c of centroids) minDist = Math.min(minDist, lab2(lab, c));
      if (minDist > bestMinDist) {
        bestMinDist = minDist;
        bestIdx = i;
      }
    }
    centroids.push({ ...sortedByL[bestIdx].lab });
  }
  return centroids;
}

/**
 * 결정적(deterministic) 가중 LAB k-평균.
 * - 초기 중심을 난수 대신 "가장 먼 점 고르기"로 고정 선택 -> 같은 입력이면 항상 같은 결과.
 * - 고정된 반복 횟수만 수행한다 (수렴 판정에 난수/미세오차가 섞이지 않게).
 * @param {{lab:{l,a,b}, weight:number}[]} samples
 * @param {number} k
 * @param {number} iterations
 * @returns {{centroid:{l,a,b}, weight:number, count:number}[]} 가중치(=총 픽셀 가중합) 내림차순
 */
export function weightedKMeansLab(samples, k = 3, iterations = 10) {
  if (samples.length === 0) return [];
  if (samples.length <= k) {
    return samples.map((s) => ({ centroid: s.lab, weight: s.weight ?? 1, count: 1 }));
  }

  const sortedByL = [...samples].sort((a, b) => a.lab.l - b.lab.l);
  const centroids = pickInitialCentroids(sortedByL, k);

  let assignments = new Array(samples.length).fill(0);

  for (let iter = 0; iter < iterations; iter++) {
    let changed = false;
    for (let i = 0; i < samples.length; i++) {
      const lab = samples[i].lab;
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let c = 0; c < centroids.length; c++) {
        const dl = lab.l - centroids[c].l;
        const da = lab.a - centroids[c].a;
        const db = lab.b - centroids[c].b;
        const dist = dl * dl + da * da + db * db;
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = c;
        }
      }
      if (assignments[i] !== bestIdx) changed = true;
      assignments[i] = bestIdx;
    }

    const sums = centroids.map(() => ({ l: 0, a: 0, b: 0, w: 0 }));
    for (let i = 0; i < samples.length; i++) {
      const c = assignments[i];
      const w = samples[i].weight ?? 1;
      sums[c].l += samples[i].lab.l * w;
      sums[c].a += samples[i].lab.a * w;
      sums[c].b += samples[i].lab.b * w;
      sums[c].w += w;
    }
    for (let c = 0; c < centroids.length; c++) {
      if (sums[c].w > 0) {
        centroids[c] = { l: sums[c].l / sums[c].w, a: sums[c].a / sums[c].w, b: sums[c].b / sums[c].w };
      }
    }
    if (!changed) break;
  }

  const clusters = centroids.map(() => ({ l: 0, a: 0, b: 0, weight: 0, count: 0 }));
  for (let i = 0; i < samples.length; i++) {
    const c = assignments[i];
    const w = samples[i].weight ?? 1;
    clusters[c].weight += w;
    clusters[c].count += 1;
  }

  return centroids
    .map((centroid, i) => ({ centroid, weight: clusters[i].weight, count: clusters[i].count }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.weight - a.weight);
}

export function labDistance(a, b) {
  return deltaE76(a, b);
}

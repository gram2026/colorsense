/**
 * 마스크 영역에서 게임의 answerColor로 쓸 대표 단색을 자동 추출한다.
 * 단순 RGB 평균은 하이라이트/그림자 때문에 물체의 기본색과 어긋나기 쉬워서
 * 쓰지 않는다. LAB 공간에서 가중 평균/가중 중앙값/가중 k-평균 군집화를 모두
 * 계산해서 후보로 제시하고, 자동 추천은 그 중 하나를 규칙에 따라 고른다.
 * 같은 이미지+마스크에서는 항상 같은 결과가 나오도록 모든 계산을 결정적으로 한다.
 */

import { weightedMeanLab, weightedMedianLab, weightedKMeansLab, labToHex } from "./utils/color-utils.js";

const MASK_ALPHA_THRESHOLD = 8; // 이 알파 미만은 "선택 안 됨"으로 취급
const MAX_SAMPLES = 6000; // 이미지가 커도 균일 샘플링으로 상한을 둔다
const MIN_SAMPLES_FOR_CLUSTERING = 12;
const CLUSTER_COUNT = 3;
const MIN_CLUSTER_SHARE = 0.05; // 전체 가중치의 5% 미만인 군집은 대표색 후보에서 제외

export function extractAnswerColorCandidates(canvasEditor) {
  const { width, height } = canvasEditor;
  const lab = canvasEditor.getOriginalLabBuffer();
  const maskData = canvasEditor.getMaskImageData().data;
  const total = width * height;

  const collected = [];
  for (let i = 0; i < total; i++) {
    const a = maskData[i * 4 + 3];
    if (a < MASK_ALPHA_THRESHOLD) continue;
    collected.push({ i, weight: a / 255 });
  }

  if (collected.length === 0) {
    return { empty: true, candidates: [], consistency: 0, sampleCount: 0 };
  }

  // 이미지가 크면 결정적(순서 기반) 균일 샘플링으로 상한을 둔다 (Math.random 사용 안 함).
  let picked = collected;
  if (collected.length > MAX_SAMPLES) {
    const stride = collected.length / MAX_SAMPLES;
    picked = new Array(MAX_SAMPLES);
    for (let s = 0; s < MAX_SAMPLES; s++) {
      picked[s] = collected[Math.floor(s * stride)];
    }
  }

  const labSamples = picked.map(({ i, weight }) => ({
    lab: { l: lab[i * 3], a: lab[i * 3 + 1], b: lab[i * 3 + 2] },
    weight,
  }));

  // 지나친 그림자/반사광 완화: 밝기 5~95 백분위 바깥 샘플은 가중치를 절반으로 낮춘다
  // (완전히 버리지는 않는다 — 흰색/검은색 물체 자체를 오판하지 않기 위해).
  const dampened = dampenExtremeLightness(labSamples);

  const meanLab = weightedMeanLab(dampened);
  const medianLab = weightedMedianLab(dampened);

  const totalWeight = dampened.reduce((s, x) => s + x.weight, 0);
  let clusters = [];
  if (dampened.length >= MIN_SAMPLES_FOR_CLUSTERING) {
    clusters = weightedKMeansLab(dampened, CLUSTER_COUNT, 12)
      .filter((c) => c.weight / totalWeight >= MIN_CLUSTER_SHARE)
      .sort((a, b) => b.weight - a.weight);
  }

  const autoLab = pickAutoCandidate(clusters, meanLab, totalWeight);
  const consistency = computeConsistency(clusters, totalWeight);

  const candidates = [];
  const seenHex = new Set();
  const pushCandidate = (label, labColor, extra = {}) => {
    const hex = labToHex(labColor);
    if (seenHex.has(hex)) return;
    seenHex.add(hex);
    candidates.push({ label, hex, ...extra });
  };

  pushCandidate("자동 추천", autoLab, { isAuto: true });
  pushCandidate("가중 평균", meanLab);
  pushCandidate("중앙값 계열", medianLab);
  clusters.slice(0, 4).forEach((c, idx) => {
    pushCandidate(`주요 색상 ${idx + 1} (${Math.round((c.weight / totalWeight) * 100)}%)`, c.centroid);
  });

  return {
    empty: false,
    candidates,
    autoHex: labToHex(autoLab),
    consistency,
    sampleCount: labSamples.length,
    totalSelectedPixels: collected.length,
  };
}

function dampenExtremeLightness(samples) {
  const sortedL = [...samples].sort((a, b) => a.lab.l - b.lab.l);
  const totalW = sortedL.reduce((s, x) => s + x.weight, 0);
  if (totalW <= 0) return samples;

  const pLow = percentileL(sortedL, totalW, 0.05);
  const pHigh = percentileL(sortedL, totalW, 0.95);

  return samples.map((s) => {
    if (s.lab.l < pLow || s.lab.l > pHigh) {
      return { ...s, weight: s.weight * 0.5 };
    }
    return s;
  });
}

function percentileL(sortedByL, totalWeight, fraction) {
  const target = totalWeight * fraction;
  let acc = 0;
  for (const s of sortedByL) {
    acc += s.weight;
    if (acc >= target) return s.lab.l;
  }
  return sortedByL[sortedByL.length - 1]?.lab.l ?? 0;
}

/**
 * 가장 큰 군집을 기본으로 쓰되, 그 군집이 아주 어두운(그림자로 의심되는) 색이고
 * 다른 군집이 충분한 비중(>=20%)과 정상적인 밝기(L>25)를 가지면 그쪽을 대신 추천한다.
 */
function pickAutoCandidate(clusters, meanLab, totalWeight) {
  if (clusters.length === 0) return meanLab;

  const top = clusters[0];
  const topIsLikelyShadow = top.centroid.l < 20;

  if (topIsLikelyShadow) {
    const alternative = clusters.find(
      (c) => c !== top && c.weight / totalWeight >= 0.2 && c.centroid.l > 25
    );
    if (alternative) return alternative.centroid;
  }

  return top.centroid;
}

/** "색상 분포 일관성" 참고값 (0~1). 가장 큰 군집이 전체에서 차지하는 가중치 비율. */
function computeConsistency(clusters, totalWeight) {
  if (clusters.length === 0) return 1; // 샘플이 적어 군집화를 안 한 경우 -> 충분히 일관적이라고 간주
  return Math.max(0, Math.min(1, clusters[0].weight / totalWeight));
}

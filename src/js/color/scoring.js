/**
 * 점수 계산
 * 평균색의 Delta E를 유사도로 바꾸고, 중간 구간부터 완만하게 상승하는
 * 단조 S 곡선으로 점수를 매긴다.
 */

import { hexToLab } from "./color-convert.js";
import { deltaE76, deltaE2000 } from "./delta-e.js";

/** src/data/config.json 의 scoring 항목과 동일한 기본값 */
export const DEFAULT_SCORING_CONFIG = {
  maxScore: 100,
  method: "ciede2000",
  perfectThreshold: 2.5,
  zeroScoreThreshold: 80,
  curve: "similarity-s",
  curveExponent: 0.75,
  hardTopFrom: 96,
  hardTopExponent: 1,
};

/** A gentle S curve, with a modest midrange penalty and no abrupt steep segment. */
export function scoreFromSimilarity(similarity) {
  const x = Math.max(0,Math.min(1,similarity));
  // Derivative stays positive (0.2…1.28): steady gains throughout the range.
  if (x === 1) return 100;
  return 100 * x * (0.2 + x * (1.8 - x));
}

/**
 * @param {string} userHex 사용자가 선택한 색 (#RRGGBB)
 * @param {string} answerHex 정답 색 (#RRGGBB)
 * @param {object} config scoring 설정 (없으면 기본값 사용)
 * @returns {{ score: number, deltaE: number, method: string }}
 */
export function calculateScore(userHex, answerHex, config = DEFAULT_SCORING_CONFIG) {
  const cfg = { ...DEFAULT_SCORING_CONFIG, ...config };

  const labUser = hexToLab(userHex);
  const labAnswer = hexToLab(answerHex);

  const deltaE =
    cfg.method === "deltaE76" ? deltaE76(labUser, labAnswer) : deltaE2000(labUser, labAnswer);

  const { maxScore, perfectThreshold, zeroScoreThreshold, curveExponent, hardTopFrom, hardTopExponent } = cfg;

  let score;
  if (deltaE <= perfectThreshold) {
    score = maxScore;
  } else if (deltaE >= zeroScoreThreshold) {
    score = 0;
  } else {
    const t = (deltaE - perfectThreshold) / (zeroScoreThreshold - perfectThreshold);
    const ratio = cfg.curve === "similarity-s" ? scoreFromSimilarity(1-t)/100 : Math.pow(1 - t, curveExponent);
    score = maxScore * ratio;
  }

  // hardTopFrom 이상 구간은 한 번 더 눌러서, 그 위로 올라가려면 훨씬 정확해야 하게 만든다.
  if (score > hardTopFrom && score < maxScore) {
    const topRange = maxScore - hardTopFrom;
    score = hardTopFrom + topRange * Math.pow((score - hardTopFrom) / topRange, hardTopExponent);
  }

  // 소수점 첫째 자리까지 표시하므로 여기서도 그 정밀도로만 반올림한다.
  const rounded = Math.round(Math.max(0, Math.min(maxScore, score)) * 10) / 10;

  return {
    score: rounded,
    deltaE,
    method: cfg.method,
  };
}

/**
 * 점수 구간에 따른 짧은 평가 문구의 i18n 키 (실제 문구는 화면에서 t()로 번역한다).
 * @returns {string} "scoreComment.perfect" 같은 i18n 키
 */
export function getScoreComment(score, maxScore = 100) {
  const tier = getScoreTier(score, maxScore);
  return tier === "low" ? "scoreComment.different" : `scoreComment.${tier}`;
}

/** 점수 구간 이름. 화면에서 score-tier--<tier> 클래스로 색/이펙트를 입힌다. */
export function getScoreTier(score, maxScore = 100) {
  const ratio = score / maxScore;
  if (ratio >= 0.95) return "perfect";
  if (ratio >= 0.85) return "great";
  if (ratio >= 0.7) return "good";
  if (ratio >= 0.5) return "okay";
  return "low";
}

const GRADE_BY_TIER = { perfect: "S", great: "A", good: "B", okay: "C", low: "D" };

/** 최종 결과 화면에서 사용할 등급. desc는 i18n 키("grade.S" 등)이며 화면에서 t()로 번역한다. */
export function getGrade(averageScore, maxScore = 100) {
  const tier = getScoreTier(averageScore, maxScore);
  const label = GRADE_BY_TIER[tier];
  return { label, tier, descKey: `grade.${label}` };
}

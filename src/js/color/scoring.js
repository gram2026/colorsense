/**
 * 점수 계산
 * 사용자 색상과 정답 색상의 Delta E를 구하고, 설정된 곡선(curveExponent)에 따라
 * 0~maxScore 범위의 점수로 변환한다.
 *
 * 단순 선형 환산(1 - t)을 그대로 쓰면 점수가 후하게 나오므로,
 * (1 - t)^curveExponent 형태로 눌러서 중간~하위권 점수를 더 엄격하게 만든다.
 */

import { hexToLab } from "./color-convert.js";
import { deltaE76, deltaE2000 } from "./delta-e.js";

/** src/data/config.json 의 scoring 항목과 동일한 기본값 */
export const DEFAULT_SCORING_CONFIG = {
  maxScore: 1000,
  method: "ciede2000",
  perfectThreshold: 2,
  zeroScoreThreshold: 70,
  curveExponent: 1.35,
};

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

  const { maxScore, perfectThreshold, zeroScoreThreshold, curveExponent } = cfg;

  let score;
  if (deltaE <= perfectThreshold) {
    score = maxScore;
  } else if (deltaE >= zeroScoreThreshold) {
    score = 0;
  } else {
    const t = (deltaE - perfectThreshold) / (zeroScoreThreshold - perfectThreshold);
    const ratio = Math.pow(1 - t, curveExponent);
    score = maxScore * ratio;
  }

  return {
    score: Math.round(Math.max(0, Math.min(maxScore, score))),
    deltaE,
    method: cfg.method,
  };
}

/** 점수 구간에 따른 짧은 평가 문구 */
export function getScoreComment(score, maxScore = 1000) {
  const ratio = score / maxScore;
  if (ratio >= 0.95) return "완벽해요";
  if (ratio >= 0.85) return "거의 같아요";
  if (ratio >= 0.7) return "꽤 비슷해요";
  if (ratio >= 0.5) return "조금만 더";
  return "색감이 꽤 달라요";
}

/** 최종 결과 화면에서 사용할 등급 */
export function getGrade(averageScore, maxScore = 1000) {
  const ratio = averageScore / maxScore;
  if (ratio >= 0.95) return { label: "S", desc: "색채 감각 최고" };
  if (ratio >= 0.85) return { label: "A", desc: "훌륭해요" };
  if (ratio >= 0.7) return { label: "B", desc: "좋아요" };
  if (ratio >= 0.5) return { label: "C", desc: "괜찮아요" };
  return { label: "D", desc: "다시 도전해봐요" };
}

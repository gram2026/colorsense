/**
 * color-utils.js (문제 제작기 색상 유틸)에 대한 고정 입력값 테스트.
 * 실행: node tests/problem-maker/color-utils.test.js
 */
import {
  hexToLab,
  labToHex,
  labToRgb,
  weightedMeanLab,
  weightedMedianLab,
  weightedKMeansLab,
  labDistance,
} from "../../problem-maker/js/utils/color-utils.js";

let pass = 0;
let fail = 0;

function assert(condition, message) {
  if (condition) {
    pass += 1;
    console.log("  ✓", message);
  } else {
    fail += 1;
    console.error("  ✗", message);
  }
}

function approxRgb(hexA, hexB, epsilon = 2) {
  const a = labToRgb(hexToLab(hexA));
  const b = labToRgb(hexToLab(hexB));
  return Math.abs(a.r - b.r) <= epsilon && Math.abs(a.g - b.g) <= epsilon && Math.abs(a.b - b.b) <= epsilon;
}

console.log("1) LAB <-> sRGB 왕복 변환 (게임 색상과 어긋나지 않는지)");
{
  for (const hex of ["#FFFFFF", "#000000", "#808080", "#E6322D", "#16A635", "#3FA9C9"]) {
    const lab = hexToLab(hex);
    const back = labToHex(lab);
    assert(approxRgb(hex, back), `${hex} -> LAB -> ${back} 왕복 오차 2 이내`);
  }
}

console.log("\n2) 가중 평균 / 가중 중앙값 (LAB)");
{
  const samples = [
    { lab: hexToLab("#FF0000"), weight: 1 },
    { lab: hexToLab("#FF0000"), weight: 1 },
    { lab: hexToLab("#000000"), weight: 1 }, // 그림자 하나
  ];
  const mean = weightedMeanLab(samples);
  const median = weightedMedianLab(samples);
  assert(labDistance(mean, hexToLab("#FF0000")) < labDistance(hexToLab("#000000"), hexToLab("#FF0000")), "그림자 1개가 섞여도 평균이 검정보다 빨강에 훨씬 가깝다");
  assert(median.l > 0, "중앙값 L은 0보다 크다 (전부 검정이 아님)");
}

console.log("\n3) 결정적 LAB k-평균 (같은 입력 -> 항상 같은 결과)");
{
  const samples = [];
  for (let i = 0; i < 40; i++) samples.push({ lab: hexToLab("#E6322D"), weight: 1 }); // 빨강 40개
  for (let i = 0; i < 30; i++) samples.push({ lab: hexToLab("#8A1008"), weight: 1 }); // 그림자 30개
  for (let i = 0; i < 10; i++) samples.push({ lab: hexToLab("#FFD9D0"), weight: 1 }); // 하이라이트 10개

  const run1 = weightedKMeansLab(samples, 3, 12);
  const run2 = weightedKMeansLab(samples, 3, 12);
  assert(JSON.stringify(run1) === JSON.stringify(run2), "같은 샘플로 두 번 돌리면 완전히 같은 결과 (결정적)");
  assert(run1.length >= 1 && run1.length <= 3, "군집 수는 1~3개");
  assert(run1[0].weight >= run1[run1.length - 1].weight, "가중치 내림차순 정렬");

  const topHex = labToHex(run1[0].centroid);
  assert(approxRgb(topHex, "#E6322D", 25), `가장 큰 군집(${topHex})은 실제 빨강(#E6322D)에 가까워야 함`);
}

console.log("\n4) 완전한 흰색/회색/검은색 물체도 정상 처리");
{
  for (const hex of ["#FFFFFF", "#808080", "#101010"]) {
    const samples = new Array(20).fill(0).map(() => ({ lab: hexToLab(hex), weight: 1 }));
    const clusters = weightedKMeansLab(samples, 3, 10);
    const topHex = labToHex(clusters[0].centroid);
    assert(approxRgb(topHex, hex, 3), `단색 ${hex} 샘플의 대표색은 ${topHex} (거의 동일해야 함)`);
  }
}

console.log("\n----------------------------------------");
console.log(`테스트 완료: 통과 ${pass}개, 실패 ${fail}개`);
process.exit(fail > 0 ? 1 : 0);

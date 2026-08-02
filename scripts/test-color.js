/**
 * 색상 변환 / Delta E / 점수 계산 함수에 대한 간단한 고정 입력값 테스트
 * 실행: npm run test
 */
import { hexToRgb, rgbToHex, rgbToHsl, hslToRgb, hexToLab } from "../src/js/color/color-convert.js";
import { deltaE2000, deltaE76 } from "../src/js/color/delta-e.js";
import { calculateScore, DEFAULT_SCORING_CONFIG } from "../src/js/color/scoring.js";
import { composePreserveLightnessPixel, resolveRenderMode } from "../src/js/color/mask-renderer.js";

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

function approx(a, b, epsilon = 0.6) {
  return Math.abs(a - b) <= epsilon;
}

/** preserve-lightness 테스트용: 지정한 H/S/L을 갖는 "원본 픽셀" 하나를 만든다. */
function makeSample(h, s, l) {
  const rgb = hslToRgb({ h, s, l });
  return { r: rgb.r, g: rgb.g, b: rgb.b, l, s };
}

console.log("1) HEX <-> RGB 왕복 변환");
{
  const hex = "#3FA9C9";
  const rgb = hexToRgb(hex);
  assert(rgbToHex(rgb) === hex, `${hex} 왕복 변환 일치`);
}

console.log("\n2) RGB <-> HSL 왕복 변환");
{
  const rgb = { r: 213, g: 43, b: 43 };
  const hsl = rgbToHsl(rgb);
  const back = hslToRgb(hsl);
  assert(approx(back.r, rgb.r) && approx(back.g, rgb.g) && approx(back.b, rgb.b), "빨강 계열 RGB->HSL->RGB 왕복 오차 0.6 이내");
}

console.log("\n3) Delta E");
{
  const lab = hexToLab("#D52B2B");
  assert(deltaE2000(lab, lab) === 0, "동일 색상의 CIEDE2000 거리는 0");
  assert(deltaE76(lab, lab) === 0, "동일 색상의 DeltaE76 거리는 0");

  const labWhite = hexToLab("#FFFFFF");
  const labBlack = hexToLab("#000000");
  assert(deltaE2000(labWhite, labBlack) > 90, "흑백 사이 CIEDE2000 거리는 매우 큼(>90)");
}

console.log("\n4) 점수 계산");
{
  const perfect = calculateScore("#FFFFFF", "#FFFFFF");
  assert(perfect.score === 1000, "동일 색상은 1000점");

  const worst = calculateScore("#000000", "#FFFFFF");
  assert(worst.score === 0, "흑백처럼 완전히 다른 색은 0점");

  const nearRed = calculateScore("#D52B2B", "#D5302E");
  assert(nearRed.score >= 950, `아주 비슷한 빨강은 950점 이상 (실제 ${nearRed.score})`);

  const complementary = calculateScore("#FF0000", "#00FFFF");
  assert(complementary.score <= 300, `보색 관계는 낮은 점수 (실제 ${complementary.score})`);

  const grayNear = calculateScore("#808080", "#828282");
  assert(grayNear.score >= 950, `채도가 낮은 회색끼리 비슷하면 여전히 높은 점수 (실제 ${grayNear.score})`);

  for (const [a, b] of [
    ["#123456", "#654321"],
    ["#FFFFFF", "#000000"],
    ["#FF00FF", "#00FF00"],
  ]) {
    const { score } = calculateScore(a, b);
    assert(score >= 0 && score <= DEFAULT_SCORING_CONFIG.maxScore, `점수는 항상 0~${DEFAULT_SCORING_CONFIG.maxScore} 범위 (${a} vs ${b} => ${score})`);
  }
}

console.log("\n5) preserve-lightness: 같은 선택색이라도 원본 명도가 다르면 결과가 달라야 함");
{
  const bright = makeSample(30, 45, 82);
  const dark = makeSample(30, 45, 18);
  const brightOut = composePreserveLightnessPixel(bright.r, bright.g, bright.b, 0, 80, bright.l, bright.s, 1);
  const darkOut = composePreserveLightnessPixel(dark.r, dark.g, dark.b, 0, 80, dark.l, dark.s, 1);
  assert(
    brightOut.r !== darkOut.r || brightOut.g !== darkOut.g || brightOut.b !== darkOut.b,
    "밝은 원본과 어두운 원본은 같은 선택색이어도 결과 RGB가 다름"
  );
}

console.log("\n6) preserve-lightness: 원본 명도 순서가 결과 밝기 순서로도 유지되어야 함");
{
  const luma = ({ r, g, b }) => 0.299 * r + 0.587 * g + 0.114 * b;
  const selH = 210; // 파랑 계열
  const selS = 70;
  const shadow = makeSample(0, 45, 15);
  const mid = makeSample(0, 45, 50);
  const highlight = makeSample(0, 45, 85);
  const shadowOut = composePreserveLightnessPixel(shadow.r, shadow.g, shadow.b, selH, selS, shadow.l, shadow.s, 1);
  const midOut = composePreserveLightnessPixel(mid.r, mid.g, mid.b, selH, selS, mid.l, mid.s, 1);
  const highlightOut = composePreserveLightnessPixel(highlight.r, highlight.g, highlight.b, selH, selS, highlight.l, highlight.s, 1);
  assert(
    luma(shadowOut) < luma(midOut) && luma(midOut) < luma(highlightOut),
    `원본 L 15 < 50 < 85 순서가 결과 밝기 순서로 유지됨 (${luma(shadowOut).toFixed(1)} < ${luma(midOut).toFixed(1)} < ${luma(highlightOut).toFixed(1)})`
  );
}

console.log("\n7) preserve-lightness: strength=1일 때 결과의 Hue는 선택색을, Lightness는 원본을 따르고 Saturation은 원본 채도 비율만큼 줄어듦");
{
  const selH = 15;
  const selS = 65;
  const originalL = 40;
  const originalS = 55;
  const expectedS = selS * (originalS / 100);
  const result = composePreserveLightnessPixel(90, 60, 60, selH, selS, originalL, originalS, 1);
  const back = rgbToHsl(result);
  assert(approx(back.h, selH, 1.5), `결과 Hue(${back.h.toFixed(1)})가 선택 Hue(${selH})와 거의 같음`);
  assert(
    approx(back.s, expectedS, 1.5),
    `결과 Saturation(${back.s.toFixed(1)})이 선택S×원본S비율(${expectedS.toFixed(1)})과 거의 같음`
  );
  assert(approx(back.l, originalL, 1.5), `결과 Lightness(${back.l.toFixed(1)})가 원본 Lightness(${originalL})와 거의 같음`);
}

console.log("\n8) preserve-lightness: 마스크 알파(strength) 0 / 255 / 128 경계값");
{
  const orig = { r: 180, g: 90, b: 40 };
  const selH = 260;
  const selS = 55;
  const originalL = 62;
  const originalS = 48;
  const effectiveS = selS * (originalS / 100);

  const zero = composePreserveLightnessPixel(orig.r, orig.g, orig.b, selH, selS, originalL, originalS, 0);
  assert(
    zero.r === orig.r && zero.g === orig.g && zero.b === orig.b,
    "strength 0(알파 0)이면 결과가 원본 픽셀과 정확히 같음"
  );

  const recolored = hslToRgb({ h: selH, s: effectiveS, l: originalL });
  const full = composePreserveLightnessPixel(orig.r, orig.g, orig.b, selH, selS, originalL, originalS, 1);
  assert(
    approx(full.r, recolored.r, 0.01) && approx(full.g, recolored.g, 0.01) && approx(full.b, recolored.b, 0.01),
    "strength 1(알파 255)이면 결과가 preserve-lightness 재계산 색과 일치"
  );

  const half = composePreserveLightnessPixel(orig.r, orig.g, orig.b, selH, selS, originalL, originalS, 0.5);
  const expectedMidR = (orig.r + recolored.r) / 2;
  const expectedMidG = (orig.g + recolored.g) / 2;
  const expectedMidB = (orig.b + recolored.b) / 2;
  assert(
    approx(half.r, expectedMidR, 0.01) && approx(half.g, expectedMidG, 0.01) && approx(half.b, expectedMidB, 0.01),
    "strength 0.5(알파 128)이면 결과가 원본과 재계산색의 중간값과 일치"
  );
}

console.log("\n9) preserve-lightness: 무채색 원본/선택색에서도 NaN이나 값 깨짐이 없어야 함");
{
  const cases = [
    { orig: [255, 255, 255], selH: 0, selS: 0 }, // 흰색 원본, 무채색 선택
    { orig: [128, 128, 128], selH: 0, selS: 0 }, // 회색 원본, 무채색 선택
    { orig: [0, 0, 0], selH: 0, selS: 0 }, // 검정 원본, 무채색 선택
    { orig: [128, 128, 128], selH: 210, selS: 90 }, // 무채색 원본 + 채도 높은 선택색
  ];
  for (const { orig, selH, selS } of cases) {
    const origHsl = rgbToHsl({ r: orig[0], g: orig[1], b: orig[2] });
    const result = composePreserveLightnessPixel(orig[0], orig[1], orig[2], selH, selS, origHsl.l, origHsl.s, 1);
    const finite = Number.isFinite(result.r) && Number.isFinite(result.g) && Number.isFinite(result.b);
    const inRange = [result.r, result.g, result.b].every((v) => v >= 0 && v <= 255);
    assert(finite, `원본 RGB(${orig}) + 선택 H${selH}/S${selS}: NaN 없음`);
    assert(inRange, `원본 RGB(${orig}) + 선택 H${selH}/S${selS}: 0~255 범위 안에 있음`);
  }

  // 원본이 완전 무채색(S=0)이면, 선택색 채도가 아무리 높아도 결과는 여전히 거의 무채색이어야 한다
  // (반사광처럼 원래 색이 옅던 부분이 선택색에 과하게 물들지 않는다는 새 규칙의 핵심 확인).
  const grayOriginal = rgbToHsl({ r: 128, g: 128, b: 128 });
  const saturatedPick = composePreserveLightnessPixel(128, 128, 128, 210, 90, grayOriginal.l, grayOriginal.s, 1);
  const backS = rgbToHsl(saturatedPick).s;
  assert(backS < 5, `무채색 원본(S=0)에 채도 90 선택색을 적용해도 결과 채도는 거의 0 (실제 ${backS.toFixed(1)})`);
}

console.log("\n10) renderMode 분기: 지원 모드는 그대로, 없거나 알 수 없는 값은 안전한 기본값으로");
{
  assert(resolveRenderMode("preserve-lightness") === "preserve-lightness", "preserve-lightness는 그대로 유지됨");
  assert(resolveRenderMode(undefined) === "preserve-lightness", "renderMode가 없으면 preserve-lightness로 대체됨");
  assert(resolveRenderMode(null) === "preserve-lightness", "renderMode가 null이어도 preserve-lightness로 대체됨");
  assert(
    resolveRenderMode("some-fancy-mode") === "preserve-lightness",
    "알 수 없는 renderMode도 preserve-lightness로 안전하게 대체됨"
  );
}

console.log("\n11) 실제 사진 형태 합성: 반사광/하이라이트/중간/그림자/반투명 가장자리 + 빨강/초록/파랑 각각 적용");
{
  const luma = ({ r, g, b }) => 0.299 * r + 0.587 * g + 0.114 * b;
  // 실사 사진처럼 반사광은 원래 채도가 거의 빠져있고(near-white), 그림자/중간은 원래 색이
  // 어느 정도 남아있다고 가정한 픽셀들 (h는 원본 사진의 원래 색상이라 결과에는 영향을 주지 않음).
  const samples = [
    { ...makeSample(200, 8, 92), alpha: 255, label: "반사광" },
    { ...makeSample(200, 25, 78), alpha: 255, label: "하이라이트" },
    { ...makeSample(200, 55, 50), alpha: 255, label: "중간 표면" },
    { ...makeSample(200, 45, 20), alpha: 255, label: "그림자" },
    { ...makeSample(200, 40, 55), alpha: 128, label: "마스크 가장자리(반투명)" },
  ];

  for (const [name, hex] of [
    ["빨강", "#E02020"],
    ["초록", "#20A020"],
    ["파랑", "#2050E0"],
  ]) {
    const { r, g, b } = hexToRgb(hex);
    const { h: selH, s: selS } = rgbToHsl({ r, g, b });

    const results = samples.map((p) => {
      const strength = p.alpha / 255;
      const out = composePreserveLightnessPixel(p.r, p.g, p.b, selH, selS, p.l, p.s, strength);
      return { ...p, out, brightness: luma(out) };
    });

    const [reflection, highlight, mid, shadow, edge] = results;
    assert(
      reflection.brightness > highlight.brightness &&
        highlight.brightness > mid.brightness &&
        mid.brightness > shadow.brightness,
      `${name} 선택 시 반사광 > 하이라이트 > 중간 > 그림자 밝기 순서 유지`
    );

    const edgeOrig = luma({ r: edge.r, g: edge.g, b: edge.b });
    const edgeFull = luma(composePreserveLightnessPixel(edge.r, edge.g, edge.b, selH, selS, edge.l, edge.s, 1));
    assert(
      edge.brightness > Math.min(edgeOrig, edgeFull) - 0.01 && edge.brightness < Math.max(edgeOrig, edgeFull) + 0.01,
      `${name} 선택 시 반투명 가장자리는 원본과 완전 합성색 밝기 사이에 위치`
    );

    assert(
      rgbToHsl(reflection.out).s < rgbToHsl(mid.out).s,
      `${name} 선택 시 원래 채도가 옅던 반사광은 원래 채도가 진하던 중간 표면보다 결과 채도도 낮음 (반사광 원래 재질감 유지)`
    );

    for (const p of results) {
      assert(
        [p.out.r, p.out.g, p.out.b].every((v) => Number.isFinite(v) && v >= 0 && v <= 255),
        `${name} 선택 시 ${p.label} 결과가 0~255 범위 안의 유한한 값`
      );
    }
  }
}

console.log("\n----------------------------------------");
console.log(`테스트 완료: 통과 ${pass}개, 실패 ${fail}개`);
process.exit(fail > 0 ? 1 : 0);

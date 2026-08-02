/**
 * color-extractor.js에 대한 테스트. 실제 Canvas 없이, extractAnswerColorCandidates가
 * 기대하는 최소 인터페이스({width, height, getOriginalLabBuffer(), getMaskImageData()})만
 * 흉내 낸 가짜 canvasEditor를 넘겨서 순수 로직만 검증한다.
 * 실행: node tests/problem-maker/color-extractor.test.js
 */
import { extractAnswerColorCandidates } from "../../problem-maker/js/color-extractor.js";
import { hexToLab, deltaE76 } from "../../problem-maker/js/utils/color-utils.js";

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

/**
 * width x height 크기의 가짜 이미지를 만든다. paintFn(x,y) -> {hex, alpha} 로 각 픽셀을 채운다.
 */
function makeFakeEditor(width, height, paintFn) {
  const lab = new Float32Array(width * height * 3);
  const maskData = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const { hex, alpha } = paintFn(x, y);
      const l = hexToLab(hex);
      lab[i * 3] = l.l;
      lab[i * 3 + 1] = l.a;
      lab[i * 3 + 2] = l.b;
      maskData[i * 4 + 3] = alpha;
    }
  }

  return {
    width,
    height,
    getOriginalLabBuffer: () => lab,
    getMaskImageData: () => ({ data: maskData, width, height }),
  };
}

function closeHex(hexA, hexB, epsilon = 20) {
  return deltaE76(hexToLab(hexA), hexToLab(hexB)) <= epsilon;
}

console.log("1) 단색 빨간 영역");
{
  const editor = makeFakeEditor(20, 20, () => ({ hex: "#CC2222", alpha: 255 }));
  const result = extractAnswerColorCandidates(editor);
  assert(!result.empty, "결과가 비어있지 않음");
  assert(closeHex(result.autoHex, "#CC2222", 3), `단색 빨강의 추천색(${result.autoHex})은 원래 색과 거의 같아야 함`);
}

console.log("\n2) 밝은 하이라이트가 포함된 빨간 물체");
{
  const editor = makeFakeEditor(30, 30, (x, y) => {
    // 왼쪽 위 모서리 10%만 밝은 하이라이트, 나머지는 기본 빨강
    if (x < 3 && y < 3) return { hex: "#FFE5DD", alpha: 255 };
    return { hex: "#D93A2E", alpha: 255 };
  });
  const result = extractAnswerColorCandidates(editor);
  assert(closeHex(result.autoHex, "#D93A2E", 12), `하이라이트가 일부 섞여도 추천색(${result.autoHex})은 기본 빨강에 가까워야 함`);
}

console.log("\n3) 어두운 그림자가 포함된 파란 물체");
{
  const editor = makeFakeEditor(30, 30, (x, y) => {
    if (y > 25) return { hex: "#0A1A33", alpha: 255 }; // 아래쪽 그림자
    return { hex: "#3A6EA5", alpha: 255 };
  });
  const result = extractAnswerColorCandidates(editor);
  assert(closeHex(result.autoHex, "#3A6EA5", 12), `그림자가 일부 섞여도 추천색(${result.autoHex})은 기본 파랑에 가까워야 함`);
}

console.log("\n4) 흰색/회색/검은색 물체");
{
  for (const hex of ["#FFFFFF", "#808080", "#111111"]) {
    const editor = makeFakeEditor(16, 16, () => ({ hex, alpha: 255 }));
    const result = extractAnswerColorCandidates(editor);
    assert(closeHex(result.autoHex, hex, 3), `무채색 ${hex}의 추천색(${result.autoHex})도 정상 처리되어야 함`);
  }
}

console.log("\n5) 반투명 마스크 가장자리 (알파가 가중치로 반영되는지)");
{
  // 중심부는 완전 선택(파랑, alpha 255), 가장자리 절반은 절반 강도(주황, alpha 128)
  const editor = makeFakeEditor(20, 20, (x, y) => {
    const edge = x < 2 || x > 17 || y < 2 || y > 17;
    return edge ? { hex: "#FF8800", alpha: 128 } : { hex: "#2244CC", alpha: 255 };
  });
  const result = extractAnswerColorCandidates(editor);
  // 중심부(가중치 높음)가 지배적이어야 하므로 파랑 계열에 훨씬 가까워야 한다.
  const distToBlue = deltaE76(hexToLab(result.autoHex), hexToLab("#2244CC"));
  const distToOrange = deltaE76(hexToLab(result.autoHex), hexToLab("#FF8800"));
  assert(distToBlue < distToOrange, `가중치가 높은 중심부(파랑)가 지배적이어야 함 (추천색 ${result.autoHex})`);
}

console.log("\n6) 마스크가 비어 있는 경우");
{
  const editor = makeFakeEditor(10, 10, () => ({ hex: "#FF0000", alpha: 0 }));
  const result = extractAnswerColorCandidates(editor);
  assert(result.empty === true, "알파가 전부 0이면 empty=true를 반환해야 함");
  assert(Array.isArray(result.candidates) && result.candidates.length === 0, "empty일 때 후보 목록은 비어있어야 함");
}

console.log("\n7) 항상 같은 결과 (결정적)");
{
  const editor = makeFakeEditor(25, 25, (x, y) => ({
    hex: (x + y) % 2 === 0 ? "#4C9A2A" : "#2D6E6E",
    alpha: 255,
  }));
  const r1 = extractAnswerColorCandidates(editor);
  const r2 = extractAnswerColorCandidates(editor);
  assert(r1.autoHex === r2.autoHex, "같은 이미지+마스크는 항상 같은 추천색을 내야 함");
  assert(JSON.stringify(r1.candidates) === JSON.stringify(r2.candidates), "후보 색상 목록도 항상 동일해야 함");
}

console.log("\n----------------------------------------");
console.log(`테스트 완료: 통과 ${pass}개, 실패 ${fail}개`);
process.exit(fail > 0 ? 1 : 0);

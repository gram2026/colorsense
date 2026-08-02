/**
 * history-manager.js (실행 취소/다시 실행)에 대한 테스트.
 * 실제 Canvas 없이, {data:Uint8ClampedArray} 형태의 가짜 ImageData를 직접 조작해서
 * begin/commit/undo/redo가 올바른 사각 영역만 저장하고 되돌리는지 검증한다.
 * 실행: node tests/problem-maker/history-manager.test.js
 */
import { HistoryManager } from "../../problem-maker/js/history-manager.js";

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

function makeFakeMask(width, height) {
  const data = new Uint8ClampedArray(width * height * 4);
  return {
    width,
    height,
    data,
    getAlpha(x, y) {
      return data[(y * width + x) * 4 + 3];
    },
    setAlpha(x, y, a) {
      const i = (y * width + x) * 4;
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = a;
    },
  };
}

console.log("1) 브러시 한 번 = 실행취소 1번으로 완전히 되돌아감");
{
  const width = 10;
  const height = 10;
  const mask = makeFakeMask(width, height);
  let putCalls = 0;

  const history = new HistoryManager({
    width,
    height,
    getMaskImageData: () => ({ data: mask.data, width, height }),
    putPatch: (alphaPatch, x, y, w, h) => {
      putCalls += 1;
      for (let row = 0; row < h; row++) {
        for (let col = 0; col < w; col++) {
          mask.setAlpha(x + col, y + row, alphaPatch[row * w + col]);
        }
      }
    },
  });

  history.begin("brush");
  for (let y = 3; y <= 5; y++) {
    for (let x = 3; x <= 5; x++) mask.setAlpha(x, y, 255);
  }
  history.commit();

  assert(mask.getAlpha(4, 4) === 255, "커밋 직후 칠한 픽셀은 255");
  assert(history.canUndo() === true, "커밋 후에는 실행취소 가능");

  history.undo();
  assert(mask.getAlpha(4, 4) === 0, "실행취소하면 칠하기 전 상태(0)로 되돌아감");
  assert(mask.getAlpha(0, 0) === 0, "칠하지 않은 픽셀은 애초에 영향 없음");
  assert(putCalls === 1, "undo는 putPatch를 정확히 1번 호출한다");

  history.redo();
  assert(mask.getAlpha(4, 4) === 255, "다시 실행하면 칠한 상태로 복원됨");
}

console.log("\n2) 아무것도 바뀌지 않은 작업은 히스토리에 남지 않는다");
{
  const width = 5;
  const height = 5;
  const mask = makeFakeMask(width, height);
  const history = new HistoryManager({
    width,
    height,
    getMaskImageData: () => ({ data: mask.data, width, height }),
    putPatch: () => {},
  });

  history.begin("noop");
  // 아무 것도 안 그림
  history.commit();

  assert(history.canUndo() === false, "변경이 없으면 undo 스택에 쌓이지 않는다");
}

console.log("\n3) 여러 번 실행취소/다시 실행 (스택 순서)");
{
  const width = 8;
  const height = 8;
  const mask = makeFakeMask(width, height);
  const history = new HistoryManager({
    width,
    height,
    getMaskImageData: () => ({ data: mask.data, width, height }),
    putPatch: (alphaPatch, x, y, w, h) => {
      for (let row = 0; row < h; row++) {
        for (let col = 0; col < w; col++) mask.setAlpha(x + col, y + row, alphaPatch[row * w + col]);
      }
    },
  });

  history.begin("a");
  mask.setAlpha(0, 0, 100);
  history.commit();

  history.begin("b");
  mask.setAlpha(7, 7, 200);
  history.commit();

  assert(mask.getAlpha(0, 0) === 100 && mask.getAlpha(7, 7) === 200, "두 작업 모두 반영됨");

  history.undo(); // b 취소
  assert(mask.getAlpha(7, 7) === 0 && mask.getAlpha(0, 0) === 100, "가장 최근 작업(b)만 취소됨");

  history.undo(); // a 취소
  assert(mask.getAlpha(0, 0) === 0, "그 다음 작업(a)까지 취소됨");
  assert(history.canUndo() === false, "더 이상 취소할 것이 없음");

  history.redo();
  history.redo();
  assert(mask.getAlpha(0, 0) === 100 && mask.getAlpha(7, 7) === 200, "두 번 다시 실행하면 원래대로 복원");
}

console.log("\n4) 더티 렉트: 실제로 바뀐 영역만 저장한다 (전체 캔버스가 아니라)");
{
  const width = 100;
  const height = 100;
  const mask = makeFakeMask(width, height);
  let lastPatchSize = null;
  const history = new HistoryManager({
    width,
    height,
    getMaskImageData: () => ({ data: mask.data, width, height }),
    putPatch: () => {},
  });

  history.begin("small-dab");
  mask.setAlpha(50, 50, 255); // 딱 1픽셀만 변경
  history.commit();

  const entry = history.undoStack[history.undoStack.length - 1];
  assert(entry.bbox.w === 1 && entry.bbox.h === 1, `1픽셀만 바뀌면 bbox도 1x1이어야 함 (실제 ${entry.bbox.w}x${entry.bbox.h})`);
  assert(entry.before.length === 1 && entry.after.length === 1, "패치 크기도 전체 100x100이 아니라 1이어야 함 (메모리 절약)");
}

console.log("\n----------------------------------------");
console.log(`테스트 완료: 통과 ${pass}개, 실패 ${fail}개`);
process.exit(fail > 0 ? 1 : 0);

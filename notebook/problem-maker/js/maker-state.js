/**
 * 문제 제작기 전역 상태 (게임 본체 src/js/state.js와 같은 아주 단순한 pub/sub 스토어)
 * 이미지/마스크 같은 무거운 픽셀 데이터는 여기 넣지 않는다 (canvas-editor.js가 따로 들고 있음).
 * 여기서는 "저장해야 하는 값(문제 메타데이터, 도구 설정, 뷰 설정)"만 다룬다.
 */

function createInitialState() {
  return {
    screen: "start",
    draftId: null, // IndexedDB 임시 저장 키 (저장된 적 있으면 채워짐)
    isDirty: false,
    sourceFileName: null,

    project: {
      schemaVersion: 1,
      categoryId: "",
      id: "",
      title: "",
      difficulty: 1,
      tags: [],
      startColorMode: "auto", // 'auto' | 'fixed'
      startColorFixed: null,
      renderMode: "preserve-lightness",
      enabled: true,
      authorNote: "",
      sourceNote: "",
      copyrightConfirmed: false,
      editingOriginalId: null, // 기존 문제를 열어 수정 중이면 원래 id (복제 여부 판단용)
    },

    image: {
      naturalWidth: 0,
      naturalHeight: 0,
      workingWidth: 0,
      workingHeight: 0,
      maxLongEdge: 2048,
      keepOriginal: false,
    },

    tool: {
      current: "brush",
      brushSize: 40,
      brushHardness: 0.75,
      smartTolerance: 24,
      smartMode: "contiguous", // 'contiguous' | 'global'
      op: "add", // 'add' | 'subtract' (브러시/폴리곤/스마트선택 공통 가감 모드)
    },

    color: {
      answerColor: null,
      source: "auto", // 'auto' | 'manual'
      candidates: [],
      consistency: 0,
      recent: [],
    },

    view: {
      mode: "normal", // 'normal' | 'mask-only' | 'original-only' | 'preview'
      maskOverlayColor: "#3aa0ff",
      maskOverlayOpacity: 0.55,
      previewHex: null,
      compareMode: false,
    },

    thumbnail: {
      offsetX: 0.5,
      offsetY: 0.5,
      zoom: 1,
    },
  };
}

let state = createInitialState();
const listeners = new Set();

export function getState() {
  return state;
}

export function setState(partial) {
  state = { ...state, ...partial };
  for (const listener of listeners) listener(state);
  return state;
}

/** project/tool/color/view처럼 중첩된 슬라이스 하나만 얕게 병합 */
export function patchSlice(sliceKey, partial) {
  return setState({ [sliceKey]: { ...state[sliceKey], ...partial } });
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function resetState() {
  state = createInitialState();
  for (const listener of listeners) listener(state);
}

export function markDirty() {
  if (!state.isDirty) setState({ isDirty: true });
}

export function markClean() {
  if (state.isDirty) setState({ isDirty: false });
}

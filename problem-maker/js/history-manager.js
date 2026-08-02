/**
 * 실행 취소 / 다시 실행 (더티 렉트 방식)
 * ---------------------------------------------------------------
 * 마우스 이동마다 전체 마스크를 저장하지 않는다. 한 번의 작업(브러시 드래그
 * 하나, 폴리곤 확정 하나, 스마트 선택 확정 하나, 전체선택/반전/확장/축소/
 * 페더링 하나)을 begin()~commit()으로 감싸고, 실제로 바뀐 사각 영역(bbox)의
 * 알파 채널만 before/after로 저장한다. 전체 캔버스를 매번 복사하는 것보다
 * 메모리를 훨씬 적게 쓴다.
 */

const MAX_HISTORY = 40;
const MAX_TOTAL_BYTES = 180 * 1024 * 1024; // 안전장치: 이보다 커지면 오래된 기록부터 버린다

export class HistoryManager {
  constructor({ getMaskImageData, putPatch, width, height }) {
    this._getMaskImageData = getMaskImageData; // () => ImageData (전체 캔버스)
    this._putPatch = putPatch; // (alphaUint8Array, x, y, w, h) => void
    this.width = width;
    this.height = height;

    this.undoStack = [];
    this.redoStack = [];
    this._pendingBefore = null; // 진행 중인 작업의 시작 시점 전체 알파
    this._pendingLabel = null;
    this._onChange = null;
    this._totalBytes = 0;
  }

  onChange(fn) {
    this._onChange = fn;
  }

  _notify() {
    this._onChange?.({ canUndo: this.canUndo(), canRedo: this.canRedo() });
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  /** 작업 시작 시 1회 호출 (pointerdown, 폴리곤 확정 직전, 전체선택 버튼 클릭 등) */
  begin(label = "edit") {
    if (this._pendingBefore) return; // 이미 진행 중이면 무시 (중복 begin 방지)
    this._pendingLabel = label;
    this._pendingBefore = extractAlpha(this._getMaskImageData());
  }

  /** 작업 종료 시 1회 호출. 실제로 바뀐 사각 영역만 골라서 히스토리에 남긴다. */
  commit() {
    if (!this._pendingBefore) return;
    const before = this._pendingBefore;
    this._pendingBefore = null;

    const after = extractAlpha(this._getMaskImageData());
    const bbox = diffBoundingBox(before, after, this.width, this.height);

    if (!bbox) {
      // 아무 것도 안 바뀐 작업(빈 드래그 등)은 히스토리에 남기지 않는다.
      return;
    }

    const beforePatch = extractPatch(before, this.width, bbox);
    const afterPatch = extractPatch(after, this.width, bbox);

    this._push({ label: this._pendingLabel, bbox, before: beforePatch, after: afterPatch });
    this.redoStack = [];
    this._notify();
  }

  /** 진행 중이던 작업을 취소한다 (Esc 등으로 되돌릴 때 히스토리에 남기지 않고 원상복구) */
  cancelPending() {
    if (!this._pendingBefore) return;
    const bbox = { x: 0, y: 0, w: this.width, h: this.height };
    this._putPatch(this._pendingBefore, bbox.x, bbox.y, bbox.w, bbox.h);
    this._pendingBefore = null;
  }

  _push(entry) {
    this.undoStack.push(entry);
    this._totalBytes += entry.before.length + entry.after.length;
    while (this.undoStack.length > MAX_HISTORY || this._totalBytes > MAX_TOTAL_BYTES) {
      const dropped = this.undoStack.shift();
      if (!dropped) break;
      this._totalBytes -= dropped.before.length + dropped.after.length;
    }
  }

  undo() {
    const entry = this.undoStack.pop();
    if (!entry) return false;
    this._putPatch(entry.before, entry.bbox.x, entry.bbox.y, entry.bbox.w, entry.bbox.h);
    this.redoStack.push(entry);
    this._notify();
    return true;
  }

  redo() {
    const entry = this.redoStack.pop();
    if (!entry) return false;
    this._putPatch(entry.after, entry.bbox.x, entry.bbox.y, entry.bbox.w, entry.bbox.h);
    this.undoStack.push(entry);
    this._notify();
    return true;
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this._pendingBefore = null;
    this._totalBytes = 0;
    this._notify();
  }
}

function extractAlpha(imageData) {
  const { data } = imageData;
  const alpha = new Uint8Array(data.length / 4);
  for (let i = 0, p = 3; p < data.length; i++, p += 4) {
    alpha[i] = data[p];
  }
  return alpha;
}

function diffBoundingBox(before, after, width, height) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    const rowStart = y * width;
    for (let x = 0; x < width; x++) {
      const i = rowStart + x;
      if (before[i] !== after[i]) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

function extractPatch(alphaFull, fullWidth, bbox) {
  const patch = new Uint8Array(bbox.w * bbox.h);
  for (let row = 0; row < bbox.h; row++) {
    const srcStart = (bbox.y + row) * fullWidth + bbox.x;
    patch.set(alphaFull.subarray(srcStart, srcStart + bbox.w), row * bbox.w);
  }
  return patch;
}

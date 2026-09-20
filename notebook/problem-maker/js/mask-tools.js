/**
 * 마스크 편집 도구: 브러시, 지우개, 다각형 선택, 전체선택/반전/확장/축소/
 * 페더링/구멍 채우기/고립 픽셀 제거.
 * 마스크는 항상 "흰색 RGB + 가변 알파" 규약을 지킨다 (원본 이미지 색이 섞이지 않음).
 * 모든 확정 동작은 history-manager의 begin()/commit()으로 감싸서 실행취소가 되게 한다.
 */

/**
 * CSS blur 기반 근사 팽창(expand)/침식(contract). editor.maskBuffer를 직접 읽고
 * editor.maskBufferCtx에 결과를 그대로 써 넣는다 (history begin/commit은 호출부 책임).
 * 침식은 "반전 -> 팽창 -> 반전"과 수학적으로 같다는 성질을 이용한다.
 */
function growShrinkPixels(editor, radiusPx, direction) {
  const { width, height, maskBufferCtx: ctx, maskBuffer } = editor;
  const source = document.createElement("canvas");
  source.width = width;
  source.height = height;
  const sourceCtx = source.getContext("2d");

  if (direction === "contract") {
    const inverted = editor.getMaskImageData();
    const data = inverted.data;
    for (let p = 0; p < data.length; p += 4) {
      data[p] = 255;
      data[p + 1] = 255;
      data[p + 2] = 255;
      data[p + 3] = 255 - data[p + 3];
    }
    sourceCtx.putImageData(inverted, 0, 0);
  } else {
    sourceCtx.drawImage(maskBuffer, 0, 0);
  }

  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.filter = `blur(${Math.max(0.5, radiusPx)}px)`;
  ctx.drawImage(source, 0, 0);
  ctx.filter = "none";
  ctx.restore();

  const blurred = editor.getMaskImageData();
  const bdata = blurred.data;
  for (let p = 0; p < bdata.length; p += 4) {
    const isSelected = bdata[p + 3] > 4;
    bdata[p] = 255;
    bdata[p + 1] = 255;
    bdata[p + 2] = 255;
    bdata[p + 3] = isSelected ? 255 : 0;
  }
  if (direction === "contract") {
    for (let p = 0; p < bdata.length; p += 4) {
      bdata[p + 3] = 255 - bdata[p + 3];
    }
  }
  editor.putMaskImageData(blurred);
}

export class MaskTools {
  constructor({ canvasEditor, historyManager }) {
    this.editor = canvasEditor;
    this.history = historyManager;
    this._strokeActive = false;
    this._lastPoint = null;
    this.polygonPoints = [];
  }

  get ctx() {
    return this.editor.maskBufferCtx;
  }

  // ---------------- 브러시 / 지우개 ----------------

  strokeStart(point, { size, hardness, mode }) {
    this.history.begin(mode === "erase" ? "eraser" : "brush");
    this._strokeActive = true;
    this._lastPoint = point;
    this._paintDab(point, size, hardness, mode);
    this.editor.notifyMaskChanged();
  }

  strokeMove(point, { size, hardness, mode }) {
    if (!this._strokeActive) return;
    const spacing = Math.max(1, size * 0.18);
    const dx = point.x - this._lastPoint.x;
    const dy = point.y - this._lastPoint.y;
    const dist = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.floor(dist / spacing));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const p = { x: this._lastPoint.x + dx * t, y: this._lastPoint.y + dy * t };
      this._paintDab(p, size, hardness, mode);
    }
    this._lastPoint = point;
    this.editor.notifyMaskChanged();
  }

  strokeEnd() {
    if (!this._strokeActive) return;
    this._strokeActive = false;
    this._lastPoint = null;
    this.history.commit();
  }

  _paintDab(point, size, hardness, mode) {
    const ctx = this.ctx;
    const radius = Math.max(0.5, size / 2);
    const hardStop = Math.min(0.98, Math.max(0, hardness));

    ctx.save();
    ctx.globalCompositeOperation = mode === "erase" ? "destination-out" : "source-over";
    const grad = ctx.createRadialGradient(point.x, point.y, radius * hardStop, point.x, point.y, radius);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ---------------- 다각형 선택 ----------------

  polygonAddPoint(point) {
    this.polygonPoints.push(point);
  }

  polygonUndoLastPoint() {
    this.polygonPoints.pop();
  }

  polygonCancel() {
    this.polygonPoints = [];
  }

  /** 첫 점 근처를 클릭했는지 (닫기 판정, 임계값은 캔버스 픽셀 기준) */
  isNearFirstPoint(point, thresholdPx) {
    if (this.polygonPoints.length === 0) return false;
    const first = this.polygonPoints[0];
    return Math.hypot(point.x - first.x, point.y - first.y) <= thresholdPx;
  }

  polygonConfirm(op) {
    if (this.polygonPoints.length < 3) {
      this.polygonPoints = [];
      return false;
    }
    const points = this.polygonPoints;
    this.polygonPoints = [];

    this.history.begin("polygon");
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = op === "subtract" ? "destination-out" : "source-over";
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    this.history.commit();
    this.editor.notifyMaskChanged();
    return true;
  }

  // ---------------- 임의 알파 선택을 마스크에 반영 (스마트선택 등에서 재사용) ----------------

  applySelectionAlpha(alphaArray, op = "add") {
    const { width, height } = this.editor;
    this.history.begin(op === "subtract" ? "selection-subtract" : "selection-add");

    const imageData = new ImageData(width, height);
    const data = imageData.data;
    for (let i = 0, p = 0; i < alphaArray.length; i++, p += 4) {
      data[p] = 255;
      data[p + 1] = 255;
      data[p + 2] = 255;
      data[p + 3] = alphaArray[i];
    }
    const temp = document.createElement("canvas");
    temp.width = width;
    temp.height = height;
    temp.getContext("2d").putImageData(imageData, 0, 0);

    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = op === "subtract" ? "destination-out" : "source-over";
    ctx.drawImage(temp, 0, 0);
    ctx.restore();

    this.history.commit();
    this.editor.notifyMaskChanged();
  }

  // ---------------- 전체/보조 기능 ----------------

  selectAll() {
    this.history.begin("select-all");
    const { width, height } = this.editor;
    this.ctx.save();
    this.ctx.globalCompositeOperation = "source-over";
    this.ctx.fillStyle = "#ffffff";
    this.ctx.fillRect(0, 0, width, height);
    this.ctx.restore();
    this.history.commit();
    this.editor.notifyMaskChanged();
  }

  selectNone() {
    this.history.begin("select-none");
    const { width, height } = this.editor;
    this.ctx.clearRect(0, 0, width, height);
    this.history.commit();
    this.editor.notifyMaskChanged();
  }

  invert() {
    this.history.begin("invert");
    const imageData = this.editor.getMaskImageData();
    const data = imageData.data;
    for (let p = 0; p < data.length; p += 4) {
      const a = 255 - data[p + 3];
      data[p] = 255;
      data[p + 1] = 255;
      data[p + 2] = 255;
      data[p + 3] = a;
    }
    this.editor.putMaskImageData(imageData);
    this.history.commit();
    this.editor.notifyMaskChanged();
  }

  /** CSS blur 필터를 이용한 근사 팽창/침식 (원 모양 커널을 픽셀 단위로 직접 도는 것보다 훨씬 빠르다) */
  expand(radiusPx) {
    this.history.begin("expand");
    growShrinkPixels(this.editor, radiusPx, "expand");
    this.history.commit();
    this.editor.notifyMaskChanged();
  }

  contract(radiusPx) {
    this.history.begin("contract");
    growShrinkPixels(this.editor, radiusPx, "contract");
    this.history.commit();
    this.editor.notifyMaskChanged();
  }

  feather(radiusPx) {
    this.history.begin("feather");
    const { width, height } = this.editor;
    const source = document.createElement("canvas");
    source.width = width;
    source.height = height;
    source.getContext("2d").drawImage(this.editor.maskBuffer, 0, 0);

    this.ctx.clearRect(0, 0, width, height);
    this.ctx.save();
    this.ctx.filter = `blur(${Math.max(0.5, radiusPx)}px)`;
    this.ctx.drawImage(source, 0, 0);
    this.ctx.filter = "none";
    this.ctx.restore();

    // 블러는 RGB에도 번지므로(투명 영역 RGB가 0,0,0 근처로 섞임) 흰색으로 다시 고정한다.
    const imageData = this.editor.getMaskImageData();
    const data = imageData.data;
    for (let p = 0; p < data.length; p += 4) {
      data[p] = 255;
      data[p + 1] = 255;
      data[p + 2] = 255;
    }
    this.editor.putMaskImageData(imageData);

    this.history.commit();
    this.editor.notifyMaskChanged();
  }

  /** 작은 구멍 채우기 = 작은 반경으로 팽창 후 침식 (모폴로지 닫힘 연산) */
  fillHoles(radiusPx = 6) {
    this.history.begin("fill-holes");
    growShrinkPixels(this.editor, radiusPx, "expand");
    growShrinkPixels(this.editor, radiusPx, "contract");
    this.history.commit();
    this.editor.notifyMaskChanged();
  }

  /** 지정한 픽셀 수 미만의 고립된 조각을 제거한다 (연결 요소 분석) */
  despeckle(minPixels = 24) {
    this.history.begin("despeckle");
    const { width, height } = this.editor;
    const imageData = this.editor.getMaskImageData();
    const data = imageData.data;
    const total = width * height;
    const selected = new Uint8Array(total);
    for (let i = 0, p = 3; i < total; i++, p += 4) selected[i] = data[p] > 8 ? 1 : 0;

    const visited = new Uint8Array(total);
    const stack = new Int32Array(total);

    for (let start = 0; start < total; start++) {
      if (!selected[start] || visited[start]) continue;

      let sp = 0;
      stack[sp++] = start;
      visited[start] = 1;
      const component = [start];

      while (sp > 0) {
        const idx = stack[--sp];
        const x = idx % width;
        const y = (idx / width) | 0;

        const neighbors = [
          x > 0 ? idx - 1 : -1,
          x < width - 1 ? idx + 1 : -1,
          y > 0 ? idx - width : -1,
          y < height - 1 ? idx + width : -1,
        ];
        for (const n of neighbors) {
          if (n >= 0 && selected[n] && !visited[n]) {
            visited[n] = 1;
            stack[sp++] = n;
            component.push(n);
          }
        }
      }

      if (component.length < minPixels) {
        for (const idx of component) {
          data[idx * 4 + 3] = 0;
        }
      }
    }

    this.editor.putMaskImageData(imageData);
    this.history.commit();
    this.editor.notifyMaskChanged();
  }
}

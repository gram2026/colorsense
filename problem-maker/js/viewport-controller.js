/**
 * 확대/축소/이동 컨트롤러.
 * 실제 편집 캔버스(원본 해상도)는 크기를 절대 바꾸지 않고, 화면에는 CSS
 * transform(scale + translate)으로만 확대/축소를 적용한다. 그래서 브러시 좌표를
 * "화면 좌표 -> CSS 표시 크기 -> 캔버스 픽셀"로 역산할 때 오차가 생기지 않는다
 * (getBoundingClientRect가 transform이 적용된 실제 표시 크기를 그대로 알려주기 때문).
 */

const MIN_ZOOM = 0.05;
const MAX_ZOOM = 8;
const ZOOM_STEP = 1.25;

export class ViewportController {
  constructor({ scrollEl, wrapEl }) {
    this.scrollEl = scrollEl;
    this.wrapEl = wrapEl;
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.contentW = 0;
    this.contentH = 0;
    this._onChange = null;
  }

  onChange(fn) {
    this._onChange = fn;
  }

  setContentSize(w, h) {
    this.contentW = w;
    this.contentH = h;
    this.wrapEl.style.width = `${w}px`;
    this.wrapEl.style.height = `${h}px`;
  }

  _notify() {
    this._onChange?.({ zoom: this.zoom, panX: this.panX, panY: this.panY });
  }

  _clampPan() {
    if (!this.scrollEl) return;
    const viewW = this.scrollEl.clientWidth;
    const viewH = this.scrollEl.clientHeight;
    const contentW = this.contentW * this.zoom;
    const contentH = this.contentH * this.zoom;

    // 콘텐츠가 화면보다 작으면 가운데 고정. 크면 이동은 허용하되, 최소한
    // 일정 픽셀(minVisible)은 항상 화면에 남도록 제한해서 무한히 사라지지 않게 한다.
    const clampAxis = (pan, viewSize, contentSize) => {
      if (contentSize <= viewSize) return 0;
      const minVisible = Math.min(120, viewSize * 0.2);
      const bound = (contentSize - viewSize) / 2 + (viewSize - minVisible);
      return Math.min(bound, Math.max(-bound, pan));
    };

    this.panX = clampAxis(this.panX, viewW, contentW);
    this.panY = clampAxis(this.panY, viewH, contentH);
  }

  apply() {
    this._clampPan();
    this.wrapEl.style.transform = `translate(-50%, -50%) translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
    this._notify();
  }

  setZoom(zoom, { anchorClientX, anchorClientY } = {}) {
    const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));

    if (anchorClientX !== undefined && this.scrollEl) {
      const rect = this.scrollEl.getBoundingClientRect();
      const cx = anchorClientX - rect.left - rect.width / 2;
      const cy = anchorClientY - rect.top - rect.height / 2;
      const scaleRatio = nextZoom / this.zoom;
      // 커서 아래 지점이 확대/축소 후에도 같은 화면 위치에 남도록 pan 보정
      this.panX = cx - (cx - this.panX) * scaleRatio;
      this.panY = cy - (cy - this.panY) * scaleRatio;
    }

    this.zoom = nextZoom;
    this.apply();
  }

  zoomIn(anchor) {
    this.setZoom(this.zoom * ZOOM_STEP, anchor);
  }

  zoomOut(anchor) {
    this.setZoom(this.zoom / ZOOM_STEP, anchor);
  }

  zoomTo100() {
    this.panX = 0;
    this.panY = 0;
    this.zoom = 1;
    this.apply();
  }

  fitToContainer(padding = 24) {
    if (!this.scrollEl || !this.contentW || !this.contentH) return;
    const viewW = this.scrollEl.clientWidth - padding * 2;
    const viewH = this.scrollEl.clientHeight - padding * 2;
    const scale = Math.min(viewW / this.contentW, viewH / this.contentH, MAX_ZOOM);
    this.zoom = Math.max(MIN_ZOOM, scale);
    this.panX = 0;
    this.panY = 0;
    this.apply();
  }

  panBy(dx, dy) {
    this.panX += dx;
    this.panY += dy;
    this.apply();
  }

  /** 화면 좌표(clientX/Y) -> 캔버스 픽셀 좌표 (확대율과 무관하게 항상 정확) */
  clientToCanvasPoint(canvasEl, clientX, clientY) {
    const rect = canvasEl.getBoundingClientRect();
    const scaleX = canvasEl.width / rect.width;
    const scaleY = canvasEl.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }
}

/**
 * 썸네일 편집: 정사각형 cover 크롭 + 드래그로 중심 이동 + 확대/축소.
 * 게임의 카테고리 카드/퀵리스트가 쓰는 실제 원본 사진(항상 정답 색 그대로인
 * 사진)을 기준으로 자른다 — 별도로 "정답색 적용판"을 새로 합성하지 않는다
 * (원본 자체가 이미 정답 색을 담고 있는 사진이라 이중으로 만들 필요가 없다).
 */

import { createCanvas, get2dContext, canvasToBlob } from "./utils/image-utils.js";

const DEFAULT_OUTPUT_SIZE = 512;
const DEFAULT_QUALITY = 0.88;

export class ThumbnailEditor {
  constructor(stageCanvasEl) {
    this.stageCanvas = stageCanvasEl;
    this.stageCtx = stageCanvasEl.getContext("2d");
    this.source = null;
    this.sourceW = 0;
    this.sourceH = 0;
    this.offsetX = 0.5; // 0~1, 크롭 중심의 가로 비율
    this.offsetY = 0.5;
    this.zoom = 1; // 1 = 딱 맞는 cover, 커질수록 확대
    this._dragging = false;
    this._lastPoint = null;
    this._bindEvents();
  }

  setSource(source, width, height) {
    this.source = source;
    this.sourceW = width;
    this.sourceH = height;
    this.offsetX = 0.5;
    this.offsetY = 0.5;
    this.zoom = 1;
    this.render();
  }

  _bindEvents() {
    const el = this.stageCanvas;
    el.addEventListener("pointerdown", (e) => {
      this._dragging = true;
      this._lastPoint = { x: e.clientX, y: e.clientY };
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener("pointermove", (e) => {
      if (!this._dragging || !this.source) return;
      const dx = e.clientX - this._lastPoint.x;
      const dy = e.clientY - this._lastPoint.y;
      this._lastPoint = { x: e.clientX, y: e.clientY };

      const rect = el.getBoundingClientRect();
      const { cropSize } = this._computeCrop(rect.width);
      this.offsetX = clamp01(this.offsetX - dx / (rect.width) * (cropSize / this.sourceW));
      this.offsetY = clamp01(this.offsetY - dy / (rect.height) * (cropSize / this.sourceH));
      this.render();
    });
    const stop = (e) => {
      this._dragging = false;
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        // 이미 해제된 경우 무시
      }
    };
    el.addEventListener("pointerup", stop);
    el.addEventListener("pointercancel", stop);
    el.addEventListener(
      "wheel",
      (e) => {
        if (!this.source) return;
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.92 : 1.08;
        this.setZoom(this.zoom * delta);
      },
      { passive: false }
    );
  }

  setZoom(zoom) {
    this.zoom = Math.min(6, Math.max(1, zoom));
    this.render();
  }

  /** cover 기준 정사각형 크롭 변의 길이(원본 픽셀 단위)를 계산 */
  _computeCrop() {
    const minSide = Math.min(this.sourceW, this.sourceH);
    const cropSize = minSide / this.zoom;
    return { cropSize };
  }

  _drawInto(ctx, outputSize) {
    if (!this.source) return;
    const { cropSize } = this._computeCrop();
    const halfCrop = cropSize / 2;

    const centerX = clamp(this.offsetX * this.sourceW, halfCrop, this.sourceW - halfCrop);
    const centerY = clamp(this.offsetY * this.sourceH, halfCrop, this.sourceH - halfCrop);

    ctx.clearRect(0, 0, outputSize, outputSize);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(
      this.source,
      centerX - halfCrop,
      centerY - halfCrop,
      cropSize,
      cropSize,
      0,
      0,
      outputSize,
      outputSize
    );
  }

  render() {
    const size = this.stageCanvas.width;
    this._drawInto(this.stageCtx, size);
  }

  async exportBlob({ outputSize = DEFAULT_OUTPUT_SIZE, quality = DEFAULT_QUALITY } = {}) {
    const canvas = createCanvas(outputSize, outputSize);
    const ctx = get2dContext(canvas);
    this._drawInto(ctx, outputSize);
    return canvasToBlob(canvas, "image/webp", quality);
  }
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}
function clamp01(v) {
  return clamp(v, 0, 1);
}

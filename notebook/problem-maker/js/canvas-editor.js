/**
 * Canvas 편집 코어
 * ---------------------------------------------------------------
 * 아래 5개를 분명하게 분리해서 들고 있는다 (스펙 7번 요구사항):
 *   1. 원본 이미지 데이터   -> this._originalImageData (한 번만 읽어서 캐시)
 *   2. 원본 해상도 마스크   -> this.maskCanvas / this.maskCtx (진짜 데이터, 항상 이 해상도)
 *   3. 화면 표시용 캔버스   -> DOM의 image-canvas / mask-canvas (뷰 모드에 따라 다시 그림)
 *   4. 색상 변경 미리보기   -> preview-renderer.js (MaskRenderer 재사용, 별도 모듈)
 *   5. 썸네일 Canvas       -> thumbnail-editor.js (별도 모듈)
 *
 * 화면 확대율과 무관하게 브러시 좌표가 항상 정확하도록, 편집 캔버스의 backing
 * store 크기(canvas.width/height)는 "작업 해상도"로 고정하고 화면 확대/축소는
 * viewport-controller.js가 CSS transform으로만 처리한다.
 */

import { createCanvas, get2dContext, drawToCanvas } from "./utils/image-utils.js";
import { rgbToLab } from "./utils/color-utils.js";

export class CanvasEditor {
  constructor({ imageCanvasEl, maskCanvasEl, overlayCanvasEl }) {
    this.imageCanvasEl = imageCanvasEl;
    this.maskCanvasEl = maskCanvasEl;
    this.overlayCanvasEl = overlayCanvasEl;

    this.imageCtx = imageCanvasEl.getContext("2d");
    this.maskViewCtx = maskCanvasEl.getContext("2d");
    this.overlayCtx = overlayCanvasEl.getContext("2d");

    this.width = 0;
    this.height = 0;

    // 마스크의 진짜 데이터 (원본 해상도, 화면에는 뷰 모드에 맞게 다시 그려서 보여준다)
    this.maskBuffer = null; // OffscreenCanvas/Canvas
    this.maskBufferCtx = null;

    this._originalImageData = null; // 최초 1회 캐시
    this._originalBitmapSource = null; // drawToCanvas에 쓸 원본 소스(다운스케일 전에 그대로 보관)

    this.viewMode = "normal";
    this.maskOverlayColor = "#3aa0ff";
    this.maskOverlayOpacity = 0.55;

    this._onMaskChanged = null;
  }

  onMaskChanged(fn) {
    this._onMaskChanged = fn;
  }

  /** 새 작업 해상도로 초기화한다. source는 decodeImageFile()이 돌려준 bitmap/img. */
  setup(source, width, height) {
    this.width = width;
    this.height = height;

    for (const canvasEl of [this.imageCanvasEl, this.maskCanvasEl, this.overlayCanvasEl]) {
      canvasEl.width = width;
      canvasEl.height = height;
    }

    this.imageCtx.imageSmoothingEnabled = true;
    this.imageCtx.imageSmoothingQuality = "high";
    this.imageCtx.clearRect(0, 0, width, height);
    this.imageCtx.drawImage(source, 0, 0, width, height);

    this._originalImageData = this.imageCtx.getImageData(0, 0, width, height);
    this._originalBitmapSource = source;
    this._originalLab = null;

    this.maskBuffer = createCanvas(width, height);
    this.maskBufferCtx = get2dContext(this.maskBuffer);
    this.maskBufferCtx.clearRect(0, 0, width, height);

    this.renderMaskView();
    this.clearOverlay();
  }

  /** 기존 마스크 PNG(이미 디코딩된 bitmap)를 그대로 불러와 마스크 버퍼에 채운다 */
  loadExistingMask(bitmap) {
    this.maskBufferCtx.clearRect(0, 0, this.width, this.height);
    this.maskBufferCtx.drawImage(bitmap, 0, 0, this.width, this.height);
    this.notifyMaskChanged();
  }

  getOriginalImageData() {
    return this._originalImageData;
  }

  /**
   * 원본 픽셀의 LAB 값을 픽셀당 3개 float(Float32Array)로 캐시해서 돌려준다.
   * 스마트 선택과 정답 색상 추출이 같은 버퍼를 공유해서, 이미지를 반복해서
   * 다시 읽거나 매번 새로 sRGB->LAB 변환을 하지 않게 한다 (최초 1회만 계산).
   */
  getOriginalLabBuffer() {
    if (this._originalLab) return this._originalLab;
    const { data } = this._originalImageData;
    const total = this.width * this.height;
    const lab = new Float32Array(total * 3);
    for (let i = 0, p = 0; i < total; i++, p += 4) {
      const { l, a, b } = rgbToLab({ r: data[p], g: data[p + 1], b: data[p + 2] });
      lab[i * 3] = l;
      lab[i * 3 + 1] = a;
      lab[i * 3 + 2] = b;
    }
    this._originalLab = lab;
    return lab;
  }

  getMaskBuffer() {
    return { canvas: this.maskBuffer, ctx: this.maskBufferCtx, width: this.width, height: this.height };
  }

  getMaskImageData() {
    return this.maskBufferCtx.getImageData(0, 0, this.width, this.height);
  }

  putMaskImageData(imageData, dx = 0, dy = 0) {
    this.maskBufferCtx.putImageData(imageData, dx, dy);
  }

  /**
   * history-manager.js가 저장해 둔 알파 패치를 되돌린다.
   * 마스크는 항상 "흰색 + 알파"만 쓰는 규약이라 RGB는 매번 255로 다시 채운다
   * (원본 이미지 색이 마스크에 섞이지 않게 하기 위한 안전장치).
   */
  applyAlphaPatch(alphaPatch, x, y, w, h) {
    const imageData = new ImageData(w, h);
    const data = imageData.data;
    for (let i = 0, p = 0; i < alphaPatch.length; i++, p += 4) {
      data[p] = 255;
      data[p + 1] = 255;
      data[p + 2] = 255;
      data[p + 3] = alphaPatch[i];
    }
    this.maskBufferCtx.putImageData(imageData, x, y);
    this.notifyMaskChanged();
  }

  notifyMaskChanged() {
    this.renderMaskView();
    this._onMaskChanged?.();
  }

  setViewMode(mode) {
    this.viewMode = mode;
    this.renderMaskView();
  }

  setMaskOverlayStyle({ color, opacity }) {
    if (color) this.maskOverlayColor = color;
    if (opacity !== undefined) this.maskOverlayOpacity = opacity;
    this.renderMaskView();
  }

  /** 뷰 모드에 맞춰 화면용 mask-canvas를 다시 그린다. 원본 마스크 버퍼는 건드리지 않는다. */
  renderMaskView() {
    const ctx = this.maskViewCtx;
    ctx.clearRect(0, 0, this.width, this.height);

    if (this.viewMode === "original-only") {
      this.imageCanvasEl.style.visibility = "visible";
      return;
    }

    if (this.viewMode === "mask-only") {
      this.imageCanvasEl.style.visibility = "hidden";
      ctx.fillStyle = "#101010";
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.drawImage(this.maskBuffer, 0, 0);
      return;
    }

    this.imageCanvasEl.style.visibility = "visible";

    if (this.viewMode === "preview") {
      // preview-renderer.js가 이 캔버스에 직접 그린다 (여기서는 비워둔다).
      return;
    }

    // normal: 원본 위에 마스크를 지정한 색/투명도로 틴트해서 겹쳐 보여준다.
    ctx.save();
    ctx.globalAlpha = this.maskOverlayOpacity;
    ctx.fillStyle = this.maskOverlayColor;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(this.maskBuffer, 0, 0);
    ctx.restore();
  }

  clearOverlay() {
    this.overlayCtx.clearRect(0, 0, this.width, this.height);
  }

  /** 마스크 알파값이 실제로 선택된 것으로 볼 임계값 이상인 픽셀 수 */
  countSelectedPixels(threshold = 8) {
    const { data } = this.getMaskImageData();
    let count = 0;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] >= threshold) count += 1;
    }
    return count;
  }

  getTotalPixels() {
    return this.width * this.height;
  }

  /** 내보내기용 원본 이미지 canvas (working 해상도 그대로, 별도 리사이즈 없음) */
  getImageCanvasForExport() {
    return this.imageCanvasEl;
  }

  getMaskCanvasForExport() {
    return this.maskBuffer;
  }

  /** 원본 소스(비트맵)를 다른 해상도로 다시 그려야 할 때(출력 해상도 변경) 사용 */
  redrawAtSize(width, height) {
    if (!this._originalBitmapSource) return;
    this.setup(this._originalBitmapSource, width, height);
  }
}

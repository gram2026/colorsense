/**
 * 스마트 선택 (= "유사 색상 선택"): 포토샵 마술봉과 비슷한 색상 기반 연속/전역 선택.
 * 실제 AI 세그멘테이션 모델을 쓰지 않으므로 "AI 선택"이라고 부르지 않는다.
 * RGB 단순 차이 대신 LAB 유클리드 거리(deltaE76)를 허용 오차 기준으로 쓴다.
 */

import { labDistance } from "./utils/color-utils.js";

export class SmartSelection {
  constructor({ canvasEditor }) {
    this.editor = canvasEditor;
    this.pendingAlpha = null; // Uint8Array | null (미확정 미리보기)
  }

  /**
   * @param {{x:number,y:number}} seed 캔버스 픽셀 좌표
   * @param {{tolerance:number, mode:'contiguous'|'global', feather?:number, fillSmallHoles?:boolean}} options
   * @returns {{alpha:Uint8Array, pixelCount:number}}
   */
  compute(seed, { tolerance = 24, mode = "contiguous", feather = 1, fillSmallHoles = false } = {}) {
    const { width, height } = this.editor;
    const lab = this.editor.getOriginalLabBuffer();
    const seedIdx = seed.y * width + seed.x;
    const seedLab = { l: lab[seedIdx * 3], a: lab[seedIdx * 3 + 1], b: lab[seedIdx * 3 + 2] };

    const selected = mode === "global"
      ? this._selectGlobal(lab, width, height, seedLab, tolerance)
      : this._selectContiguous(lab, width, height, seed, seedLab, tolerance);

    let alpha = new Uint8Array(selected.length);
    for (let i = 0; i < selected.length; i++) alpha[i] = selected[i] ? 255 : 0;

    if (fillSmallHoles) {
      alpha = this._closeSmallHoles(alpha, width, height, 3);
    }
    if (feather > 0) {
      alpha = this._featherAlpha(alpha, width, height, feather);
    }

    let pixelCount = 0;
    for (let i = 0; i < selected.length; i++) if (selected[i]) pixelCount++;

    this.pendingAlpha = alpha;
    return { alpha, pixelCount };
  }

  _selectGlobal(lab, width, height, seedLab, tolerance) {
    const total = width * height;
    const out = new Uint8Array(total);
    for (let i = 0; i < total; i++) {
      const pixelLab = { l: lab[i * 3], a: lab[i * 3 + 1], b: lab[i * 3 + 2] };
      out[i] = labDistance(pixelLab, seedLab) <= tolerance ? 1 : 0;
    }
    return out;
  }

  _selectContiguous(lab, width, height, seed, seedLab, tolerance) {
    const total = width * height;
    const out = new Uint8Array(total);
    const visited = new Uint8Array(total);
    const stack = new Int32Array(total);
    let sp = 0;

    const startIdx = seed.y * width + seed.x;
    stack[sp++] = startIdx;
    visited[startIdx] = 1;

    while (sp > 0) {
      const idx = stack[--sp];
      const pixelLab = { l: lab[idx * 3], a: lab[idx * 3 + 1], b: lab[idx * 3 + 2] };
      if (labDistance(pixelLab, seedLab) > tolerance) continue;
      out[idx] = 1;

      const x = idx % width;
      const y = (idx / width) | 0;
      const neighbors = [
        x > 0 ? idx - 1 : -1,
        x < width - 1 ? idx + 1 : -1,
        y > 0 ? idx - width : -1,
        y < height - 1 ? idx + width : -1,
      ];
      for (const n of neighbors) {
        if (n >= 0 && !visited[n]) {
          visited[n] = 1;
          stack[sp++] = n;
        }
      }
    }
    return out;
  }

  /** 작은 구멍 완화: 아주 작은 반경의 팽창 후 침식 (0/255 이진 배열 기준) */
  _closeSmallHoles(alpha, width, height, radius) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.putImageData(toImageData(alpha, width, height), 0, 0);

    ctx.filter = `blur(${radius}px)`;
    ctx.drawImage(canvas, 0, 0);
    ctx.filter = "none";
    let data = ctx.getImageData(0, 0, width, height).data;
    const dilated = new Uint8Array(width * height);
    for (let i = 0, p = 3; i < dilated.length; i++, p += 4) dilated[i] = data[p] > 4 ? 1 : 0;

    ctx.putImageData(toImageData(invert(dilated), width, height), 0, 0);
    ctx.filter = `blur(${radius}px)`;
    ctx.drawImage(canvas, 0, 0);
    ctx.filter = "none";
    data = ctx.getImageData(0, 0, width, height).data;
    const closed = new Uint8Array(width * height);
    for (let i = 0, p = 3; i < closed.length; i++, p += 4) closed[i] = data[p] > 4 ? 0 : 1;

    return closed;
  }

  _featherAlpha(alpha01, width, height, radiusPx) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    const imageData = new ImageData(width, height);
    for (let i = 0, p = 3; i < alpha01.length; i++, p += 4) imageData.data[p] = alpha01[i] ? 255 : 0;
    ctx.putImageData(imageData, 0, 0);

    const blurCanvas = document.createElement("canvas");
    blurCanvas.width = width;
    blurCanvas.height = height;
    const blurCtx = blurCanvas.getContext("2d");
    blurCtx.filter = `blur(${radiusPx}px)`;
    blurCtx.drawImage(canvas, 0, 0);

    const out = new Uint8Array(alpha01.length);
    const data = blurCtx.getImageData(0, 0, width, height).data;
    for (let i = 0, p = 3; i < out.length; i++, p += 4) out[i] = data[p];
    return out;
  }
}

function toImageData(alpha01, width, height) {
  const imageData = new ImageData(width, height);
  for (let i = 0, p = 3; i < alpha01.length; i++, p += 4) imageData.data[p] = alpha01[i] ? 255 : 0;
  return imageData;
}

function invert(alpha01) {
  const out = new Uint8Array(alpha01.length);
  for (let i = 0; i < alpha01.length; i++) out[i] = alpha01[i] ? 0 : 1;
  return out;
}

/**
 * 이미지 입출력 헬퍼
 * - 방향(EXIF orientation)을 반영해 디코딩
 * - 큰 이미지도 브라우저가 멈추지 않게 작업 해상도로 축소
 * - Canvas/OffscreenCanvas, toBlob/convertToBlob 차이를 감춘다
 */

export const SUPPORTED_MIME = ["image/png", "image/jpeg", "image/webp"];
export const SUPPORTED_EXT = [".png", ".jpg", ".jpeg", ".webp"];
export const DEFAULT_MAX_LONG_EDGE = 2048;
export const HARD_MAX_LONG_EDGE = 4096; // 이보다 크면 강제로 줄여서 브라우저가 멈추는 것을 막는다
export const MAX_FILE_BYTES = 60 * 1024 * 1024; // 60MB

export function validateImageFile(file) {
  if (!file) return { ok: false, reason: "파일이 없습니다." };
  const nameLower = file.name.toLowerCase();
  const extOk = SUPPORTED_EXT.some((ext) => nameLower.endsWith(ext));
  const mimeOk = !file.type || SUPPORTED_MIME.includes(file.type);
  if (!extOk && !mimeOk) {
    return { ok: false, reason: "PNG, JPG, WebP 형식만 지원합니다." };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, reason: `파일이 너무 큽니다 (최대 ${Math.round(MAX_FILE_BYTES / 1024 / 1024)}MB).` };
  }
  return { ok: true };
}

export const supportsOffscreenCanvas = typeof OffscreenCanvas !== "undefined";
export const supportsCreateImageBitmap = typeof createImageBitmap === "function";

/**
 * 파일/Blob을 방향 보정된 비트맵으로 디코딩한다.
 * createImageBitmap을 우선 사용하고, 실패하면 <img> 방식으로 대체한다.
 * @returns {Promise<{ok:boolean, bitmap?:ImageBitmap|HTMLImageElement, width?:number, height?:number, error?:Error}>}
 */
export async function decodeImageFile(fileOrBlob) {
  if (supportsCreateImageBitmap) {
    try {
      const bitmap = await createImageBitmap(fileOrBlob, { imageOrientation: "from-image" });
      return { ok: true, bitmap, width: bitmap.width, height: bitmap.height, kind: "bitmap" };
    } catch (err) {
      console.warn("[image-utils] createImageBitmap 실패, <img> 방식으로 대체합니다:", err);
    }
  }
  try {
    const url = URL.createObjectURL(fileOrBlob);
    const img = await loadHtmlImage(url);
    URL.revokeObjectURL(url);
    return { ok: true, bitmap: img, width: img.naturalWidth, height: img.naturalHeight, kind: "img" };
  } catch (err) {
    return { ok: false, error: err };
  }
}

function loadHtmlImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("이미지를 디코딩하지 못했습니다."));
    img.src = src;
  });
}

/** 긴 변 기준으로 목표 크기 안에 맞춘 가로/세로를 계산한다 (원본 유지 옵션이면 scale=1) */
export function computeFitSize(naturalW, naturalH, maxLongEdge) {
  if (!maxLongEdge || maxLongEdge <= 0) return { width: naturalW, height: naturalH, scale: 1 };
  const longEdge = Math.max(naturalW, naturalH);
  const scale = Math.min(1, maxLongEdge / longEdge);
  return {
    width: Math.max(1, Math.round(naturalW * scale)),
    height: Math.max(1, Math.round(naturalH * scale)),
    scale,
  };
}

export function createCanvas(width, height) {
  if (supportsOffscreenCanvas) {
    return new OffscreenCanvas(width, height);
  }
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  return c;
}

export function get2dContext(canvas, opts = {}) {
  return canvas.getContext("2d", { willReadFrequently: true, ...opts });
}

/** source(비트맵/이미지)를 targetW x targetH 캔버스에 그려서 돌려준다 */
export function drawToCanvas(source, targetW, targetH) {
  const canvas = createCanvas(targetW, targetH);
  const ctx = get2dContext(canvas);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, targetW, targetH);
  return canvas;
}

/** HTMLCanvasElement/OffscreenCanvas 차이를 감춘 toBlob */
export function canvasToBlob(canvas, type = "image/png", quality) {
  if (typeof canvas.convertToBlob === "function") {
    return canvas.convertToBlob({ type, quality });
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Canvas를 이미지로 변환하지 못했습니다."))),
      type,
      quality
    );
  });
}

export async function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function fileToObjectURL(file) {
  return URL.createObjectURL(file);
}

/** 두 이미지(원본/마스크)가 같은 크기인지 확인 */
export function sizesMatch(a, b) {
  return a.width === b.width && a.height === b.height;
}

/**
 * ZIP 내보내기.
 * 모든 파일(question.json, original.webp, mask.png, thumbnail.webp)을 메모리에서
 * 먼저 전부 만들고 검증한 뒤에만 ZIP을 묶고 다운로드한다 — 중간에 하나라도
 * 실패하면 예외가 위로 던져지고, 부분적으로 완성된 ZIP은 절대 다운로드되지 않는다.
 * CDN이 아니라 npm(jszip)으로 설치한 패키지를 index.html에서 <script>로 그대로
 * 불러와 window.JSZip으로 쓴다 (이 프로젝트는 번들러가 없는 정적 사이트라서).
 */

import { canvasToBlob } from "./utils/image-utils.js";

const ORIGINAL_FILENAME = "original.webp";
const MASK_FILENAME = "mask.png";
const THUMBNAIL_FILENAME = "thumbnail.webp";

/** 4개 파일을 전부 메모리에서 만든다. 실패하면 예외를 던진다. */
export async function buildExportBundle({ question, imageCanvas, maskCanvas, thumbnailBlob }) {
  if (!thumbnailBlob) throw new Error("썸네일이 준비되지 않았습니다.");

  const [originalBlob, maskBlob] = await Promise.all([
    canvasToBlob(imageCanvas, "image/webp", 0.92),
    canvasToBlob(maskCanvas, "image/png"),
  ]);

  if (!originalBlob) throw new Error("원본 이미지를 만들지 못했습니다.");
  if (!maskBlob) throw new Error("마스크 이미지를 만들지 못했습니다.");

  const questionJson = {
    schemaVersion: 1,
    id: question.id,
    categoryId: question.categoryId,
    title: question.title,
    originalImage: ORIGINAL_FILENAME,
    maskImage: MASK_FILENAME,
    thumbnail: THUMBNAIL_FILENAME,
    answerColor: question.answerColor,
    startColor: question.startColorMode === "fixed" ? question.startColorFixed : null,
    renderMode: question.renderMode,
    enabled: question.enabled !== false,
    difficulty: question.difficulty ?? 1,
    tags: question.tags ?? [],
    metadata: {
      createdAt: question.metadata?.createdAt || new Date().toISOString().slice(0, 10),
      makerVersion: "1.0.0",
    },
  };

  return {
    questionJson,
    files: {
      [ORIGINAL_FILENAME]: originalBlob,
      [MASK_FILENAME]: maskBlob,
      [THUMBNAIL_FILENAME]: thumbnailBlob,
    },
  };
}

export async function exportZip(bundle) {
  if (typeof window.JSZip !== "function") {
    throw new Error("JSZip 라이브러리를 불러오지 못했습니다 (node_modules/jszip 설치를 확인하세요).");
  }
  const zip = new window.JSZip();
  const folder = zip.folder(bundle.questionJson.id);
  folder.file("question.json", JSON.stringify(bundle.questionJson, null, 2) + "\n");
  for (const [name, blob] of Object.entries(bundle.files)) {
    folder.file(name, blob);
  }
  return zip.generateAsync({ type: "blob" });
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function exportQuestionAsZip(params) {
  const bundle = await buildExportBundle(params);
  const zipBlob = await exportZip(bundle);
  downloadBlob(zipBlob, `${bundle.questionJson.id}.zip`);
  return bundle;
}

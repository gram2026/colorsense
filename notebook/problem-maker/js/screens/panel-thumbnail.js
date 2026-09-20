/** 오른쪽 패널 - "썸네일" 탭 */

import { qs } from "../utils/dom-utils.js";
import { ThumbnailEditor } from "../thumbnail-editor.js";

/**
 * @returns {ThumbnailEditor} 생성된 편집기 인스턴스 (호출부가 setSource/exportBlob 호출)
 */
export function renderThumbnailPanel(root, { onZoomChange }) {
  root.innerHTML = `
    <p class="field__hint">원본 사진을 기준으로 정사각형(512×512, WebP)으로 잘라냅니다. 드래그로 중심을 옮기고 휠로 확대할 수 있습니다.</p>
    <div class="thumb-editor">
      <div class="thumb-editor__stage">
        <canvas data-role="thumb-canvas" width="220" height="220" aria-label="썸네일 크롭 영역. 드래그로 이동, 휠로 확대/축소"></canvas>
      </div>
      <div class="thumb-editor__controls">
        <div class="field__range-row">
          <span style="font-size:11px;">확대</span>
          <input type="range" class="maker-range" min="100" max="600" value="100" data-role="thumb-zoom" />
        </div>
        <span class="field__hint">출력: 512×512, WebP 품질 0.88</span>
      </div>
    </div>
  `;

  const canvas = qs('[data-role="thumb-canvas"]', root);
  const editor = new ThumbnailEditor(canvas);

  const zoomInput = qs('[data-role="thumb-zoom"]', root);
  zoomInput.addEventListener("input", () => {
    editor.setZoom(Number(zoomInput.value) / 100);
    onZoomChange?.();
  });

  return editor;
}

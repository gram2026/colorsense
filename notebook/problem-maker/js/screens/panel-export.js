/** 오른쪽 패널 - "내보내기" 탭 */

import { qs, iconSvg } from "../utils/dom-utils.js";
import { isFileSystemAccessSupported } from "../direct-project-writer.js";

export function renderExportPanel(root, { onValidate, onExportZip, onDirectAdd }) {
  const fsaSupported = isFileSystemAccessSupported();

  root.innerHTML = `
    <button type="button" class="btn btn--secondary btn--block" data-action="validate">
      ${iconSvg("check", 18)}<span>검증 결과 보기</span>
    </button>

    <button type="button" class="btn btn--primary btn--block" data-action="export-zip">
      ${iconSvg("download", 18)}<span>ZIP으로 내보내기</span>
    </button>

    <button type="button" class="btn btn--secondary btn--block" data-action="direct-add" ${fsaSupported ? "" : "disabled"}>
      ${iconSvg("folderPlus", 18)}<span>게임 프로젝트에 바로 추가</span>
    </button>
    ${
      !fsaSupported
        ? `<p class="field__hint">이 브라우저는 폴더에 직접 쓰는 기능(File System Access API)을 지원하지 않습니다. Chrome 또는 Edge 최신 버전을 사용하거나, ZIP으로 내보낸 뒤 아래 명령을 사용하세요.</p>`
        : `<p class="field__hint">C:\\colorguesser 폴더를 직접 선택해야 하며, 선택 전까지는 어떤 파일도 쓰지 않습니다.</p>`
    }

    <div class="field">
      <label class="field__label">ZIP을 내려받은 뒤 게임에 등록하는 명령</label>
      <pre class="maker-input" style="white-space:pre-wrap; user-select:all; font-family:ui-monospace,monospace; font-size:12px;">cd C:\\colorguesser
npm run import-question -- "C:\\다운로드경로\\문제ID"</pre>
      <span class="field__hint">ZIP 안의 폴더(문제ID 이름의 폴더)를 압축 해제한 뒤, 그 폴더 경로를 넣어주세요.</span>
    </div>
  `;

  qs('[data-action="validate"]', root).addEventListener("click", onValidate);
  qs('[data-action="export-zip"]', root).addEventListener("click", onExportZip);
  if (fsaSupported) {
    qs('[data-action="direct-add"]', root).addEventListener("click", onDirectAdd);
  }
}

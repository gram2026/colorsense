/**
 * 문제 제작기 진입점.
 * 모든 모듈을 불러와 서로 연결하고, 캔버스 포인터 이벤트와 키보드 단축키를 관리한다.
 */

import { qs, qsa, iconSvg, debounce } from "./utils/dom-utils.js";
import {
  decodeImageFile,
  computeFitSize,
  canvasToBlob,
  DEFAULT_MAX_LONG_EDGE,
  HARD_MAX_LONG_EDGE,
} from "./utils/image-utils.js";
import { getState, setState, patchSlice, markDirty, markClean, resetState } from "./maker-state.js";
import { CanvasEditor } from "./canvas-editor.js";
import { ViewportController } from "./viewport-controller.js";
import { HistoryManager } from "./history-manager.js";
import { MaskTools } from "./mask-tools.js";
import { SmartSelection } from "./smart-selection.js";
import { extractAnswerColorCandidates } from "./color-extractor.js";
import { PreviewRenderer } from "./preview-renderer.js";
import { runFullValidation, summarize } from "./question-validator.js";
import { exportQuestionAsZip } from "./export-manager.js";
import {
  isFileSystemAccessSupported,
  pickProjectRoot,
  verifyProjectRoot,
  planDirectWrite,
  writeQuestionDirectly,
} from "./direct-project-writer.js";
import { openExistingFromZipFile } from "./open-existing.js";
import * as draftStorage from "./draft-storage.js";
import { loadUsableCategories, isValidQuestionId } from "./project-loader.js";

import { renderStartScreen } from "./screens/start-screen.js";
import { renderInfoPanel, updateAnswerSwatch } from "./screens/panel-info.js";
import { renderMaskPanel } from "./screens/panel-mask.js";
import { renderColorPanel } from "./screens/panel-color.js";
import { renderPreviewPanel } from "./screens/panel-preview.js";
import { renderThumbnailPanel } from "./screens/panel-thumbnail.js";
import { renderExportPanel } from "./screens/panel-export.js";

// ---------------------------------------------------------------------------
// DOM 참조
// ---------------------------------------------------------------------------

const el = {
  startScreen: qs('[data-screen="start"]'),
  editorScreen: qs('[data-screen="editor"]'),
  startRoot: qs('[data-role="start-root"]'),
  toast: qs('[data-role="toast"]'),

  filename: qs('[data-role="filename"]'),
  savestate: qs('[data-role="savestate"]'),
  undoBtn: qs('[data-action="undo"]'),
  redoBtn: qs('[data-action="redo"]'),

  toolrail: qs('[data-role="toolrail"]'),
  canvasScroll: qs('[data-role="canvas-scroll"]'),
  canvasWrap: qs('[data-role="canvas-wrap"]'),
  imageCanvas: qs('[data-role="image-canvas"]'),
  maskCanvas: qs('[data-role="mask-canvas"]'),
  previewCanvas: qs('[data-role="preview-canvas"]'),
  overlayCanvas: qs('[data-role="overlay-canvas"]'),

  zoomValue: qs('[data-role="zoom-value"]'),
  panelTabsNav: qs('[data-role="panel-tabs"]'),
  panelSections: {
    info: qs('[data-panel="info"]'),
    mask: qs('[data-panel="mask"]'),
    color: qs('[data-panel="color"]'),
    preview: qs('[data-panel="preview"]'),
    thumbnail: qs('[data-panel="thumbnail"]'),
    export: qs('[data-panel="export"]'),
  },

  statusImageSize: qs('[data-role="status-image-size"]'),
  statusZoom: qs('[data-role="status-zoom"]'),
  statusMaskPixels: qs('[data-role="status-mask-pixels"]'),
  statusMaskRatio: qs('[data-role="status-mask-ratio"]'),
  statusCursor: qs('[data-role="status-cursor"]'),
  statusTool: qs('[data-role="status-tool"]'),

  mobileNotice: qs('[data-role="mobile-notice"]'),

  shortcutsModal: qs('[data-role="shortcuts-modal"]'),
  shortcutsBody: qs('[data-role="shortcuts-body"]'),
  validationModal: qs('[data-role="validation-modal"]'),
  validationBody: qs('[data-role="validation-body"]'),
  validationFooter: qs('[data-role="validation-footer"]'),
  confirmModal: qs('[data-role="confirm-modal"]'),
  confirmTitle: qs('[data-role="confirm-title"]'),
  confirmBody: qs('[data-role="confirm-body"]'),
  confirmFooter: qs('[data-role="confirm-footer"]'),
  progressModal: qs('[data-role="progress-modal"]'),
  progressText: qs('[data-role="progress-text"]'),
};

// ---------------------------------------------------------------------------
// 전역 인스턴스 (이미지를 불러올 때마다 새로 만든다)
// ---------------------------------------------------------------------------

let canvasEditor = null;
let viewport = null;
let historyManager = null;
let maskTools = null;
let smartSelection = null;
let thumbnailEditor = null;
let previewRenderer = null;
let categoriesForValidation = [];

let spaceDown = false;
let isPanning = false;
let panStart = null;
let strokeDragging = false;
let lastThumbnailBlob = null;
let activePanelTab = "info";

const scheduleAutosave = debounce(() => saveDraftNow().catch((err) => console.error("[maker-app] 자동 저장 실패", err)), 1200);
let autosaveIntervalId = null;

// ---------------------------------------------------------------------------
// 토스트 / 모달 헬퍼
// ---------------------------------------------------------------------------

let toastTimer = null;
function showToast(message) {
  el.toast.textContent = message;
  el.toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove("is-visible"), 3200);
}

function openModal(modalEl) {
  modalEl.hidden = false;
  const focusable = modalEl.querySelector("button, input, select, textarea, [tabindex]");
  focusable?.focus();
}
function closeModal(modalEl) {
  modalEl.hidden = true;
}

qsa('[data-action="close-modal"]').forEach((btn) => {
  btn.addEventListener("click", (e) => {
    const modal = e.target.closest(".overlay");
    if (modal) closeModal(modal);
  });
});

function showProgress(text) {
  el.progressText.textContent = text;
  openModal(el.progressModal);
}
function hideProgress() {
  closeModal(el.progressModal);
}

/** @returns {Promise<boolean>} 사용자가 확인을 눌렀으면 true */
function confirmDialog(title, bodyHtml, { confirmLabel = "확인", cancelLabel = "취소", danger = false } = {}) {
  return new Promise((resolve) => {
    el.confirmTitle.textContent = title;
    el.confirmBody.innerHTML = bodyHtml;
    el.confirmFooter.innerHTML = "";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "btn btn--ghost";
    cancelBtn.textContent = cancelLabel;

    const confirmBtn = document.createElement("button");
    confirmBtn.type = "button";
    confirmBtn.className = danger ? "btn btn--secondary" : "btn btn--primary";
    confirmBtn.textContent = confirmLabel;

    const finish = (result) => {
      closeModal(el.confirmModal);
      cancelBtn.removeEventListener("click", onCancel);
      confirmBtn.removeEventListener("click", onConfirm);
      resolve(result);
    };
    const onCancel = () => finish(false);
    const onConfirm = () => finish(true);

    cancelBtn.addEventListener("click", onCancel);
    confirmBtn.addEventListener("click", onConfirm);
    el.confirmFooter.append(cancelBtn, confirmBtn);
    openModal(el.confirmModal);
  });
}

// ---------------------------------------------------------------------------
// 화면 전환
// ---------------------------------------------------------------------------

function showScreen(name) {
  el.startScreen.hidden = name !== "start";
  el.editorScreen.hidden = name !== "editor";
  setState({ screen: name });
}

// ---------------------------------------------------------------------------
// 시작 화면
// ---------------------------------------------------------------------------

async function initStartScreen() {
  await renderStartScreen(el.startRoot, {
    onImageFile: handleNewImageFile,
    onOpenExisting: handleOpenExistingClick,
    onOpenDraft: handleOpenDraft,
    onError: (reason) => showToast(reason),
  });
}

async function handleNewImageFile(file) {
  showProgress("이미지를 불러오는 중...");
  try {
    const decoded = await decodeImageFile(file);
    if (!decoded.ok) {
      hideProgress();
      showToast("이미지를 디코딩하지 못했습니다.");
      return;
    }
    hideProgress();

    const keepOriginal = await askResolutionChoice(decoded.width, decoded.height);
    if (keepOriginal === null) return; // 사용자가 취소함

    resetState();
    setupNewProject(decoded, { maxLongEdge: keepOriginal ? null : DEFAULT_MAX_LONG_EDGE, keepOriginal, sourceFileName: file.name });
  } catch (err) {
    hideProgress();
    console.error("[maker-app] 이미지 로드 실패", err);
    showToast("이미지를 불러오는 중 오류가 발생했습니다.");
  }
}

/** @returns {Promise<boolean|null>} true=원본 유지, false=기본 해상도로 축소, null=취소 */
function askResolutionChoice(width, height) {
  const longEdge = Math.max(width, height);
  const willShrink = longEdge > DEFAULT_MAX_LONG_EDGE;
  return new Promise((resolve) => {
    el.confirmTitle.textContent = "출력 해상도 선택";
    el.confirmBody.innerHTML = `
      <p style="margin-bottom:12px;">불러온 이미지: ${width} × ${height}px</p>
      <label class="maker-checkbox-row" style="margin-bottom:8px;">
        <input type="radio" name="res-choice" value="default" checked />
        긴 변 기준 ${DEFAULT_MAX_LONG_EDGE}px로 맞추기${willShrink ? " (축소됨)" : " (원본과 동일)"}
      </label>
      <label class="maker-checkbox-row">
        <input type="radio" name="res-choice" value="keep" />
        원본 해상도 그대로 사용${longEdge > HARD_MAX_LONG_EDGE ? ` (긴 변이 ${HARD_MAX_LONG_EDGE}px로 제한됩니다)` : ""}
      </label>
    `;
    el.confirmFooter.innerHTML = "";
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "btn btn--ghost";
    cancelBtn.textContent = "취소";
    const okBtn = document.createElement("button");
    okBtn.type = "button";
    okBtn.className = "btn btn--primary";
    okBtn.textContent = "시작하기";

    const finish = (value) => {
      closeModal(el.confirmModal);
      resolve(value);
    };
    cancelBtn.addEventListener("click", () => finish(null));
    okBtn.addEventListener("click", () => {
      const choice = el.confirmBody.querySelector('input[name="res-choice"]:checked').value;
      finish(choice === "keep");
    });
    el.confirmFooter.append(cancelBtn, okBtn);
    openModal(el.confirmModal);
  });
}

function setupNewProject(decoded, { maxLongEdge, keepOriginal, sourceFileName }) {
  const fit = computeFitSize(decoded.width, decoded.height, keepOriginal ? HARD_MAX_LONG_EDGE : maxLongEdge);

  ensureEditorInstances();
  canvasEditor.setup(decoded.bitmap, fit.width, fit.height);
  syncHistorySize();
  viewport.setContentSize(fit.width, fit.height);
  requestAnimationFrame(() => viewport.fitToContainer());

  setState({
    sourceFileName,
    image: {
      naturalWidth: decoded.width,
      naturalHeight: decoded.height,
      workingWidth: fit.width,
      workingHeight: fit.height,
      maxLongEdge: keepOriginal ? null : DEFAULT_MAX_LONG_EDGE,
      keepOriginal,
    },
  });

  lastThumbnailBlob = null;
  enterEditor();
}

function enterEditor() {
  showScreen("editor");
  updateFilenameDisplay();
  renderToolrail();
  renderAllPanels();
  updateStatusBar();
  startAutosaveTimer();
  markDirty();
}

// ---------------------------------------------------------------------------
// 편집 인스턴스 생성
// ---------------------------------------------------------------------------

function ensureEditorInstances() {
  canvasEditor = new CanvasEditor({
    imageCanvasEl: el.imageCanvas,
    maskCanvasEl: el.maskCanvas,
    overlayCanvasEl: el.overlayCanvas,
  });
  viewport = new ViewportController({ scrollEl: el.canvasScroll, wrapEl: el.canvasWrap });
  viewport.onChange(({ zoom }) => {
    el.zoomValue.textContent = `${Math.round(zoom * 100)}%`;
    el.statusZoom.textContent = `확대율: ${Math.round(zoom * 100)}%`;
  });

  historyManager = new HistoryManager({
    getMaskImageData: () => canvasEditor.getMaskImageData(),
    putPatch: (alpha, x, y, w, h) => canvasEditor.applyAlphaPatch(alpha, x, y, w, h),
    width: 0,
    height: 0,
  });
  historyManager.onChange(({ canUndo, canRedo }) => {
    el.undoBtn.disabled = !canUndo;
    el.redoBtn.disabled = !canRedo;
  });

  maskTools = new MaskTools({ canvasEditor, historyManager });
  smartSelection = new SmartSelection({ canvasEditor });

  canvasEditor.onMaskChanged(() => {
    updateStatusBar();
    scheduleAutosave();
    if (getState().view.mode === "preview") updatePreviewRenderer();
  });
}

// history-manager는 width/height를 생성 시점에 고정해서 받으므로, 새 이미지를 열 때마다
// canvasEditor.setup() 이후 실제 크기로 다시 맞춰준다.
function syncHistorySize() {
  historyManager.width = canvasEditor.width;
  historyManager.height = canvasEditor.height;
  historyManager.clear();
}

// ---------------------------------------------------------------------------
// 툴 레일
// ---------------------------------------------------------------------------

const TOOL_DEFS = [
  { id: "brush", icon: "brush", label: "브러시", key: "B" },
  { id: "eraser", icon: "eraser", label: "지우개", key: "E" },
  { id: "polygon", icon: "polygon", label: "다각형", key: "P" },
  { id: "smart", icon: "wand", label: "스마트 선택", key: "Ctrl+Q" },
  { id: "eyedropper", icon: "eyedropper", label: "스포이드", key: "I" },
];

/** 브러시 등 "도구"와 달리 누르는 즉시 실행되는 마스크 선택 동작들 (활성 상태로 남지 않는다) */
const SELECTION_ACTION_DEFS = [
  { op: "selectAll", icon: "selectAll", label: "전체 선택", key: "A" },
  { op: "selectNone", icon: "selectNone", label: "전체 해제", key: "D" },
  { op: "invert", icon: "invert", label: "반전", key: "R" },
  { op: "expand", icon: "expand", label: "확장", key: "Shift+]" },
  { op: "contract", icon: "contract", label: "축소", key: "Shift+[" },
  { op: "feather", icon: "feather", label: "페더", key: "F" },
  { op: "fillHoles", icon: "fillHoles", label: "구멍 채우기", key: "H" },
  { op: "despeckle", icon: "despeckle", label: "고립 픽셀 제거", key: "X" },
];

function renderToolrail() {
  const toolButtons = TOOL_DEFS.map(
    (t) => `
    <button type="button" class="tool-btn" data-tool="${t.id}" aria-label="${t.label} (${t.key})" title="${t.label} (${t.key})">
      ${iconSvg(t.icon, 20)}
      <span class="tool-btn__label">${t.label}</span>
    </button>
  `
  ).join("");

  const actionButtons = SELECTION_ACTION_DEFS.map(
    (a) => `
    <button type="button" class="tool-btn" data-mask-op="${a.op}" aria-label="${a.label} (${a.key})" title="${a.label} (${a.key})">
      ${iconSvg(a.icon, 20)}
      <span class="tool-btn__label">${a.label}</span>
    </button>
  `
  ).join("");

  el.toolrail.innerHTML = `${toolButtons}<div class="tool-rail__divider"></div>${actionButtons}`;

  qsa("[data-tool]", el.toolrail).forEach((btn) => {
    btn.addEventListener("click", () => setActiveTool(btn.dataset.tool));
  });
  qsa("[data-mask-op]", el.toolrail).forEach((btn) => {
    btn.addEventListener("click", () => runMaskOpFromShortcut(btn.dataset.maskOp));
  });
  updateToolrailActive();
}

function setActiveTool(toolId) {
  cancelPendingInteractions();
  patchSlice("tool", { current: toolId });
  updateToolrailActive();
  const def = TOOL_DEFS.find((t) => t.id === toolId);
  el.statusTool.textContent = `도구: ${def?.label ?? toolId}`;
}

function updateToolrailActive() {
  const current = getState().tool.current;
  qsa("[data-tool]", el.toolrail).forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.tool === current);
  });
}

function cancelPendingInteractions() {
  if (maskTools && maskTools.polygonPoints.length > 0) {
    maskTools.polygonCancel();
    redrawOverlayInteraction();
  }
  if (smartSelection && smartSelection.pendingAlpha) {
    smartSelection.pendingAlpha = null;
    redrawOverlayInteraction();
  }
  if (strokeDragging && maskTools) {
    maskTools.strokeEnd();
    strokeDragging = false;
  }
}

// ---------------------------------------------------------------------------
// 캔버스 포인터 인터랙션
// ---------------------------------------------------------------------------

function pointFromEvent(e) {
  const p = viewport.clientToCanvasPoint(el.overlayCanvas, e.clientX, e.clientY);
  return {
    x: Math.max(0, Math.min(canvasEditor.width, p.x)),
    y: Math.max(0, Math.min(canvasEditor.height, p.y)),
  };
}

el.overlayCanvas.addEventListener("pointerdown", (e) => {
  if (!canvasEditor?.width) return;
  if (spaceDown) {
    isPanning = true;
    panStart = { x: e.clientX, y: e.clientY };
    el.overlayCanvas.setPointerCapture(e.pointerId);
    return;
  }

  const point = pointFromEvent(e);
  const tool = getState().tool;

  // Ctrl(또는 Cmd)+왼쪽 클릭: 현재 도구와 무관하게, 클릭한 지점의 유사 색상 영역을
  // 곧바로(확정 절차 없이) 마스크에 추가로 선택한다.
  if ((e.ctrlKey || e.metaKey) && e.button === 0) {
    quickAddSmartSelectAt({ x: Math.round(point.x), y: Math.round(point.y) });
    return;
  }

  if (tool.current === "brush" || tool.current === "eraser") {
    strokeDragging = true;
    el.overlayCanvas.setPointerCapture(e.pointerId);
    maskTools.strokeStart(point, {
      size: tool.brushSize,
      hardness: tool.brushHardness,
      mode: tool.current === "eraser" ? "erase" : "paint",
    });
  } else if (tool.current === "polygon") {
    handlePolygonClick(point);
  } else if (tool.current === "smart") {
    handleSmartSelectClick(point);
  } else if (tool.current === "eyedropper") {
    handleEyedropperClick(point);
  }
});

el.overlayCanvas.addEventListener("pointermove", (e) => {
  if (!canvasEditor?.width) return;

  if (isPanning && panStart) {
    const dx = e.clientX - panStart.x;
    const dy = e.clientY - panStart.y;
    panStart = { x: e.clientX, y: e.clientY };
    viewport.panBy(dx, dy);
    return;
  }

  const point = pointFromEvent(e);
  el.statusCursor.textContent = `좌표: ${Math.round(point.x)}, ${Math.round(point.y)}`;

  const tool = getState().tool;
  if (strokeDragging && (tool.current === "brush" || tool.current === "eraser")) {
    maskTools.strokeMove(point, { size: tool.brushSize, hardness: tool.brushHardness, mode: tool.current === "eraser" ? "erase" : "paint" });
  }
  drawOverlayForPoint(point, tool);
});

function endPointerInteraction(e) {
  if (isPanning) {
    isPanning = false;
    panStart = null;
    try {
      el.overlayCanvas.releasePointerCapture(e.pointerId);
    } catch {
      /* 이미 해제된 경우 무시 */
    }
    return;
  }
  if (strokeDragging) {
    maskTools.strokeEnd();
    strokeDragging = false;
    try {
      el.overlayCanvas.releasePointerCapture(e.pointerId);
    } catch {
      /* 무시 */
    }
  }
}
el.overlayCanvas.addEventListener("pointerup", endPointerInteraction);
el.overlayCanvas.addEventListener("pointercancel", endPointerInteraction);

el.canvasScroll.addEventListener(
  "wheel",
  (e) => {
    if (!canvasEditor?.width) return;
    e.preventDefault();
    if (e.deltaY < 0) viewport.zoomIn({ anchorClientX: e.clientX, anchorClientY: e.clientY });
    else viewport.zoomOut({ anchorClientX: e.clientX, anchorClientY: e.clientY });
  },
  { passive: false }
);

/** 마우스가 움직일 때마다 오버레이 캔버스를 한 번만 지우고 다시 그린다 (커서 링 + 다각형 러버밴드 + 스마트선택 미리보기) */
function drawOverlayForPoint(point, tool) {
  const ctx = canvasEditor.overlayCtx;
  canvasEditor.clearOverlay();
  if (tool.current === "polygon") {
    drawPolygonShape(point);
  }
  if (tool.current === "brush" || tool.current === "eraser") {
    ctx.save();
    ctx.strokeStyle = tool.current === "eraser" ? "#ff5a5a" : "#2a7fff";
    ctx.lineWidth = Math.max(1, 1.5 / viewport.zoom);
    ctx.beginPath();
    ctx.arc(point.x, point.y, tool.brushSize / 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  if (smartSelection?.pendingAlpha) {
    drawSmartSelectionPreview();
  }
}

function redrawOverlayInteraction() {
  canvasEditor.clearOverlay();
  drawPolygonShape();
  if (smartSelection?.pendingAlpha) drawSmartSelectionPreview();
}

// ---------------------------------------------------------------------------
// 다각형 선택
// ---------------------------------------------------------------------------

function handlePolygonClick(point) {
  const CLOSE_THRESHOLD = 10 / Math.max(0.05, viewport.zoom);
  if (maskTools.polygonPoints.length >= 3 && maskTools.isNearFirstPoint(point, CLOSE_THRESHOLD)) {
    confirmPolygon();
    return;
  }
  maskTools.polygonAddPoint(point);
  redrawOverlayInteraction();
}

function confirmPolygon() {
  const op = getState().tool.op;
  const ok = maskTools.polygonConfirm(op);
  if (ok) showToast("다각형 선택을 마스크에 반영했습니다.");
  redrawOverlayInteraction();
}

function drawPolygonShape(cursorPoint) {
  const points = maskTools?.polygonPoints || [];
  if (points.length === 0) return;
  const ctx = canvasEditor.overlayCtx;
  ctx.save();
  ctx.strokeStyle = "#2a7fff";
  ctx.fillStyle = "rgba(42,127,255,0.15)";
  ctx.lineWidth = Math.max(1, 2 / viewport.zoom);
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  if (cursorPoint) ctx.lineTo(cursorPoint.x, cursorPoint.y);
  ctx.stroke();
  if (points.length >= 2) ctx.fill();
  for (const p of points) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(2, 4 / viewport.zoom), 0, Math.PI * 2);
    ctx.fillStyle = "#2a7fff";
    ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// 스마트 선택
// ---------------------------------------------------------------------------

/** Ctrl(Cmd)+클릭: 미리보기/확정 절차 없이 곧바로 마스크에 추가한다 */
function quickAddSmartSelectAt(seed) {
  const tool = getState().tool;
  const { alpha, pixelCount } = smartSelection.compute(seed, {
    tolerance: tool.smartTolerance,
    mode: tool.smartMode,
    feather: 1,
  });
  smartSelection.pendingAlpha = null; // 미리보기 상태로 남기지 않고 바로 확정 처리
  maskTools.applySelectionAlpha(alpha, "add");
  redrawOverlayInteraction();
  showToast(`Ctrl+클릭으로 ${pixelCount.toLocaleString("ko-KR")}픽셀을 마스크에 추가했습니다.`);
}

function handleSmartSelectClick(point) {
  const tool = getState().tool;
  const seed = { x: Math.round(point.x), y: Math.round(point.y) };
  const { alpha, pixelCount } = smartSelection.compute(seed, {
    tolerance: tool.smartTolerance,
    mode: tool.smartMode,
    feather: 1,
  });
  redrawOverlayInteraction();
  showToast(`${pixelCount.toLocaleString("ko-KR")}픽셀 선택됨 — Enter로 확정, Esc로 취소`);
}

function drawSmartSelectionPreview() {
  const alpha = smartSelection.pendingAlpha;
  if (!alpha) return;
  const { width, height } = canvasEditor;
  const imageData = new ImageData(width, height);
  const data = imageData.data;
  for (let i = 0, p = 0; i < alpha.length; i++, p += 4) {
    if (alpha[i] <= 0) continue;
    data[p] = 255;
    data[p + 1] = 90;
    data[p + 2] = 20;
    data[p + 3] = Math.min(180, alpha[i]);
  }
  const temp = document.createElement("canvas");
  temp.width = width;
  temp.height = height;
  temp.getContext("2d").putImageData(imageData, 0, 0);
  canvasEditor.overlayCtx.drawImage(temp, 0, 0);
}

function confirmSmartSelection() {
  if (!smartSelection?.pendingAlpha) return;
  const op = getState().tool.op;
  maskTools.applySelectionAlpha(smartSelection.pendingAlpha, op);
  smartSelection.pendingAlpha = null;
  redrawOverlayInteraction();
  showToast("스마트 선택을 마스크에 반영했습니다.");
}

// ---------------------------------------------------------------------------
// 스포이드
// ---------------------------------------------------------------------------

function handleEyedropperClick(point) {
  const sample = getState().tool.eyedropperSample || 5;
  const hex = sampleOriginalColor(Math.round(point.x), Math.round(point.y), sample);
  applyAnswerColor(hex, "manual");
  showToast(`스포이드로 ${hex} 를 선택했습니다.`);
}

function sampleOriginalColor(cx, cy, size) {
  const { data, width, height } = canvasEditor.getOriginalImageData();
  const half = Math.floor(size / 2);
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  for (let dy = -half; dy <= half; dy++) {
    for (let dx = -half; dx <= half; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      const idx = (y * width + x) * 4;
      r += data[idx];
      g += data[idx + 1];
      b += data[idx + 2];
      count++;
    }
  }
  if (count === 0) return "#808080";
  const toHex = (v) => Math.round(v / count).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

// ---------------------------------------------------------------------------
// 뷰 모드 / 미리보기
// ---------------------------------------------------------------------------

qsa('input[name="view-mode"]').forEach((radio) => {
  radio.addEventListener("change", () => {
    if (!radio.checked || !canvasEditor) return;
    setViewMode(radio.value);
  });
});

function setViewMode(mode) {
  patchSlice("view", { mode });
  canvasEditor.setViewMode(mode);
  el.previewCanvas.style.display = mode === "preview" ? "block" : "none";
  if (mode === "preview") updatePreviewRenderer();
}

function ensurePreviewRenderer() {
  // 게임의 MaskRenderer는 내부적으로 캔버스 크기를 자기 마음대로 다시 잡기 때문에
  // (최대 640px로 축소) mask-canvas를 공유하면 마스크 오버레이용 백킹 사이즈가
  // 깨진다. 그래서 미리보기 전용 캔버스를 따로 둔다.
  if (!previewRenderer) previewRenderer = new PreviewRenderer(el.previewCanvas);
  return previewRenderer;
}

async function updatePreviewRenderer() {
  if (getState().view.mode !== "preview" || !canvasEditor?.width) return;
  const renderer = ensurePreviewRenderer();
  await renderer.updateSource(
    canvasEditor.getImageCanvasForExport(),
    canvasEditor.getMaskCanvasForExport(),
    getState().project.renderMode
  );
  const hex = getState().view.previewHex || getState().color.answerColor || "#808080";
  renderer.setColor(hex);
}

// ---------------------------------------------------------------------------
// 실행 취소 / 다시 실행
// ---------------------------------------------------------------------------

el.undoBtn.addEventListener("click", () => historyManager?.undo());
el.redoBtn.addEventListener("click", () => historyManager?.redo());

// ---------------------------------------------------------------------------
// 줌 컨트롤
// ---------------------------------------------------------------------------

qs('[data-action="zoom-in"]').addEventListener("click", () => viewport?.zoomIn());
qs('[data-action="zoom-out"]').addEventListener("click", () => viewport?.zoomOut());
qs('[data-action="zoom-fit"]').addEventListener("click", () => viewport?.fitToContainer());
qs('[data-action="zoom-100"]').addEventListener("click", () => viewport?.zoomTo100());

// ---------------------------------------------------------------------------
// 패널 탭
// ---------------------------------------------------------------------------

qsa(".maker-panel__tab").forEach((tabBtn) => {
  tabBtn.addEventListener("click", () => switchPanelTab(tabBtn.dataset.tab));
});

function switchPanelTab(tabName) {
  activePanelTab = tabName;
  qsa(".maker-panel__tab").forEach((btn) => {
    const active = btn.dataset.tab === tabName;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-selected", String(active));
  });
  for (const [name, sectionEl] of Object.entries(el.panelSections)) {
    sectionEl.hidden = name !== tabName;
  }
}

function renderAllPanels() {
  renderInfoTab();
  renderMaskTab();
  renderColorTab();
  renderPreviewTab();
  renderThumbnailTab();
  renderExportTab();
  switchPanelTab(activePanelTab);
}

function renderInfoTab() {
  renderInfoPanel(el.panelSections.info, {
    color: getState().color,
    onExtract: runExtraction,
    onDirectAdd: handleDirectAdd,
    project: getState().project,
    sourceFileName: getState().sourceFileName,
    onPatch: (partial) => {
      patchSlice("project", partial);
      updateFilenameDisplay();
      scheduleAutosave();
      if (partial.categoryId && !getState().project.id) {
        renderInfoTab();
      }
    },
  });
}

function renderMaskTab() {
  renderMaskPanel(el.panelSections.mask, {
    tool: getState().tool,
    view: getState().view,
    onToolPatch: (partial) => patchSlice("tool", partial),
    onViewPatch: (partial) => {
      patchSlice("view", partial);
      canvasEditor.setMaskOverlayStyle({ color: getState().view.maskOverlayColor, opacity: getState().view.maskOverlayOpacity });
    },
  });
}

function runMaskOp(op, amount) {
  if (!maskTools) return;
  switch (op) {
    case "selectAll":
      maskTools.selectAll();
      break;
    case "selectNone":
      maskTools.selectNone();
      break;
    case "invert":
      maskTools.invert();
      break;
    case "expand":
      maskTools.expand(amount ?? 6);
      break;
    case "contract":
      maskTools.contract(amount ?? 6);
      break;
    case "feather":
      maskTools.feather(amount ?? 4);
      break;
    case "fillHoles":
      maskTools.fillHoles(amount ?? 6);
      break;
    case "despeckle":
      maskTools.despeckle(amount ?? 24);
      break;
    default:
      return;
  }
  showToast("마스크를 업데이트했습니다.");
}

/** 키보드 단축키에서 호출: "빠른 편집" 탭에 있는 값 입력칸의 현재 값을 그대로 사용한다 */
function runMaskOpFromShortcut(op) {
  const input = document.querySelector(`[data-mask-op-value="${op}"]`);
  const amount = input ? Number(input.value) : undefined;
  runMaskOp(op, amount);
}

function renderColorTab() {
  updateAnswerSwatch(el.panelSections.info, getState().color.answerColor);
  renderColorPanel(el.panelSections.color, {
    color: getState().color,
    tool: getState().tool,
    onExtract: runExtraction,
    onSetColor: applyAnswerColor,
    onEyedropperToggle: (opts) => {
      if (opts?.sampleOnly) {
        patchSlice("tool", { eyedropperSample: opts.sample });
        return;
      }
      setActiveTool("eyedropper");
      updateToolrailActive();
    },
  });
}

function runExtraction() {
  if (!canvasEditor?.width) return;
  const result = extractAnswerColorCandidates(canvasEditor);
  if (result.empty) {
    patchSlice("color", { candidates: [], consistency: 0, autoHex: null });
    showToast("마스크가 비어 있어 추출할 수 없습니다.");
    renderColorTab();
    return;
  }
  patchSlice("color", {
    candidates: result.candidates,
    consistency: result.consistency,
    autoHex: result.autoHex,
    answerColor: result.autoHex,
    source: "auto",
  });
  renderColorTab();
  showToast(`정답 색상을 추출했습니다 (샘플 ${result.sampleCount.toLocaleString("ko-KR")}개).`);
  scheduleAutosave();
}

function applyAnswerColor(hex, source) {
  const color = getState().color;
  const recent = [hex, ...color.recent.filter((h) => h !== hex)].slice(0, 8);
  patchSlice("color", { answerColor: hex, source, recent });
  renderColorTab();
  if (getState().view.mode === "preview" && !getState().view.previewHex) {
    updatePreviewRenderer();
  }
  scheduleAutosave();
}

function renderPreviewTab() {
  renderPreviewPanel(el.panelSections.preview, {
    view: getState().view,
    color: getState().color,
    onSetPreviewHex: (hex) => {
      patchSlice("view", { previewHex: hex });
      updatePreviewRenderer();
    },
    onToggleCompare: (checked) => patchSlice("view", { compareMode: checked }),
  });
}

function renderThumbnailTab() {
  thumbnailEditor = renderThumbnailPanel(el.panelSections.thumbnail, {
    onZoomChange: () => scheduleAutosave(),
  });
  if (canvasEditor?.width) {
    thumbnailEditor.setSource(canvasEditor.getImageCanvasForExport(), canvasEditor.width, canvasEditor.height);
  }
}

function renderExportTab() {
  renderExportPanel(el.panelSections.export, {
    onValidate: () => runValidationFlow({ silent: false }),
    onExportZip: handleExportZip,
    onDirectAdd: handleDirectAdd,
  });
}

// ---------------------------------------------------------------------------
// 검증
// ---------------------------------------------------------------------------

function buildQuestionForValidation() {
  const { project, color } = getState();
  return {
    schemaVersion: 1,
    id: project.id,
    categoryId: project.categoryId,
    title: project.title,
    originalImage: "original.webp",
    maskImage: "mask.png",
    thumbnail: "thumbnail.webp",
    answerColor: color.answerColor,
    startColor: project.startColorMode === "fixed" ? project.startColorFixed : null,
    renderMode: project.renderMode,
    enabled: project.enabled !== false,
    difficulty: project.difficulty ?? 1,
    tags: project.tags ?? [],
    metadata: { createdAt: new Date().toISOString().slice(0, 10), makerVersion: "1.0.0" },
    __editingOriginalId: project.editingOriginalId,
  };
}

async function runValidationFlow({ silent, allowOverwrite = false }) {
  if (categoriesForValidation.length === 0) {
    categoriesForValidation = await loadUsableCategories();
  }
  const question = buildQuestionForValidation();
  let results = await runFullValidation({
    question,
    canvasEditor,
    thumbnailReady: !!lastThumbnailBlob || !!thumbnailEditor?.source,
    categoryList: categoriesForValidation,
  });
  if (allowOverwrite) results = results.filter(r => r.code !== "duplicate-id");
  const summary = summarize(results);

  if (!silent || summary.error > 0) {
    renderValidationModal(results, summary);
    openModal(el.validationModal);
  }
  return { results, summary };
}

function renderValidationModal(results, summary) {
  el.validationBody.innerHTML = `
    <div class="validation-summary">
      <div class="validation-summary__item"><div class="validation-summary__count">${summary.pass}</div><div class="validation-summary__label">통과</div></div>
      <div class="validation-summary__item"><div class="validation-summary__count">${summary.warn}</div><div class="validation-summary__label">경고</div></div>
      <div class="validation-summary__item"><div class="validation-summary__count">${summary.error}</div><div class="validation-summary__label">오류</div></div>
    </div>
    <div class="validation-list">
      ${results
        .map(
          (r) => `
        <div class="validation-item validation-item--${r.level}">
          <span class="validation-item__icon">${iconSvg(r.level === "error" ? "error" : r.level === "warn" ? "warning" : "check", 18)}</span>
          <span>${escapeHtml(r.message)}</span>
        </div>`
        )
        .join("")}
    </div>
  `;
  el.validationFooter.innerHTML = "";
}

// ---------------------------------------------------------------------------
// 내보내기: ZIP
// ---------------------------------------------------------------------------

async function ensureThumbnailBlob() {
  if (!thumbnailEditor) return null;
  lastThumbnailBlob = await thumbnailEditor.exportBlob();
  return lastThumbnailBlob;
}

async function handleExportZip() {
  const { summary } = await runValidationFlow({ silent: true });
  if (summary.error > 0) {
    showToast("오류가 있어 내보낼 수 없습니다. 검증 결과를 확인해 주세요.");
    return;
  }
  if (summary.warn > 0) {
    const proceed = await confirmDialog("경고가 있습니다", "경고 항목이 있습니다. 계속 내보낼까요?");
    if (!proceed) return;
  }

  showProgress("ZIP을 만드는 중...");
  try {
    const thumbnailBlob = await ensureThumbnailBlob();
    const question = buildQuestionForValidation();
    await exportQuestionAsZip({
      question,
      imageCanvas: canvasEditor.getImageCanvasForExport(),
      maskCanvas: canvasEditor.getMaskCanvasForExport(),
      thumbnailBlob,
    });
    hideProgress();
    showToast("ZIP을 내보냈습니다.");
    markClean();
  } catch (err) {
    hideProgress();
    console.error("[maker-app] ZIP 내보내기 실패", err);
    showToast(`ZIP 내보내기에 실패했습니다: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// 내보내기: 게임 프로젝트에 바로 추가
// ---------------------------------------------------------------------------

async function handleDirectAdd() {
  if (!isFileSystemAccessSupported()) {
    showToast("이 브라우저는 폴더에 직접 쓰는 기능을 지원하지 않습니다. ZIP으로 내보내 주세요.");
    return;
  }

  const { summary } = await runValidationFlow({ silent: true, allowOverwrite: true });
  if (summary.error > 0) {
    showToast("오류가 있어 추가할 수 없습니다. 검증 결과를 확인해 주세요.");
    return;
  }
  if (summary.warn > 0) {
    const proceed = await confirmDialog("경고가 있습니다", "경고 항목이 있습니다. 계속 추가할까요?");
    if (!proceed) return;
  }

  let rootHandle;
  try {
    rootHandle = await pickProjectRoot();
  } catch (err) {
    if (err.name === "AbortError") return; // 사용자가 취소함
    console.error("[maker-app] 폴더 선택 실패", err);
    showToast("폴더를 선택하지 못했습니다.");
    return;
  }

  const verify = await verifyProjectRoot(rootHandle);
  if (!verify.ok) {
    showToast(verify.error);
    return;
  }

  const question = buildQuestionForValidation();
  let plan;
  try {
    plan = await planDirectWrite(rootHandle, { categoryId: question.categoryId, questionId: question.id });
  } catch (err) {
    showToast(err.message);
    return;
  }

  const proceed = await confirmDialog(
    plan.overwrite ? "같은 ID의 문제를 덮어쓸까요?" : "이 경로에 문제를 추가합니다",
    `<p><strong>${escapeHtml(plan.destPath)}/</strong> ${plan.overwrite ? "기존 문제와 이미지를 백업한 후 교체합니다." : "폴더를 새로 만들고 아래 파일을 씁니다."}</p>
     <ul style="margin-top:8px; padding-left:18px;">${plan.files.map((f) => `<li>${escapeHtml(f)}</li>`).join("")}</ul>
     <p style="margin-top:8px;">그리고 <strong>${escapeHtml(plan.questionFilePath)}</strong>에 문제 항목을 추가합니다 (수정 전 자동 백업 생성).</p>`
  );
  if (!proceed) return;

  showProgress("게임 프로젝트에 추가하는 중...");
  try {
    const thumbnailBlob = await ensureThumbnailBlob();
    const result = await writeQuestionDirectly(rootHandle, {
      overwrite: plan.overwrite,
      question,
      imageCanvas: canvasEditor.getImageCanvasForExport(),
      maskCanvas: canvasEditor.getMaskCanvasForExport(),
      thumbnailBlob,
    });
    hideProgress();
    showToast(`추가했습니다: ${result.destPath} (백업: ${result.backupFile})`);
    markClean();
  } catch (err) {
    hideProgress();
    console.error("[maker-app] 프로젝트에 직접 추가 실패", err);
    showToast(`추가에 실패했습니다: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// 기존 문제 열기
// ---------------------------------------------------------------------------

let openFileInput = null;
function handleOpenExistingClick() {
  if (!openFileInput) {
    openFileInput = document.createElement("input");
    openFileInput.type = "file";
    openFileInput.accept = ".zip,application/zip";
    openFileInput.className = "visually-hidden";
    document.body.appendChild(openFileInput);
    openFileInput.addEventListener("change", async () => {
      const file = openFileInput.files?.[0];
      openFileInput.value = "";
      if (file) await handleOpenExistingZip(file);
    });
  }
  openFileInput.click();
}

async function handleOpenExistingZip(file) {
  showProgress("문제를 여는 중...");
  try {
    const opened = await openExistingFromZipFile(file);
    hideProgress();

    const keepId = await confirmDialog(
      "원본 ID를 유지할까요?",
      `<p>불러온 문제 id: <strong>${escapeHtml(opened.question.id)}</strong></p>
       <p style="margin-top:8px;">원본 id를 유지하면 기존 문제를 그대로 수정합니다. 새 id로 복제하면 별도의 새 문제로 저장됩니다.</p>`,
      { confirmLabel: "원본 id 유지", cancelLabel: "새 id로 복제" }
    );

    resetState();
    ensureEditorInstances();
    canvasEditor.setup(opened.originalBitmap, opened.width, opened.height);
    canvasEditor.loadExistingMask(opened.maskBitmap);
    syncHistorySize();
    viewport.setContentSize(opened.width, opened.height);
    requestAnimationFrame(() => viewport.fitToContainer());

    const q = opened.question;
    setState({
      image: { naturalWidth: opened.width, naturalHeight: opened.height, workingWidth: opened.width, workingHeight: opened.height, maxLongEdge: null, keepOriginal: true },
      project: {
        ...getState().project,
        categoryId: q.categoryId || "",
        id: keepId ? q.id : "",
        title: q.title || "",
        difficulty: q.difficulty ?? 1,
        tags: q.tags || [],
        startColorMode: q.startColor ? "fixed" : "auto",
        startColorFixed: q.startColor || null,
        renderMode: q.renderMode || "preserve-lightness",
        enabled: q.enabled !== false,
        editingOriginalId: keepId ? q.id : null,
      },
      color: { ...getState().color, answerColor: q.answerColor || null, source: "manual", candidates: [], recent: q.answerColor ? [q.answerColor] : [] },
    });

    enterEditor();
    if (opened.thumbnailBitmap && thumbnailEditor) {
      thumbnailEditor.setSource(opened.thumbnailBitmap, opened.thumbnailBitmap.width, opened.thumbnailBitmap.height);
    }
    showToast("문제를 열었습니다.");
  } catch (err) {
    hideProgress();
    console.error("[maker-app] 기존 문제 열기 실패", err);
    showToast(`문제를 여는 데 실패했습니다: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// 새 작업 / 상단 바
// ---------------------------------------------------------------------------

qs('[data-action="new-project"]').addEventListener("click", async () => {
  if (getState().isDirty) {
    const proceed = await confirmDialog("저장하지 않은 변경사항", "지금 작업 중인 내용이 저장되지 않을 수 있습니다. 새 작업을 시작할까요?", { danger: true });
    if (!proceed) return;
  }
  resetState();
  showScreen("start");
  initStartScreen();
});

qs('[data-action="open-project"]').addEventListener("click", handleOpenExistingClick);

qs('[data-action="shortcuts"]').addEventListener("click", () => {
  renderShortcutsModal();
  openModal(el.shortcutsModal);
});

function renderShortcutsModal() {
  const rows = [
    ["브러시", "B"],
    ["지우개", "E"],
    ["스마트 선택", "W"],
    ["다각형 선택", "P"],
    ["스포이드", "I"],
    ["화면 이동", "Space + 드래그"],
    ["클릭 지점 유사 색상을 마스크에 즉시 추가", "Ctrl + 왼쪽 클릭"],
    ["실행 취소", "Ctrl+Z"],
    ["다시 실행", "Ctrl+Y / Ctrl+Shift+Z"],
    ["임시 저장", "Ctrl+S"],
    ["이미지에 맞춤", "0"],
    ["100% 보기", "1"],
    ["브러시 작게", "["],
    ["브러시 크게", "]"],
    ["마스크 표시/숨기기", "M"],
    ["전체 선택", "A"],
    ["전체 해제", "D"],
    ["마스크 반전", "R"],
    ["선택 영역 확장", "Shift+]"],
    ["선택 영역 축소", "Shift+["],
    ["가장자리 부드럽게", "F"],
    ["작은 구멍 채우기", "H"],
    ["고립 픽셀 제거", "X"],
    ["현재 작업 취소", "Esc"],
  ];
  el.shortcutsBody.innerHTML = `
    <div class="shortcut-list">
      ${rows
        .map(
          ([label, key]) => `
        <div class="shortcut-row"><span>${label}</span><span class="shortcut-keys">${key
          .split(" / ")
          .map((k) => `<kbd class="key">${k}</kbd>`)
          .join(" 또는 ")}</span></div>`
        )
        .join("")}
    </div>
  `;
}

function updateFilenameDisplay() {
  const { project, sourceFileName } = getState();
  el.filename.textContent = project.title || sourceFileName || "제목 없음";
}

// ---------------------------------------------------------------------------
// 키보드 단축키
// ---------------------------------------------------------------------------

function isTypingInField() {
  const active = document.activeElement;
  if (!active) return false;
  const tag = active.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || active.isContentEditable;
}

window.addEventListener("keydown", (e) => {
  if (getState().screen !== "editor") return;

  if (e.code === "Space" && !isTypingInField()) {
    spaceDown = true;
    el.overlayCanvas.style.cursor = "grab";
  }

  if (isTypingInField()) return;

  const ctrlOrCmd = e.ctrlKey || e.metaKey;

  if (e.ctrlKey && !e.altKey && !e.shiftKey && e.code === "KeyQ") {
    e.preventDefault();
    setActiveTool("smart");
    return;
  }

  if (ctrlOrCmd && e.key.toLowerCase() === "z" && e.shiftKey) {
    e.preventDefault();
    historyManager?.redo();
    return;
  }
  if (ctrlOrCmd && e.key.toLowerCase() === "z") {
    e.preventDefault();
    historyManager?.undo();
    return;
  }
  if (ctrlOrCmd && e.key.toLowerCase() === "y") {
    e.preventDefault();
    historyManager?.redo();
    return;
  }
  if (!ctrlOrCmd && e.shiftKey && e.code === "BracketRight") {
    e.preventDefault();
    runMaskOpFromShortcut("expand");
    return;
  }
  if (!ctrlOrCmd && e.shiftKey && e.code === "BracketLeft") {
    e.preventDefault();
    runMaskOpFromShortcut("contract");
    return;
  }
  if (ctrlOrCmd && e.key.toLowerCase() === "s") {
    e.preventDefault();
    saveDraftNow().then(() => showToast("임시 저장했습니다."));
    return;
  }

  switch (e.key) {
    case "b":
    case "B":
      setActiveTool("brush");
      break;
    case "e":
    case "E":
      setActiveTool("eraser");
      break;
    case "w":
    case "W":
      setActiveTool("smart");
      break;
    case "p":
    case "P":
      setActiveTool("polygon");
      break;
    case "i":
    case "I":
      setActiveTool("eyedropper");
      break;
    case "m":
    case "M": {
      if (!canvasEditor?.width) break;
      const current = getState().view.mode;
      const nextMode = current === "mask-only" ? "normal" : "mask-only";
      setViewMode(nextMode);
      qs(`input[name="view-mode"][value="${nextMode}"]`).checked = true;
      break;
    }
    // ---- 마스크 선택 도구 (빠른 편집 탭의 버튼과 동일) ----
    case "a":
    case "A":
      runMaskOpFromShortcut("selectAll");
      break;
    case "d":
    case "D":
      runMaskOpFromShortcut("selectNone");
      break;
    case "r":
    case "R":
      runMaskOpFromShortcut("invert");
      break;
    case "f":
    case "F":
      runMaskOpFromShortcut("feather");
      break;
    case "h":
    case "H":
      runMaskOpFromShortcut("fillHoles");
      break;
    case "x":
    case "X":
      runMaskOpFromShortcut("despeckle");
      break;

    case "0":
      viewport?.fitToContainer();
      break;
    case "1":
      viewport?.zoomTo100();
      break;
    case "[":
      patchSlice("tool", { brushSize: Math.max(2, getState().tool.brushSize - 4) });
      renderMaskTab();
      break;
    case "]":
      patchSlice("tool", { brushSize: Math.min(400, getState().tool.brushSize + 4) });
      renderMaskTab();
      break;
    case "Enter":
      if (getState().tool.current === "polygon" && maskTools.polygonPoints.length >= 3) confirmPolygon();
      else if (smartSelection?.pendingAlpha) confirmSmartSelection();
      break;
    case "Escape":
      cancelPendingInteractions();
      break;
    default:
      break;
  }
});

window.addEventListener("keyup", (e) => {
  if (e.code === "Space") {
    spaceDown = false;
    isPanning = false;
    el.overlayCanvas.style.cursor = "crosshair";
  }
});

window.addEventListener("beforeunload", (e) => {
  if (getState().isDirty) {
    e.preventDefault();
    e.returnValue = "";
  }
});

// ---------------------------------------------------------------------------
// 상태 표시줄
// ---------------------------------------------------------------------------

function updateStatusBar() {
  if (!canvasEditor?.width) return;
  const { workingWidth, workingHeight, naturalWidth, naturalHeight } = getState().image;
  el.statusImageSize.textContent =
    workingWidth === naturalWidth
      ? `이미지: ${workingWidth} × ${workingHeight}px`
      : `이미지: ${workingWidth} × ${workingHeight}px (원본 ${naturalWidth} × ${naturalHeight}px)`;

  const total = canvasEditor.getTotalPixels();
  const selected = canvasEditor.countSelectedPixels();
  el.statusMaskPixels.textContent = `마스크 픽셀: ${selected.toLocaleString("ko-KR")}`;
  el.statusMaskRatio.textContent = `마스크 비율: ${total > 0 ? ((selected / total) * 100).toFixed(1) : 0}%`;
}

// ---------------------------------------------------------------------------
// 임시 저장 (IndexedDB)
// ---------------------------------------------------------------------------

function startAutosaveTimer() {
  if (autosaveIntervalId) clearInterval(autosaveIntervalId);
  autosaveIntervalId = setInterval(() => {
    if (getState().isDirty) saveDraftNow().catch((err) => console.error("[maker-app] 자동 저장 실패", err));
  }, 20000);
}

async function saveDraftNow() {
  if (!canvasEditor?.width || !draftStorage.isSupported()) return;
  const state = getState();

  const [imageBlob, maskBlob] = await Promise.all([
    canvasToBlob(canvasEditor.getImageCanvasForExport(), "image/png"),
    canvasToBlob(canvasEditor.getMaskCanvasForExport(), "image/png"),
  ]);

  const record = {
    id: state.draftId || undefined,
    title: state.project.title || state.sourceFileName || "제목 없음",
    categoryId: state.project.categoryId,
    questionMeta: {
      project: state.project,
      tool: state.tool,
      color: { ...state.color },
      view: state.view,
    },
    imageBlob,
    maskBlob,
    thumbnailBlob: lastThumbnailBlob,
    naturalWidth: state.image.naturalWidth,
    naturalHeight: state.image.naturalHeight,
    workingWidth: canvasEditor.width,
    workingHeight: canvasEditor.height,
  };

  const id = await draftStorage.saveDraft(record);
  setState({ draftId: id });
  markClean();
  el.savestate.textContent = "저장됨 · " + new Date().toLocaleTimeString("ko-KR");
  el.savestate.classList.add("is-saved");
}

async function handleOpenDraft(draftId) {
  showProgress("임시 작업을 불러오는 중...");
  try {
    const record = await draftStorage.loadDraft(draftId);
    if (!record) {
      hideProgress();
      showToast("임시 작업을 찾을 수 없습니다.");
      return;
    }
    const [originalBitmap, maskBitmap] = await Promise.all([
      createImageBitmap(record.imageBlob),
      createImageBitmap(record.maskBlob),
    ]);

    resetState();
    ensureEditorInstances();
    canvasEditor.setup(originalBitmap, record.workingWidth, record.workingHeight);
    canvasEditor.loadExistingMask(maskBitmap);
    syncHistorySize();
    viewport.setContentSize(record.workingWidth, record.workingHeight);
    requestAnimationFrame(() => viewport.fitToContainer());

    setState({
      draftId: record.id,
      sourceFileName: record.title,
      image: {
        naturalWidth: record.naturalWidth,
        naturalHeight: record.naturalHeight,
        workingWidth: record.workingWidth,
        workingHeight: record.workingHeight,
        maxLongEdge: null,
        keepOriginal: record.naturalWidth === record.workingWidth,
      },
      project: { ...getState().project, ...record.questionMeta.project },
      tool: { ...getState().tool, ...record.questionMeta.tool },
      color: { ...getState().color, ...record.questionMeta.color },
      view: { ...getState().view, ...record.questionMeta.view, mode: "normal" },
    });

    lastThumbnailBlob = record.thumbnailBlob || null;
    hideProgress();
    enterEditor();
    if (lastThumbnailBlob && thumbnailEditor) {
      const thumbBitmap = await createImageBitmap(lastThumbnailBlob);
      thumbnailEditor.setSource(thumbBitmap, thumbBitmap.width, thumbBitmap.height);
    }
    showToast("임시 작업을 복구했습니다.");
  } catch (err) {
    hideProgress();
    console.error("[maker-app] 임시 작업 복구 실패", err);
    showToast("임시 작업을 복구하지 못했습니다.");
  }
}

// ---------------------------------------------------------------------------
// 모바일 안내
// ---------------------------------------------------------------------------

function checkMobileNotice() {
  if (window.innerWidth < 720 && !sessionStorage.getItem("mk-mobile-notice-dismissed")) {
    el.mobileNotice.hidden = false;
  }
}
qs('[data-action="dismiss-mobile-notice"]').addEventListener("click", () => {
  el.mobileNotice.hidden = true;
  sessionStorage.setItem("mk-mobile-notice-dismissed", "1");
});

// ---------------------------------------------------------------------------
// 초기화
// ---------------------------------------------------------------------------

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

async function init() {
  checkMobileNotice();
  window.addEventListener("resize", checkMobileNotice);
  await initStartScreen();
}

init();

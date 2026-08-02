/** DOM 헬퍼 + 라인 스타일 아이콘 모음 (게임 본체 src/js/utils/dom.js와 같은 스타일) */

export function qs(selector, root = document) {
  return root.querySelector(selector);
}

export function qsa(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "class") node.className = value;
    else if (key === "html") node.innerHTML = value;
    else if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value !== null && value !== undefined && value !== false) {
      node.setAttribute(key, value === true ? "" : value);
    }
  }
  for (const child of [].concat(children)) {
    if (child === null || child === undefined) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function on(target, type, handler, opts) {
  target.addEventListener(type, handler, opts);
  return () => target.removeEventListener(type, handler, opts);
}

export function formatNumber(n) {
  return Math.round(n).toLocaleString("ko-KR");
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function debounce(fn, wait) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

/** 이모지를 아이콘으로 쓰지 않기 위한 최소한의 라인 스타일 SVG 세트 */
const ICONS = {
  brush:
    '<path d="M4 20c0-3 1-5 3-5s3 2 3 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M9 15 18.5 4.5a1.5 1.5 0 0 1 2.2 2L10 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  eraser:
    '<path d="M18 13 9.5 21.5H5L3 19.5l11-11 6 6-2 -1.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M8 21.5h11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  polygon:
    '<path d="m5 8 6-4 8 3-1 9-9 4-4-6z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="5" cy="8" r="1.6" fill="currentColor"/><circle cx="11" cy="4" r="1.6" fill="currentColor"/><circle cx="19" cy="7" r="1.6" fill="currentColor"/><circle cx="18" cy="16" r="1.6" fill="currentColor"/><circle cx="9" cy="20" r="1.6" fill="currentColor"/>',
  wand:
    '<path d="M4.5 19.5 15 9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M17 3v3M22 8h-3M11 3l.7 1.8L13.5 5.5 11.7 6.2 11 8l-.7-1.8L8.5 5.5l1.8-.7z" fill="currentColor" stroke="currentColor" stroke-width="0.6" stroke-linejoin="round"/><path d="M19 11.5l.5 1.3 1.3.5-1.3.5-.5 1.3-.5-1.3-1.3-.5 1.3-.5z" fill="currentColor"/>',
  eyedropper:
    '<path d="m10.5 13.5-6 6H2v-2.5l6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M13 4.5a2.5 2.5 0 0 1 3.5 0l2 2a2.5 2.5 0 0 1 0 3.5L11 17.5l-5-5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  undo: '<path d="M7 8H3V4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 8a9 9 0 1 1 2.6 8.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  redo: '<path d="M17 8h4V4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M21 8a9 9 0 1 0-2.6 8.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  zoomIn:
    '<circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10.5 8v5M8 10.5h5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="m20 20-4.3-4.3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  zoomOut:
    '<circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 10.5h5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="m20 20-4.3-4.3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  fit: '<path d="M9 3H4v5M15 3h5v5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  upload:
    '<path d="M12 15V4M12 4 8 8M12 4l4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  folderOpen:
    '<path d="M3 8V6a1.5 1.5 0 0 1 1.5-1.5H9l2 2h8A1.5 1.5 0 0 1 20.5 8" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M2.5 8h18.6a1 1 0 0 1 1 1.2l-1.6 8A1.5 1.5 0 0 1 19 18.5H5a1.5 1.5 0 0 1-1.5-1.3L2 9.2A1 1 0 0 1 2.5 8z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  download:
    '<path d="M12 4v11M12 15l-4-4M12 15l4-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  save: '<path d="M5 4h11l3 3v13H5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M8 4v5h7V4M8 20v-6h8v6" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  plus: '<path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  check:
    '<path d="M5 13l4 4 10-10" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
  warning:
    '<path d="M12 3 2 20h20z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 9.5v4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="17" r="1" fill="currentColor"/>',
  error:
    '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9 9l6 6M15 9l-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  close:
    '<path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  help: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9.5 9a2.5 2.5 0 0 1 4.7 1.2c0 1.7-2.2 1.6-2.2 3.3" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/><circle cx="12" cy="17" r="1" fill="currentColor"/>',
  trash:
    '<path d="M4 7h16M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7M6 7l1 13a1.5 1.5 0 0 0 1.5 1.4h7A1.5 1.5 0 0 0 17 20l1-13" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  refresh:
    '<path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M18 4v4h-4M6 20v-4h4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  image:
    '<rect x="3" y="4" width="18" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="8.5" cy="9.5" r="1.6" fill="currentColor"/><path d="m4 17 5-5 4 4 3-3 4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  eyeShow:
    '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/>',
  eyeHide:
    '<path d="M3 3l18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M10.6 5.2A9.9 9.9 0 0 1 12 5c6 0 10 7 10 7a15.6 15.6 0 0 1-4 4.6M6.6 6.6C4 8.3 2 12 2 12s4 7 10 7a9.9 9.9 0 0 0 4-.8" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M9.9 10a3 3 0 0 0 4.2 4.2" fill="none" stroke="currentColor" stroke-width="2"/>',
  invert:
    '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/>',
  expand:
    '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/>',
  contract:
    '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/>',
  feather:
    '<path d="M20 4C10 4 4 10 4 20c8 0 14-6 14-14z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M13 11 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  fillHoles:
    '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3.5" fill="currentColor"/>',
  despeckle:
    '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="2 3"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/>',
  selectAll:
    '<rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="3 2"/>',
  selectNone:
    '<rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="3 2"/><path d="M8 8l8 8M16 8l-8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  share:
    '<circle cx="18" cy="5" r="2.4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="6" cy="12" r="2.4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="18" cy="19" r="2.4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8.1 10.7l7.8-4.4M8.1 13.3l7.8 4.4" stroke="currentColor" stroke-width="2"/>',
  folderPlus:
    '<path d="M2.5 8h18.6a1 1 0 0 1 1 1.2l-1.6 8A1.5 1.5 0 0 1 19 18.5H5a1.5 1.5 0 0 1-1.5-1.3L2 9.2A1 1 0 0 1 2.5 8z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M3 8V6a1.5 1.5 0 0 1 1.5-1.5H9l2 2h8" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 10.5v4.5M9.7 12.75h4.6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  crop: '<path d="M6 2v14a2 2 0 0 0 2 2h14M18 22V8a2 2 0 0 0-2-2H2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  compare:
    '<path d="M8 5v14M16 5v14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M4 12h2M18 12h2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  move: '<path d="M12 3v18M3 12h18M6 7l-3 5 3 5M18 7l3 5-3 5M7 6l5-3 5 3M7 18l5 3 5-3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
  chevronDown:
    '<path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
};

export function iconSvg(name, size = 20) {
  const body = ICONS[name] || "";
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${body}</svg>`;
}

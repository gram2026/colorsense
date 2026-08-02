/** DOM 관련 자잘한 헬퍼 + 라인 스타일 SVG 아이콘 모음 */

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
    } else if (value !== null && value !== undefined) {
      node.setAttribute(key, value);
    }
  }
  for (const child of [].concat(children)) {
    if (child === null || child === undefined) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function formatNumber(n) {
  return Math.round(n).toLocaleString("ko-KR");
}

/**
 * 획일적인 라인 스타일 아이콘. 이모지를 주 아이콘으로 쓰지 않기 위해
 * 필요한 최소한의 아이콘만 인라인 SVG로 직접 그린다.
 */
const ICONS = {
  play: '<path d="M8 5.5v13l11-6.5-11-6.5z" fill="currentColor"/>',
  back: '<path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
  settings:
    '<circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 3v2.2M12 18.8V21M21 12h-2.2M5.2 12H3M18.4 5.6l-1.55 1.55M7.15 16.85l-1.55 1.55M18.4 18.4l-1.55-1.55M7.15 7.15L5.6 5.6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  soundOn:
    '<path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M17 8.5a5 5 0 010 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  soundOff:
    '<path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  share:
    '<circle cx="18" cy="5" r="2.4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="6" cy="12" r="2.4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="18" cy="19" r="2.4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8.1 10.7l7.8-4.4M8.1 13.3l7.8 4.4" stroke="currentColor" stroke-width="2"/>',
  replay:
    '<path d="M4 12a8 8 0 1 1 2.6 5.9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M4 17v-5h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  home: '<path d="M4 11l8-7 8 7v9a1 1 0 01-1 1h-4v-6H9v6H5a1 1 0 01-1-1v-9z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  check:
    '<path d="M5 13l4 4 10-10" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
  star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.2 1 6-5.2-2.9-5.2 2.9 1-6-4.3-4.2 5.9-.8z" fill="currentColor"/>',
};

export function iconSvg(name, size = 20) {
  const body = ICONS[name] || "";
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${body}</svg>`;
}

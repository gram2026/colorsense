/** 짧은 알림 문구를 화면 아래에 잠깐 보여준다 */

let hideTimer = null;

export function showToast(message, { duration = 2200 } = {}) {
  const toastEl = document.getElementById("toast");
  if (!toastEl) return;

  toastEl.textContent = message;
  toastEl.classList.add("is-visible");

  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    toastEl.classList.remove("is-visible");
  }, duration);
}

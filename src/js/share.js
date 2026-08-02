/**
 * 결과 공유
 * 1) Web Share API 지원 시 공유창을 연다
 * 2) 아니면 클립보드에 문구를 복사한다 (execCommand 폴백까지 시도)
 * 정답/문제 데이터는 절대 포함하지 않는다.
 */

function isDeployedUrl() {
  const { hostname, protocol } = location;
  if (protocol === "file:") return false;
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "") return false;
  return true;
}

export function buildShareText({ categoryName, totalScore }) {
  const base = `Color Guesser ${categoryName} 카테고리에서 ${totalScore}점을 기록했어요! 당신의 색감은 몇 점인가요?`;
  return isDeployedUrl() ? `${base}\n${location.href}` : base;
}

function fallbackCopy(text) {
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

/**
 * @returns {Promise<{ method: "share" | "clipboard" | "manual", text: string, cancelled?: boolean }>}
 */
export async function shareResult(payload) {
  const text = buildShareText(payload);

  if (navigator.share) {
    try {
      await navigator.share({ title: "Color Guesser", text });
      return { method: "share", text };
    } catch (err) {
      if (err && err.name === "AbortError") {
        return { method: "share", text, cancelled: true };
      }
      console.error("[share] Web Share 실패, 클립보드로 대체합니다.", err);
    }
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return { method: "clipboard", text };
    } catch (err) {
      console.error("[share] 클립보드 복사 실패, execCommand로 대체합니다.", err);
    }
  }

  const ok = fallbackCopy(text);
  return { method: ok ? "clipboard" : "manual", text };
}

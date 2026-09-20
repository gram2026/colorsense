/**
 * 이미지 로딩 헬퍼
 * 실패해도 앱 전체가 멈추지 않도록 항상 resolve하고, 성공 여부를 결과로 알려준다.
 */

export function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ ok: true, image: img });
    img.onerror = () => resolve({ ok: false, image: null, error: new Error(`이미지를 불러오지 못했습니다: ${src}`) });
    img.src = src;
  });
}

/** 여러 이미지를 동시에 불러오고, 실패한 것도 결과 배열에 그대로 포함해서 반환 */
export async function loadImages(sources) {
  return Promise.all(sources.map((src) => loadImage(src)));
}

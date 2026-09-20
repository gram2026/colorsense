/**
 * 게임과 완전히 같은 색상 합성 결과를 보여주는 미리보기.
 * ---------------------------------------------------------------
 * 절대로 색상 치환 수식을 여기서 다시 구현하지 않는다. 게임 본체가 실제로
 * 쓰는 src/js/color/mask-renderer.js의 MaskRenderer를 그대로 가져다 쓴다.
 * 이렇게 하면 제작기 미리보기와 실제 게임 화면이 알고리즘 수준에서 항상
 * 똑같다 (수식을 복사해서 나중에 서로 달라지는 사고를 원천적으로 막는다).
 *
 * MaskRenderer는 <img src="...">로 이미지를 불러오므로, 캔버스에 있는
 * 원본/마스크를 Blob -> ObjectURL로 바꿔서 넘긴다. 색을 바꿀 때마다 이미지를
 * 다시 읽지 않고 setColor()만 호출하며(내부적으로 requestAnimationFrame 사용),
 * 원본/마스크 자체가 바뀔 때만 다시 load()한다.
 */

import { MaskRenderer } from "../../src/js/color/mask-renderer.js";
import { canvasToBlob } from "./utils/image-utils.js";

export class PreviewRenderer {
  constructor(canvasEl) {
    this.renderer = new MaskRenderer(canvasEl);
    this._urls = [];
    this.ready = false;
  }

  async updateSource(imageCanvas, maskCanvas, renderMode) {
    this._revokeUrls();

    const [originalBlob, maskBlob] = await Promise.all([
      canvasToBlob(imageCanvas, "image/png"),
      canvasToBlob(maskCanvas, "image/png"),
    ]);

    const originalUrl = URL.createObjectURL(originalBlob);
    const maskUrl = URL.createObjectURL(maskBlob);
    this._urls.push(originalUrl, maskUrl);

    const result = await this.renderer.load(originalUrl, maskUrl, renderMode);
    this.ready = result.ok;
    return result;
  }

  setColor(hex) {
    if (!this.ready) return;
    this.renderer.setColor(hex);
  }

  _revokeUrls() {
    for (const url of this._urls) URL.revokeObjectURL(url);
    this._urls = [];
  }

  destroy() {
    this.renderer.destroy();
    this._revokeUrls();
    this.ready = false;
  }
}

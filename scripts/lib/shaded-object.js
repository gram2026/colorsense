/**
 * 테스트용 샘플 이미지 렌더링 헬퍼
 * 실제 사진 대신, 빛/그림자/하이라이트가 있는 간단한 구 형태 오브젝트를
 * 픽셀 단위로 직접 그려서 Canvas 마스크 합성 테스트에 쓸 수 있게 한다.
 */

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function newBuffer(width, height) {
  return Buffer.alloc(width * height * 4);
}

function setPixel(buf, width, x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= width) return;
  const i = (y * width + x) * 4;
  buf[i] = clamp(r, 0, 255);
  buf[i + 1] = clamp(g, 0, 255);
  buf[i + 2] = clamp(b, 0, 255);
  buf[i + 3] = clamp(a, 0, 255);
}

/** 세로 그라데이션 배경 (은은한 스튜디오 배경 느낌) */
function fillBackground(width, height, topRgb, bottomRgb) {
  const buf = newBuffer(width, height);
  for (let y = 0; y < height; y++) {
    const t = y / (height - 1);
    const r = topRgb[0] + (bottomRgb[0] - topRgb[0]) * t;
    const g = topRgb[1] + (bottomRgb[1] - topRgb[1]) * t;
    const b = topRgb[2] + (bottomRgb[2] - topRgb[2]) * t;
    for (let x = 0; x < width; x++) {
      setPixel(buf, width, x, y, r, g, b, 255);
    }
  }
  return buf;
}

/** 오브젝트 아래에 은은한 접지 그림자를 얹는다 (원본에만 적용, 마스크에는 영향 없음) */
function addContactShadow(buf, width, height, cx, cy, rx, ry, strength = 0.35) {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      const d2 = dx * dx + dy * dy;
      if (d2 < 1) {
        const falloff = (1 - d2) * strength;
        const i = (y * width + x) * 4;
        buf[i] = buf[i] * (1 - falloff);
        buf[i + 1] = buf[i + 1] * (1 - falloff);
        buf[i + 2] = buf[i + 2] * (1 - falloff);
      }
    }
  }
}

/** 어두운 색의 둥근 사각형 (신호등 하우징 등 마스크에 포함되지 않는 배경 오브젝트용) */
function drawRoundedRect(buf, width, height, x, y, w, h, radius, colorRgb) {
  for (let py = Math.max(0, y - 2); py < Math.min(height, y + h + 2); py++) {
    for (let px = Math.max(0, x - 2); px < Math.min(width, x + w + 2); px++) {
      const rx = clamp(px, x + radius, x + w - radius);
      const ry = clamp(py, y + radius, y + h - radius);
      const dx = px - rx;
      const dy = py - ry;
      const inside = dx * dx + dy * dy <= radius * radius;
      if (inside) {
        const shade = 0.85 + 0.15 * ((py - y) / h);
        setPixel(
          buf,
          width,
          px,
          py,
          colorRgb[0] * shade,
          colorRgb[1] * shade,
          colorRgb[2] * shade,
          255
        );
      }
    }
  }
}

/**
 * 빛(하이라이트)과 그림자가 있는 타원형 오브젝트를 그리고,
 * 동시에 같은 영역의 마스크(흰색 + 알파)를 만든다.
 *
 * @param {Buffer} imageBuf 결과가 합성될 원본 이미지 버퍼 (이미 배경이 채워져 있어야 함)
 * @param {Buffer} maskBuf 결과가 합성될 마스크 버퍼 (검정/투명으로 초기화되어 있어야 함)
 */
function drawShadedObject(imageBuf, maskBuf, width, height, opts) {
  const {
    cx,
    cy,
    rx,
    ry,
    baseColor, // [r,g,b] 0~255
    ambient = 0.4,
    specPower = 24,
    specStrength = 0.7,
    lightDir = [-0.55, -0.65, 0.55],
  } = opts;

  const lightLen = Math.hypot(lightDir[0], lightDir[1], lightDir[2]);
  const L = lightDir.map((v) => v / lightLen);
  const V = [0, 0, 1];
  let H = [L[0] + V[0], L[1] + V[1], L[2] + V[2]];
  const hLen = Math.hypot(H[0], H[1], H[2]) || 1;
  H = H.map((v) => v / hLen);

  const avgRadius = (rx + ry) / 2;
  const padding = 3;

  for (let y = Math.floor(cy - ry - padding); y <= Math.ceil(cy + ry + padding); y++) {
    if (y < 0 || y >= height) continue;
    for (let x = Math.floor(cx - rx - padding); x <= Math.ceil(cx + rx + padding); x++) {
      if (x < 0 || x >= width) continue;

      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      const d2 = dx * dx + dy * dy;
      const dist = Math.sqrt(d2);

      // 픽셀 단위 가장자리 거리 (안티앨리어싱용)
      const edgePx = (1 - dist) * avgRadius;
      const coverage = clamp(edgePx / 1.5 + 0.5, 0, 1);
      if (coverage <= 0) continue;

      let nz = Math.sqrt(Math.max(0, 1 - Math.min(d2, 1)));
      let n = [dx, dy, nz];
      const nLen = Math.hypot(n[0], n[1], n[2]) || 1;
      n = n.map((v) => v / nLen);

      const diffuse = Math.max(0, n[0] * L[0] + n[1] * L[1] + n[2] * L[2]);
      const intensity = ambient + (1 - ambient) * diffuse;

      const specAngle = Math.max(0, n[0] * H[0] + n[1] * H[1] + n[2] * H[2]);
      const spec = Math.pow(specAngle, specPower) * specStrength;

      let r = baseColor[0] * intensity;
      let g = baseColor[1] * intensity;
      let b = baseColor[2] * intensity;

      r += (255 - r) * spec;
      g += (255 - g) * spec;
      b += (255 - b) * spec;

      const i = (y * width + x) * 4;
      // 배경과 오브젝트 색을 커버리지(경계 안티앨리어싱)로 블렌딩
      imageBuf[i] = imageBuf[i] * (1 - coverage) + r * coverage;
      imageBuf[i + 1] = imageBuf[i + 1] * (1 - coverage) + g * coverage;
      imageBuf[i + 2] = imageBuf[i + 2] * (1 - coverage) + b * coverage;
      imageBuf[i + 3] = 255;

      // 마스크: 흰색 + 알파(커버리지) — 반투명 가장자리를 그대로 표현
      const maskAlpha = clamp(maskBuf[i + 3] + coverage * 255, 0, 255);
      maskBuf[i] = 255;
      maskBuf[i + 1] = 255;
      maskBuf[i + 2] = 255;
      maskBuf[i + 3] = maskAlpha;
    }
  }
}

export { newBuffer, fillBackground, addContactShadow, drawRoundedRect, drawShadedObject, clamp };

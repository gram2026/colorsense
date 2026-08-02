/**
 * 샘플 문제/카테고리 이미지 생성 스크립트 (1회성 개발 도구)
 * 저작권 문제 없이 테스트할 수 있도록, 실제 사진 대신 빛/그림자/하이라이트가
 * 있는 간단한 오브젝트를 코드로 직접 그려서 original/mask/thumbnail PNG를 만든다.
 *
 * 실행: node scripts/generate-sample-assets.js
 * 실제 사진을 준비하면 이 스크립트가 만든 파일을 같은 경로에 덮어써서 교체하면 된다.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { encodePng } from "./lib/png-encoder.js";
import {
  newBuffer,
  fillBackground,
  addContactShadow,
  drawRoundedRect,
  drawShadedObject,
} from "./lib/shaded-object.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function save(relativePath, width, height, rgbaBuffer) {
  const fullPath = join(ROOT, relativePath);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, encodePng(width, height, rgbaBuffer));
  console.log("생성:", relativePath);
}

// ---------- 문제 장면 ----------

function buildTomatoScene(width, height) {
  const image = fillBackground(width, height, [241, 238, 230], [225, 220, 206]);
  const cx = width * 0.52;
  const cy = height * 0.58;
  const r = width * 0.32;

  addContactShadow(image, width, height, cx, cy + r * 0.88, r * 1.05, r * 0.32, 0.3);

  const mask = newBuffer(width, height);
  drawShadedObject(image, mask, width, height, {
    cx,
    cy,
    rx: r,
    ry: r * 0.97,
    baseColor: [213, 43, 43],
    ambient: 0.4,
    specPower: 26,
    specStrength: 0.55,
  });

  // 꼭지(연두색 calyx)는 마스크에 포함하지 않는다 -> throwaway 마스크에 그린다.
  const throwaway = newBuffer(width, height);
  drawShadedObject(image, throwaway, width, height, {
    cx,
    cy: cy - r * 0.92,
    rx: r * 0.24,
    ry: r * 0.13,
    baseColor: [86, 140, 58],
    ambient: 0.5,
    specPower: 10,
    specStrength: 0.3,
  });

  return { image, mask };
}

function buildLemonScene(width, height) {
  const image = fillBackground(width, height, [244, 241, 232], [228, 223, 208]);
  const cx = width * 0.5;
  const cy = height * 0.55;
  const rx = width * 0.32;
  const ry = height * 0.23;

  addContactShadow(image, width, height, cx, cy + ry * 0.95, rx * 1.1, ry * 0.4, 0.26);

  const mask = newBuffer(width, height);
  drawShadedObject(image, mask, width, height, {
    cx,
    cy,
    rx,
    ry,
    baseColor: [242, 194, 48],
    ambient: 0.46,
    specPower: 20,
    specStrength: 0.5,
  });

  return { image, mask };
}

function buildTrafficLightScene(width, height) {
  const image = fillBackground(width, height, [233, 230, 221], [206, 201, 188]);

  const houseW = width * 0.46;
  const houseH = height * 0.82;
  const houseX = (width - houseW) / 2;
  const houseY = height * 0.07;

  addContactShadow(
    image,
    width,
    height,
    width / 2,
    houseY + houseH + height * 0.02,
    houseW * 0.8,
    height * 0.06,
    0.25
  );
  drawRoundedRect(
    image,
    width,
    height,
    houseX,
    houseY,
    houseW,
    houseH,
    Math.min(houseW, houseH) * 0.16,
    [42, 42, 46]
  );

  const mask = newBuffer(width, height);
  const lampR = houseW * 0.3;
  const lampCx = width / 2;

  // 꺼진 노란/초록 램프 (마스크 대상 아님)
  const throwaway = newBuffer(width, height);
  drawShadedObject(image, throwaway, width, height, {
    cx: lampCx,
    cy: houseY + houseH * 0.53,
    rx: lampR * 0.85,
    ry: lampR * 0.85,
    baseColor: [72, 62, 22],
    ambient: 0.5,
    specPower: 10,
    specStrength: 0.2,
  });
  drawShadedObject(image, throwaway, width, height, {
    cx: lampCx,
    cy: houseY + houseH * 0.77,
    rx: lampR * 0.85,
    ry: lampR * 0.85,
    baseColor: [32, 56, 32],
    ambient: 0.5,
    specPower: 10,
    specStrength: 0.2,
  });

  // 켜진 빨간 램프 (마스크 대상)
  drawShadedObject(image, mask, width, height, {
    cx: lampCx,
    cy: houseY + houseH * 0.28,
    rx: lampR,
    ry: lampR,
    baseColor: [230, 50, 45],
    ambient: 0.35,
    specPower: 30,
    specStrength: 0.75,
  });

  return { image, mask };
}

function buildCategoryCover(width, height, colorRgb) {
  const image = fillBackground(width, height, [255, 255, 255], [250, 247, 239]);
  const cx = width * 0.5;
  const cy = height * 0.56;
  const r = Math.min(width, height) * 0.3;
  addContactShadow(image, width, height, cx, cy + r * 0.85, r * 1.05, r * 0.28, 0.18);
  const throwaway = newBuffer(width, height);
  drawShadedObject(image, throwaway, width, height, {
    cx,
    cy,
    rx: r,
    ry: r,
    baseColor: colorRgb,
    ambient: 0.42,
    specPower: 24,
    specStrength: 0.6,
  });
  return image;
}

function buildRandomCover(width, height) {
  const image = fillBackground(width, height, [255, 255, 255], [250, 247, 239]);
  const positions = [
    [-0.15, -0.08, [255, 107, 87]],
    [0.15, 0.03, [63, 201, 191]],
    [-0.02, 0.19, [255, 201, 60]],
  ];
  const r = Math.min(width, height) * 0.2;
  const throwaway = newBuffer(width, height);
  for (const [ox, oy, color] of positions) {
    const cx = width * 0.5 + width * ox;
    const cy = height * 0.55 + height * oy;
    addContactShadow(image, width, height, cx, cy + r * 0.8, r, r * 0.26, 0.12);
  }
  for (const [ox, oy, color] of positions) {
    const cx = width * 0.5 + width * ox;
    const cy = height * 0.55 + height * oy;
    drawShadedObject(image, throwaway, width, height, {
      cx,
      cy,
      rx: r,
      ry: r,
      baseColor: color,
      ambient: 0.42,
      specPower: 20,
      specStrength: 0.55,
    });
  }
  return image;
}

// ---------- 실행 ----------

const FULL = 480;
const THUMB = 160;

function generateQuestion(basePath, sceneBuilder) {
  const full = sceneBuilder(FULL, FULL);
  save(`${basePath}/original.png`, FULL, FULL, full.image);
  save(`${basePath}/mask.png`, FULL, FULL, full.mask);

  const thumb = sceneBuilder(THUMB, THUMB);
  save(`${basePath}/thumbnail.png`, THUMB, THUMB, thumb.image);
}

generateQuestion("assets/questions/food/tomato-001", buildTomatoScene);
generateQuestion("assets/questions/food/lemon-002", buildLemonScene);
generateQuestion("assets/questions/objects/traffic-light-001", buildTrafficLightScene);

const COVER_W = 320;
const COVER_H = 240;
const categoryColors = {
  food: [255, 138, 66],
  brands: [139, 92, 222],
  objects: [63, 201, 191],
  characters: [255, 133, 162],
  nature: [108, 181, 90],
};

for (const [id, color] of Object.entries(categoryColors)) {
  save(`assets/categories/${id}/cover.png`, COVER_W, COVER_H, buildCategoryCover(COVER_W, COVER_H, color));
}
save("assets/categories/random/cover.png", COVER_W, COVER_H, buildRandomCover(COVER_W, COVER_H));

console.log("\n샘플 이미지 생성 완료.");

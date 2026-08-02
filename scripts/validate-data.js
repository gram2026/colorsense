/**
 * 데이터 검증 스크립트
 * categories.json + questions/*.json 을 읽어서 스키마, 중복 ID, 이미지 존재 여부,
 * 원본/마스크 크기 일치 여부를 검사한다.
 *
 * 실행: npm run validate-data
 * 문제가 있는 항목이 있어도 끝까지 검사한 뒤, 마지막에 요약과 함께
 * 오류가 있으면 종료 코드 1로 끝난다 (CI 등에서 실패로 잡을 수 있게).
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  validateQuestionShape,
  validateCategoryShape,
  findDuplicateIds,
} from "../src/js/utils/validation.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

let errorCount = 0;
let warningCount = 0;

function reportError(msg) {
  errorCount += 1;
  console.error("✗", msg);
}
function reportWarning(msg) {
  warningCount += 1;
  console.warn("!", msg);
}
function reportOk(msg) {
  console.log("✓", msg);
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(join(ROOT, relativePath), "utf-8"));
}

/** PNG IHDR 청크에서 가로/세로만 가볍게 읽는다 (전체 디코딩 없이) */
function getPngSize(absolutePath) {
  const buf = readFileSync(absolutePath);
  const isPng =
    buf.length > 24 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47;
  if (!isPng) return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function checkImageExists(relativePath, label) {
  const abs = join(ROOT, relativePath);
  if (!existsSync(abs)) {
    reportError(`${label} 파일이 존재하지 않습니다: ${relativePath}`);
    return false;
  }
  return true;
}

console.log("Color Guesser 데이터 검증을 시작합니다...\n");

const categoriesDoc = readJson("src/data/categories.json");
const categories = Array.isArray(categoriesDoc.categories) ? categoriesDoc.categories : [];
const categoryIds = new Set(categories.map((c) => c.id));

for (const category of categories) {
  const errors = validateCategoryShape(category);
  if (errors.length > 0) {
    errors.forEach((e) => reportError(`[카테고리 ${category?.id ?? "?"}] ${e}`));
  } else {
    reportOk(`카테고리 구조 확인: ${category.id}`);
  }
}

for (const category of categories) {
  if (category.isRandomMix || !category.questionFile) continue;
  if (category.enabled === false) {
    reportWarning(`비활성화된 카테고리라 건너뜁니다: ${category.id}`);
    continue;
  }

  console.log(`\n--- ${category.id} (${category.questionFile}) ---`);

  let doc;
  try {
    doc = readJson(category.questionFile);
  } catch (err) {
    reportError(`문제 파일을 읽을 수 없습니다: ${category.questionFile} (${err.message})`);
    continue;
  }

  if (doc.categoryId !== category.id) {
    reportError(
      `categories.json의 id(${category.id})와 questionFile의 categoryId(${doc.categoryId})가 다릅니다.`
    );
  }

  const questions = Array.isArray(doc.questions) ? doc.questions : [];

  const duplicates = findDuplicateIds(questions);
  for (const [id, count] of duplicates) {
    reportError(`중복된 문제 id: ${id} (${count}번 등장)`);
  }

  for (const question of questions) {
    const label = question?.id ?? "(id 없음)";

    if (question.enabled === false) {
      reportWarning(`비활성화된 문제라 건너뜁니다: ${label}`);
      continue;
    }

    const shapeErrors = validateQuestionShape(question);
    if (shapeErrors.length > 0) {
      shapeErrors.forEach((e) => reportError(`[${label}] ${e}`));
      continue;
    }

    if (question.categoryId && !categoryIds.has(question.categoryId)) {
      reportError(`[${label}] 존재하지 않는 categoryId: ${question.categoryId}`);
    }

    const originalOk = checkImageExists(question.originalImage, `[${label}] 원본 이미지`);
    const maskOk = checkImageExists(question.maskImage, `[${label}] 마스크 이미지`);
    checkImageExists(question.thumbnail, `[${label}] 썸네일`);

    if (originalOk && maskOk) {
      const originalSize = getPngSize(join(ROOT, question.originalImage));
      const maskSize = getPngSize(join(ROOT, question.maskImage));
      if (originalSize && maskSize) {
        if (originalSize.width !== maskSize.width || originalSize.height !== maskSize.height) {
          reportError(
            `[${label}] 원본(${originalSize.width}x${originalSize.height})과 마스크(${maskSize.width}x${maskSize.height}) 크기가 다릅니다.`
          );
        }
      } else {
        reportWarning(`[${label}] PNG가 아니라 크기 비교를 건너뜁니다 (webp/jpg 등은 자동 검사 미지원).`);
      }
    }

    if (!shapeErrors.length) reportOk(`문제 확인: ${label}`);
  }
}

console.log("\n----------------------------------------");
console.log(`검증 완료: 오류 ${errorCount}개, 경고 ${warningCount}개`);

process.exit(errorCount > 0 ? 1 : 0);

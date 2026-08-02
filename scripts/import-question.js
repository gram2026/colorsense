/**
 * 문제 제작기가 내보낸 폴더(export/)를 게임 데이터로 가져오는 스크립트
 *
 * 실행: npm run import-question -- "C:\경로\export"
 *
 * export 폴더 형식:
 *   question.json, original.*, mask.png, thumbnail.*
 *
 * 실패하면(검증 실패, 중복 id, 파일 복사 실패 등) 아무 것도 바꾸지 않은 상태로 끝낸다.
 * (이미 복사한 파일이 있다면 되돌린다.)
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, rmSync } from "node:fs";
import { dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { validateQuestionShape } from "../src/js/utils/validation.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function fail(message) {
  console.error("✗ 가져오기 실패:", message);
  process.exit(1);
}

const exportDir = process.argv[2];
if (!exportDir) {
  fail('사용법: npm run import-question -- "C:\\경로\\export"');
}
if (!existsSync(exportDir)) {
  fail(`export 폴더를 찾을 수 없습니다: ${exportDir}`);
}

const questionJsonPath = join(exportDir, "question.json");
if (!existsSync(questionJsonPath)) {
  fail(`question.json이 없습니다: ${questionJsonPath}`);
}

let question;
try {
  question = JSON.parse(readFileSync(questionJsonPath, "utf-8"));
} catch (err) {
  fail(`question.json 파싱 실패: ${err.message}`);
}

const shapeErrors = validateQuestionShape(question);
if (shapeErrors.length > 0) {
  shapeErrors.forEach((e) => console.error("  -", e));
  fail("question.json이 스키마를 만족하지 않습니다.");
}

const categoriesPath = join(ROOT, "src/data/categories.json");
const categoriesDoc = JSON.parse(readFileSync(categoriesPath, "utf-8"));
const category = categoriesDoc.categories.find((c) => c.id === question.categoryId);
if (!category) {
  fail(`존재하지 않는 categoryId입니다: ${question.categoryId}`);
}
if (!category.questionFile) {
  fail(`카테고리 ${category.id}에는 questionFile이 설정되어 있지 않습니다 (랜덤 믹스 카테고리인가요?).`);
}

const questionFilePath = join(ROOT, category.questionFile);
if (!existsSync(questionFilePath)) {
  fail(`카테고리 문제 파일을 찾을 수 없습니다: ${category.questionFile}`);
}

const questionFileDoc = JSON.parse(readFileSync(questionFilePath, "utf-8"));
const existingQuestions = Array.isArray(questionFileDoc.questions) ? questionFileDoc.questions : [];
if (existingQuestions.some((q) => q.id === question.id)) {
  fail(`이미 존재하는 문제 id입니다: ${question.id} (다른 id를 사용하세요)`);
}

const requiredSourceFiles = ["originalImage", "maskImage", "thumbnail"].map((key) => ({
  key,
  filename: basename(question[key]),
  sourcePath: join(exportDir, basename(question[key])),
}));

for (const file of requiredSourceFiles) {
  if (!existsSync(file.sourcePath)) {
    fail(`export 폴더에 ${file.key} 파일이 없습니다: ${file.sourcePath}`);
  }
}

const destDir = join(ROOT, "assets", "questions", category.id, question.id);
if (existsSync(destDir)) {
  fail(`대상 폴더가 이미 존재합니다 (중복 가져오기 방지): ${destDir}`);
}

// ---- 여기부터 실제로 상태를 바꾼다. 실패하면 되돌린다. ----
let copiedDestDir = false;
try {
  mkdirSync(destDir, { recursive: true });
  copiedDestDir = true;

  for (const file of requiredSourceFiles) {
    copyFileSync(file.sourcePath, join(destDir, file.filename));
  }

  const relativeBase = `assets/questions/${category.id}/${question.id}`;
  const newQuestion = {
    ...question,
    originalImage: `${relativeBase}/${basename(question.originalImage)}`,
    maskImage: `${relativeBase}/${basename(question.maskImage)}`,
    thumbnail: `${relativeBase}/${basename(question.thumbnail)}`,
  };

  questionFileDoc.questions = [...existingQuestions, newQuestion];
  writeFileSync(questionFilePath, JSON.stringify(questionFileDoc, null, 2) + "\n", "utf-8");

  console.log("✓ 문제를 가져왔습니다.");
  console.log(`  카테고리: ${category.id}`);
  console.log(`  문제 id: ${question.id}`);
  console.log(`  이미지 경로: ${relativeBase}/`);
  console.log(`  등록된 파일: ${category.questionFile}`);
  console.log("\n게임을 새로고침하면 바로 보입니다. (npm run validate-data 로 다시 검증해보세요)");
} catch (err) {
  if (copiedDestDir) {
    try {
      rmSync(destDir, { recursive: true, force: true });
    } catch {
      // 롤백 중 오류는 무시하고 원래 오류를 보여준다
    }
  }
  fail(`가져오는 중 오류가 발생해 되돌렸습니다: ${err.message}`);
}

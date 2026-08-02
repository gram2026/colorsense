/**
 * File System Access API로 "게임 프로젝트에 바로 추가"한다.
 * ---------------------------------------------------------------
 * 브라우저 보안 정책상 사용자가 직접 폴더를 선택해야만 그 폴더에 쓸 수 있다.
 * 그래서 항상 showDirectoryPicker()로 사용자가 C:\colorguesser를 고르게 하고,
 * 그 폴더가 실제 Color Guesser 프로젝트인지 검사한 뒤에만 진행한다.
 * scripts/import-question.js와 최종 결과(assets/questions/<categoryId>/<id>/...
 * 경로, categories.json이 아니라 카테고리별 questionFile 갱신)가 동일하도록 맞춘다.
 */

import { canvasToBlob } from "./utils/image-utils.js";

export function isFileSystemAccessSupported() {
  return typeof window.showDirectoryPicker === "function";
}

export async function pickProjectRoot() {
  return window.showDirectoryPicker({ id: "colorguesser-root", mode: "readwrite" });
}

/** 선택한 폴더가 실제 Color Guesser 프로젝트 루트인지 확인 */
export async function verifyProjectRoot(rootHandle) {
  try {
    await rootHandle.getFileHandle("package.json");
  } catch {
    return { ok: false, error: "선택한 폴더에 package.json이 없습니다. C:\\colorguesser 폴더를 선택해 주세요." };
  }
  try {
    const src = await rootHandle.getDirectoryHandle("src");
    const data = await src.getDirectoryHandle("data");
    await data.getFileHandle("categories.json");
    await src.getDirectoryHandle("js");
    await rootHandle.getDirectoryHandle("assets");
  } catch {
    return {
      ok: false,
      error: "선택한 폴더가 Color Guesser 프로젝트 구조와 다릅니다 (src/data/categories.json, assets 폴더가 필요합니다).",
    };
  }
  return { ok: true };
}

async function readJsonFile(fileHandle) {
  const file = await fileHandle.getFile();
  const text = await file.text();
  return JSON.parse(text);
}

async function writeTextFile(dirHandle, name, text) {
  const fileHandle = await dirHandle.getFileHandle(name, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(text);
  await writable.close();
}

async function writeBlobFile(dirHandle, name, blob) {
  const fileHandle = await dirHandle.getFileHandle(name, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
}

/** "a/b/c.json" 같은 상대경로를 루트 핸들에서부터 따라가 {dirHandle, fileHandle, name}을 돌려준다 */
async function resolveFileByPath(rootHandle, relativePath) {
  const parts = relativePath.split("/").filter(Boolean);
  const name = parts.pop();
  let dir = rootHandle;
  for (const part of parts) {
    dir = await dir.getDirectoryHandle(part);
  }
  const fileHandle = await dir.getFileHandle(name);
  return { dirHandle: dir, fileHandle, name };
}

/** "a/b/c" 폴더를 루트 핸들 기준으로 만들면서 따라간다. mustNotExist면 마지막 폴더가 이미 있으면 에러. */
async function ensureDirByPath(rootHandle, relativePath, { mustNotExist = false } = {}) {
  const parts = relativePath.split("/").filter(Boolean);
  let dir = rootHandle;
  for (let i = 0; i < parts.length; i++) {
    const isLast = i === parts.length - 1;
    if (isLast && mustNotExist) {
      const alreadyExists = await dir
        .getDirectoryHandle(parts[i])
        .then(() => true)
        .catch(() => false);
      if (alreadyExists) {
        throw new Error(`대상 폴더가 이미 존재합니다: ${relativePath}`);
      }
    }
    dir = await dir.getDirectoryHandle(parts[i], { create: true });
  }
  return dir;
}

/**
 * 실제로 저장하기 전에, 어떤 경로가 만들어질지 미리 계산해서 보여주기 위한 함수.
 */
export async function planDirectWrite(rootHandle, { categoryId, questionId }) {
  const categoriesFile = await resolveFileByPath(rootHandle, "src/data/categories.json");
  const categoriesDoc = await readJsonFile(categoriesFile.fileHandle);
  const category = (categoriesDoc.categories || []).find((c) => c.id === categoryId);
  if (!category) throw new Error(`존재하지 않는 카테고리입니다: ${categoryId}`);
  if (!category.questionFile) throw new Error(`카테고리 "${category.id}"에는 questionFile이 없습니다 (랜덤 믹스 카테고리인가요?).`);

  const destPath = `assets/questions/${category.id}/${questionId}`;
  return {
    category,
    destPath,
    files: [`${destPath}/original.webp`, `${destPath}/mask.png`, `${destPath}/thumbnail.webp`],
    questionFilePath: category.questionFile,
  };
}

/**
 * @returns {{ok:boolean, destPath?:string, backupFile?:string, error?:string}}
 */
export async function writeQuestionDirectly(rootHandle, { question, imageCanvas, maskCanvas, thumbnailBlob }) {
  const categoriesFile = await resolveFileByPath(rootHandle, "src/data/categories.json");
  const categoriesDoc = await readJsonFile(categoriesFile.fileHandle);
  const category = (categoriesDoc.categories || []).find((c) => c.id === question.categoryId);
  if (!category) throw new Error(`존재하지 않는 카테고리입니다: ${question.categoryId}`);
  if (!category.questionFile) throw new Error(`카테고리 "${category.id}"에는 questionFile이 없습니다.`);

  const questionFileRef = await resolveFileByPath(rootHandle, category.questionFile);
  const questionDoc = await readJsonFile(questionFileRef.fileHandle);
  const existingQuestions = Array.isArray(questionDoc.questions) ? questionDoc.questions : [];

  if (existingQuestions.some((q) => q.id === question.id)) {
    throw new Error(`이미 존재하는 문제 id입니다: ${question.id} (다른 id를 사용하세요)`);
  }

  const destRelPath = `assets/questions/${category.id}/${question.id}`;

  // 1) 카테고리 문제 파일을 바꾸기 전에 타임스탬프 붙은 백업을 먼저 만든다.
  const backupName = questionFileRef.name.replace(/\.json$/i, `.bak-${timestamp()}.json`);
  await writeTextFile(questionFileRef.dirHandle, backupName, JSON.stringify(questionDoc, null, 2) + "\n");

  // 2) 목적지 폴더 생성 (이미 있으면 실패 -> 사용자 확인 없이 덮어쓰지 않는다)
  const destDir = await ensureDirByPath(rootHandle, destRelPath, { mustNotExist: true });

  // 3) 이미지/마스크/썸네일 파일 준비 + 기록
  const [originalBlob, maskBlob] = await Promise.all([
    canvasToBlob(imageCanvas, "image/webp", 0.92),
    canvasToBlob(maskCanvas, "image/png"),
  ]);
  await writeBlobFile(destDir, "original.webp", originalBlob);
  await writeBlobFile(destDir, "mask.png", maskBlob);
  await writeBlobFile(destDir, "thumbnail.webp", thumbnailBlob);

  // 4) 카테고리 문제 JSON에 새 문제를 추가해서 다시 쓴다.
  const newQuestion = {
    schemaVersion: 1,
    id: question.id,
    categoryId: question.categoryId,
    title: question.title,
    originalImage: `${destRelPath}/original.webp`,
    maskImage: `${destRelPath}/mask.png`,
    thumbnail: `${destRelPath}/thumbnail.webp`,
    answerColor: question.answerColor,
    startColor: question.startColorMode === "fixed" ? question.startColorFixed : null,
    renderMode: question.renderMode,
    enabled: question.enabled !== false,
    difficulty: question.difficulty ?? 1,
    tags: question.tags ?? [],
    metadata: {
      createdAt: question.metadata?.createdAt || new Date().toISOString().slice(0, 10),
      makerVersion: "1.0.0",
    },
  };
  questionDoc.questions = [...existingQuestions, newQuestion];
  await writeTextFile(questionFileRef.dirHandle, questionFileRef.name, JSON.stringify(questionDoc, null, 2) + "\n");

  // 5) 검증: 다시 읽어서 실제로 반영됐는지 확인
  const verifyDoc = await readJsonFile(questionFileRef.fileHandle);
  const ok = Array.isArray(verifyDoc.questions) && verifyDoc.questions.some((q) => q.id === question.id);
  if (!ok) {
    throw new Error("문제를 저장했지만 다시 읽었을 때 확인되지 않았습니다. 파일을 직접 확인해 주세요.");
  }

  return { ok: true, destPath: destRelPath, backupFile: backupName, questionFilePath: category.questionFile };
}

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

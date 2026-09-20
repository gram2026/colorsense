/**
 * 기존 문제 열기: 문제 제작기가 내보낸 ZIP(question.json + original.* + mask.png + thumbnail.*)을
 * 다시 불러와 수정할 수 있게 한다. JSZip은 내보내기와 똑같은 라이브러리를 그대로 재사용한다.
 */

import { decodeImageFile } from "./utils/image-utils.js";

/**
 * @param {File} zipFile
 * @returns {Promise<{question:object, originalBitmap, maskBitmap, thumbnailBitmap, width:number, height:number}>}
 */
export async function openExistingFromZipFile(zipFile) {
  if (typeof window.JSZip !== "function") {
    throw new Error("JSZip 라이브러리를 불러오지 못했습니다.");
  }

  const zip = await window.JSZip.loadAsync(zipFile);

  const entries = Object.values(zip.files).filter((f) => !f.dir);
  const questionEntry = entries.find((f) => f.name.endsWith("question.json"));
  if (!questionEntry) {
    throw new Error("ZIP 안에서 question.json을 찾을 수 없습니다.");
  }

  const questionText = await questionEntry.async("string");
  let question;
  try {
    question = JSON.parse(questionText);
  } catch (err) {
    throw new Error(`question.json 파싱에 실패했습니다: ${err.message}`);
  }

  const basePrefix = questionEntry.name.slice(0, questionEntry.name.length - "question.json".length);

  const findEntry = (refPath) => {
    const filename = refPath.split("/").pop();
    return (
      zip.file(`${basePrefix}${filename}`) ||
      entries.find((f) => f.name.endsWith(`/${filename}`) || f.name === filename)
    );
  };

  const originalEntry = findEntry(question.originalImage);
  const maskEntry = findEntry(question.maskImage);
  const thumbnailEntry = findEntry(question.thumbnail);

  if (!originalEntry) throw new Error(`ZIP 안에 원본 이미지 파일이 없습니다: ${question.originalImage}`);
  if (!maskEntry) throw new Error(`ZIP 안에 마스크 파일이 없습니다: ${question.maskImage}`);

  const [originalBlob, maskBlob, thumbnailBlob] = await Promise.all([
    originalEntry.async("blob"),
    maskEntry.async("blob"),
    thumbnailEntry ? thumbnailEntry.async("blob") : Promise.resolve(null),
  ]);

  const originalDecoded = await decodeImageFile(originalBlob);
  if (!originalDecoded.ok) throw new Error("원본 이미지를 디코딩하지 못했습니다.");
  const maskDecoded = await decodeImageFile(maskBlob);
  if (!maskDecoded.ok) throw new Error("마스크 이미지를 디코딩하지 못했습니다.");
  const thumbnailDecoded = thumbnailBlob ? await decodeImageFile(thumbnailBlob) : null;

  return {
    question,
    originalBitmap: originalDecoded.bitmap,
    maskBitmap: maskDecoded.bitmap,
    thumbnailBitmap: thumbnailDecoded?.ok ? thumbnailDecoded.bitmap : null,
    width: originalDecoded.width,
    height: originalDecoded.height,
  };
}

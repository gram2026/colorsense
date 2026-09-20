import sharp from 'sharp';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export async function buildScoringProfiles(root, categoryId = null, questionId = null) {
  const categories = JSON.parse(await readFile(path.join(root, 'src/data/categories.json'))).categories;
  for (const c of categories.filter(c => c.enabled && c.questionFile)) {
    if (categoryId && c.id !== categoryId) continue;
    const doc = JSON.parse(await readFile(path.join(root, c.questionFile)));
    for (const q of doc.questions.filter(q => q.enabled !== false)) {
      if (questionId && q.id !== questionId) continue;
      const { data: original, info } = await sharp(path.join(root, q.originalImage)).toColourspace('srgb').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const mask = await sharp(path.join(root, q.maskImage)).resize(info.width, info.height).toColourspace('srgb').ensureAlpha().raw().toBuffer();
      const groups = new Map();
      for (let i = 0; i < original.length; i += 4) {
        const strength = mask[i] * mask[i + 3];
        if (!strength || !original[i + 3]) continue;
        const key = [original[i], original[i + 1], original[i + 2], original[i + 3], strength].join(',');
        groups.set(key, (groups.get(key) || 0) + 1);
      }
      const dir = path.join(root, 'assets/scoring', c.id);
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, `${q.id}.json`), JSON.stringify([...groups].map(([key, n]) => [...key.split(',').map(Number), n])));
    }
  }
}

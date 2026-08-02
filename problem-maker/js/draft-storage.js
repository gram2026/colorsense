/**
 * 임시 저장 (IndexedDB).
 * 이미지가 커서 단순 localStorage에는 담을 수 없으므로 IndexedDB를 쓴다.
 * 브라우저가 IndexedDB를 지원하지 않거나 막혀 있으면 isSupported()가 false를
 * 돌려주고, 호출부는 자동 저장 없이 계속 작업할 수 있게 안내만 한다.
 */

const DB_NAME = "colorguesser-problem-maker";
const DB_VERSION = 1;
const STORE = "drafts";

let dbPromise = null;

export function isSupported() {
  return typeof indexedDB !== "undefined";
}

function openDb() {
  if (!isSupported()) return Promise.reject(new Error("이 브라우저는 IndexedDB를 지원하지 않습니다."));
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("updatedAt", "updatedAt");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("IndexedDB를 열지 못했습니다."));
  });

  return dbPromise;
}

function tx(db, mode) {
  const t = db.transaction(STORE, mode);
  return { t, store: t.objectStore(STORE) };
}

function requestToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("IndexedDB 요청이 실패했습니다."));
  });
}

/**
 * @param {object} record { id?: string, title, categoryId, questionMeta, imageBlob, maskBlob, thumbnailBlob, naturalWidth, naturalHeight, workingWidth, workingHeight }
 * @returns {Promise<string>} 저장된 draft id
 */
export async function saveDraft(record) {
  const db = await openDb();
  const id = record.id || `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const payload = { ...record, id, updatedAt: Date.now() };
  const { t, store } = tx(db, "readwrite");
  store.put(payload);
  await txDone(t);
  return id;
}

export async function listDrafts() {
  const db = await openDb();
  const { store } = tx(db, "readonly");
  const all = await requestToPromise(store.getAll());
  return all
    .slice()
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((r) => ({
      id: r.id,
      title: r.title || "제목 없음",
      categoryId: r.categoryId,
      updatedAt: r.updatedAt,
      thumbnailBlob: r.thumbnailBlob || null,
    }));
}

export async function loadDraft(id) {
  const db = await openDb();
  const { store } = tx(db, "readonly");
  return requestToPromise(store.get(id));
}

export async function deleteDraft(id) {
  const db = await openDb();
  const { t, store } = tx(db, "readwrite");
  store.delete(id);
  await txDone(t);
}

function txDone(t) {
  return new Promise((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error || new Error("IndexedDB 트랜잭션이 실패했습니다."));
    t.onabort = () => reject(t.error || new Error("IndexedDB 트랜잭션이 중단되었습니다."));
  });
}

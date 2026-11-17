let opening;

function listing(match) {
  const {
    id,
    title,
    created,
    duration,
    cover
  } = match;
  return {
    id,
    title,
    created,
    duration,
    cover,
    context: match.report?.context || match.job?.context || match.context,
    report: !!match.report,
    job: !!match.job
  };
}

function openDb() {
  if (!opening) opening = new Promise((resolve, reject) => {
    const req = indexedDB.open('overwatch-guide', 2);
    req.onupgradeneeded = e => {
      const db = req.result;
      if (e.oldVersion < 1) {
        for (const key of ['matches', 'videos', 'cards']) db.createObjectStore(key, {
          keyPath: 'id'
        });
      }
      if (e.oldVersion < 2) {
        const shelf = db.createObjectStore('shelf', {
          keyPath: 'id'
        });
        const cursor = req.transaction.objectStore('matches').openCursor();
        cursor.onsuccess = () => {
          const row = cursor.result;
          if (row) {
            shelf.put(listing(row.value));
            row.continue();
          }
        };
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => {
        db.close();
        opening = undefined;
      };
      resolve(db);
    };
    req.onerror = () => {
      opening = undefined;
      reject(req.error);
    };
    req.onblocked = () => {
      opening = undefined;
      reject(new Error('请关闭同一工作台的其他标签页，再重试数据库更新。'));
    };
  });
  return opening;
}
async function tx(stores, mode, work) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(stores, mode);
    let request;
    try {
      request = work(t);
    } catch (error) {
      t.abort();
      reject(error);
      return;
    }
    t.oncomplete = () => resolve(request?.result);
    t.onabort = () => reject(t.error || new Error('设备没有完成数据写入。'));
    t.onerror = () => reject(t.error);
  });
}
export const get = (store, id) => tx([store], 'readonly', t => t.objectStore(store).get(id));
export const all = store => tx([store], 'readonly', t => t.objectStore(store).getAll());

function writeMatch(t, item) {
  t.objectStore('shelf').put(listing(item));
  return t.objectStore('matches').put(item);
}
export const put = (store, item) => store === 'matches' ? tx(['matches', 'shelf'], 'readwrite', t => writeMatch(t, item)) : tx([store], 'readwrite', t => t.objectStore(store).put(item));
export const removeCard = id => tx(['cards'], 'readwrite', t => t.objectStore('cards').delete(id));
export const saveImport = (match, file) => tx(['matches', 'shelf', 'videos'], 'readwrite', t => {
  t.objectStore('videos').put({
    id: match.id,
    file
  });
  return writeMatch(t, match);
});
export const deleteMatch = id => tx(['matches', 'shelf', 'videos'], 'readwrite', t => {
  t.objectStore('videos').delete(id);
  t.objectStore('shelf').delete(id);
  return t.objectStore('matches').delete(id);
});

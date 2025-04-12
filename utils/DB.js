export class MediaDB {
  constructor(dbName = "WebDownloaderDB", storeName = "media") {
    this.dbName = dbName;
    this.storeName = storeName;
    this.db = null;
  }

  init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 3);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (db.objectStoreNames.contains(this.storeName)) {
          db.deleteObjectStore(this.storeName);
        }
        const store = db.createObjectStore(this.storeName, { keyPath: "id", autoIncrement: true });
        store.createIndex("width_idx", "width");
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve();
      };

      request.onerror = (event) => {
        reject(`IndexedDB error: ${event.target.errorCode}`);
      };
    });
  }

  getCount(minWidth = 0) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, "readonly");
      const store = tx.objectStore(this.storeName);
      const index = store.index("width_idx");

      const keyRange = IDBKeyRange.lowerBound(minWidth);
      const countRequest = index.count(keyRange);

      countRequest.onsuccess = () => resolve(countRequest.result);
      countRequest.onerror = (e) => reject(e);
    });
  }

  get(id) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, "readonly");
      const store = tx.objectStore(this.storeName);
      const request = store.get(id);

      request.onsuccess = (e) => resolve(e.target.result);
      request.onerror = (e) => reject(e);
    });
  }

  getByIds(ids) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, "readonly");
      const store = tx.objectStore(this.storeName);
      Promise.all(ids.map(id => {
        return new Promise((res, rej) => {
          const request = store.get(id);
          request.onsuccess = () => res(request.result);
          request.onerror = () => rej(request.error);
        });
      }))
        .then(results => resolve(results.filter(Boolean)))
        .catch(reject);
    });
  }

  getByPage(minWidth = 0, offset = 0, limit = 0) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, "readonly");
      const store = tx.objectStore(this.storeName);
      const index = store.index("width_idx");
      const keyRange = IDBKeyRange.lowerBound(minWidth);

      const results = [];
      let skipped = 0;

      const cursorReq = index.openCursor(keyRange, "prev");

      cursorReq.onsuccess = (e) => {
        const cursor = e.target.result;
        if (!cursor) return resolve(results);

        if (skipped < offset) {
          skipped++;
          cursor.continue();
          return;
        }

        results.push(cursor.value);

        if (limit > 0 && results.length >= limit) {
          return resolve(results);
        }

        cursor.continue();
      };

      cursorReq.onerror = (e) => reject(e);
    });
  }

  add(video) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, "readwrite");
      const store = tx.objectStore(this.storeName);
      const request = store.add(video);

      request.onsuccess = () => resolve();
      request.onerror = (e) => reject(e);
    });
  }

  delete(id) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, "readwrite");
      const store = tx.objectStore(this.storeName);

      const deleteRequest = store.delete(id);
      deleteRequest.onsuccess = () => resolve();
      deleteRequest.onerror = (e) => reject(e);
    });
  }

  clear() {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, "readwrite");
      const store = tx.objectStore(this.storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = (e) => reject(e);
    });
  }

}

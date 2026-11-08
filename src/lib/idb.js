/**
 * 通用 IndexedDB 封装 —— 图片（lib/images.js）与文档（lib/docs.js）共用。
 *
 * 为什么抽出来：两处都要「按 key 存 Blob、取 Blob、删 Blob、列 key」，
 * 之前这套逻辑只写在 images.js 里，且把库名/store 名写死在函数内部。
 * 文档要另开一个库（不能与图片混用，否则清理图片时会误删文档），
 * 所以把「库名 + store 名」提成参数，两边各自实例化。
 *
 * 约定：
 * - 一个库的所有 store 在 openStore 时一次性建好（onupgradeneeded 里按数组建），
 *   避免「第二次打开另一个 store 但版本号没变、upgrade 不触发、store 建不出来」这个经典坑。
 * - 每次操作后 close()，不做长连接缓存。调用频次很低（一次解析/一次查看），
 *   换来的是不用处理 versionchange 与连接失效。
 */

/** 探测当前环境是否可用 IndexedDB（隐私模式下 open 会抛错） */
export function idbAvailable() {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null
  } catch {
    return false
  }
}

/**
 * 打开库并确保 store 存在。
 * @param {string} dbName 库名
 * @param {string|string[]} storeNames 需要存在的 store（首次创建时全部建好）
 * @param {number} version 版本号，默认 1
 * @returns {Promise<IDBDatabase>}
 */
export function openStore(dbName, storeNames, version = 1) {
  const list = Array.isArray(storeNames) ? storeNames : [storeNames]
  return new Promise((resolve, reject) => {
    if (!idbAvailable()) {
      reject(new Error('当前环境不支持 IndexedDB'))
      return
    }
    const req = indexedDB.open(dbName, version)
    req.onupgradeneeded = () => {
      const db = req.result
      list.forEach((name) => {
        if (name && !db.objectStoreNames.contains(name)) db.createObjectStore(name)
      })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error || new Error('IndexedDB 打开失败'))
    req.onblocked = () => reject(new Error('IndexedDB 被其他页面占用，请关闭其他标签页后重试'))
  })
}

/** 写入。value 可以是 Blob / ArrayBuffer / 任意可结构化克隆的值 */
export async function idbPut(dbName, storeName, key, value) {
  const db = await openStore(dbName, storeName)
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    tx.objectStore(storeName).put(value, key)
    tx.oncomplete = () => {
      db.close()
      resolve(key)
    }
    tx.onerror = () => {
      db.close()
      reject(tx.error)
    }
    tx.onabort = () => {
      db.close()
      reject(tx.error || new Error('写入被中断（可能是存储空间不足）'))
    }
  })
}

/** 读取，未命中返回 null */
export async function idbGet(dbName, storeName, key) {
  const db = await openStore(dbName, storeName)
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const req = tx.objectStore(storeName).get(key)
    req.onsuccess = () => {
      db.close()
      resolve(req.result || null)
    }
    req.onerror = () => {
      db.close()
      reject(req.error)
    }
  })
}

/** 删除，失败不抛（清理路径不该阻断主流程） */
export async function idbDelete(dbName, storeName, key) {
  try {
    const db = await openStore(dbName, storeName)
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite')
      tx.objectStore(storeName).delete(key)
      tx.oncomplete = () => {
        db.close()
        resolve(true)
      }
      tx.onerror = () => {
        db.close()
        reject(tx.error)
      }
    })
  } catch {
    return false
  }
}

/** 列出全部 key，失败返回空数组 */
export async function idbKeys(dbName, storeName) {
  try {
    const db = await openStore(dbName, storeName)
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly')
      const req = tx.objectStore(storeName).getAllKeys()
      req.onsuccess = () => {
        db.close()
        resolve(req.result || [])
      }
      req.onerror = () => {
        db.close()
        reject(req.error)
      }
    })
  } catch {
    return []
  }
}

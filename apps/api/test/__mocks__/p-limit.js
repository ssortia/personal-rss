/**
 * CJS-совместимая реализация p-limit для e2e-тестов.
 * p-limit@7 — ESM-only пакет, Jest (CJS режим) не может его трансформировать.
 * Эта заглушка реализует тот же интерфейс и используется только в e2e-окружении.
 *
 * Намеренно не реализованы: activeCount, pendingCount, clearQueue —
 * продакшн-код (sync.service.ts) не использует эти свойства.
 */
function pLimit(concurrency) {
  let running = 0;
  const queue = [];

  function next() {
    if (running >= concurrency || queue.length === 0) return;
    const { fn, resolve, reject } = queue.shift();
    running++;
    Promise.resolve()
      .then(() => fn())
      .then(resolve, reject)
      .finally(() => {
        running--;
        next();
      });
  }

  return function limit(fn, ...args) {
    return new Promise((resolve, reject) => {
      queue.push({ fn: () => fn(...args), resolve, reject });
      next();
    });
  };
}

module.exports = pLimit;
module.exports.default = pLimit;

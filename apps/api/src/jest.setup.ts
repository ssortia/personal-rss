import { Logger } from '@nestjs/common';

// Подавляем вывод NestJS-логгера в тестах — сервисы логируют ошибки как часть
// нормальной работы, и в тест-выводе это создаёт лишний шум.
// beforeEach (а не beforeAll) — потому что jest.restoreAllMocks() в afterEach
// восстанавливает шпионы, и их нужно переустанавливать перед каждым тестом.
beforeEach(() => {
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'verbose').mockImplementation(() => undefined);
});

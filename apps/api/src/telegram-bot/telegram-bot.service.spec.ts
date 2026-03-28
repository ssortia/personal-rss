import { Bot } from 'grammy';

import type { UsersService } from '../users/users.service';

// Мок grammy: Bot — заглушка с jest.fn() методами
jest.mock('grammy', () => ({
  Bot: jest.fn().mockImplementation(() => ({
    command: jest.fn(),
    start: jest.fn().mockReturnValue(Promise.resolve()),
    stop: jest.fn().mockReturnValue(Promise.resolve()),
  })),
}));

// Позволяет переключать наличие токена между тестами
const mockGetEnv = jest.fn();
jest.mock('../config/env', () => ({ getEnv: () => mockGetEnv() }));

import { TelegramBotService } from './telegram-bot.service';

function makeMockUsers() {
  return { linkTelegramByToken: jest.fn() } as unknown as UsersService;
}

function createService(token: string | undefined, usersService: UsersService) {
  mockGetEnv.mockReturnValue({ TELEGRAM_BOT_TOKEN: token, TELEGRAM_BOT_NAME: 'TestBot' });
  return new TelegramBotService(usersService);
}

function getLastBotInstance() {
  const MockBot = Bot as jest.MockedClass<typeof Bot>;
  const lastResult = MockBot.mock.results[MockBot.mock.results.length - 1];
  // mockImplementation явно возвращает объект, поэтому Jest помещает его в mock.results[i].value.
  // Для new без mockImplementation (конструктор возвращает undefined) нужно было бы использовать mock.instances.
  return lastResult?.value as { command: jest.Mock; start: jest.Mock; stop: jest.Mock };
}

function getStartHandler() {
  const botInstance = getLastBotInstance();
  const commandMock = botInstance.command as unknown as jest.Mock;
  return commandMock.mock.calls[0][1] as (ctx: unknown) => Promise<void>;
}

function makeCtx(match: string, chatId = 100, username?: string) {
  return {
    match,
    chat: { id: chatId },
    from: username !== undefined ? { username } : undefined,
    reply: jest.fn().mockResolvedValue(undefined),
  };
}

describe('TelegramBotService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('без TELEGRAM_BOT_TOKEN', () => {
    it('не создаёт экземпляр Bot', () => {
      createService(undefined, makeMockUsers());
      expect(Bot).not.toHaveBeenCalled();
    });

    it('onApplicationBootstrap не выбрасывает ошибку', () => {
      const service = createService(undefined, makeMockUsers());
      expect(() => service.onApplicationBootstrap()).not.toThrow();
    });

    it('onApplicationShutdown не выбрасывает ошибку', async () => {
      const service = createService(undefined, makeMockUsers());
      await expect(service.onApplicationShutdown()).resolves.not.toThrow();
    });
  });

  describe('с TELEGRAM_BOT_TOKEN', () => {
    it('регистрирует обработчик команды /start', () => {
      createService('valid-token', makeMockUsers());
      const botInstance = getLastBotInstance();
      expect(botInstance.command).toHaveBeenCalledWith('start', expect.any(Function));
    });

    it('запускает polling в onApplicationBootstrap', () => {
      const service = createService('valid-token', makeMockUsers());
      service.onApplicationBootstrap();
      const botInstance = getLastBotInstance();
      expect(botInstance.start).toHaveBeenCalledWith({ drop_pending_updates: true });
    });

    it('останавливает бота в onApplicationShutdown', async () => {
      const service = createService('valid-token', makeMockUsers());
      await service.onApplicationShutdown();
      const botInstance = getLastBotInstance();
      expect(botInstance.stop).toHaveBeenCalled();
    });
  });

  describe('обработчик /start', () => {
    let mockUsers: UsersService;

    beforeEach(() => {
      mockUsers = makeMockUsers();
      createService('valid-token', mockUsers);
    });

    it('отвечает инструкцией если токен отсутствует', async () => {
      const ctx = makeCtx('');
      await getStartHandler()(ctx);
      expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('ссылку из настроек'));
    });

    it('отвечает успехом при валидном токене', async () => {
      (mockUsers.linkTelegramByToken as jest.Mock).mockResolvedValue(true);
      const ctx = makeCtx('abc123', 42, 'testuser');
      await getStartHandler()(ctx);
      expect(mockUsers.linkTelegramByToken).toHaveBeenCalledWith('abc123', '42', 'testuser');
      expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('успешно'));
    });

    it('отвечает ошибкой при просроченном/неизвестном токене', async () => {
      (mockUsers.linkTelegramByToken as jest.Mock).mockResolvedValue(false);
      const ctx = makeCtx('expired', 42, 'user');
      await getStartHandler()(ctx);
      expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('устарела'));
    });

    it('передаёт null если у пользователя нет username', async () => {
      (mockUsers.linkTelegramByToken as jest.Mock).mockResolvedValue(true);
      const ctx = makeCtx('token123', 99, undefined);
      await getStartHandler()(ctx);
      expect(mockUsers.linkTelegramByToken).toHaveBeenCalledWith('token123', '99', null);
    });
  });
});

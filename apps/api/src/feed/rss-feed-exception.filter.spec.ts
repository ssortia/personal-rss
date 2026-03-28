import type { ArgumentsHost } from '@nestjs/common';
import { HttpStatus, NotFoundException, UnauthorizedException } from '@nestjs/common';

import { RssFeedExceptionFilter } from './rss-feed-exception.filter';

/** Строит мок-цепочку reply.status().header().send() и возвращает spy-функции. */
function makeMockReply() {
  const mockSend = jest.fn();
  const headerChain = { send: mockSend };
  const mockHeader = jest.fn().mockReturnValue(headerChain);
  const statusChain = { header: mockHeader };
  const mockStatus = jest.fn().mockReturnValue(statusChain);
  const reply = { status: mockStatus };
  return { reply, mockStatus, mockHeader, mockSend };
}

function makeMockHost(reply: object): jest.Mocked<ArgumentsHost> {
  const mockGetResponse = jest.fn().mockReturnValue(reply);
  const mockSwitchToHttp = jest.fn().mockReturnValue({ getResponse: mockGetResponse });
  return { switchToHttp: mockSwitchToHttp } as unknown as jest.Mocked<ArgumentsHost>;
}

describe('RssFeedExceptionFilter', () => {
  let filter: RssFeedExceptionFilter;

  beforeEach(() => {
    filter = new RssFeedExceptionFilter();
  });

  it('устанавливает HTTP-статус из исключения', () => {
    const { reply, mockStatus } = makeMockReply();
    filter.catch(new NotFoundException('Not found'), makeMockHost(reply));
    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
  });

  it('устанавливает Content-Type: application/rss+xml', () => {
    const { reply, mockHeader } = makeMockReply();
    filter.catch(new NotFoundException('Test'), makeMockHost(reply));
    expect(mockHeader).toHaveBeenCalledWith('Content-Type', 'application/rss+xml; charset=utf-8');
  });

  it('отправляет RSS XML в теле ответа', () => {
    const { reply, mockSend } = makeMockReply();
    filter.catch(new NotFoundException('Фид не найден'), makeMockHost(reply));
    expect(mockSend).toHaveBeenCalledWith(expect.stringContaining('<rss version="2.0">'));
    expect(mockSend).toHaveBeenCalledWith(expect.stringContaining('Фид не найден'));
  });

  it('включает код статуса в заголовок XML', () => {
    const { reply, mockSend } = makeMockReply();
    filter.catch(new UnauthorizedException('Unauthorized'), makeMockHost(reply));
    const xml = mockSend.mock.calls[0]?.[0] as string;
    expect(xml).toContain(`Ошибка ${HttpStatus.UNAUTHORIZED}`);
  });

  it('экранирует спецсимволы XML в сообщении ошибки', () => {
    const { reply, mockSend } = makeMockReply();
    // Сообщение содержит символы, требующие экранирования
    const exception = new NotFoundException('Error: <test> & "issue"');
    filter.catch(exception, makeMockHost(reply));
    const xml = mockSend.mock.calls[0]?.[0] as string;
    expect(xml).toContain('&lt;test&gt;');
    expect(xml).toContain('&amp;');
    expect(xml).toContain('&quot;issue&quot;');
    // Сырые символы не должны присутствовать в описании
    expect(xml).not.toContain('<test>');
  });

  it('возвращает валидную XML-структуру', () => {
    const { reply, mockSend } = makeMockReply();
    filter.catch(new NotFoundException('Not found'), makeMockHost(reply));
    const xml = mockSend.mock.calls[0]?.[0] as string;
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<rss version="2.0">');
    expect(xml).toContain('</rss>');
  });
});

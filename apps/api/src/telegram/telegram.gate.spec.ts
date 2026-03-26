import { TelegramGate } from './telegram.gate';

/** Строит минимальный HTML Telegram-превью с указанными параметрами. */
function makeHtml(opts: {
  title?: string;
  description?: string;
  image?: string;
  posts?: Array<{ id: string; text: string; datetime?: string }>;
}): string {
  const metaTags = [
    opts.title ? `<meta property="og:title" content="${opts.title}">` : '',
    opts.description ? `<meta property="og:description" content="${opts.description}">` : '',
    opts.image ? `<meta property="og:image" content="${opts.image}">` : '',
  ].join('\n');

  const postsHtml = (opts.posts ?? [])
    .map(
      (p) => `
      <div class="tgme_widget_message" data-post="testchannel/${p.id}">
        <div class="tgme_widget_message_text">${p.text}</div>
        ${p.datetime ? `<time datetime="${p.datetime}"></time>` : ''}
      </div>`,
    )
    .join('\n');

  return `<html><head>${metaTags}</head><body>${postsHtml}</body></html>`;
}

function mockFetchOk(html: string): void {
  jest.spyOn(global, 'fetch').mockResolvedValue({
    ok: true,
    text: async () => html,
  } as unknown as Response);
}

describe('TelegramGate', () => {
  let gate: TelegramGate;

  beforeEach(() => {
    gate = new TelegramGate();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('fetchChannel — ошибки сети', () => {
    it('возвращает null при HTTP-ошибке (404)', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        status: 404,
      } as unknown as Response);
      const result = await gate.fetchChannel('private_channel');
      expect(result).toBeNull();
    });

    it('возвращает null при ошибке сети', async () => {
      jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));
      const result = await gate.fetchChannel('testchannel');
      expect(result).toBeNull();
    });
  });

  describe('fetchChannel — парсинг канала', () => {
    it('возвращает null если нет og:title (приватный или несуществующий канал)', async () => {
      mockFetchOk('<html><body><p>No title here</p></body></html>');
      const result = await gate.fetchChannel('private');
      expect(result).toBeNull();
    });

    it('извлекает title, description и imageUrl из мета-тегов', async () => {
      mockFetchOk(
        makeHtml({
          title: 'My Channel',
          description: 'Channel description',
          image: 'https://cdn.telegram.org/photo.jpg',
          posts: [],
        }),
      );
      const result = await gate.fetchChannel('testchannel');
      expect(result).toMatchObject({
        title: 'My Channel',
        description: 'Channel description',
        imageUrl: 'https://cdn.telegram.org/photo.jpg',
      });
    });

    it('description = null если мета-тег отсутствует', async () => {
      mockFetchOk(makeHtml({ title: 'Channel', posts: [] }));
      const result = await gate.fetchChannel('testchannel');
      expect(result?.description).toBeNull();
    });

    it('imageUrl = null если og:image отсутствует', async () => {
      mockFetchOk(makeHtml({ title: 'Channel', posts: [] }));
      const result = await gate.fetchChannel('testchannel');
      expect(result?.imageUrl).toBeNull();
    });
  });

  describe('fetchChannel — парсинг постов', () => {
    it('парсит пост с текстом, url и датой', async () => {
      mockFetchOk(
        makeHtml({
          title: 'Channel',
          posts: [{ id: '123', text: 'Hello World', datetime: '2024-01-15T10:00:00+00:00' }],
        }),
      );
      const result = await gate.fetchChannel('testchannel');
      expect(result?.posts).toHaveLength(1);
      expect(result?.posts[0]).toMatchObject({
        guid: 'testchannel/123',
        title: 'Hello World',
        url: 'https://t.me/testchannel/123',
        content: 'Hello World',
      });
      expect(result?.posts[0]?.publishedAt).toBeInstanceOf(Date);
    });

    it('устанавливает publishedAt = null если нет datetime', async () => {
      mockFetchOk(
        makeHtml({
          title: 'Channel',
          posts: [{ id: '1', text: 'Post without date' }],
        }),
      );
      const result = await gate.fetchChannel('testchannel');
      expect(result?.posts[0]?.publishedAt).toBeNull();
    });

    it('обрезает title поста до 100 символов', async () => {
      const longText = 'A'.repeat(150);
      mockFetchOk(makeHtml({ title: 'Channel', posts: [{ id: '1', text: longText }] }));
      const result = await gate.fetchChannel('testchannel');
      expect(result?.posts[0]?.title).toHaveLength(100);
      expect(result?.posts[0]?.content).toHaveLength(150); // content не обрезается
    });

    it('пропускает посты без текста (только медиа)', async () => {
      const html = `
        <html>
          <head><meta property="og:title" content="Channel"></head>
          <body>
            <div class="tgme_widget_message" data-post="testchannel/1">
              <!-- нет .tgme_widget_message_text -->
            </div>
          </body>
        </html>`;
      mockFetchOk(html);
      const result = await gate.fetchChannel('testchannel');
      expect(result?.posts).toHaveLength(0);
    });

    it('возвращает несколько постов в правильном порядке', async () => {
      mockFetchOk(
        makeHtml({
          title: 'Channel',
          posts: [
            { id: '1', text: 'First post' },
            { id: '2', text: 'Second post' },
            { id: '3', text: 'Third post' },
          ],
        }),
      );
      const result = await gate.fetchChannel('testchannel');
      expect(result?.posts).toHaveLength(3);
      expect(result?.posts[0]?.guid).toBe('testchannel/1');
      expect(result?.posts[2]?.guid).toBe('testchannel/3');
    });
  });

  describe('fetchChannel — HTTP-запрос', () => {
    it('запрашивает t.me/s/{username}', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        text: async () => makeHtml({ title: 'Channel', posts: [] }),
      } as unknown as Response);
      await gate.fetchChannel('mychannel');
      expect(fetchSpy).toHaveBeenCalledWith('https://t.me/s/mychannel', expect.any(Object));
    });

    it('передаёт User-Agent с упоминанием CurioBot', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        text: async () => makeHtml({ title: 'Channel', posts: [] }),
      } as unknown as Response);
      await gate.fetchChannel('testchannel');
      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const userAgent = (init.headers as Record<string, string>)['User-Agent'];
      expect(userAgent).toContain('CurioBot');
    });
  });
});

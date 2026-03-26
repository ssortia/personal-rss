import { mapRssFeedItems } from './rss-mapper';

describe('mapRssFeedItems', () => {
  describe('makeGuid — приоритет значений', () => {
    it('возвращает guid если он есть', () => {
      const result = mapRssFeedItems([{ guid: 'my-guid', link: 'http://example.com', title: 'T' }]);
      expect(result[0]?.guid).toBe('my-guid');
    });

    it('возвращает link если нет guid', () => {
      const result = mapRssFeedItems([{ link: 'http://example.com/article', title: 'T' }]);
      expect(result[0]?.guid).toBe('http://example.com/article');
    });

    it('генерирует hash-fallback если нет ни guid ни link', () => {
      const result = mapRssFeedItems([{ title: 'Test', pubDate: '2024-01-01' }]);
      expect(result[0]?.guid).toMatch(/^hash:[a-f0-9]{16}$/);
    });

    it('hash детерминирован: одинаковые входные данные → одинаковый guid', () => {
      const item = { title: 'Same title', pubDate: '2024-01-01' };
      const r1 = mapRssFeedItems([item]);
      const r2 = mapRssFeedItems([item]);
      expect(r1[0]?.guid).toBe(r2[0]?.guid);
    });

    it('разные title → разные guid', () => {
      const result = mapRssFeedItems([
        { title: 'Article A', pubDate: '2024-01-01' },
        { title: 'Article B', pubDate: '2024-01-01' },
      ]);
      expect(result[0]?.guid).not.toBe(result[1]?.guid);
    });

    it('разные pubDate → разные guid', () => {
      const result = mapRssFeedItems([
        { title: 'Same title', pubDate: '2024-01-01' },
        { title: 'Same title', pubDate: '2024-01-02' },
      ]);
      expect(result[0]?.guid).not.toBe(result[1]?.guid);
    });

    it('использует isoDate как fallback если нет pubDate', () => {
      // isoDate входит в hash-источник вместо pubDate
      const withIsoDate = mapRssFeedItems([{ title: 'T', isoDate: '2024-06-15' }]);
      const noDate = mapRssFeedItems([{ title: 'T' }]);
      // Хэши должны отличаться: `T::2024-06-15` vs `T::`
      expect(withIsoDate[0]?.guid).toMatch(/^hash:/);
      expect(withIsoDate[0]?.guid).not.toBe(noDate[0]?.guid);
    });
  });

  describe('маппинг полей', () => {
    it('маппит все поля корректно', () => {
      const result = mapRssFeedItems([
        {
          guid: 'g1',
          link: 'http://example.com/1',
          title: 'Test title',
          contentSnippet: 'snippet text',
          pubDate: 'Mon, 01 Jan 2024 00:00:00 GMT',
        },
      ]);
      expect(result[0]).toMatchObject({
        guid: 'g1',
        url: 'http://example.com/1',
        title: 'Test title',
        content: 'snippet text',
      });
      expect(result[0]?.publishedAt).toBeInstanceOf(Date);
    });

    it('пустой item → дефолтные значения', () => {
      const result = mapRssFeedItems([{}]);
      expect(result[0]).toMatchObject({
        title: '',
        url: '',
        content: null,
        publishedAt: null,
      });
      expect(result[0]?.guid).toMatch(/^hash:/);
    });

    it('contentSnippet имеет приоритет над content', () => {
      const result = mapRssFeedItems([{ title: 'T', contentSnippet: 'snippet', content: 'full' }]);
      expect(result[0]?.content).toBe('snippet');
    });

    it('fallback на content если нет contentSnippet', () => {
      const result = mapRssFeedItems([{ title: 'T', content: 'fallback text' }]);
      expect(result[0]?.content).toBe('fallback text');
    });

    it('publishedAt = null если нет pubDate', () => {
      const result = mapRssFeedItems([{ title: 'T', link: 'http://x.com' }]);
      expect(result[0]?.publishedAt).toBeNull();
    });

    it('пустой массив → пустой массив', () => {
      expect(mapRssFeedItems([])).toEqual([]);
    });

    it('маппит несколько элементов независимо', () => {
      const result = mapRssFeedItems([
        { guid: 'g1', title: 'First' },
        { guid: 'g2', title: 'Second' },
      ]);
      expect(result).toHaveLength(2);
      expect(result[0]?.guid).toBe('g1');
      expect(result[1]?.guid).toBe('g2');
    });
  });
});

import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(() => {
    controller = new HealthController();
  });

  it('возвращает статус ok', () => {
    const result = controller.check();
    expect(result).toMatchObject({ status: 'ok' });
  });
});

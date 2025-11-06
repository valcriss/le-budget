import { HttpContext, HttpRequest } from '@angular/common/http';
import { SKIP_AUTH_REFRESH } from './auth-http-context.tokens';

describe('SKIP_AUTH_REFRESH token', () => {
  it('defaults to false', () => {
    const context = new HttpContext();
    expect(context.get(SKIP_AUTH_REFRESH)).toBe(false);
  });

  it('respects explicit value', () => {
    const context = new HttpContext().set(SKIP_AUTH_REFRESH, true);
    const request = new HttpRequest('GET', '/', { context });
    expect(request.context.get(SKIP_AUTH_REFRESH)).toBe(true);
  });
});

import { strict as assert } from 'assert';
import { UnauthorizedException } from '@nestjs/common';
import { UserContextService } from '../src/common/services/user-context.service';

function createRequest(user?: { sub?: string }) {
  return {
    user,
  } as any;
}

function createService(request: any) {
  return new UserContextService(request);
}

function testGetUserIdReturnsSub() {
  const service = createService(createRequest({ sub: 'user-123' }));
  assert.equal(service.getUserId(), 'user-123');
}

function testGetUserIdThrowsWhenMissing() {
  const service = createService(createRequest());
  assert.throws(() => service.getUserId(), UnauthorizedException);
}


function testGetUserIdThrowsWhenSubNotString() {
  const service = createService(createRequest({ sub: 42 as any }));
  assert.throws(() => service.getUserId(), UnauthorizedException);
}

(async () => {
  testGetUserIdReturnsSub();
  testGetUserIdThrowsWhenMissing();
  testGetUserIdThrowsWhenSubNotString();
  console.log('User context service tests passed ✓');
})();

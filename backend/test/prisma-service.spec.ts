import { strict as assert } from 'assert';
import { PrismaService } from '../src/prisma/prisma.service';

async function testOnModuleInitCallsConnect() {
  const service = new PrismaService();
  let called = false;
  (service as any).$connect = async () => {
    called = true;
  };

  await service.onModuleInit();
  assert.equal(called, true);
}

async function testOnModuleDestroyCallsDisconnect() {
  const service = new PrismaService();
  let called = false;
  (service as any).$disconnect = async () => {
    called = true;
  };

  await service.onModuleDestroy();
  assert.equal(called, true);
}

async function testEnableShutdownHooksRegistersHandler() {
  const service = new PrismaService();
  const original = process.on;
  let registeredHandler: (() => Promise<void>) | undefined;

  try {
    (process as any).on = (event: string, handler: () => Promise<void>) => {
      if (event === 'beforeExit') {
        registeredHandler = handler;
      }
      return process;
    };

    let closed = false;
    const app = { close: async () => { closed = true; } };

    await service.enableShutdownHooks(app as any);
    assert(registeredHandler, 'beforeExit handler should be registered');

    await registeredHandler!();
    assert.equal(closed, true);
  } finally {
    process.on = original;
  }
}

(async () => {
  await testOnModuleInitCallsConnect();
  await testOnModuleDestroyCallsDisconnect();
  await testEnableShutdownHooksRegistersHandler();
  console.log('Prisma service tests passed ✓');
})();

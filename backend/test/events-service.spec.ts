import { strict as assert } from 'assert';
import { firstValueFrom, take } from 'rxjs';
import { EventsService } from '../src/modules/events/events.service';

async function testEmitPublishesEvent() {
  const service = new EventsService();
  const emitted = firstValueFrom(service.stream.pipe(take(1)));

  service.emit('budget.updated', { foo: 'bar' });

  const result = await emitted;
  assert.equal(result.event, 'budget.updated');
  assert.deepEqual(result.data, { foo: 'bar' });
}

async function testOnModuleDestroyCompletesStream() {
  const service = new EventsService();
  let completed = false;

  service.stream.subscribe({
    complete: () => {
      completed = true;
    },
  });

  service.onModuleDestroy();
  assert.equal(completed, true);
}

(async () => {
  await testEmitPublishesEvent();
  await testOnModuleDestroyCompletesStream();
  console.log('Events service tests passed ✓');
})();

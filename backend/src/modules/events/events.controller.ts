import { Controller, Sse } from '@nestjs/common';
import { Observable } from 'rxjs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { EventsService, ServerSentEvent } from './events.service';
@ApiTags('events')
@Controller()
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Sse('events')
  @ApiOperation({
    summary: 'Flux SSE des évènements',
    description: 'Permet de souscrire au flux Server-Sent Events pour recevoir les mises à jour en temps réel.',
  })
  events(): Observable<ServerSentEvent> {
    return this.eventsService.stream;
  }
}

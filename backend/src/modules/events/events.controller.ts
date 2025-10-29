import { Controller, Sse } from '@nestjs/common';
import { Observable } from 'rxjs';
import { EventsService, ServerSentEvent } from './events.service';

@Controller()
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Sse('events')
  events(): Observable<ServerSentEvent> {
    return this.eventsService.stream;
  }
}

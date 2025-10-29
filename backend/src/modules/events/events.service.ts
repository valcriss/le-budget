import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';

export interface ServerSentEvent {
  data: unknown;
  event?: string;
  id?: string;
  retry?: number;
}

@Injectable()
export class EventsService implements OnModuleDestroy {
  private readonly subject = new Subject<ServerSentEvent>();

  get stream(): Observable<ServerSentEvent> {
    return this.subject.asObservable();
  }

  emit(event: string, data: unknown) {
    this.subject.next({ event, data });
  }

  onModuleDestroy() {
    this.subject.complete();
  }
}

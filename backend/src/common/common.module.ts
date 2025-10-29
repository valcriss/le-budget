import { Module } from '@nestjs/common';
import { UserContextService } from './services/user-context.service';

@Module({
  providers: [UserContextService],
  exports: [UserContextService],
})
export class CommonModule {}

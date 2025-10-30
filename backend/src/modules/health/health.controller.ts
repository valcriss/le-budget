import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Public()
  @Get()
  @ApiOperation({ summary: 'Vérifier la disponibilité', description: 'Renvoie un statut simple confirmant que l’API est opérationnelle.' })
  check() {
    return { status: 'ok' };
  }
}

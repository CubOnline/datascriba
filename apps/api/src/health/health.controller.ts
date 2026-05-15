import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common'
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'

interface HealthResponse {
  status: 'ok'
  timestamp: string
}

@ApiTags('Health')
@Controller('health')
export class HealthController {
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'API health check' })
  @ApiOkResponse({ description: 'Service is healthy' })
  check(): HealthResponse {
    return { status: 'ok', timestamp: new Date().toISOString() }
  }
}

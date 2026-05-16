import type { ScheduleDefinition } from '@datascriba/shared-types'
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import {
  ApiBody,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger'

import { CreateScheduleDto } from './dto/create-schedule.dto'
import { UpdateScheduleDto } from './dto/update-schedule.dto'
import { ScheduleService } from './schedule.service'

@ApiTags('Schedules')
@UseGuards(JwtAuthGuard)
@Controller('schedules')
export class ScheduleController {
  constructor(private readonly service: ScheduleService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new schedule' })
  @ApiBody({ type: CreateScheduleDto })
  @ApiCreatedResponse({ description: 'Schedule created' })
  async create(@Body() dto: CreateScheduleDto): Promise<ScheduleDefinition> {
    return this.service.create(dto)
  }

  @Get()
  @ApiOperation({ summary: 'List all schedules' })
  @ApiOkResponse({ description: 'List of schedules' })
  async findAll(): Promise<ScheduleDefinition[]> {
    return this.service.findAll()
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a schedule by ID' })
  @ApiParam({ name: 'id', type: String })
  @ApiNotFoundResponse({ description: 'Schedule not found' })
  async findOne(@Param('id') id: string): Promise<ScheduleDefinition> {
    return this.service.findOne(id)
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a schedule' })
  @ApiParam({ name: 'id', type: String })
  @ApiBody({ type: UpdateScheduleDto })
  @ApiNotFoundResponse({ description: 'Schedule not found' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateScheduleDto,
  ): Promise<ScheduleDefinition> {
    return this.service.update(id, dto)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a schedule' })
  @ApiParam({ name: 'id', type: String })
  @ApiNoContentResponse({ description: 'Schedule deleted' })
  async remove(@Param('id') id: string): Promise<void> {
    return this.service.remove(id)
  }

  @Post(':id/trigger')
  @ApiOperation({ summary: 'Manually trigger a schedule (enqueue job)' })
  @ApiParam({ name: 'id', type: String })
  @ApiOkResponse({ description: 'Job enqueued', schema: { properties: { jobId: { type: 'string' } } } })
  async trigger(@Param('id') id: string): Promise<{ jobId: string }> {
    return this.service.trigger(id)
  }
}

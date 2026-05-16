import type { ReportDefinition, RunRecord } from '@datascriba/report-engine'
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
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import {
  ApiBody,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger'
import type { FastifyReply } from 'fastify'

import { CreateReportDto } from './dto/create-report.dto'
import { RunReportDto } from './dto/run-report.dto'
import { ReportService } from './report.service'

@ApiTags('Reports')
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportController {
  constructor(private readonly service: ReportService) {}

  @Post()
  @ApiOperation({ summary: 'Create a report definition' })
  @ApiBody({ type: CreateReportDto })
  async create(@Body() dto: CreateReportDto): Promise<ReportDefinition> {
    return this.service.create(dto)
  }

  @Get()
  @ApiOperation({ summary: 'List all report definitions' })
  async findAll(): Promise<ReportDefinition[]> {
    return this.service.findAll()
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a report definition by ID' })
  @ApiParam({ name: 'id', type: String })
  @ApiNotFoundResponse({ description: 'Report not found' })
  async findOne(@Param('id') id: string): Promise<ReportDefinition> {
    return this.service.findOne(id)
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a report definition' })
  @ApiParam({ name: 'id', type: String })
  @ApiBody({ type: CreateReportDto })
  async update(
    @Param('id') id: string,
    @Body() dto: CreateReportDto,
  ): Promise<ReportDefinition> {
    return this.service.update(id, dto)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a report definition' })
  @ApiParam({ name: 'id', type: String })
  @ApiNoContentResponse({ description: 'Report deleted' })
  async remove(@Param('id') id: string): Promise<void> {
    return this.service.remove(id)
  }

  @Post(':id/run')
  @ApiOperation({ summary: 'Run a report and download output file' })
  @ApiParam({ name: 'id', type: String })
  @ApiBody({ type: RunReportDto })
  @ApiOkResponse({ description: 'File download stream' })
  async runReport(
    @Param('id') id: string,
    @Body() dto: RunReportDto,
    @Res({ passthrough: true }) res: FastifyReply,
  ): Promise<StreamableFile> {
    const { buffer, filename, mimeType } = await this.service.run(id, dto)
    void res.header('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`)
    void res.header('Content-Type', mimeType)
    return new StreamableFile(buffer)
  }

  @Get(':id/runs')
  @ApiOperation({ summary: 'List run history for a report' })
  @ApiParam({ name: 'id', type: String })
  async listRuns(@Param('id') id: string): Promise<RunRecord[]> {
    return this.service.listRuns(id)
  }

  @Get(':id/runs/:runId')
  @ApiOperation({ summary: 'Get a single run record' })
  @ApiParam({ name: 'id', type: String })
  @ApiParam({ name: 'runId', type: String })
  @ApiNotFoundResponse({ description: 'Run not found' })
  async findRun(
    @Param('id') id: string,
    @Param('runId') runId: string,
  ): Promise<RunRecord> {
    return this.service.findRun(id, runId)
  }
}

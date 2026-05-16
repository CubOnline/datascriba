import type { ColumnMeta, DataSourceRecord, QueryResult, TableMeta } from '@datascriba/shared-types'
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
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger'


import { DataSourceService } from './data-source.service'
import { CreateDataSourceDto } from './dto/create-data-source.dto'
import { ExecuteQueryDto } from './dto/execute-query.dto'
import { UpdateDataSourceDto } from './dto/update-data-source.dto'

@ApiTags('Data Sources')
@UseGuards(JwtAuthGuard)
@Controller('data-sources')
export class DataSourceController {
  constructor(private readonly service: DataSourceService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new data source' })
  @ApiBody({ type: CreateDataSourceDto })
  async create(@Body() dto: CreateDataSourceDto): Promise<DataSourceRecord> {
    return this.service.create(dto)
  }

  @Get()
  @ApiOperation({ summary: 'List all data sources' })
  async findAll(): Promise<DataSourceRecord[]> {
    return this.service.findAll()
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single data source by ID' })
  @ApiParam({ name: 'id', type: String })
  @ApiNotFoundResponse({ description: 'Data source not found' })
  async findOne(@Param('id') id: string): Promise<DataSourceRecord> {
    return this.service.findOne(id)
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a data source' })
  @ApiParam({ name: 'id', type: String })
  @ApiBody({ type: UpdateDataSourceDto })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateDataSourceDto,
  ): Promise<DataSourceRecord> {
    return this.service.update(id, dto)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a data source' })
  @ApiParam({ name: 'id', type: String })
  async remove(@Param('id') id: string): Promise<void> {
    return this.service.remove(id)
  }

  @Post(':id/test')
  @ApiOperation({ summary: 'Test a data source connection' })
  @ApiParam({ name: 'id', type: String })
  @ApiOkResponse({ schema: { type: 'object', properties: { ok: { type: 'boolean' } } } })
  async testConnection(@Param('id') id: string): Promise<{ ok: boolean }> {
    const ok = await this.service.testConnection(id)
    return { ok }
  }

  @Get(':id/tables')
  @ApiOperation({ summary: 'List tables in a data source' })
  @ApiParam({ name: 'id', type: String })
  async listTables(@Param('id') id: string): Promise<TableMeta[]> {
    return this.service.listTables(id)
  }

  @Get(':id/tables/:tableName')
  @ApiOperation({ summary: 'Describe columns of a table' })
  @ApiParam({ name: 'id', type: String })
  @ApiParam({ name: 'tableName', type: String })
  async describeTable(
    @Param('id') id: string,
    @Param('tableName') tableName: string,
  ): Promise<ColumnMeta[]> {
    return this.service.describeTable(id, tableName)
  }

  @Post(':id/execute')
  @ApiOperation({ summary: 'Execute a SQL query against a data source' })
  @ApiParam({ name: 'id', type: String })
  @ApiBody({ type: ExecuteQueryDto })
  async executeQuery(
    @Param('id') id: string,
    @Body() dto: ExecuteQueryDto,
  ): Promise<QueryResult> {
    return this.service.executeQuery(id, dto.sql, dto.params ?? [])
  }
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsArray, IsIn, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator'

import { ReportParameterDto } from './report-parameter.dto'

export class CreateReportDto {
  @ApiProperty({ description: 'Human-readable report name', example: 'Monthly Sales' })
  @IsString()
  @MinLength(1)
  name!: string

  @ApiProperty({ description: 'ID of the data source to query', example: 'uuid-here' })
  @IsString()
  dataSourceId!: string

  @ApiProperty({
    description: 'SQL query (may contain Handlebars template expressions)',
    example: 'SELECT * FROM {{tableName}}',
  })
  @IsString()
  @MinLength(1)
  query!: string

  @ApiPropertyOptional({ description: 'Report description' })
  @IsOptional()
  @IsString()
  description?: string

  @ApiPropertyOptional({
    description: 'Parameter definitions for the report',
    type: [ReportParameterDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReportParameterDto)
  parameters?: ReportParameterDto[]

  @ApiProperty({
    description: 'Supported export formats',
    example: ['csv', 'excel'],
    enum: ['csv', 'excel'],
    isArray: true,
  })
  @IsArray()
  @IsIn(['csv', 'excel'], { each: true })
  exportFormats!: string[]
}

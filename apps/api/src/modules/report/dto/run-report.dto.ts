import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsIn, IsObject, IsOptional } from 'class-validator'

export class RunReportDto {
  @ApiProperty({
    description: 'Export format for the report',
    enum: ['csv', 'excel'],
    example: 'csv',
  })
  @IsIn(['csv', 'excel'])
  format!: 'csv' | 'excel'

  @ApiPropertyOptional({
    description: 'Parameter values to pass to the report query',
  })
  @IsOptional()
  @IsObject()
  parameters?: Record<string, unknown>
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsBoolean, IsEmail, IsIn, IsObject, IsOptional, IsString, IsUUID, MinLength } from 'class-validator'

export class CreateScheduleDto {
  @ApiProperty({ description: 'Report ID to schedule', example: 'uuid' })
  @IsUUID()
  reportId!: string

  @ApiProperty({ description: 'Cron expression (5-part)', example: '0 8 * * 1-5' })
  @IsString()
  @MinLength(9)
  cronExpression!: string

  @ApiProperty({ description: 'Export format', enum: ['csv', 'excel'] })
  @IsIn(['csv', 'excel'])
  format!: 'csv' | 'excel'

  @ApiPropertyOptional({ description: 'Report parameters' })
  @IsOptional()
  @IsObject()
  parameters?: Record<string, unknown>

  @ApiPropertyOptional({ description: 'E-mail for delivery notification' })
  @IsOptional()
  @IsEmail()
  notifyEmail?: string

  @ApiPropertyOptional({ description: 'Start enabled', default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean
}

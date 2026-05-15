import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsBoolean, IsEmail, IsIn, IsObject, IsOptional, IsString, MinLength } from 'class-validator'

export class UpdateScheduleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(9)
  cronExpression?: string

  @ApiPropertyOptional({ enum: ['csv', 'excel'] })
  @IsOptional()
  @IsIn(['csv', 'excel'])
  format?: 'csv' | 'excel'

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  parameters?: Record<string, unknown>

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  notifyEmail?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsArray, IsBoolean, IsIn, IsOptional, IsString } from 'class-validator'

const PARAMETER_TYPES = ['string', 'number', 'date', 'dateRange', 'select', 'multiSelect', 'boolean'] as const

export class ReportParameterDto {
  @ApiProperty({ description: 'Parameter name (used as key in values map)' })
  @IsString()
  name!: string

  @ApiProperty({ enum: PARAMETER_TYPES })
  @IsIn(PARAMETER_TYPES)
  type!: string

  @ApiProperty({ description: 'Display label' })
  @IsString()
  label!: string

  @ApiProperty()
  @IsBoolean()
  required!: boolean

  @ApiPropertyOptional()
  @IsOptional()
  defaultValue?: unknown

  @ApiPropertyOptional({ type: 'array' })
  @IsOptional()
  @IsArray()
  options?: Array<{ label: string; value: unknown }>

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  dependsOn?: string[]
}

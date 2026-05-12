import type { DataSourceType } from '@datascriba/shared-types'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator'


export class CreateDataSourceDto {
  @ApiProperty({ description: 'Human-readable name', example: 'Production MSSQL' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string

  @ApiProperty({
    description: 'Database driver type',
    enum: ['mssql'],
    example: 'mssql',
  })
  @IsEnum(['mssql'])
  type!: DataSourceType

  @ApiProperty({
    description: 'Connection string (will be encrypted at rest)',
    example: 'Server=localhost,1433;Database=mydb;User Id=sa;Password=secret;',
  })
  @IsString()
  @MinLength(1)
  connectionString!: string

  @ApiPropertyOptional({ description: 'Workspace ID (defaults to "default")' })
  @IsOptional()
  @IsString()
  workspaceId?: string

  @ApiPropertyOptional({ description: 'Query timeout in milliseconds', default: 30000 })
  @IsOptional()
  @IsInt()
  @Min(1000)
  @Max(300_000)
  queryTimeoutMs?: number

  @ApiPropertyOptional({
    description: 'Allow mutating statements (DELETE/DROP/TRUNCATE)',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  allowMutations?: boolean
}

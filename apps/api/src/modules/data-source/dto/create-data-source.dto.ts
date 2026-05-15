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

import { IsPublicHost } from '../../../common/validators/is-public-host.validator'

export class CreateDataSourceDto {
  @ApiProperty({ description: 'Human-readable name', example: 'Production MSSQL' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string

  @ApiProperty({ description: 'Database driver type', enum: ['mssql'], example: 'mssql' })
  @IsEnum(['mssql'])
  type!: DataSourceType

  @ApiProperty({ description: 'Server hostname or IP (private/loopback addresses are blocked)', example: 'db.example.com' })
  @IsString()
  @MinLength(1)
  @MaxLength(253)
  @IsPublicHost()
  host!: string

  @ApiProperty({ description: 'Server port', example: 1433 })
  @IsInt()
  @Min(1)
  @Max(65535)
  port!: number

  @ApiProperty({ description: 'Database name', example: 'mydb' })
  @IsString()
  @MinLength(1)
  database!: string

  @ApiProperty({ description: 'Login username', example: 'sa' })
  @IsString()
  @MinLength(1)
  username!: string

  @ApiProperty({ description: 'Login password (never stored in plaintext)' })
  @IsString()
  @MinLength(1)
  password!: string

  @ApiPropertyOptional({ description: 'Encrypt connection', default: true })
  @IsOptional()
  @IsBoolean()
  encrypt?: boolean

  @ApiPropertyOptional({ description: 'Trust server certificate', default: false })
  @IsOptional()
  @IsBoolean()
  trustServerCertificate?: boolean

  @ApiPropertyOptional({ description: 'Connection timeout in milliseconds', default: 30000 })
  @IsOptional()
  @IsInt()
  @Min(1000)
  @Max(300_000)
  connectionTimeoutMs?: number

  @ApiPropertyOptional({ description: 'Query timeout in milliseconds', default: 30000 })
  @IsOptional()
  @IsInt()
  @Min(1000)
  @Max(300_000)
  queryTimeoutMs?: number

  @ApiPropertyOptional({ description: 'Allow mutating statements (DELETE/DROP/TRUNCATE)', default: false })
  @IsOptional()
  @IsBoolean()
  allowMutations?: boolean

  @ApiPropertyOptional({ description: 'Workspace ID (defaults to "default")' })
  @IsOptional()
  @IsString()
  workspaceId?: string
}

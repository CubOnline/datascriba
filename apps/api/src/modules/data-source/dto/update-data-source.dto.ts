import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator'

import { IsPublicHost } from '../../../common/validators/is-public-host.validator'

export class UpdateDataSourceDto {
  @ApiPropertyOptional({ description: 'Human-readable name', example: 'Staging MSSQL' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string

  @ApiPropertyOptional({ description: 'Server hostname or IP (private/loopback addresses are blocked)' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(253)
  @IsPublicHost()
  host?: string

  @ApiPropertyOptional({ description: 'Server port' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number

  @ApiPropertyOptional({ description: 'Database name' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  database?: string

  @ApiPropertyOptional({ description: 'Login username' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  username?: string

  @ApiPropertyOptional({ description: 'New password (triggers connection string re-encryption)' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  password?: string

  @ApiPropertyOptional({ description: 'Encrypt connection' })
  @IsOptional()
  @IsBoolean()
  encrypt?: boolean

  @ApiPropertyOptional({ description: 'Trust server certificate' })
  @IsOptional()
  @IsBoolean()
  trustServerCertificate?: boolean

  @ApiPropertyOptional({ description: 'Connection timeout in milliseconds' })
  @IsOptional()
  @IsInt()
  @Min(1000)
  @Max(300_000)
  connectionTimeoutMs?: number

  @ApiPropertyOptional({ description: 'Query timeout in milliseconds' })
  @IsOptional()
  @IsInt()
  @Min(1000)
  @Max(300_000)
  queryTimeoutMs?: number

  @ApiPropertyOptional({ description: 'Allow mutating statements' })
  @IsOptional()
  @IsBoolean()
  allowMutations?: boolean
}

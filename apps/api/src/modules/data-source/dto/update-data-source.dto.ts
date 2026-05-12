import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator'

export class UpdateDataSourceDto {
  @ApiPropertyOptional({ description: 'Human-readable name', example: 'Staging MSSQL' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string

  @ApiPropertyOptional({ description: 'New connection string (will be re-encrypted)' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  connectionString?: string

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

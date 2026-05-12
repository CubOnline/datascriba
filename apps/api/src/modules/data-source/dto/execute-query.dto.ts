import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsArray, IsOptional, IsString, MinLength } from 'class-validator'

export class ExecuteQueryDto {
  @ApiProperty({ description: 'SQL query to execute', example: 'SELECT TOP 10 * FROM dbo.Orders' })
  @IsString()
  @MinLength(1)
  sql!: string

  @ApiPropertyOptional({ description: 'Positional query parameters', type: [Object] })
  @IsOptional()
  @IsArray()
  params?: unknown[]
}

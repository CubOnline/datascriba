import { ApiProperty } from '@nestjs/swagger'
import { IsString, IsUUID, MinLength, MaxLength } from 'class-validator'

export class SuggestQueryDto {
  @ApiProperty({
    description: 'Natural language description of the desired SQL query',
    example: 'Show me total sales grouped by product category for last month',
    minLength: 5,
    maxLength: 1000,
  })
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  prompt!: string

  @ApiProperty({
    description: 'ID of the data source to query schema from',
    format: 'uuid',
  })
  @IsString()
  @IsUUID()
  dataSourceId!: string
}

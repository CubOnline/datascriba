import { ApiProperty } from '@nestjs/swagger'
import { IsString, MinLength, MaxLength } from 'class-validator'

export class ExplainQueryDto {
  @ApiProperty({
    description: 'SQL query to explain',
    example: 'SELECT TOP 10 * FROM [dbo].[Orders] WHERE [Status] = @p1',
    minLength: 10,
    maxLength: 10000,
  })
  @IsString()
  @MinLength(10)
  @MaxLength(10000)
  sql!: string
}

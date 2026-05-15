import { ApiProperty } from '@nestjs/swagger'
import { IsString, MinLength, MaxLength } from 'class-validator'

export class FixQueryDto {
  @ApiProperty({
    description: 'The broken SQL query',
    example: 'SELECT * FORM Orders',
    minLength: 5,
    maxLength: 10000,
  })
  @IsString()
  @MinLength(5)
  @MaxLength(10000)
  sql!: string

  @ApiProperty({
    description: 'The SQL error message returned by the database',
    example: "Incorrect syntax near 'FORM'.",
    minLength: 1,
    maxLength: 2000,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  errorMessage!: string
}

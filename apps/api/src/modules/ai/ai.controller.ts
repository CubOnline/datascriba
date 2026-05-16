import type { AiStreamChunk } from '@datascriba/ai-client'
import type { AiSseChunk, ExplainQueryResponse } from '@datascriba/shared-types'
import {
  Body,
  Controller,
  MessageEvent,
  Post,
  Sse,
  UseGuards,
} from '@nestjs/common'
import {
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger'
import { ThrottlerGuard } from '@nestjs/throttler'
import { Observable, from, map } from 'rxjs'

import { AiService } from './ai.service'
import { ExplainQueryDto } from './dto/explain-query.dto'
import { FixQueryDto } from './dto/fix-query.dto'
import { SuggestQueryDto } from './dto/suggest-query.dto'

/**
 * AsyncIterable<AiStreamChunk> → Observable<MessageEvent> dönüştürücü.
 * NestJS SSE (@Sse) Observable<MessageEvent> bekler.
 */
function chunkToSse(
  iterable: AsyncIterable<AiStreamChunk>,
): Observable<MessageEvent> {
  return from(iterable).pipe(
    map((chunk): MessageEvent => {
      const data: AiSseChunk = {
        type: chunk.type,
        text: chunk.text,
        error: chunk.error,
      }
      return { data }
    }),
  )
}

// TODO(security/C-1): Add Better-Auth session guard here once the auth module
// is implemented. Currently ALL AI endpoints are unauthenticated — any client
// that can reach the API can consume the Anthropic quota without logging in.
// Pattern: @UseGuards(SessionGuard, ThrottlerGuard)
@ApiTags('AI')
@Controller('ai')
@UseGuards(ThrottlerGuard)
export class AiController {
  constructor(private readonly service: AiService) {}

  @Sse('suggest-query')
  @ApiOperation({ summary: 'Generate SQL from natural language (streaming SSE)' })
  @ApiBody({ type: SuggestQueryDto })
  @ApiProduces('text/event-stream')
  @ApiOkResponse({
    description: 'SSE stream. Events: {"type":"delta","text":"..."} or {"type":"done"}',
    schema: { type: 'string' },
  })
  suggestQuery(@Body() dto: SuggestQueryDto): Observable<MessageEvent> {
    return chunkToSse(this.service.suggestQuery(dto))
  }

  @Post('explain-query')
  @ApiOperation({ summary: 'Explain a SQL query in Turkish and English' })
  @ApiBody({ type: ExplainQueryDto })
  @ApiOkResponse({
    description: 'Explanation in Turkish and English',
  })
  async explainQuery(
    @Body() dto: ExplainQueryDto,
  ): Promise<ExplainQueryResponse> {
    return this.service.explainQuery(dto)
  }

  @Sse('fix-query')
  @ApiOperation({ summary: 'Fix a broken SQL query (streaming SSE)' })
  @ApiBody({ type: FixQueryDto })
  @ApiProduces('text/event-stream')
  @ApiOkResponse({
    description: 'SSE stream of corrected SQL tokens',
    schema: { type: 'string' },
  })
  fixQuery(@Body() dto: FixQueryDto): Observable<MessageEvent> {
    return chunkToSse(this.service.fixQuery(dto))
  }
}

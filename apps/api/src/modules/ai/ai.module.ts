import { Module } from '@nestjs/common'

import { DataSourceModule } from '../data-source/data-source.module'

import { AiController } from './ai.controller'
import { AiService } from './ai.service'

@Module({
  imports: [DataSourceModule],
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}

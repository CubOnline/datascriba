import { Module } from '@nestjs/common'

import { DataSourceController } from './data-source.controller'
import { DataSourceRepository } from './data-source.repository'
import { DataSourceService } from './data-source.service'

@Module({
  controllers: [DataSourceController],
  providers: [DataSourceService, DataSourceRepository],
  exports: [DataSourceService],
})
export class DataSourceModule {}

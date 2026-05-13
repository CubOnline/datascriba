import { Module } from '@nestjs/common'

import { DataSourceModule } from '../data-source/data-source.module'

import { ReportController } from './report.controller'
import { ReportRepository } from './report.repository'
import { ReportService } from './report.service'

@Module({
  imports: [DataSourceModule],
  controllers: [ReportController],
  providers: [ReportService, ReportRepository],
  exports: [ReportService],
})
export class ReportModule {}

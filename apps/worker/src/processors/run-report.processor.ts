import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import type { Job } from 'bullmq'
import { RunReportJobSchema, QUEUE_NAME, type RunReportJobPayload } from '@datascriba/queue-config'

import { EmailService } from '../services/email.service'
import { ReportRunnerService } from '../services/report-runner.service'

@Processor(QUEUE_NAME)
export class RunReportProcessor extends WorkerHost {
  private readonly logger = new Logger(RunReportProcessor.name)

  constructor(
    private readonly reportRunner: ReportRunnerService,
    private readonly emailService: EmailService,
  ) {
    super()
  }

  async process(job: Job<unknown>): Promise<void> {
    // Validate payload at runtime
    const parseResult = RunReportJobSchema.safeParse(job.data)
    if (!parseResult.success) {
      this.logger.error(
        { jobId: job.id, errors: parseResult.error.issues },
        'Invalid job payload — job discarded',
      )
      throw new Error('Invalid RunReportJob payload')
    }

    const payload: RunReportJobPayload = parseResult.data
    this.logger.log(
      { jobId: job.id, scheduleId: payload.scheduleId, reportId: payload.reportId },
      'Processing RunReportJob',
    )

    const { buffer, filename, reportName } = await this.reportRunner.run(payload)

    if (payload.notifyEmail) {
      // Email failure must NEVER abort a successfully completed job.
      // Wrap in try/catch so SMTP errors don't trigger BullMQ retries.
      try {
        await this.emailService.sendReportEmail({
          to: payload.notifyEmail,
          reportName,
          ranAt: new Date(payload.triggeredAt),
          format: payload.format,
          attachment: { filename, content: buffer },
        })
      } catch (emailErr: unknown) {
        this.logger.error(
          { jobId: job.id, scheduleId: payload.scheduleId, err: emailErr },
          'Failed to send report email — job still marked complete',
        )
      }
    }

    this.logger.log(
      { jobId: job.id, scheduleId: payload.scheduleId, filename },
      'RunReportJob completed',
    )
  }
}

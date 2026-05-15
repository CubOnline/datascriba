import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as nodemailer from 'nodemailer'
import Handlebars from 'handlebars'
import type { WorkerEnv } from '../config/worker-env'

interface ReportEmailOptions {
  to: string
  reportName: string
  ranAt: Date
  format: 'csv' | 'excel'
  attachment: {
    filename: string
    content: Buffer
  }
}

// Inline HTML template — avoids filesystem reads at runtime
const EMAIL_TEMPLATE_SOURCE = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>DataScriba Report</title></head>
<body style="font-family:Inter,sans-serif;color:#0F172A;max-width:600px;margin:auto;padding:24px">
  <h1 style="color:#6366F1;margin-bottom:4px">DataScriba</h1>
  <p style="color:#64748b;margin-top:0">Your AI-powered data scribe</p>
  <hr style="border:none;border-top:1px solid #E2E8F0;margin:24px 0">
  <h2>Report Ready: {{reportName}}</h2>
  <p>Your scheduled report has been generated and is attached to this e-mail.</p>
  <table style="border-collapse:collapse;width:100%">
    <tr>
      <td style="padding:8px 0;color:#64748b;width:140px">Report Name</td>
      <td style="padding:8px 0;font-weight:600">{{reportName}}</td>
    </tr>
    <tr>
      <td style="padding:8px 0;color:#64748b">Generated At</td>
      <td style="padding:8px 0">{{ranAt}}</td>
    </tr>
    <tr>
      <td style="padding:8px 0;color:#64748b">Format</td>
      <td style="padding:8px 0;text-transform:uppercase">{{format}}</td>
    </tr>
  </table>
  <hr style="border:none;border-top:1px solid #E2E8F0;margin:24px 0">
  <p style="color:#94a3b8;font-size:12px">
    This is an automated message from DataScriba. Do not reply to this e-mail.
  </p>
</body>
</html>
`

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name)
  private readonly template: Handlebars.TemplateDelegate
  private readonly transporter: nodemailer.Transporter | null = null

  constructor(private readonly config: ConfigService<WorkerEnv, true>) {
    this.template = Handlebars.compile(EMAIL_TEMPLATE_SOURCE)

    const smtpHost = config.get('SMTP_HOST', { infer: true })
    if (smtpHost) {
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: config.get('SMTP_PORT', { infer: true }),
        secure: false,
        auth: {
          user: config.get('SMTP_USER', { infer: true }),
          pass: config.get('SMTP_PASS', { infer: true }),
        },
      })
    }
  }

  async sendReportEmail(options: ReportEmailOptions): Promise<void> {
    if (!this.transporter) {
      this.logger.warn('SMTP not configured — skipping email notification')
      return
    }

    const html = this.template({
      reportName: options.reportName,
      ranAt: options.ranAt.toISOString(),
      format: options.format,
    })

    const mimeType =
      options.format === 'excel'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'text/csv'

    const from = this.config.get('SMTP_FROM', { infer: true })

    await this.transporter.sendMail({
      from: from ?? 'no-reply@datascriba.io',
      to: options.to,
      subject: `[DataScriba] Report Ready: ${options.reportName}`,
      html,
      attachments: [
        {
          filename: options.attachment.filename,
          content: options.attachment.content,
          contentType: mimeType,
        },
      ],
    })

    this.logger.log({ to: options.to, reportName: options.reportName }, 'Report email sent')
  }
}

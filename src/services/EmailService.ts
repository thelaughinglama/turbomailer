import nodemailer, { Transporter } from 'nodemailer';
import { Worker, Queue, JobsOptions, QueueEvents, Job } from 'bullmq';
import { EmailOptions, QueueOptions, EmailServiceConfig, QueueStatus } from '../types/types';
import { Logger } from '../utils/Logger';
import { Monitor } from '../utils/Monitor';
import { Redis, RedisOptions } from 'ioredis';
import { EventEmitter } from 'events';

export class EmailService {
  private transporter: Transporter;
  private queue: Queue;
  private worker?: Worker;
  private logger: Logger;
  private monitor: Monitor;
  private config: EmailServiceConfig;
  private redisConnection: Redis;
  private queueEvents: QueueEvents;
  public eventEmitter: EventEmitter;

  constructor(config: EmailServiceConfig, startWorker: boolean = true) {
    this.config = config;
    this.validateConfig();
    this.logger = new Logger(config.logLevel || 'info');
    this.monitor = new Monitor();
    this.transporter = nodemailer.createTransport(config.transporter);

    // Initialize Redis connection with user-provided config or default to localhost
    const redisOptions: RedisOptions = {
      host: config.redis?.host || '127.0.0.1',
      port: config.redis?.port || 6379,
      maxRetriesPerRequest: null, // Important for BullMQ compatibility
      ...config.redis,
    };
    this.redisConnection = new Redis(redisOptions);

    this.queue = new Queue('emailQueue', { connection: this.redisConnection });
    this.queueEvents = new QueueEvents('emailQueue', { connection: this.redisConnection });
    this.eventEmitter = new EventEmitter();

    if (startWorker) {
      this.worker = new Worker(
        'emailQueue',
        async job => {
          await this.processEmail(job.data.emailOptions);
        },
        {
          connection: this.redisConnection,
          concurrency: config.concurrency || 5,
        }
      );
    }

    this.setupEventHandlers();
    this.handleGracefulShutdown();
  }

  private validateConfig(): void {
    if (!this.config.transporter) {
      throw new Error('Transporter configuration is required.');
    }
  }

  private setupEventHandlers(): void {
    if (this.worker) {
      this.worker.on('completed', async (job: Job, returnvalue: any) => {
        if (job.name === 'sendEmail') {
          this.logger.info(`Email sent: Job ID ${job.id}`);
          this.monitor.incrementSuccess();
          this.eventEmitter.emit('completed', { jobId: job.id, emailOptions: job.data.emailOptions });
        }
      });

      this.worker.on('failed', async (job: Job<any, any, string> | undefined, err: Error) => {
        if (!job) {
          this.logger.error(`Job is undefined. Reason: ${err.message}`);
          return;
        }

        if (job.name === 'sendEmail') {
          this.logger.error(`Email failed: Job ID ${job.id}, Reason: ${err.message}`);
          this.monitor.incrementFailure();
          this.eventEmitter.emit('failed', { jobId: job.id, failedReason: err.message, emailOptions: job.data.emailOptions });
        }
      });

      this.worker.on('error', err => {
        this.logger.error(`Worker error: ${err.message}`);
        this.eventEmitter.emit('error', err);
      });
    }

    this.queueEvents.on('error', err => {
      this.logger.error(`QueueEvents error: ${err.message}`);
      this.eventEmitter.emit('error', err);
    });

    // Start listening to the queue events
    this.queueEvents.waitUntilReady().catch(err => {
      this.logger.error(`QueueEvents could not start: ${err.message}`);
    });
  }

  public async sendEmail(emailOptions: EmailOptions, queueOptions?: QueueOptions): Promise<void> {
    if (queueOptions) {
      await this.queueEmail(emailOptions, queueOptions);
    } else {
      await this.processEmail(emailOptions);
    }
  }

  public async queueEmail(emailOptions: EmailOptions, queueOptions?: QueueOptions): Promise<void> {
    const jobOptions: JobsOptions = {
      attempts: this.config.retryLimit || 3,
      backoff: {
        type: 'exponential',
        delay: this.config.backoffStrategy || 5000,
      },
      priority: this.getPriority(emailOptions.priority),
      removeOnComplete: true,
      removeOnFail: false,
      ...queueOptions,
    };

    await this.queue.add('sendEmail', { emailOptions }, jobOptions);
    this.logger.info(`Email queued: ${emailOptions.subject}`);
  }

  public async getQueueStatus(): Promise<QueueStatus> {
    const counts = await this.queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');

    return {
      waiting: counts.waiting || 0,
      active: counts.active || 0,
      completed: counts.completed || 0,
      failed: counts.failed || 0,
      delayed: counts.delayed || 0,
    };
  }

  private async processEmail(emailOptions: EmailOptions): Promise<void> {
    try {
      await this.transporter.sendMail(emailOptions);
      this.monitor.incrementProcessed();
      this.logger.info(`Email processed: ${emailOptions.subject}`);
    } catch (error: any) {
      this.logger.error(`Failed to send email: ${error.message}`);
      throw error;
    }
  }

  private getPriority(priority?: 'high' | 'normal' | 'low'): number {
    switch (priority) {
      case 'high':
        return 1;
      case 'low':
        return 10;
      default:
        return 5;
    }
  }

  private handleGracefulShutdown(): void {
    const shutdownSignals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGQUIT'];

    shutdownSignals.forEach(signal => {
      process.on(signal, async () => {
        this.logger.info(`Received ${signal}. Shutting down gracefully...`);
        await this.close();
        process.exit(0);
      });
    });
  }

  public async close(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker.removeAllListeners();
    }
    await this.queueEvents.close();
    await this.queue.close();
    await this.redisConnection.quit();
    this.queueEvents.removeAllListeners();
    this.eventEmitter.removeAllListeners();
    this.logger.info('EmailService has been closed.');
  }
}

import { EmailService } from '../src/services/EmailService';
import { EmailOptions, EmailServiceConfig } from '../src/types/types';
import nodemailer from 'nodemailer';
import { mocked } from 'jest-mock';

jest.mock('nodemailer');
const mockedNodemailer = mocked(nodemailer, { shallow: false });

describe('EmailService', () => {
  let emailService: EmailService;

  const mockSendMail = jest.fn().mockResolvedValue('Email sent');

  beforeAll(() => {
    mockedNodemailer.createTransport.mockReturnValue({
      sendMail: mockSendMail,
    } as any);
  });

  afterEach(async () => {
    if (emailService) {
      await emailService.close();
    }
    jest.clearAllMocks();
  });

  it('should send an email immediately', async () => {
    const config: EmailServiceConfig = {
      transporter: {
        host: 'smtp.test.com',
        port: 587,
        secure: false,
        auth: {
          user: 'test_user',
          pass: 'test_pass',
        },
      },
      concurrency: 2,
      retryLimit: 2, // Allow initial attempt + one retry
      backoffStrategy: 1000,
      logLevel: 'info',
      redis: {
        host: 'localhost',
        port: 6379,
      },
    };

    emailService = new EmailService(config);

    const emailOptions: EmailOptions = {
      from: 'sender@test.com',
      to: 'recipient@test.com',
      subject: 'Test Email Immediate',
      text: 'This is a test email.',
    };

    await emailService.sendEmail(emailOptions);

    expect(mockSendMail).toHaveBeenCalledWith(emailOptions);
  });

  it('should delay an email', async () => {
    const config: EmailServiceConfig = {
      transporter: {
        host: 'smtp.test.com',
        port: 587,
        secure: false,
        auth: {
          user: 'test_user',
          pass: 'test_pass',
        },
      },
      concurrency: 2,
      retryLimit: 2, // Allow initial attempt + one retry
      backoffStrategy: 1000,
      logLevel: 'info',
      redis: {
        host: 'localhost',
        port: 6379,
      },
    };

    emailService = new EmailService(config);

    const emailOptions: EmailOptions = {
      from: 'sender@test.com',
      to: 'recipient@test.com',
      subject: 'Queued Email',
      text: 'This email is queued.',
    };

    await emailService.queueEmail(emailOptions, { delay: 300, removeOnComplete: false });

    const status = await emailService.getQueueStatus();
    expect(status.delayed).toBeGreaterThan(0);
  });

  it('should process queued emails', async () => {
    const config: EmailServiceConfig = {
      transporter: {
        host: 'smtp.test.com',
        port: 587,
        secure: false,
        auth: {
          user: 'test_user',
          pass: 'test_pass',
        },
      },
      concurrency: 2,
      retryLimit: 2, // Allow initial attempt + one retry
      backoffStrategy: 1000,
      logLevel: 'info',
      redis: {
        host: 'localhost',
        port: 6379,
      },
    };

    emailService = new EmailService(config);

    const emailOptions: EmailOptions = {
      from: 'sender@test.com',
      to: 'recipient@test.com',
      subject: 'Queued Email Processing',
      text: 'Processing queued email.',
    };

    const eventPromise = new Promise<void>((resolve, reject) => {
      emailService.eventEmitter.once('completed', async ({ jobId, emailOptions: receivedOptions }) => {
        try {
          expect(mockSendMail).toHaveBeenCalledWith(emailOptions);
          expect(receivedOptions).toEqual(emailOptions);
          const status = await emailService.getQueueStatus();
          expect(status.completed).toBeGreaterThanOrEqual(1);
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });

    await emailService.queueEmail(emailOptions, { removeOnComplete: false });
    await eventPromise;
  });

  it('should retry failed emails', async () => {
    const config: EmailServiceConfig = {
      transporter: {
        host: 'smtp.test.com',
        port: 587,
        secure: false,
        auth: {
          user: 'test_user',
          pass: 'test_pass',
        },
      },
      concurrency: 2,
      retryLimit: 2, // Allow initial attempt + one retry
      backoffStrategy: 1000,
      logLevel: 'info',
      redis: {
        host: 'localhost',
        port: 6379,
      },
    };

    emailService = new EmailService(config);

    mockSendMail.mockRejectedValueOnce(new Error('SMTP Error')).mockResolvedValueOnce('Email sent');

    const emailOptions: EmailOptions = {
      from: 'sender@test.com',
      to: 'recipient@test.com',
      subject: 'Retry Email',
      text: 'This email should be retried.',
    };

    const eventPromise = new Promise<void>((resolve, reject) => {
      emailService.eventEmitter.once('completed', async ({ jobId }) => {
        try {
          expect(mockSendMail).toHaveBeenCalledTimes(2);
          const status = await emailService.getQueueStatus();
          expect(status.failed).toBe(0);
          expect(status.completed).toBeGreaterThanOrEqual(1);
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });

    await emailService.queueEmail(emailOptions);
    await eventPromise;
  });

  it('should respect email priority', async () => {
    const config: EmailServiceConfig = {
      transporter: {
        host: 'smtp.test.com',
        port: 587,
        secure: false,
        auth: {
          user: 'test_user',
          pass: 'test_pass',
        },
      },
      concurrency: 2,
      retryLimit: 2, // Allow initial attempt + one retry
      backoffStrategy: 1000,
      logLevel: 'info',
      redis: {
        host: 'localhost',
        port: 6379,
      },
    };

    emailService = new EmailService(config);

    const highPriorityEmail: EmailOptions = {
      from: 'sender@test.com',
      to: 'recipient@test.com',
      subject: 'High Priority Email',
      text: 'This is a high priority email.',
      priority: 'high',
    };

    const lowPriorityEmail: EmailOptions = {
      from: 'sender@test.com',
      to: 'recipient@test.com',
      subject: 'Low Priority Email',
      text: 'This is a low priority email.',
      priority: 'low',
    };

    let callCount = 0;

    const eventPromise = new Promise<void>((resolve, reject) => {
      emailService.eventEmitter.on('completed', async ({ jobId, emailOptions }) => {
        callCount++;
        if (callCount === 2) {
          try {
            expect(mockSendMail).toHaveBeenNthCalledWith(1, highPriorityEmail);
            expect(mockSendMail).toHaveBeenNthCalledWith(2, lowPriorityEmail);
            resolve();
          } catch (error) {
            reject(error);
          }
        }
      });
    });

    await emailService.queueEmail(lowPriorityEmail);
    await emailService.queueEmail(highPriorityEmail);
    await eventPromise;
  });

  it('should get queue status', async () => {
    const config: EmailServiceConfig = {
      transporter: {
        host: 'smtp.test.com',
        port: 587,
        secure: false,
        auth: {
          user: 'test_user',
          pass: 'test_pass',
        },
      },
      concurrency: 2,
      retryLimit: 2, // Allow initial attempt + one retry
      backoffStrategy: 1000,
      logLevel: 'info',
      redis: {
        host: 'localhost',
        port: 6379,
      },
    };

    emailService = new EmailService(config);

    const status = await emailService.getQueueStatus();
    expect(status).toHaveProperty('waiting');
    expect(status).toHaveProperty('active');
    expect(status).toHaveProperty('completed');
    expect(status).toHaveProperty('failed');
    expect(status).toHaveProperty('delayed');
  });
});

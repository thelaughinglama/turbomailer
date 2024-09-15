export interface EmailOptions {
  from: string;
  to: string;
  subject: string;
  text?: string;
  html?: string;
  attachments?: any[];
  priority?: 'high' | 'normal' | 'low';
}

export interface QueueOptions {
  priority?: number;
  delay?: number;
  removeOnComplete?: boolean
}

export interface TransporterConfig {
  [key: string]: any;
}

export interface EmailServiceConfig {
  transporter: TransporterConfig;
  concurrency?: number;
  retryLimit?: number;
  backoffStrategy?: number;
  logLevel?: 'error' | 'warn' | 'info' | 'verbose' | 'debug' | 'silly';
  redis?: {
    host?: string;
    port?: number;
    password?: string;
    db?: number;
  };
}

export interface QueueStatus {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

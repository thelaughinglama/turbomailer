
<img src="https://i.ibb.co/D8cmwB5/turbomailer-removebg.png" alt="TurboMailer Logo" width="200"/>

**A robust, scalable, and high-throughput email processing service built with Node.js, BullMQ, Redis, and Nodemailer. TurboMailer allows you to send emails efficiently, handle retries, manage priorities, and monitor queue status with ease.**




![GitHub Workflow Status](https://github.com/thelaughinglama/turbomailer/actions/workflows/main.yml/badge.svg) [![coverage](https://codecov.io/github/thelaughinglama/turbomailer/graph/badge.svg?token=ECD82MHQF2)](https://codecov.io/github/thelaughinglama/turbomailer)


## Table of Contents
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Getting Started](#getting-started)
  - [Configuration](#configuration)
  - [Creating an EmailService Instance](#creating-an-emailservice-instance)
- [Usage](#usage)
  - [Sending an Email Immediately](#sending-an-email-immediately)
  - [Queueing an Email](#queueing-an-email)
  - [Processing Queued Emails](#processing-queued-emails)
  - [Handling Email Priorities](#handling-email-priorities)
  - [Delaying Email Delivery](#delaying-email-delivery)
  - [Monitoring Queue Status](#monitoring-queue-status)
  - [Graceful Shutdown](#graceful-shutdown)
- [Configuration Options](#configuration-options)
  - [EmailServiceConfig](#emailserviceconfig)
  - [EmailOptions](#emailoptions)
  - [QueueOptions](#queueoptions)
- [Advanced Usage](#advanced-usage)
  - [Error Handling](#error-handling)
  - [Event Handling](#event-handling)
  - [Custom Redis Configuration](#custom-redis-configuration)
- [Example](#example)
- [Testing](#testing)

## Features
- **Asynchronous Email Processing**: Offload email sending to a queue to improve application responsiveness.
- **High Throughput**: Efficiently handle thousands of emails concurrently using BullMQ and Redis.
- **Retry Mechanism**: Automatic retries with customizable backoff strategies for transient failures.
- **Priority Handling**: Assign priorities to emails to ensure critical messages are sent first.
- **Delayed Emails**: Schedule emails to be sent at a later time.
- **Monitoring**: Retrieve queue status and monitor email processing metrics.
- **Graceful Shutdown**: Safely close connections and workers on application termination.

## Prerequisites
- **Node.js**: Version 14 or higher.
- **Redis Server**: Version 6.2.0 or higher (required by BullMQ 5.x).
- **SMTP Server Credentials**: Access to an SMTP server for sending emails.

## Installation
Install TurboMailer via npm:
```bash
npm install turbomailer
```

## Getting Started

### Configuration
Before using TurboMailer, you need to configure it with your SMTP and Redis settings.

- **SMTP Configuration**: Used by Nodemailer to send emails.
- **Redis Configuration**: Used by BullMQ for job queueing.

### Creating an EmailService Instance

```typescript
import { EmailService, EmailServiceConfig } from 'turbomailer';

const config: EmailServiceConfig = {
  transporter: {
    host: 'smtp.yourserver.com',
    port: 587,
    secure: false, // true for port 465, false for other ports
    auth: {
      user: 'your_username',
      pass: 'your_password',
    },
  },
  concurrency: 5, // Number of concurrent email processing jobs
  retryLimit: 3,  // Number of retries for failed emails
  backoffStrategy: 5000, // Delay between retries in milliseconds
  logLevel: 'info', // 'error' | 'warn' | 'info' | 'verbose' | 'debug' | 'silly'
  redis: {
    host: 'localhost',
    port: 6379,
  },
};

const emailService = new EmailService(config);
```
## Usage

### Sending an Email Immediately

```typescript
const emailOptions = {
  from: 'no-reply@yourdomain.com',
  to: 'recipient@example.com',
  subject: 'Welcome to Our Service',
  text: 'Thank you for signing up!',
};

await emailService.sendEmail(emailOptions);
```
### Queueing an Email

To queue an email for asynchronous processing:

```typescript
await emailService.queueEmail(emailOptions);
```
### Processing Queued Emails

TurboMailer automatically processes queued emails using the worker initialized during instantiation. You can adjust the concurrency level in the configuration.

### Handling Email Priorities

Assign priorities to ensure critical emails are sent first:

```typescript
const highPriorityEmail = {
  ...emailOptions,
  priority: 'high', // 'high' | 'normal' | 'low'
};

await emailService.queueEmail(highPriorityEmail);
```

### Delaying Email Delivery

Schedule an email to be sent after a certain delay:

```typescript
await emailService.queueEmail(emailOptions, {
  delay: 60000, // Delay in milliseconds (e.g., 60000ms = 1 minute)
});
```
### Monitoring Queue Status

Retrieve the current status of the email queue:

```typescript
const status = await emailService.getQueueStatus();
console.log(status);
/*
{
  waiting: 5,
  active: 2,
  completed: 10,
  failed: 1,
  delayed: 3,
}
*/
```
### Graceful Shutdown

Ensure all resources are properly closed when shutting down your application:

```typescript
await emailService.close();
```

## Configuration Options

### EmailServiceConfig

| Property          | Type                         | Required | Description                                                                 |
|-------------------|------------------------------|----------|-----------------------------------------------------------------------------|
| transporter       | `TransporterConfig`           | Yes      | SMTP configuration object used by Nodemailer.                               |
| concurrency       | `number`                     | No       | Number of concurrent email processing jobs (default: 5).                    |
| retryLimit        | `number`                     | No       | Number of retries for failed emails (default: 3).                           |
| backoffStrategy   | `number`                     | No       | Delay between retries in milliseconds (default: 5000).                      |
| logLevel          | `'error' \| 'warn' \| 'info' \| 'debug'` | No       | Logging level for the internal logger (default: 'info').                   |
| redis             | `RedisOptions`               | No       | Redis connection options. Defaults to `{ host: '127.0.0.1', port: 6379 }`. |

Example:

```typescript
const config: EmailServiceConfig = {
  transporter: {
    host: 'smtp.yourserver.com',
    port: 465,
    secure: true,
    auth: {
      user: 'your_username',
      pass: 'your_password',
    },
  },
  concurrency: 10,
  retryLimit: 5,
  backoffStrategy: 10000,
  logLevel: 'debug',
  redis: {
    host: 'redis-server',
    port: 6380,
    password: 'your_redis_password',
    db: 1,
  },
};
```

### EmailOptions

| Property    | Type                         | Required | Description                                                |
|-------------|------------------------------|----------|------------------------------------------------------------|
| from        | `string`                     | Yes      | Sender's email address.                                    |
| to          | `string`                     | Yes      | Recipient's email address.                                 |
| subject     | `string`                     | Yes      | Email subject line.                                        |
| text        | `string`                     | No       | Plain text version of the email content.                   |
| html        | `string`                     | No       | HTML version of the email content.                         |
| attachments | `Attachment[]`               | No       | Array of attachment objects as per Nodemailer specifications.|
| priority    | `'high' \| 'normal' \| 'low'` | No       | Email priority level (default: 'normal').                  |

Example:

```typescript
const emailOptions = {
  from: 'no-reply@yourdomain.com',
  to: 'user@example.com',
  subject: 'Account Activation',
  html: '<h1>Activate Your Account</h1><p>Please click the link below to activate your account.</p>',
  priority: 'high',
};
```
### QueueOptions

| Property        | Type     | Required | Description                                                        |
|-----------------|----------|----------|--------------------------------------------------------------------|
| priority        | `number` | No       | Custom priority value (1 is highest).                              |
| delay           | `number` | No       | Delay before the job becomes active, in milliseconds.              |
| removeOnComplete| `boolean`| No       | Whether to remove the job from the queue upon completion (default: true). |

Example:

```typescript
const queueOptions = {
  priority: 1,            // High priority
  delay: 300000,          // Delay of 5 minutes
  removeOnComplete: false, // Keep the job in the queue after completion
};
```
## Advanced Usage

### Error Handling

Handle errors gracefully using try-catch blocks:

```typescript
try {
  await emailService.sendEmail(emailOptions);
} catch (error) {
  console.error('Failed to send email:', error.message);
}
```

### Event Handling

Listen to events emitted by TurboMailer for custom actions:

```typescript
emailService.eventEmitter.on('completed', ({ jobId, emailOptions }) => {
  console.log(`Email sent successfully: Job ID ${jobId}`);
});

emailService.eventEmitter.on('failed', ({ jobId, failedReason, emailOptions }) => {
  console.error(`Email failed: Job ID ${jobId}, Reason: ${failedReason}`);
});

emailService.eventEmitter.on('error', err => {
  console.error('Worker error:', err.message);
});
```
### Custom Redis Configuration

Customize the Redis connection by providing additional options:

```typescript
const config: EmailServiceConfig = {
  // ... other configurations
  redis: {
    host: 'custom-redis-host',
    port: 6380,
    password: 'your_redis_password',
    db: 2,
    tls: {
      // TLS/SSL options if needed
    },
  },
};
```

## Example

Here's a complete example demonstrating how to set up and use TurboMailer:

```typescript
import { EmailService, EmailServiceConfig } from 'turbomailer';

const config: EmailServiceConfig = {
  transporter: {
    host: 'smtp.mailtrap.io',
    port: 2525,
    auth: {
      user: 'your_mailtrap_username',
      pass: 'your_mailtrap_password',
    },
  },
  concurrency: 3,
  retryLimit: 2,
  backoffStrategy: 2000,
  logLevel: 'info',
  redis: {
    host: 'localhost',
    port: 6379,
  },
};

(async () => {
  const emailService = new EmailService(config);

  const emailOptions = {
    from: 'no-reply@example.com',
    to: 'user@example.com',
    subject: 'Welcome!',
    text: 'Thank you for joining our service.',
  };

  // Send email immediately
  await emailService.sendEmail(emailOptions);

  // Queue email with delay
  await emailService.queueEmail(emailOptions, { delay: 60000 });

  // Listen for completion events
  emailService.eventEmitter.on('completed', ({ jobId, emailOptions }) => {
    console.log(`Email sent: Job ID ${jobId}`);
  });

  // Retrieve queue status
  const status = await emailService.getQueueStatus();
  console.log('Queue Status:', status);

  // Close the service when done
  await emailService.close();
})();
```
## Testing

TurboMailer includes comprehensive unit tests to ensure reliability.

### Running Tests:

Make sure Redis is running before executing the tests:

```bash
npm test
```

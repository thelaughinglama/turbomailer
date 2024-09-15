import { createLogger, format, transports, Logger as WinstonLogger } from 'winston';

export class Logger {
  private logger: WinstonLogger;

  constructor(level: string) {
    this.logger = createLogger({
      level,
      format: format.combine(format.timestamp(), format.json()),
      transports: [new transports.Console()],
    });
  }

  public info(message: string): void {
    this.logger.info(message);
  }

  public error(message: string): void {
    this.logger.error(message);
  }

  public debug(message: string): void {
    this.logger.debug(message);
  }
}

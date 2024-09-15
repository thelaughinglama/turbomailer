export class Monitor {
  private emailsProcessed: number = 0;
  private failures: number = 0;
  private successes: number = 0;

  public incrementProcessed(): void {
    this.emailsProcessed++;
  }

  public incrementFailure(): void {
    this.failures++;
  }

  public incrementSuccess(): void {
    this.successes++;
  }

  public getMetrics() {
    return {
      emailsProcessed: this.emailsProcessed,
      failures: this.failures,
      successes: this.successes,
    };
  }
}

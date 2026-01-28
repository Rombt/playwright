

export class RateLimiter {
  private lastRun = 0;

  constructor(private readonly intervalMs: number) {}

  async wait(): Promise<void> {
    const now = Date.now();
    const delta = now - this.lastRun;

    if (delta < this.intervalMs) {
      await new Promise(res => setTimeout(res, this.intervalMs - delta));
    }

    this.lastRun = Date.now();
  }
}
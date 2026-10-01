export class FatalError extends Error {
  readonly type = 'fatal';

  constructor(message: string) {
    super(message);
    this.name = 'FatalError';
  }
}

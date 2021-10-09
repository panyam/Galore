export class ParseError extends Error {
  message: string;
  constructor(public offset: number, message: string) {
    super(`Parse Error at (${offset}): ${message}`);
    Object.setPrototypeOf(this, new.target.prototype);
  }

  get name(): string {
    return this.constructor.name;
  }
}

export class ParseError extends Error {
  constructor(
    message: string,
    public type: string,
    public value: any = null,
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }

  get name(): string {
    return this.constructor.name;
  }
}

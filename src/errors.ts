export class TokenizerError extends Error {
  readonly name: string = "TokenizerError";

  constructor(public offset: number, public length: number, public type: string, public value: any = null) {
    super(`Tokenizer Error (${offset}-${offset + length}): ${type}`);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ParseError extends Error {
  constructor(public type: string, public value: any = null) {
    super(`ParseError(${type})`);
    Object.setPrototypeOf(this, new.target.prototype);
  }

  get name(): string {
    return this.constructor.name;
  }
}

/**
 * Error thrown when parsing fails.
 *
 * @example
 * ```typescript
 * import { newParser, ParseError } from "galore";
 *
 * try {
 *   const result = parser.parse("invalid input");
 * } catch (err) {
 *   if (err instanceof ParseError) {
 *     console.log(err.type);   // "UnexpectedToken"
 *     console.log(err.value);  // { state, token }
 *   }
 * }
 * ```
 */
export class ParseError extends Error {
  /**
   * Creates a new ParseError.
   *
   * @param message - Human-readable error description
   * @param type - Error type identifier (e.g., "UnexpectedToken")
   * @param value - Additional context about the error
   */
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

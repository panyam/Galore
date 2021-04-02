import * as TSU from "@panyam/tsutils";
import { Token } from "./tokenizer";

export class ParseError extends Error {
  index: number;
  readonly name: string = "ParseError";

  constructor(index: number, message: string) {
    super(`Parse Error at (${index}): ${message}`);
    this.index = index;
  }
}

export class UnexpectedTokenError extends ParseError {
  foundToken: TSU.Nullable<Token>;
  expectedTokens: Token[];
  readonly name: string = "UnexpectedTokenError";

  constructor(foundToken: TSU.Nullable<Token>, ...expectedTokens: Token[]) {
    super(
      foundToken?.offset || 0,
      `Found Token: ${foundToken?.tag || "EOF"} (${foundToken?.value || ""}), Expected: ${expectedTokens
        .map((t) => t.tag)
        .join(", ")}`,
    );
    this.foundToken = foundToken;
    this.expectedTokens = expectedTokens;
  }
}

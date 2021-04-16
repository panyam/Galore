/**
 * A Tape of characters we would read with some extra helpers like rewinding
 * forwarding and prefix checking that is fed into the different tokenizers
 * used by the scannerless parsers.
 */
export class Tape {
  lineLengths: number[] = [];
  index = 0;
  input: string;

  constructor(input: string) {
    this.input = input;
  }

  push(content: string): void {
    this.input += content;
  }

  substring(startIndex: number, endIndex: number): string {
    return this.input.substring(startIndex, endIndex);
  }

  advance(delta = 1): this {
    this.index += delta;
    return this;
  }

  /**
   * Advances the tape to the end of the first occurence of the given pattern.
   */
  advanceAfter(pattern: string, ensureNoPrefixSlash = true): number {
    const newPos = this.advanceTill(pattern, ensureNoPrefixSlash);
    if (newPos >= 0) {
      this.index += pattern.length;
    }
    return this.index;
  }

  /**
   * Advances the tape till the start of a given pattern.
   */
  advanceTill(pattern: string, ensureNoPrefixSlash = true): number {
    let lastIndex = this.index;
    while (true) {
      const endIndex = this.input.indexOf(pattern, lastIndex);
      if (endIndex < 0) {
        throw new Error(`Unexpected end of input before (${pattern})`);
      } else if (ensureNoPrefixSlash) {
        let numSlashes = 0;
        for (let i = endIndex - 1; i >= 0; i--) {
          if (this.input[i] == "\\") numSlashes++;
          else break;
        }
        if (numSlashes % 2 == 0) {
          // even number of slashes mean we are fine
          // found a match
          this.index = endIndex;
          return endIndex;
        }
        lastIndex = endIndex + 1;
      } else {
        // found a match
        this.index = endIndex;
        return endIndex;
      }
    }
  }

  /**
   * Tells if the given prefix is matche at the current position of the tokenizer.
   */
  matches(prefix: string, advance = true): boolean {
    const lastIndex = this.index;
    let i = 0;
    let success = true;
    for (; i < prefix.length; i++) {
      if (prefix[i] != this.nextCh()) {
        success = false;
        break;
      }
    }
    // Reset pointers if we are only peeking or match failed
    if (!advance || !success) {
      this.index = lastIndex;
    }
    return success;
  }

  get hasMore(): boolean {
    return this.index < this.input.length;
  }

  get currCh(): string {
    if (!this.hasMore) return "";
    return this.input[this.index];
  }

  get currChCode(): number {
    if (!this.hasMore) return -1;
    return this.input.charCodeAt(this.index);
  }

  nextCh(): string {
    if (!this.hasMore) return "";
    const ch = this.input[this.index++];
    /*
    this.currCol++;
    if (ch == "\n" || ch == "\r") {
      this.lineLengths[this.currLine] = this.currCol + 1;
      this.currCol = 0;
      this.currLine++;
    }
    */
    return ch;
  }

  rewind(): boolean {
    //
    this.index--;
    /*
    if (this.currCol > 0) this.currCol--;
    else {
      this.currLine--;
      this.currCol = this.lineLengths[this.currLine] - 1;
    }
    */
    return true;
  }
}

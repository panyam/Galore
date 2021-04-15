import * as TSU from "@panyam/tsutils";
import { CharTape } from "./tape";

export enum OpCode {
  Match,
  Noop,
  Any,
  StartOfInput,
  EndOfInput,
  Char,
  CharClass,
  Save,
  Split,
  Jump,
  JumpIfLt,
  JumpIfGt,
  RegAcquire,
  RegInc,
  RegRelease,
}

export class Prog {
  instrs: Instr[] = [];

  get length(): number {
    return this.instrs.length;
  }

  add(opcode: OpCode, ...args: number[]): Instr {
    const out = new Instr(opcode).add(...args);
    out.offset = this.instrs.length;
    this.instrs.push(out);
    return out;
  }

  debugValue(): any {
    return this.instrs.map((instr, index) => `L${index}: ${instr.debugValue}`);
  }
}

/**
 * A thread that is performing an execution of the regex VM.
 */
class Thread {
  /**
   * Saved positions into the input stream for the purpose of
   * partial and custom matches.
   */
  positions: number[] = [];
  registers: TSU.NumMap<number> = {};

  /**
   * Create a thread at the given offset
   */
  constructor(public readonly offset: number = 0) {}

  jumpBy(delta = 1): Thread {
    return this.jumpTo(this.offset + delta);
  }

  jumpTo(newOffset: number): Thread {
    const out = new Thread(newOffset);
    out.positions = this.positions;
    out.registers = this.registers;
    return out;
  }

  forkTo(newOffset: number): Thread {
    const out = new Thread(newOffset);
    out.positions = [...this.positions];
    out.registers = { ...this.registers };
    return out;
  }

  regIncr(regId: number): void {
    if (!(regId in this.registers)) {
      throw new Error(`Register at offset ${regId} is invalid`);
    }
    this.registers[regId]++;
  }

  regAcquire(regId: number): void {
    if (regId in this.registers) {
      throw new Error(`Register at offset ${regId} already acquired.  Release it first`);
    }
    this.registers[regId] = 0;
  }

  regRelease(regId: number): void {
    if (!(regId in this.registers)) {
      throw new Error(`Register at offset ${regId} is invalid`);
    }
    delete this.registers[regId];
  }

  regValue(regId: number): number {
    if (!(regId in this.registers)) {
      throw new Error(`Register at offset ${regId} is invalid`);
    }
    return this.registers[regId];
  }
}

export class Instr {
  offset = 0;
  comment: string;
  args: number[] = [];
  constructor(public readonly opcode: OpCode) {}

  add(...args: number[]): this {
    this.args.push(...args);
    return this;
  }

  debugValue(): any {
    switch (this.opcode) {
      case OpCode.Match:
        return `Match ${this.args[0]}`;
      case OpCode.Char:
        const start = this.args[0];
        const end = this.args[1];
        const s =
          start == end ? String.fromCharCode(start) : `${String.fromCharCode(start)}-${String.fromCharCode(end)}`;
        return `Char ${s}`;
      case OpCode.CharClass:
        let out = "CharClass ";
        for (let i = 0; i < this.args.length; i += 2) {
          out += this.args[i] + "-" + this.args[i + 1];
        }
        return out;
      case OpCode.Any:
        return ".";
      case OpCode.StartOfInput:
        return "^";
      case OpCode.EndOfInput:
        return "$";
      case OpCode.Save:
        return `Save ${this.args[0]}`;
      case OpCode.Split:
        return `Save ${this.args.join(", ")}`;
      case OpCode.Jump:
        return `Jump ${this.args[0]}`;
      case OpCode.JumpIfLt:
        return `JumpIfLt L${this.args[0]} ${this.args[1]} L${this.args[2]}`;
      case OpCode.JumpIfGt:
        return `JumpIfGt L${this.args[0]} ${this.args[1]} L${this.args[2]}`;
      case OpCode.RegAcquire:
        return `RegAcquire`;
      case OpCode.RegInc:
        return `RegInc L${this.args[0]}`;
      case OpCode.RegRelease:
        return `RegRelease L${this.args[0]}`;
    }
  }
}

export class VM {
  // TODO - To prevent excessive heap activity and GC
  // create a pool of threads and just have a cap on
  // match sizes
  // To eve simplify each Thread could just be something like:
  // number[] where
  //  number[0] == offset
  //  number[1-2*MaxSubs] = Substitutions
  //  number[2*MaxSubs - 2*MaxSubs + M] = Registers
  //      where M = Max number of NewReg instructions
  currThreads: Thread[] = [];
  nextThreads: Thread[] = [];

  // Records which "generation" of the match a particular
  // offset is in.  If a thread is added at a particular
  // offset the generation number is used to see if the
  // thread is a duplicate (and avoided if so).  This
  // ensures that are linearly bounded on the number of
  // number threads as we match.
  genForOffset: number[];
  gen = 0;
  constructor(public readonly prog: Prog) {
    this.genForOffset = [];
    prog.instrs.forEach(() => this.genForOffset.push(-1));
  }

  addThread(thread: Thread, list: Thread[], index: number): void {
    const threads = [thread];
    for (let i = 0; i < threads.length; i++) {
      thread = threads[i];
      if (this.genForOffset[thread.offset] == this.gen) {
        // duplicate
        continue;
      }
      this.genForOffset[thread.offset] = this.gen;
      const instr = this.prog.instrs[thread.offset];
      let newThread: Thread;
      switch (instr.opcode) {
        case OpCode.RegInc:
          thread.regIncr(instr.args[0]);
          threads.push(thread.jumpBy(1));
          break;
        case OpCode.RegRelease:
          thread.regRelease(instr.args[0]);
          threads.push(thread.jumpBy(1));
          break;
        case OpCode.RegAcquire:
          thread.regAcquire(instr.offset);
          threads.push(thread.jumpBy(1));
          break;
        case OpCode.Jump:
          threads.push(thread.jumpTo(instr.args[0]));
          break;
        case OpCode.JumpIfLt:
          {
            const [regOffset, checkValue, goto] = [instr.args[0], instr.args[1], instr.args[2]];
            const regValue = thread.regValue(regOffset);
            newThread = regValue < checkValue ? thread.jumpTo(goto) : thread.jumpBy(1);
            threads.push(newThread);
          }
          break;
        case OpCode.JumpIfGt:
          {
            const [regOffset, checkValue, goto] = [instr.args[0], instr.args[1], instr.args[2]];
            const regValue = thread.regValue(regOffset);
            newThread = regValue > checkValue ? thread.jumpTo(goto) : thread.jumpBy(1);
            threads.push(newThread);
          }
          break;
        case OpCode.Split:
          for (const newOff of instr.args) {
            threads.push(thread.jumpTo(newOff));
          }
          break;
        case OpCode.Save:
          newThread = thread.forkTo(thread.offset + 1);
          newThread.positions[instr.args[0]] = index;
          threads.push(newThread);
          break;
        default:
          list.push(thread);
          break;
      }
    }
  }

  /**
   * Runs the given instructions and returns a triple:
   * [matchId, matchStart, matchEnd]
   */
  run(tape: CharTape): [number, number, number] {
    let currMatch: [number, number, number] = [-1, -1, -1];
    this.currThreads = [];
    this.nextThreads = [];
    this.addThread(new Thread(0), this.currThreads, tape.index);
    const instrs = this.prog.instrs;
    for (const ch = tape.currChCode; ; tape.nextCh) {
      if (this.currThreads.length == 0) {
        break;
      }
      let matchedInGen = false;
      for (let i = 0; i < this.currThreads.length && !matchedInGen; i++) {
        const thread = this.currThreads[i];
        const instr = instrs[thread.offset];
        const opcode = instr.opcode;
        const args = instr.args;
        // Do char match based actions
        let advanceTape = false;
        if (tape.hasMore) {
          // See if we can do a match
          if (opcode == OpCode.Any) {
            advanceTape = true;
          } else if (opcode == OpCode.Char) {
            if (ch >= args[0] && ch <= args[1]) {
              // matched so add transition
              advanceTape = true;
            }
          } else if (opcode == OpCode.CharClass) {
            // TODO - Optimize with binary searches
            for (let a = 0; a < args.length; a += 2) {
              if (ch >= args[a] && ch <= args[a + 1]) {
                advanceTape = true;
                break;
              }
            }
          } else if (opcode == OpCode.StartOfInput) {
            // only proceed further if prev was a newline or start
            const prevCh = tape.input[tape.index - 1] || null;
            if (tape.index == 0 || prevCh == "\r" || prevCh == "\n" || prevCh == "\u2028" || prevCh == "\u2029") {
              // have a match so can go forwrd but dont advance tape on
              // the same generation
              this.addThread(thread.jumpBy(1), this.currThreads, tape.index);
            }
          }
        }
        // On end of input we dont advance tape but thread moves on
        // if at end of line boundary
        if (opcode == OpCode.EndOfInput) {
          // check if next is end of input
          const currCh = tape.currCh || null;
          if (currCh == "\r" || currCh == "\n" || currCh == "\u2028" || currCh == "\u2029" || !tape.hasMore) {
            this.addThread(thread.jumpBy(1), this.currThreads, tape.index);
          }
        }
        if (advanceTape) {
          this.addThread(thread.jumpBy(1), this.nextThreads, tape.index + 1);
        }
        if (opcode == OpCode.Match) {
          // we have a match on this thread so return it
          currMatch = [args[0], args[1], args[2]];
          matchedInGen = true;
          break;
        }
      }
      if (!tape.hasMore) break;
      this.nextGen();
    }
    return currMatch;
  }

  nextGen(): void {
    this.currThreads = this.nextThreads;
    this.nextThreads = [];
    this.gen++;
  }
}

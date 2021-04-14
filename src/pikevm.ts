import * as TSU from "@panyam/tsutils";
import { Expr, ExprType, Cat, Union, Quant, Char, CharClass } from "./regex";
import { CharTape } from "./tape";

enum OpCode {
  Match,
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

class Prog {
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

export function compileMulti(exprs: Expr[]): Prog {
  // Split across each of our expressions
  const out = new Prog();
  const split = out.add(OpCode.Split);
  exprs.forEach((expr, i) => {
    split.add(out.instrs.length);
    out.add(OpCode.Save, 0);
    compile(expr, out);
    out.add(OpCode.Save, 1);
    out.add(OpCode.Match, i);
  });
  // Add the error case to match -1 if nothing else matches
  // should technically never come here if atleast one rule matches
  out.add(OpCode.Save, 0);
  compile(Char.Any(), out);
  out.add(OpCode.Save, 1);
  out.add(OpCode.Match, -1);
  return out;
}

/**
 * Compile a given expression into a set of instructions.
 */
export function compile(expr: Expr, prog: Prog): number {
  const start = prog.length;
  if (expr.tag == ExprType.CHAR) {
    const char = expr as Char;
    prog.add(OpCode.Char, char.start, char.end);
  } else if (expr.tag == ExprType.CHAR_CLASS) {
    const instr = prog.add(OpCode.CharClass);
    for (const char of (expr as CharClass).chars) {
      instr.add(char.start, char.end);
    }
  } else if (expr.tag == ExprType.CAT) {
    const cat = expr as Cat;
    for (const child of cat.children) {
      compile(child, prog);
    }
  } else if (expr.tag == ExprType.UNION) {
    const union = expr as Union;
    const split = prog.add(OpCode.Split);
    const jumps: Instr[] = [];

    for (let i = 0; i < union.options.length; i++) {
      split.add(prog.length);
      compile(union.options[i], prog);
      if (i < union.options.length - 1) {
        jumps.push(prog.add(OpCode.Jump));
      }
    }
    for (const jmp of jumps) {
      jmp.add(prog.length);
    }
  } else if (expr.tag == ExprType.QUANT) {
    const quant = expr as Quant;

    // optionals allowed so create a split
    const split = quant.minCount <= 0 ? prog.add(OpCode.Split) : null;

    // For Expr{A,B} do something like:
    // L0: AcquireReg     # acquire new register at L0 and set value to 0
    // L1: CodeFor expr   # Emit code for expr
    // L2: ...
    // L5: ... Code for Expr ends here
    // L6: IncReg L0    # Increment value of register at L0
    //
    // # If value of register at L0 is < A jump to L1
    // L7: JumpIfLt L0, A, L1
    //
    // # If value of register at L0 is >= B jump to LX (after split)
    // L8: JumpIfGt L0, B - 1, L10
    //
    // # Repeat as we are between A and B
    // # Ofcourse swap L1 and L10 if match is not greedy
    // L9: Split L1, L10
    //
    // L10: ReleaseReg L0 # Release register - no longer used
    //
    // In the above if A == 0 then insert a Split L11 before L0 above
    const l0 = prog.add(OpCode.RegAcquire).offset;
    const l1 = prog.length;
    compile(quant.expr, prog);

    // Increment match count
    prog.add(OpCode.RegInc, l0);

    // Next two jumps perform if (A <= val <= B) ...
    prog.add(OpCode.JumpIfLt, l0, quant.minCount, l1);
    const jumpIfGt = prog.add(OpCode.JumpIfGt, l0, quant.maxCount - 1 /* Add L10 here */);

    // Have the option of repeat if we are here
    const split2 = prog.add(OpCode.Split);

    // Release the register for reuse
    const lEnd = prog.add(OpCode.RegRelease, l0).offset;
    jumpIfGt.add(lEnd);
    split2.add(lEnd);

    if (split != null) split.add(prog.length);
  } else {
    throw new Error("Expr Type yet supported: " + expr.tag);
  }
  return prog.length - start;
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

class Instr {
  offset = 0;
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
        return `Char ${new Char(this.args[0], this.args[1]).debugValue}`;
      case OpCode.CharClass:
        let out = "CharClass ";
        for (let i = 0; i < this.args.length; i += 2) {
          out += this.args[i] + "-" + this.args[i + 1];
        }
        return out;
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
        if (opcode == OpCode.Char || opcode == OpCode.CharClass) {
          // See if we can do a match
          if (tape.hasMore) {
            if (opcode == OpCode.Char) {
              if (ch >= args[0] && ch <= args[1]) {
                // matched so add transition
                this.addThread(thread.jumpBy(1), this.nextThreads, tape.index + 1);
              } else {
                // TODO - Optimize with binary searches
                for (let a = 0; a < args.length; a += 2) {
                  if (ch >= args[a] && ch <= args[a + 1]) {
                    this.addThread(thread.jumpBy(1), this.nextThreads, tape.index + 1);
                    break;
                  }
                }
              }
            }
          } else {
            // TODO - match end of input
          }
        } else if (opcode == OpCode.Match) {
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

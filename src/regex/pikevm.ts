import * as TSU from "@panyam/tsutils";
import { Tape } from "../tape";
import { Rule, RegexType, Quant, Regex, Cat, Char, CharClass, Ref, LookAhead, LookBack, Union } from "./core";
import { Prog, Instr, Match, VM as VMBase } from "./vm";

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
  RegSave,
  Begin,
  End,
}

type RuleResolver = (name: string) => Rule;
type CompilerListener = (expr: Regex, prog: Prog, start: number, length: number) => void;

export class Compiler {
  constructor(
    public exprResolver: TSU.Nullable<RuleResolver>,
    public listener: TSU.Nullable<CompilerListener> = null,
  ) {}

  compile(rules: Rule[]): Prog {
    // Split across each of our expressions
    const out = new Prog();
    // only add the split instruction if we have more than one rule
    const split: Instr = rules.length <= 1 ? new Instr(OpCode.Split) : out.add(OpCode.Split);
    rules.forEach((rule, i) => {
      if (rule.tokenType != null) {
        split.add(out.instrs.length);
        this.compileExpr(rule.expr, out);
        out.add(OpCode.Match, rule.priority, i);
      }
    });
    /*
    // Add the error case to match -1 if nothing else matches
    // should technically never come here if atleast one rule matches
    out.add(OpCode.Save, 0);
    this.compileRegex(new Any(), out);
    out.add(OpCode.Save, 1);
    out.add(OpCode.Match, 0, -1);
    */
    return out;
  }

  /**
   * Compile a given expression into a set of instructions.
   */
  compileExpr(expr: Regex, prog: Prog): number {
    const start = prog.length;
    const currOffset = prog.length;
    if (expr.tag == RegexType.CHAR) {
      const char = expr as Char;
      prog.add(OpCode.Char, char.start, char.end);
    } else if (expr.tag == RegexType.CHAR_CLASS) {
      const instr = prog.add(OpCode.CharClass);
      for (const char of (expr as CharClass).chars) {
        instr.add(char.start, char.end);
      }
    } else if (expr.tag == RegexType.START_OF_INPUT) {
      prog.add(OpCode.StartOfInput);
    } else if (expr.tag == RegexType.END_OF_INPUT) {
      prog.add(OpCode.EndOfInput);
    } else if (expr.tag == RegexType.ANY) {
      prog.add(OpCode.Any);
    } else if (expr.tag == RegexType.CAT) {
      this.compileCat(expr as Cat, prog);
    } else if (expr.tag == RegexType.UNION) {
      this.compileUnion(expr as Union, prog);
    } else if (expr.tag == RegexType.QUANT) {
      this.compileQuant(expr as Quant, prog);
    } else if (expr.tag == RegexType.REF) {
      this.compileRef(expr as Ref, prog);
    } else if (expr.tag == RegexType.LOOK_AHEAD) {
      this.compileLookAhead(expr as LookAhead, prog);
    } else if (expr.tag == RegexType.LOOK_BACK) {
      this.compileLookBack(expr as LookBack, prog);
    } else {
      throw new Error("Regex Type not yet supported: " + expr.tag);
    }
    if (this.listener) {
      this.listener(expr, prog, currOffset, prog.length - currOffset);
    }
    return prog.length - start;
  }

  compileCat(cat: Cat, prog: Prog): void {
    for (const child of cat.children) {
      this.compileExpr(child, prog);
    }
  }

  compileRef(ne: Ref, prog: Prog): void {
    const name = ne.name.trim();
    const rule = this.exprResolver ? this.exprResolver(name) : null;
    if (rule == null) {
      throw new Error(`Cannot find expression: ${name}`);
    }
    this.compileExpr(rule.expr, prog);
  }

  compileUnion(union: Union, prog: Prog): void {
    const split = prog.add(OpCode.Split);
    const jumps: Instr[] = [];

    for (let i = 0; i < union.options.length; i++) {
      split.add(prog.length);
      this.compileExpr(union.options[i], prog);
      if (i < union.options.length - 1) {
        jumps.push(prog.add(OpCode.Jump));
      }
    }
    for (const jmp of jumps) {
      jmp.add(prog.length);
    }
  }

  /**
   * Compiles a repetition (with quantifiers) into its instructions.
   *
   * For Regex{A,B} do something like:
   * L0: AcquireReg     # acquire new register at L0 and set value to 0
   * L1: CodeFor expr   # Emit code for expr
   * L2: ...
   * L5: ... Code for Regex ends here
   * L6: IncReg L0    # Increment value of register at L0
   *
   * # If value of register at L0 is < A jump to L1
   * L7: JumpIfLt L0, A, L1
   *
   * # If value of register at L0 is >= B jump to LX (after split)
   * L8: JumpIfGt L0, B - 1, L10
   *
   * # Else split and repeat as we are between A and B
   * # Ofcourse swap L1 and L?? if match is not greedy
   * L9: Split L1, L10
   *
   * L10: ReleaseReg L0 # Release register - no longer used
   *
   * In the above if A == 0 then insert a Split L11 before L0 above
   */
  compileQuant(quant: Quant, prog: Prog): void {
    // optimize the special cases of *, ? and +
    if (quant.minCount == 0 && quant.maxCount == TSU.Constants.MAX_INT) {
      // *
      const split = prog.add(OpCode.Split);
      const l1 = split.offset;
      const l2 = prog.length;
      this.compileExpr(quant.expr, prog);
      prog.add(OpCode.Jump, l1);
      const l3 = prog.length;
      if (quant.greedy) {
        split.add(l2, l3);
      } else {
        split.add(l3, l2);
      }
    } else if (quant.minCount == 1 && quant.maxCount == TSU.Constants.MAX_INT) {
      // +
      const l1 = prog.length;
      this.compileExpr(quant.expr, prog);
      const split = prog.add(OpCode.Split);
      const l3 = prog.length;
      if (quant.greedy) {
        split.add(l1, l3);
      } else {
        split.add(l3, l1);
      }
    } else if (quant.minCount == 0 && quant.maxCount == 1) {
      // ?
      const split = prog.add(OpCode.Split);
      const l1 = prog.length;
      this.compileExpr(quant.expr, prog);
      const l2 = prog.length;
      if (quant.greedy) {
        split.add(l2, l1);
      } else {
        split.add(l1, l2);
      }
    } else {
      // general case
      const split = quant.minCount <= 0 ? prog.add(OpCode.Split) : null;

      const l0 = prog.add(OpCode.RegAcquire).offset;
      const l1 = l0 + 1;
      this.compileExpr(quant.expr, prog);

      // Increment match count
      prog.add(OpCode.RegInc, l0);

      // Next two jumps perform if (A <= val <= B) ...
      // Jump back to start of code until val < A
      if (quant.minCount > 0) {
        prog.add(OpCode.JumpIfLt, l0, quant.minCount, l1);
      }

      // If over max then stop
      const jumpIfGt = prog.add(OpCode.JumpIfGt, l0, quant.maxCount - 1 /* Add L10 here */);

      // Have the option of repeat if we are here
      const split2 = prog.add(OpCode.Split, l1);

      // Release the register for reuse
      const lEnd = prog.add(OpCode.RegRelease, l0).offset;
      jumpIfGt.add(lEnd);
      split2.add(prog.length);

      if (split != null) split.add(l0, prog.length);
    }
  }

  /**
   * Compiles lookahead assertions
   */
  compileLookAhead(la: LookAhead, prog: Prog): void {
    // how should this work?
    // Ensure that assertion matches first before continuing with the expression
    const begin = prog.add(OpCode.Begin, 1, la.negate ? 1 : 0); // forward and negate if needed
    this.compileExpr(la.cond, prog);
    const end = prog.add(OpCode.End, begin.offset);
    begin.add(end.offset);
  }

  /**
   * Compiles lookback assertions
   */
  compileLookBack(lb: LookBack, prog: Prog): void {
    // Ensure that assertion matches first before continuing with the expression
    const begin = prog.add(OpCode.Begin, 0, lb.negate ? 1 : 0); // forward and negate if needed
    this.compileExpr(lb.cond.reverse(), prog);
    const end = prog.add(OpCode.End, begin.offset);
    begin.add(end.offset);
  }
}

/**
 * A thread that is performing an execution of the regex VM.
 */
export class Thread {
  /**
   * Saved positions into the input stream for the purpose of
   * partial and custom matches.
   */
  parentId = -1;
  id = 0;
  priority = 0;
  positions: number[] = [];
  registers: TSU.NumMap<number> = {};

  /**
   * Create a thread at the given offset
   */
  constructor(public readonly offset: number = 0, public readonly gen: number = 0) {}

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

export interface VMTracer {
  threadDequeued(thread: Thread, tapeIndex: number): void;
  threadStepped(thread: Thread, tapeIndex: number, gen: number): void;
  threadQueued(thread: Thread, tapeIndex: number): void;
}

export class VM extends VMBase {
  // TODO - To prevent excessive heap activity and GC
  // create a pool of threads and just have a cap on
  // match sizes
  // To eve simplify each Thread could just be something like:
  // number[] where
  //  number[0] == offset
  //  number[1-2*MaxSubs] = Substitutions
  //  number[2*MaxSubs - 2*MaxSubs + M] = Registers
  //      where M = Max number of NewReg instructions
  threadCounter = 0;
  currThreads: Thread[] = [];
  nextThreads: Thread[] = [];
  tracer: VMTracer;

  gen = 0;
  // Records which "generation" of the match a particular
  // offset is in.  If a thread is added at a particular
  // offset the generation number is used to see if the
  // thread is a duplicate (and avoided if so).  This
  // ensures that are linearly bounded on the number of
  // number threads as we match.
  threadForOffset: TSU.NumMap<Thread> = {};

  jumpBy(thread: Thread, delta = 1): Thread {
    return this.jumpTo(thread, thread.offset + delta);
  }

  jumpTo(thread: Thread, newOffset: number): Thread {
    const out = new Thread(newOffset, this.gen);
    out.id = thread.id;
    out.parentId = thread.parentId;
    out.priority = thread.priority;
    out.positions = thread.positions;
    out.registers = thread.registers;
    return out;
  }

  forkTo(thread: Thread, newOffset: number): Thread {
    const out = new Thread(newOffset, this.gen);
    out.id = ++this.threadCounter;
    out.parentId = thread.id;
    out.priority = thread.priority;
    out.positions = [...thread.positions];
    out.registers = { ...thread.registers };
    return out;
  }

  addThread(thread: Thread, list: Thread[], tape: Tape, delta = 0): void {
    if (this.threadForOffset[thread.offset - this.start]?.gen == this.gen) {
      // duplicate
      return;
    }
    this.threadForOffset[thread.offset - this.start] = thread;
    const instr = this.prog.instrs[thread.offset];
    let newThread: Thread;
    // if (this.tracer) this.tracer.threadStepped(thread, tape.index, this.gen);
    switch (instr.opcode) {
      case OpCode.RegInc:
        thread.regIncr(instr.args[0]);
        this.addThread(this.jumpBy(thread, 1), list, tape);
        break;
      case OpCode.RegRelease:
        thread.regRelease(instr.args[0]);
        this.addThread(this.jumpBy(thread, 1), list, tape);
        break;
      case OpCode.RegAcquire:
        thread.regAcquire(instr.offset);
        this.addThread(this.jumpBy(thread, 1), list, tape);
        break;
      case OpCode.Jump:
        this.addThread(this.jumpTo(thread, instr.args[0]), list, tape);
        break;
      case OpCode.JumpIfLt:
        {
          const [regOffset, checkValue, goto] = [instr.args[0], instr.args[1], instr.args[2]];
          const regValue = thread.regValue(regOffset);
          newThread = regValue < checkValue ? this.jumpTo(thread, goto) : this.jumpBy(thread, 1);
          this.addThread(newThread, list, tape);
        }
        break;
      case OpCode.JumpIfGt:
        {
          const [regOffset, checkValue, goto] = [instr.args[0], instr.args[1], instr.args[2]];
          const regValue = thread.regValue(regOffset);
          newThread = regValue > checkValue ? this.jumpTo(thread, goto) : this.jumpBy(thread, 1);
          this.addThread(newThread, list, tape);
        }
        break;
      case OpCode.Split:
        // add in reverse order so backtracking happens correctly
        for (let j = 0; j < instr.args.length; j++) {
          const newOff = instr.args[j];
          const newThread = this.jumpTo(thread, newOff);
          if (j != 0) {
            newThread.parentId = thread.id;
            newThread.id = ++this.threadCounter;
            newThread.registers = { ...thread.registers };
          }
          this.addThread(newThread, list, tape);
        }
        break;
      case OpCode.Save:
        newThread = this.forkTo(thread, thread.offset + 1);
        newThread.positions[instr.args[0]] = tape.index;
        this.addThread(newThread, list, tape);
        break;
      case OpCode.Begin:
        // This results in a new VM being created for this sub program
        const [forward, /* consume, */ negate, end] = instr.args;
        const vm = new VM(this.prog, instr.offset + 1, end, forward == 1);
        const savedPos = tape.index;
        const match = vm.match(tape);
        // const newPos = tape.index;
        const matchSuccess = (match != null && negate == 0) || (match == null && negate == 1);

        tape.index = savedPos; // always restore it first before doing anything else with it
        if (matchSuccess) {
          // on a success we have a few options
          if (forward) {
            // lookahead
            // TODO - Consider using a DFA for this case so we can mitigate
            // pathological cases with an exponential blowup

            // TODO - See if there is any use case for a consume ption here
            // ie only advance tape position if it is a non - negative match.
            // Problem wth consume option is we potentiall have to start a thread
            // much further out and having to maintain future threads that wont
            // be awaken this or next generation is a pain
            // if (consume && !negate) { tape.index = newPos; }
            this.addThread(this.jumpTo(thread, end + 1), this.currThreads, tape);
          } else {
            // lookback
            // nothing - just continue on after the assertion
            // note here we are prioritizing it on the same generation
            // as the tape position has not advanced here
            this.addThread(this.jumpTo(thread, end + 1), this.currThreads, tape);
          }
        } else {
          // fail as nothing else to do
        }
        break;
      default:
        if (this.tracer) this.tracer.threadQueued(thread, tape.index);
        list.push(thread);
        break;
    }
  }

  protected hasMore(tape: Tape): boolean {
    return this.forward ? tape.hasMore : tape.index > 0;
  }

  /**
   * Runs the given instructions and returns a triple:
   * [matchId, matchStart, matchEnd]
   */
  match(tape: Tape): Match | null {
    const prevCh = () => tape.input[tape.index - delta];
    let currMatch: Match | null = null;
    this.currThreads = [];
    this.nextThreads = [];
    this.gen++;
    this.addThread(new Thread(this.start, this.gen), this.currThreads, tape);
    const instrs = this.prog.instrs;
    const delta = this.forward ? 1 : -1;
    // let largestMatchEnd = -1;
    // let lastMatchIndex = -1;
    const startPos = tape.index;
    for (; this.currThreads.length > 0; tape.advance(delta)) {
      this.gen++;
      const ch = tape.currChCode;
      let matchedInGen = false;
      for (let i = 0; i < this.currThreads.length && !matchedInGen; i++) {
        const thread = this.currThreads[i];
        const instr = instrs[thread.offset];
        // if (this.tracer) this.tracer.threadDequeued(thread, tape.index);
        if (this.tracer) this.tracer.threadStepped(thread, tape.index, this.gen);
        const opcode = instr.opcode;
        const args = instr.args;
        // Do char match based actions
        let advanceTape = false;
        switch (opcode) {
          case OpCode.End:
            // Return back to calling VM - very similar to a match
            return new Match(-1, startPos, tape.index);
            break;
          case OpCode.Any:
            if (this.hasMore(tape)) advanceTape = true;
            break;
          case OpCode.Char:
            if (ch >= args[0] && ch <= args[1]) {
              // matched so add transition
              advanceTape = true;
            }
            break;
          case OpCode.CharClass:
            // TODO - Optimize with binary searches
            for (let a = 0; a < args.length; a += 2) {
              if (ch >= args[a] && ch <= args[a + 1]) {
                advanceTape = true;
                break;
              }
            }
            break;
          case OpCode.StartOfInput:
            // only proceed further if prev was a newline or start
            const lastCh = prevCh();
            if (tape.index == 0 || lastCh == "\r" || lastCh == "\n" || lastCh == "\u2028" || lastCh == "\u2029") {
              // have a match so can go forwrd but dont advance tape on
              // the same generation
              this.addThread(this.jumpBy(thread, 1), this.currThreads, tape);
            }
            break;
          case OpCode.EndOfInput:
            // On end of input we dont advance tape but thread moves on
            // if at end of line boundary
            // check if next is end of input
            const currCh = tape.currCh || null;
            if (currCh == "\r" || currCh == "\n" || currCh == "\u2028" || currCh == "\u2029" || !this.hasMore(tape)) {
              this.addThread(this.jumpBy(thread, 1), this.currThreads, tape);
            }
            break;
          case OpCode.Match:
            // we have a match on this thread so return it
            // Update the match if we are a higher prioirty or longer match
            // than what was already found (if any)
            if (tape.index > startPos) {
              const currPriority = instr.args[0];
              const matchIndex = instr.args[1];
              if (currMatch == null) currMatch = new Match();
              if (currPriority > currMatch.priority || tape.index > currMatch.end) {
                currMatch.start = startPos;
                currMatch.end = tape.index;
                currMatch.priority = currPriority;
                currMatch.matchIndex = matchIndex;
                // highestPriority = currPriority;
                matchedInGen = true;
              } else {
                // Since we kill of lower priority matches becuase of matchedInGen
                // we should not be here
                TSU.assert(false, "Should not be here");
              }
            }
            break;
        }
        if (advanceTape && this.hasMore(tape)) {
          this.addThread(this.jumpBy(thread, 1), this.nextThreads, tape, delta);
        }
      }
      if (!this.hasMore(tape)) break;
      this.nextGen();
    }
    // ensure tape is rewound to end of last match
    if (currMatch != null) tape.index = currMatch.end;
    return currMatch;
  }

  nextGen(): void {
    this.currThreads = this.nextThreads;
    this.nextThreads = [];
  }
}

export function InstrDebugValue(instr: Instr): string {
  switch (instr.opcode) {
    case OpCode.Match:
      return `Match ${instr.args[0]} ${instr.args[1]}`;
    case OpCode.Char:
      const start = (+"" + instr.args[0]).toString(16);
      const end = (+"" + instr.args[1]).toString(16);
      const s = start == end ? start : `${start}-${end}`;
      return `Char ${s}`;
    case OpCode.CharClass:
      let out = "CharClass ";
      for (let i = 0; i < instr.args.length; i += 2) {
        const start = (+"" + instr.args[i]).toString(16);
        const end = (+"" + instr.args[i + 1]).toString(16);
        const s = start == end ? start : `${start}-${end}`;
        if (i > 0) out += " ";
        out += s;
      }
      return out;
    case OpCode.Any:
      return ".";
    case OpCode.StartOfInput:
      return "^";
    case OpCode.EndOfInput:
      return "$";
    case OpCode.Save:
      return `Save ${instr.args[0]}`;
    case OpCode.Split:
      return `Split ${instr.args.join(", ")}`;
    case OpCode.Jump:
      return `Jump ${instr.args[0]}`;
    case OpCode.JumpIfLt:
      return `JumpIfLt L${instr.args[0]} ${instr.args[1]} L${instr.args[2]}`;
    case OpCode.JumpIfGt:
      return `JumpIfGt L${instr.args[0]} ${instr.args[1]} L${instr.args[2]}`;
    case OpCode.RegAcquire:
      return `RegAcquire`;
    case OpCode.RegInc:
      return `RegInc L${instr.args[0]}`;
    case OpCode.RegRelease:
      return `RegRelease L${instr.args[0]}`;
    case OpCode.Begin:
      return `Begin ${instr.args.join(" ")}`;
    case OpCode.End:
      return `End ${instr.args.join(" ")}`;
    default:
      throw new Error("Invalid Opcode: " + instr.opcode);
  }
}

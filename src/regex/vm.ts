import { Tape } from "../tape";

export class Match {
  constructor(public priority = 10, public matchIndex = -1, public start = -1, public end = -1) {}
}

export class Prog {
  instrs: Instr[] = [];

  get length(): number {
    return this.instrs.length;
  }

  add(opcode: any, ...args: number[]): Instr {
    const out = new Instr(opcode).add(...args);
    out.offset = this.instrs.length;
    this.instrs.push(out);
    return out;
  }

  static with(initializer: (prog: Prog) => void): Prog {
    const out = new Prog();
    initializer(out);
    return out;
  }

  get reprString(): any {
    let out = "";
    this.instrs.forEach((instr) => (out += `p.add(${instr.opcode}, ${instr.args.join(", ")});`));
    return `Prog.with((p) => { ${out} })`;
  }

  debugValue(instrDebugValue?: (instr: Instr) => string): any {
    if (instrDebugValue) {
      return this.instrs.map((instr, index) => {
        if (instr.comment.trim().length > 0) return `L${index}: ${instrDebugValue(instr)}     # ${instr.comment}`;
        else return `L${index}: ${instrDebugValue(instr)}`;
      });
    } else {
      return this.instrs.map((instr, index) => `L${index}: ${instr.debugValue}`);
    }
  }
}

export class Instr {
  offset = 0;
  comment = "";
  args: number[] = [];
  constructor(public readonly opcode: any) {}

  add(...args: number[]): this {
    this.args.push(...args);
    return this;
  }

  get reprString(): any {
    return `new Instr(${this.opcode}, ${this.args.join(", ")})`;
  }

  get debugValue(): any {
    if (this.comment.trim().length > 0) return `${this.opcode} ${this.args.join(" ")}     # ${this.comment}`;
    else return `${this.opcode} ${this.args.join(" ")}`;
  }
}

export class VM {
  constructor(
    public readonly prog: Prog,
    public readonly start = 0,
    public readonly end = -1,
    public readonly forward = true,
  ) {
    if (end < 0) {
      end = prog.length - 1;
    }
  }

  match(tape: Tape): Match | null {
    return null;
  }

  instrDebugValue(instr: Instr): any {
    return `${instr.opcode} ${instr.args.join(" ")}`;
  }

  progDebugValue(prog: Prog): any {
    return prog.instrs.map((instr, index) => `L${index}: ${this.instrDebugValue(instr)}`);
  }
}

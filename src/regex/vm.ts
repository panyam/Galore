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
      return this.instrs.map((instr, index) => `L${index}: ${instrDebugValue(instr)}`);
    } else {
      return this.instrs.map((instr, index) => `L${index}: ${instr.debugValue}`);
    }
  }
}

export class Instr {
  offset = 0;
  comment: string;
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
    return `${this.opcode} ${this.args.join(" ")}`;
  }
}

export class VM {
  instrDebugValue(instr: Instr): any {
    return `${instr.opcode} ${instr.args.join(" ")}`;
  }

  progDebugValue(prog: Prog): any {
    return prog.instrs.map((instr, index) => `L${index}: ${this.instrDebugValue(instr)}`);
  }
}

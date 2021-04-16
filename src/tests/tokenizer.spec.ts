import { SimpleTokenizer } from "../tokenizer";
import { Tape } from "../tape";

describe("Tape Tests", () => {
  test("Basic", () => {
    const t1 = new Tape("Hello World");
    expect(t1.currCh).toBe("H");
    expect(t1.index).toBe(0);
    expect(t1.nextCh()).toBe("H");
    expect(t1.index).toBe(1);
    expect(t1.substring(4, 6)).toBe("o ");
    t1.push(" And Universe");
    expect(t1.input).toBe("Hello World And Universe");
  });

  test("Advance Tests", () => {
    const t1 = new Tape("Hello World");
    expect(() => t1.advanceAfter("HHello")).toThrowError();
    expect(t1.index).toBe(0);
    expect(t1.advanceAfter("Hello")).toBe(5);
    expect(t1.index).toBe(5);
    expect(t1.advanceTill("World")).toBe(6);
    expect(t1.index).toBe(6);
  });

  test("Match Tests", () => {
    const t1 = new Tape("Hello World I feel Alive");
    expect(t1.matches("hello")).toBe(false);
    expect(t1.index).toBe(0);
    expect(t1.matches("Hello")).toBe(true);
    expect(t1.index).toBe(5);
    expect(t1.matches(" World", false)).toBe(true);
    expect(t1.index).toBe(5);
    expect(t1.matches(" World")).toBe(true);
    expect(t1.index).toBe(11);
    expect(t1.hasMore).toBe(true);
  });
});

describe("Tokenizer Tests", () => {
  test("Basic", () => {
    const t = new SimpleTokenizer("Hello World");
    t.addLiteral("Hello", 55);
    const tok = t.nextToken();
    expect(tok?.isOneOf(55)).toBe(true);
    expect(tok?.isOneOf(66)).toBe(false);
    expect(tok?.tag).toBe(55);
    expect(tok?.value).toBe("Hello");
    expect(tok?.offset).toBe(0);
    expect(tok?.length).toBe(5);
  });
});

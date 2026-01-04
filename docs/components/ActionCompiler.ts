/**
 * ActionCompiler - Shared action code compilation and execution
 * Used by both ExampleRunner and PlaygroundPage
 */

import ace from "ace-builds";

export interface ActionCompileResult {
  success: boolean;
  fn: ((node: any) => any) | null;
  error: string | null;
  line: number | null; // 0-indexed line number for error
}

export interface ActionRunResult {
  success: boolean;
  result: any;
  error: string | null;
  line: number | null; // 0-indexed line number for runtime error
}

export class ActionCompiler {
  private editor: ace.Ace.Editor | null = null;
  private compiledFn: ((node: any) => any) | null = null;
  private compileError: string | null = null;
  private statusEl: HTMLElement | null = null;
  private onCompile: ((result: ActionCompileResult) => void) | null = null;

  constructor(
    editor: ace.Ace.Editor,
    statusEl: HTMLElement | null = null,
    onCompile: ((result: ActionCompileResult) => void) | null = null,
  ) {
    this.editor = editor;
    this.statusEl = statusEl;
    this.onCompile = onCompile;

    // Setup change listener with debounce
    let compileTimeout: number | null = null;
    this.editor.session.on("change", () => {
      if (compileTimeout) clearTimeout(compileTimeout);
      compileTimeout = window.setTimeout(() => this.compile(), 300);
    });
  }

  /**
   * Compile the current editor content
   */
  compile(): ActionCompileResult {
    if (!this.editor) {
      return { success: false, fn: null, error: "No editor", line: null };
    }

    const code = this.editor.getValue().trim();
    const session = this.editor.session;

    // Clear previous annotations
    session.clearAnnotations();
    this.compiledFn = null;
    this.compileError = null;

    if (!code) {
      this.updateStatus("", "");
      const result = { success: true, fn: null, error: null, line: null };
      this.onCompile?.(result);
      return result;
    }

    try {
      // Compile using new Function
      this.compiledFn = new Function("node", code) as (node: any) => any;
      this.updateStatus("✓", "success");
      const result = { success: true, fn: this.compiledFn, error: null, line: null };
      this.onCompile?.(result);
      return result;
    } catch (e: any) {
      this.compileError = e.message;
      this.updateStatus("✗ Compile Error", "error");

      // Try to extract line number from error message
      // Common patterns: "at line 5", "line 5", ":5:", "(5:"
      const lineMatch = e.message.match(/(?:at line |line |:|\()(\d+)(?::|,|\))/i);
      const line = lineMatch ? parseInt(lineMatch[1], 10) - 1 : 0; // 0-indexed

      session.setAnnotations([
        {
          row: line,
          column: 0,
          text: e.message,
          type: "error",
        },
      ]);

      const result = { success: false, fn: null, error: e.message, line };
      this.onCompile?.(result);
      return result;
    }
  }

  /**
   * Run the compiled action on a parse tree node
   */
  run(node: any): ActionRunResult {
    if (!node) {
      return { success: false, result: null, error: "No parse result available", line: null };
    }

    if (this.compileError) {
      return { success: false, result: null, error: `Compile Error: ${this.compileError}`, line: null };
    }

    if (!this.compiledFn) {
      return { success: true, result: null, error: null, line: null }; // No action code
    }

    try {
      const result = this.compiledFn(node);
      // Clear runtime error annotations
      if (this.editor) {
        this.editor.session.clearAnnotations();
      }
      this.updateStatus("✓", "success");
      return { success: true, result, error: null, line: null };
    } catch (e: any) {
      // Try to extract line number from runtime error stack
      const stack = e.stack || "";
      const lineMatch = stack.match(/<anonymous>:(\d+):/);
      const line = lineMatch ? parseInt(lineMatch[1], 10) - 1 : null; // 0-indexed

      // Set runtime error annotation
      if (this.editor && line !== null) {
        this.editor.session.setAnnotations([
          {
            row: line,
            column: 0,
            text: e.message,
            type: "error",
          },
        ]);
      }

      this.updateStatus("✗ Runtime Error", "error");
      return { success: false, result: null, error: e.message, line };
    }
  }

  /**
   * Get the current compile error (if any)
   */
  getCompileError(): string | null {
    return this.compileError;
  }

  /**
   * Check if there's a compiled action function
   */
  hasCompiledAction(): boolean {
    return this.compiledFn !== null;
  }

  /**
   * Update status element
   */
  private updateStatus(text: string, statusClass: string): void {
    if (this.statusEl) {
      this.statusEl.textContent = text;
      // Clear and set status classes without removing base class
      this.statusEl.classList.remove("success", "error");
      if (statusClass) {
        this.statusEl.classList.add(statusClass);
      }
    }
  }

  /**
   * Clear annotations and status
   */
  clear(): void {
    if (this.editor) {
      this.editor.session.clearAnnotations();
    }
    this.compiledFn = null;
    this.compileError = null;
    this.updateStatus("", "");
  }
}

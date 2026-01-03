/**
 * GrammarSandbox.ts - Mini sandbox component for embedding grammar examples in docs
 *
 * Three-panel layout:
 * 1. Grammar Panel - Shows the grammar definition
 * 2. Input Panel - Shows the input text to parse
 * 3. Parsed AST Panel - Shows the resulting parse tree
 */

import * as G from "galore";

export interface SandboxConfig {
  grammar: string;
  input?: string;
  parserType?: "slr" | "lalr" | "lr1";
  editable?: boolean;
  caption?: string;
}

export class GrammarSandbox {
  private element: HTMLElement;
  private config: SandboxConfig;
  private parser: any = null;

  private grammarEditor: HTMLTextAreaElement | null = null;
  private inputEditor: HTMLTextAreaElement | null = null;
  private astContainer: HTMLElement | null = null;
  private statusBar: HTMLElement | null = null;

  constructor(element: HTMLElement) {
    this.element = element;
    this.config = this.parseConfig();
    this.render();
    this.compile();
  }

  private parseConfig(): SandboxConfig {
    const grammarContent = this.element.textContent?.trim() || "";

    return {
      grammar: grammarContent,
      input: this.element.getAttribute("input") || "",
      parserType: (this.element.getAttribute("parser-type") as any) || "lalr",
      editable: this.element.getAttribute("editable") !== "false",
      caption: this.element.getAttribute("caption") || undefined,
    };
  }

  private render(): void {
    this.element.innerHTML = "";
    this.element.classList.add("grammar-sandbox");

    // Caption / Title bar
    const header = document.createElement("div");
    header.className = "sandbox-header";

    if (this.config.caption) {
      const caption = document.createElement("span");
      caption.className = "sandbox-caption";
      caption.textContent = this.config.caption;
      header.appendChild(caption);
    }

    // Parser type badge
    const parserBadge = document.createElement("span");
    parserBadge.className = "sandbox-badge";
    parserBadge.textContent = (this.config.parserType || "lalr").toUpperCase();
    header.appendChild(parserBadge);

    this.element.appendChild(header);

    // Three-panel container
    const panelsContainer = document.createElement("div");
    panelsContainer.className = "sandbox-panels";

    // Panel 1: Grammar
    const grammarPanel = this.createPanel("Grammar", "sandbox-panel-grammar");
    if (this.config.editable) {
      this.grammarEditor = document.createElement("textarea");
      this.grammarEditor.className = "sandbox-textarea";
      this.grammarEditor.value = this.config.grammar;
      this.grammarEditor.spellcheck = false;
      grammarPanel.content.appendChild(this.grammarEditor);
    } else {
      const grammarPre = document.createElement("pre");
      grammarPre.className = "sandbox-pre";
      grammarPre.textContent = this.config.grammar;
      grammarPanel.content.appendChild(grammarPre);
    }
    panelsContainer.appendChild(grammarPanel.panel);

    // Panel 2: Input
    const inputPanel = this.createPanel("Input", "sandbox-panel-input");
    if (this.config.editable) {
      this.inputEditor = document.createElement("textarea");
      this.inputEditor.className = "sandbox-textarea";
      this.inputEditor.value = this.config.input || "";
      this.inputEditor.spellcheck = false;
      inputPanel.content.appendChild(this.inputEditor);
    } else {
      const inputPre = document.createElement("pre");
      inputPre.className = "sandbox-pre";
      inputPre.textContent = this.config.input || "";
      inputPanel.content.appendChild(inputPre);
    }
    panelsContainer.appendChild(inputPanel.panel);

    // Panel 3: Parsed AST
    const astPanel = this.createPanel("Parse Tree", "sandbox-panel-ast");
    this.astContainer = document.createElement("div");
    this.astContainer.className = "sandbox-ast";
    astPanel.content.appendChild(this.astContainer);
    panelsContainer.appendChild(astPanel.panel);

    this.element.appendChild(panelsContainer);

    // Toolbar (for editable mode)
    if (this.config.editable) {
      const toolbar = document.createElement("div");
      toolbar.className = "sandbox-toolbar";

      const runBtn = document.createElement("button");
      runBtn.className = "sandbox-btn sandbox-btn-primary";
      runBtn.innerHTML = "&#9654; Run";
      runBtn.addEventListener("click", () => {
        this.compile();
        this.parse();
      });
      toolbar.appendChild(runBtn);

      this.element.appendChild(toolbar);
    }

    // Status bar
    this.statusBar = document.createElement("div");
    this.statusBar.className = "sandbox-status";
    this.element.appendChild(this.statusBar);
  }

  private createPanel(title: string, className: string): { panel: HTMLElement; content: HTMLElement } {
    const panel = document.createElement("div");
    panel.className = `sandbox-panel ${className}`;

    const header = document.createElement("div");
    header.className = "sandbox-panel-header";
    header.textContent = title;
    panel.appendChild(header);

    const content = document.createElement("div");
    content.className = "sandbox-panel-content";
    panel.appendChild(content);

    return { panel, content };
  }

  public compile(): void {
    const grammar = this.config.editable && this.grammarEditor
      ? this.grammarEditor.value
      : this.config.grammar;

    try {
      this.parser = G.newParser(grammar, {
        type: this.config.parserType
      });

      this.setStatus("Compiled successfully", "success");

      // Auto-parse if input is provided
      const input = this.config.editable && this.inputEditor
        ? this.inputEditor.value
        : this.config.input;

      if (input) {
        this.parse();
      }
    } catch (error: any) {
      this.setStatus(`Compile error: ${error.message}`, "error");
      this.parser = null;
      this.showASTError(error.message);
    }
  }

  public parse(): void {
    if (!this.parser) {
      this.setStatus("No parser available", "error");
      return;
    }

    const input = this.config.editable && this.inputEditor
      ? this.inputEditor.value
      : this.config.input;

    if (!input) {
      this.setStatus("No input to parse", "warning");
      return;
    }

    try {
      const startTime = performance.now();
      const result = this.parser.parse(input);
      const elapsed = (performance.now() - startTime).toFixed(2);

      this.setStatus(`Parsed in ${elapsed}ms`, "success");
      this.showAST(result);
    } catch (error: any) {
      this.setStatus(`Parse error: ${error.message}`, "error");
      this.showASTError(error.message);
    }
  }

  private showAST(result: any): void {
    if (!this.astContainer) return;

    this.astContainer.innerHTML = "";
    this.astContainer.classList.remove("error");

    if (!result) {
      this.astContainer.innerHTML = '<div class="sandbox-empty">No result</div>';
      return;
    }

    const pre = document.createElement("pre");
    pre.className = "sandbox-ast-tree";
    pre.textContent = this.formatTree(result);
    this.astContainer.appendChild(pre);
  }

  private showASTError(message: string): void {
    if (!this.astContainer) return;

    this.astContainer.innerHTML = "";
    this.astContainer.classList.add("error");

    const errorDiv = document.createElement("div");
    errorDiv.className = "sandbox-ast-error";
    errorDiv.textContent = message;
    this.astContainer.appendChild(errorDiv);
  }

  private formatTree(node: any, indent: string = ""): string {
    if (!node) return "";

    let result = indent;

    // Node symbol
    if (node.sym) {
      result += node.sym.label;
    } else {
      result += "?";
    }

    // Node value (for terminals)
    if (node.value !== undefined && node.value !== null) {
      result += `: ${JSON.stringify(node.value)}`;
    }

    result += "\n";

    // Children
    if (node.children) {
      for (const child of node.children) {
        result += this.formatTree(child, indent + "  ");
      }
    }

    return result;
  }

  private setStatus(message: string, level: "success" | "error" | "warning" | "info" = "info"): void {
    if (!this.statusBar) return;

    this.statusBar.textContent = message;
    this.statusBar.className = `sandbox-status sandbox-status-${level}`;
  }
}

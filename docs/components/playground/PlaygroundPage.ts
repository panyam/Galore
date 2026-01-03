/**
 * PlaygroundPage.ts - Main playground with DockView layout
 */

import { DockviewComponent, DockviewApi } from "dockview-core";
import "dockview-core/dist/styles/dockview.css";

import * as G from "galore";
import { EventHub, Events } from "./EventHub";
import { builtinGrammars, parserTypes } from "./configs";

// Import Ace editor
import * as ace from "ace-builds";
import "ace-builds/src-noconflict/mode-text";
import "ace-builds/src-noconflict/theme-monokai";
import "ace-builds/src-noconflict/theme-github";

// Expose galore globally
(window as any).G = G;

export class PlaygroundPage {
  private dockview: DockviewApi | null = null;
  private eventHub = new EventHub();

  // State
  private currentParser: any = null;
  private currentGrammar: any = null;
  private parserType: string = "lalr";

  // Editors
  private grammarEditor: ace.Ace.Editor | null = null;
  private inputEditor: ace.Ace.Editor | null = null;
  private normalizedEditor: ace.Ace.Editor | null = null;

  // DOM refs
  private parseTreeContainer: HTMLElement | null = null;
  private parseTableContainer: HTMLElement | null = null;
  private consoleOutput: HTMLElement | null = null;

  constructor() {
    this.init();
  }

  private init(): void {
    const container = document.getElementById("dockview-container");
    if (!container) {
      console.error("Dockview container not found");
      return;
    }

    // Apply theme
    const isDarkMode = document.documentElement.classList.contains("dark");
    container.className = isDarkMode
      ? "dockview-theme-dark"
      : "dockview-theme-light";

    // Watch for theme changes
    const observer = new MutationObserver(() => {
      const isDark = document.documentElement.classList.contains("dark");
      container.className = isDark
        ? "dockview-theme-dark"
        : "dockview-theme-light";
      this.updateEditorThemes(isDark);
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    // Create DockView
    const dockviewComponent = new DockviewComponent(container, {
      createComponent: (options) => this.createComponent(options),
    });

    this.dockview = dockviewComponent.api;

    // Create default layout
    this.createDefaultLayout();

    // Setup event listeners
    this.setupEventListeners();

    // Load initial grammar
    this.selectGrammar(builtinGrammars.find((g) => g.selected) || builtinGrammars[0]);
  }

  private createComponent(options: any): any {
    switch (options.name) {
      case "grammar":
        return this.createGrammarPanel();
      case "input":
        return this.createInputPanel();
      case "parseTree":
        return this.createParseTreePanel();
      case "parseTable":
        return this.createParseTablePanel();
      case "normalizedGrammar":
        return this.createNormalizedGrammarPanel();
      case "console":
        return this.createConsolePanel();
      default:
        return { element: document.createElement("div") };
    }
  }

  private createDefaultLayout(): void {
    if (!this.dockview) return;

    // Grammar panel (left)
    this.dockview.addPanel({
      id: "grammar",
      component: "grammar",
      title: "Grammar",
    });

    // Input panel (below grammar)
    this.dockview.addPanel({
      id: "input",
      component: "input",
      title: "Input",
      position: { direction: "below", referencePanel: "grammar" },
    });

    // Parse tree panel (right of grammar)
    this.dockview.addPanel({
      id: "parseTree",
      component: "parseTree",
      title: "Parse Tree",
      position: { direction: "right", referencePanel: "grammar" },
    });

    // Parse table panel (tabbed with parse tree)
    this.dockview.addPanel({
      id: "parseTable",
      component: "parseTable",
      title: "Parse Table",
      position: { direction: "within", referencePanel: "parseTree" },
    });

    // Normalized grammar (tabbed with grammar)
    this.dockview.addPanel({
      id: "normalizedGrammar",
      component: "normalizedGrammar",
      title: "Normalized Grammar",
      position: { direction: "within", referencePanel: "grammar" },
    });

    // Console (below input)
    this.dockview.addPanel({
      id: "console",
      component: "console",
      title: "Console",
      position: { direction: "below", referencePanel: "input" },
    });
  }

  private createGrammarPanel(): any {
    const template = document.getElementById("grammar-panel-template");
    if (!template) return { element: document.createElement("div") };

    const element = template.cloneNode(true) as HTMLElement;
    element.style.display = "flex";
    element.style.flexDirection = "column";
    element.style.height = "100%";

    return {
      element,
      init: () => {
        // Setup grammar select
        const grammarSelect = element.querySelector("#grammar-select") as HTMLSelectElement;
        if (grammarSelect) {
          grammarSelect.innerHTML = builtinGrammars
            .map((g) => `<option value="${g.name}" ${g.selected ? "selected" : ""}>${g.label}</option>`)
            .join("");
          grammarSelect.addEventListener("change", () => {
            const grammar = builtinGrammars.find((g) => g.name === grammarSelect.value);
            if (grammar) this.selectGrammar(grammar);
          });
        }

        // Setup parser type select
        const parserTypeSelect = element.querySelector("#parser-type-select") as HTMLSelectElement;
        if (parserTypeSelect) {
          parserTypeSelect.addEventListener("change", () => {
            this.parserType = parserTypeSelect.value;
          });
        }

        // Setup compile button
        const compileBtn = element.querySelector("#compile-btn");
        if (compileBtn) {
          compileBtn.addEventListener("click", () => this.compile());
        }

        // Setup Ace editor
        const editorContainer = element.querySelector("#grammar-editor") as HTMLElement;
        if (editorContainer) {
          this.grammarEditor = ace.edit(editorContainer);
          this.grammarEditor.setTheme("ace/theme/monokai");
          this.grammarEditor.session.setMode("ace/mode/text");
          this.grammarEditor.setOptions({
            fontSize: "14px",
            showPrintMargin: false,
          });
        }
      },
    };
  }

  private createInputPanel(): any {
    const template = document.getElementById("input-panel-template");
    if (!template) return { element: document.createElement("div") };

    const element = template.cloneNode(true) as HTMLElement;
    element.style.display = "flex";
    element.style.flexDirection = "column";
    element.style.height = "100%";

    return {
      element,
      init: () => {
        // Setup parse button
        const parseBtn = element.querySelector("#parse-btn");
        if (parseBtn) {
          parseBtn.addEventListener("click", () => this.parse());
        }

        // Setup Ace editor
        const editorContainer = element.querySelector("#input-editor") as HTMLElement;
        if (editorContainer) {
          this.inputEditor = ace.edit(editorContainer);
          this.inputEditor.setTheme("ace/theme/monokai");
          this.inputEditor.session.setMode("ace/mode/text");
          this.inputEditor.setOptions({
            fontSize: "14px",
            showPrintMargin: false,
          });
        }
      },
    };
  }

  private createParseTreePanel(): any {
    const template = document.getElementById("parse-tree-panel-template");
    if (!template) return { element: document.createElement("div") };

    const element = template.cloneNode(true) as HTMLElement;
    element.style.display = "flex";
    element.style.height = "100%";
    element.style.overflow = "auto";

    return {
      element,
      init: () => {
        this.parseTreeContainer = element.querySelector("#parse-tree-container");
      },
    };
  }

  private createParseTablePanel(): any {
    const template = document.getElementById("parse-table-panel-template");
    if (!template) return { element: document.createElement("div") };

    const element = template.cloneNode(true) as HTMLElement;
    element.style.display = "flex";
    element.style.height = "100%";
    element.style.overflow = "auto";

    return {
      element,
      init: () => {
        this.parseTableContainer = element.querySelector("#parse-table-container");
      },
    };
  }

  private createNormalizedGrammarPanel(): any {
    const template = document.getElementById("normalized-grammar-panel-template");
    if (!template) return { element: document.createElement("div") };

    const element = template.cloneNode(true) as HTMLElement;
    element.style.display = "flex";
    element.style.height = "100%";

    return {
      element,
      init: () => {
        const editorContainer = element.querySelector("#normalized-grammar-editor") as HTMLElement;
        if (editorContainer) {
          this.normalizedEditor = ace.edit(editorContainer);
          this.normalizedEditor.setTheme("ace/theme/monokai");
          this.normalizedEditor.session.setMode("ace/mode/text");
          this.normalizedEditor.setReadOnly(true);
          this.normalizedEditor.setOptions({
            fontSize: "14px",
            showPrintMargin: false,
          });
        }
      },
    };
  }

  private createConsolePanel(): any {
    const template = document.getElementById("console-panel-template");
    if (!template) return { element: document.createElement("div") };

    const element = template.cloneNode(true) as HTMLElement;
    element.style.display = "flex";
    element.style.flexDirection = "column";
    element.style.height = "100%";

    return {
      element,
      init: () => {
        this.consoleOutput = element.querySelector("#console-output");

        const clearBtn = element.querySelector("#clear-console-btn");
        if (clearBtn) {
          clearBtn.addEventListener("click", () => {
            if (this.consoleOutput) this.consoleOutput.innerHTML = "";
          });
        }
      },
    };
  }

  private setupEventListeners(): void {
    this.eventHub.on(Events.GRAMMAR_COMPILED, (parser: any, grammar: any) => {
      this.log("Grammar compiled successfully");
      this.updateParseTable();
      this.updateNormalizedGrammar();
    });

    this.eventHub.on(Events.INPUT_PARSED, (result: any) => {
      this.updateParseTree(result);
    });
  }

  private selectGrammar(grammar: any): void {
    if (this.grammarEditor) {
      this.grammarEditor.setValue(grammar.grammar, -1);
    }
    if (this.inputEditor && grammar.sampleInput) {
      this.inputEditor.setValue(grammar.sampleInput, -1);
    }
    this.eventHub.emit(Events.GRAMMAR_SELECTED, grammar);
  }

  public compile(): void {
    if (!this.grammarEditor) return;

    const grammarText = this.grammarEditor.getValue();

    try {
      this.currentParser = G.newParser(grammarText, { type: this.parserType as any });
      this.currentGrammar = this.currentParser.parseTable?.grammar;

      this.eventHub.emit(Events.GRAMMAR_COMPILED, this.currentParser, this.currentGrammar);
      this.log(`Parser compiled (${this.parserType.toUpperCase()})`);

      // Auto-parse if input exists
      if (this.inputEditor && this.inputEditor.getValue().trim()) {
        this.parse();
      }
    } catch (e: any) {
      this.log(`Compile error: ${e.message}`, "error");
    }
  }

  public parse(): void {
    if (!this.currentParser || !this.inputEditor) {
      this.log("No parser available. Compile the grammar first.", "error");
      return;
    }

    const input = this.inputEditor.getValue();

    try {
      const startTime = performance.now();
      const result = this.currentParser.parse(input);
      const elapsed = (performance.now() - startTime).toFixed(2);

      this.log(`Parsed in ${elapsed}ms`);
      this.eventHub.emit(Events.INPUT_PARSED, result);
    } catch (e: any) {
      this.log(`Parse error: ${e.message}`, "error");
    }
  }

  private updateParseTree(result: any): void {
    if (!this.parseTreeContainer) return;

    this.parseTreeContainer.innerHTML = "";

    if (!result) {
      this.parseTreeContainer.innerHTML = '<div class="empty-message">No parse result</div>';
      return;
    }

    const pre = document.createElement("pre");
    pre.className = "parse-tree-text";
    pre.textContent = this.formatTree(result);
    this.parseTreeContainer.appendChild(pre);
  }

  private formatTree(node: any, indent: string = ""): string {
    if (!node) return "";

    let result = indent + (node.sym?.label || "?");
    if (node.value !== undefined && node.value !== null) {
      result += `: ${JSON.stringify(node.value)}`;
    }
    result += "\n";

    if (node.children) {
      for (const child of node.children) {
        result += this.formatTree(child, indent + "  ");
      }
    }

    return result;
  }

  private updateParseTable(): void {
    if (!this.parseTableContainer || !this.currentParser) return;

    try {
      const html = G.Printers.parseTableToHtml(this.currentParser.parseTable);
      this.parseTableContainer.innerHTML = html;
    } catch (e) {
      this.parseTableContainer.innerHTML = '<div class="error">Could not render parse table</div>';
    }
  }

  private updateNormalizedGrammar(): void {
    if (!this.normalizedEditor || !this.currentGrammar) return;

    const debugValue = this.currentGrammar.debugValue || [];
    this.normalizedEditor.setValue(debugValue.join("\n"), -1);
  }

  private updateEditorThemes(isDark: boolean): void {
    const theme = isDark ? "ace/theme/monokai" : "ace/theme/github";
    this.grammarEditor?.setTheme(theme);
    this.inputEditor?.setTheme(theme);
    this.normalizedEditor?.setTheme(theme);
  }

  private log(message: string, level: string = "info"): void {
    if (!this.consoleOutput) return;

    const entry = document.createElement("div");
    entry.className = `console-entry console-${level}`;

    const timestamp = new Date().toLocaleTimeString();
    entry.innerHTML = `<span class="console-time">[${timestamp}]</span> ${message}`;

    this.consoleOutput.appendChild(entry);
    this.consoleOutput.scrollTop = this.consoleOutput.scrollHeight;
  }
}

// Initialize on DOM ready
document.addEventListener("DOMContentLoaded", () => {
  (window as any).playgroundPage = new PlaygroundPage();
});

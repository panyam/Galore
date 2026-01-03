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

const LAYOUT_STORAGE_KEY = "galore-playground-layout";

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

  private isDarkMode(): boolean {
    return document.documentElement.classList.contains("dark");
  }

  private getEditorTheme(): string {
    return this.isDarkMode() ? "ace/theme/monokai" : "ace/theme/github";
  }

  private init(): void {
    const container = document.getElementById("dockview-container");
    if (!container) {
      console.error("Dockview container not found");
      return;
    }

    // Apply theme
    container.className = this.isDarkMode() ? "dockview-theme-dark" : "dockview-theme-light";

    // Watch for theme changes
    const observer = new MutationObserver(() => {
      const isDark = this.isDarkMode();
      container.className = isDark ? "dockview-theme-dark" : "dockview-theme-light";
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

    // Try to restore saved layout, otherwise create default
    if (!this.loadLayout()) {
      this.createDefaultLayout();
    }

    // Listen for layout changes to persist them
    this.dockview.onDidLayoutChange(() => {
      this.saveLayout();
    });

    // Setup event listeners
    this.setupEventListeners();

    // Load initial grammar
    this.selectGrammar(builtinGrammars.find((g) => g.selected) || builtinGrammars[0]);

    // Apply initial theme to editors (after they're created)
    // Use multiple timeouts to ensure editors are initialized
    setTimeout(() => this.updateEditorThemes(this.isDarkMode()), 100);
    setTimeout(() => this.updateEditorThemes(this.isDarkMode()), 500);
  }

  private saveLayout(): void {
    if (!this.dockview) return;
    try {
      const layout = this.dockview.toJSON();
      localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
    } catch (e) {
      console.warn("Failed to save layout:", e);
    }
  }

  private loadLayout(): boolean {
    if (!this.dockview) return false;
    try {
      const saved = localStorage.getItem(LAYOUT_STORAGE_KEY);
      if (saved) {
        const layout = JSON.parse(saved);
        this.dockview.fromJSON(layout);
        return true;
      }
    } catch (e) {
      console.warn("Failed to load layout:", e);
      localStorage.removeItem(LAYOUT_STORAGE_KEY);
    }
    return false;
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

    // Layout:
    // Left Panel: Parse Tree
    // Right Panel: Parse Table
    // Center Panel (3 rows): Grammar/Normalized (tabbed), Input, Console

    // Step 1: Create Grammar panel (will become center)
    this.dockview.addPanel({
      id: "grammar",
      component: "grammar",
      title: "Grammar",
    });

    // Step 2: Add Parse Tree to LEFT (establishes left column)
    this.dockview.addPanel({
      id: "parseTree",
      component: "parseTree",
      title: "Parse Tree",
      position: { direction: "left", referencePanel: "grammar" },
    });

    // Step 3: Add Parse Table to RIGHT (establishes right column)
    this.dockview.addPanel({
      id: "parseTable",
      component: "parseTable",
      title: "Parse Table",
      position: { direction: "right", referencePanel: "grammar" },
    });

    // Step 4: Now add rows to center column (below grammar)
    this.dockview.addPanel({
      id: "input",
      component: "input",
      title: "Input",
      position: { direction: "below", referencePanel: "grammar" },
    });

    // Step 5: Console below input (center row 3)
    this.dockview.addPanel({
      id: "console",
      component: "console",
      title: "Console",
      position: { direction: "below", referencePanel: "input" },
    });

    // Step 6: Normalized grammar tabbed with grammar
    this.dockview.addPanel({
      id: "normalizedGrammar",
      component: "normalizedGrammar",
      title: "Normalized Grammar",
      position: { direction: "within", referencePanel: "grammar" },
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
          this.grammarEditor.setTheme(this.getEditorTheme());
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
          this.inputEditor.setTheme(this.getEditorTheme());
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
          this.normalizedEditor.setTheme(this.getEditorTheme());
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
      const startTime = performance.now();
      // newParser returns [parser, tokenFunc, itemGraph]
      const [parser] = G.newParser(grammarText, {
        flatten: true,
        type: this.parserType as any,
      });
      const elapsed = (performance.now() - startTime).toFixed(2);

      this.currentParser = parser;
      this.currentGrammar = parser.grammar;

      this.eventHub.emit(Events.GRAMMAR_COMPILED, this.currentParser, this.currentGrammar);
      this.log(`Parser compiled (${this.parserType.toUpperCase()}) in ${elapsed}ms`);

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

    // Create SVG element
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.classList.add("parse-tree-svg");

    // Render tree and get dimensions
    const { element, width, height } = this.renderTreeNode(result, 0, 0);
    svg.appendChild(element);

    // Set SVG dimensions
    svg.setAttribute("width", String(width + 40));
    svg.setAttribute("height", String(height + 40));
    svg.setAttribute("viewBox", `0 0 ${width + 40} ${height + 40}`);

    this.parseTreeContainer.appendChild(svg);
  }

  private renderTreeNode(
    node: any,
    x: number,
    y: number
  ): { element: SVGGElement; width: number; height: number } {
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");

    const padding = 8;
    const nodeHeight = 28;
    const childIndent = 24;
    const verticalGap = 8;

    // Get label
    let label = node.sym?.label || "?";
    if (node.value !== undefined && node.value !== null && !node.children?.length) {
      label += `: ${JSON.stringify(node.value)}`;
    }

    // Estimate text width (approximate)
    const textWidth = label.length * 8 + padding * 2;

    // Create node rectangle
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", String(x));
    rect.setAttribute("y", String(y));
    rect.setAttribute("width", String(textWidth));
    rect.setAttribute("height", String(nodeHeight));
    rect.setAttribute("rx", "4");
    rect.setAttribute("ry", "4");
    rect.classList.add("parse-tree-node");
    if (node.children?.length) {
      rect.classList.add("non-terminal");
    } else {
      rect.classList.add("terminal");
    }
    g.appendChild(rect);

    // Create text
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", String(x + padding));
    text.setAttribute("y", String(y + nodeHeight / 2 + 4));
    text.classList.add("parse-tree-text");
    text.textContent = label;
    g.appendChild(text);

    let totalWidth = textWidth;
    let totalHeight = nodeHeight;

    // Render children
    if (node.children?.length) {
      let childY = y + nodeHeight + verticalGap;
      const childX = x + childIndent;

      for (const child of node.children) {
        // Draw connector line
        const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
        const lineX = x + childIndent / 2;
        const d = `M ${lineX} ${y + nodeHeight} V ${childY + nodeHeight / 2} H ${childX}`;
        line.setAttribute("d", d);
        line.classList.add("parse-tree-line");
        g.appendChild(line);

        // Render child node
        const childResult = this.renderTreeNode(child, childX, childY);
        g.appendChild(childResult.element);

        totalWidth = Math.max(totalWidth, childIndent + childResult.width);
        childY += childResult.height + verticalGap;
        totalHeight = childY - y - verticalGap;
      }
    }

    return { element: g, width: totalWidth, height: totalHeight };
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

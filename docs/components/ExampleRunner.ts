/**
 * ExampleRunner - Interactive component for grammar examples
 *
 * Provides a 2-column layout with:
 * - Column 1: Grammar (editable with copy button)
 * - Column 2: Input (editable) + Output (parse tree + action result)
 * - Below: Action code (read-only with copy button)
 * - Run button to compile, parse, and execute
 */

import * as G from "galore";
import ace from "ace-builds";
import "ace-builds/src-min-noconflict/mode-text";
import "ace-builds/src-min-noconflict/mode-javascript";
import "ace-builds/src-min-noconflict/theme-monokai";
import "ace-builds/src-min-noconflict/theme-github";
import { builtinGrammars, BuiltinGrammar } from "./configs";
import { ActionCompiler, ActionRunResult } from "./ActionCompiler";
import { initPageSetup } from "./common/pageSetup";

interface ExampleConfig {
  // Either provide grammarName to look up from builtinGrammars, or provide grammar/input directly
  grammarName?: string;
  grammar?: string;
  input?: string;
  actionCode?: string;
  actionFn?: (node: any) => any;
}

export class ExampleRunner {
  private container: HTMLElement;
  private config: ExampleConfig;
  private resolvedGrammar: string = "";
  private resolvedInput: string = "";
  private resolvedActionCode: string = "";

  private grammarEditor: ace.Ace.Editor | null = null;
  private inputEditor: ace.Ace.Editor | null = null;
  private actionEditor: ace.Ace.Editor | null = null;
  private outputContainer: HTMLElement | null = null;

  private currentParser: G.Parser | null = null;
  private actionCompiler: ActionCompiler | null = null;
  private actionCodeModified: boolean = false;
  private originalActionCode: string = "";

  constructor(containerId: string, config: ExampleConfig) {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`Container #${containerId} not found`);
      return;
    }
    this.container = container;
    this.config = config;

    // Resolve grammar from builtinGrammars if grammarName is provided
    if (config.grammarName) {
      const builtin = builtinGrammars.find((g) => g.name === config.grammarName);
      if (builtin) {
        this.resolvedGrammar = builtin.grammar;
        this.resolvedInput = config.input || builtin.sampleInput || "";
        this.resolvedActionCode = config.actionCode || builtin.actionCode || "";
      } else {
        console.error(`Grammar "${config.grammarName}" not found in builtinGrammars`);
        this.resolvedGrammar = config.grammar || "";
        this.resolvedInput = config.input || "";
        this.resolvedActionCode = config.actionCode || "";
      }
    } else {
      this.resolvedGrammar = config.grammar || "";
      this.resolvedInput = config.input || "";
      this.resolvedActionCode = config.actionCode || "";
    }

    this.init();
  }

  private isDarkMode(): boolean {
    return document.documentElement.classList.contains("dark");
  }

  private getEditorTheme(): string {
    return this.isDarkMode() ? "ace/theme/monokai" : "ace/theme/github";
  }

  private init(): void {
    this.render();
    this.setupEditors();
    this.setupEventListeners();

    // Watch for theme changes
    const observer = new MutationObserver(() => {
      this.updateEditorThemes();
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    // Auto-run on load
    setTimeout(() => this.run(), 100);
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="example-runner">
        <div class="example-main">
          <div class="example-column example-grammar-column">
            <div class="example-panel-header">
              <span class="example-panel-title">Grammar</span>
              <button class="example-copy-btn" data-target="grammar" title="Copy grammar">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </button>
            </div>
            <div class="example-editor-container" id="example-grammar-editor"></div>
          </div>
          <div class="example-column example-io-column">
            <div class="example-io-row example-input-row">
              <div class="example-panel-header">
                <span class="example-panel-title">Input</span>
                <button class="example-run-btn" title="Run">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                  </svg>
                  Run
                </button>
              </div>
              <div class="example-editor-container example-input-editor" id="example-input-editor"></div>
            </div>
            <div class="example-io-row example-output-row">
              <div class="example-panel-header">
                <span class="example-panel-title">Output</span>
              </div>
              <div class="example-output-container" id="example-output"></div>
            </div>
          </div>
        </div>
        ${
          this.resolvedActionCode
            ? `
        <div class="example-actions">
          <div class="example-panel-header">
            <span class="example-panel-title">Action Code</span>
            <span class="example-action-status" id="example-action-status"></span>
            <button class="example-copy-btn" data-target="action" title="Copy action code">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
          </div>
          <div class="example-editor-container" id="example-action-editor"></div>
        </div>
        `
            : ""
        }
      </div>
    `;
  }

  private setupEditors(): void {
    const theme = this.getEditorTheme();

    // Grammar editor (editable)
    const grammarContainer = this.container.querySelector("#example-grammar-editor") as HTMLElement;
    if (grammarContainer) {
      this.grammarEditor = ace.edit(grammarContainer);
      this.grammarEditor.setTheme(theme);
      this.grammarEditor.session.setMode("ace/mode/text");
      this.grammarEditor.setValue(this.resolvedGrammar.trim(), -1);
      // Disable Temporarily:
      // this.grammarEditor.setReadOnly(true);
      this.grammarEditor.setOptions({
        fontSize: "13px",
        showPrintMargin: false,
        maxLines: 20,
        minLines: 5,
      });
    }

    // Input editor (editable)
    const inputContainer = this.container.querySelector("#example-input-editor") as HTMLElement;
    if (inputContainer) {
      this.inputEditor = ace.edit(inputContainer);
      this.inputEditor.setTheme(theme);
      this.inputEditor.session.setMode("ace/mode/text");
      this.inputEditor.setValue(this.resolvedInput.trim(), -1);
      this.inputEditor.setOptions({
        fontSize: "13px",
        showPrintMargin: false,
        maxLines: 10,
        minLines: 3,
      });
    }

    // Action editor (editable, if action code provided)
    if (this.resolvedActionCode) {
      const actionContainer = this.container.querySelector("#example-action-editor") as HTMLElement;
      if (actionContainer) {
        this.actionEditor = ace.edit(actionContainer);
        this.actionEditor.setTheme(theme);
        this.actionEditor.session.setMode("ace/mode/javascript");
        this.originalActionCode = this.resolvedActionCode.trim();
        this.actionEditor.setValue(this.originalActionCode, -1);
        this.actionEditor.setOptions({
          fontSize: "13px",
          showPrintMargin: false,
          maxLines: 25,
          minLines: 5,
        });

        // Track modifications
        this.actionEditor.session.on("change", () => {
          this.actionCodeModified = this.actionEditor!.getValue() !== this.originalActionCode;
        });

        // Setup ActionCompiler
        const statusEl = this.container.querySelector("#example-action-status") as HTMLElement;
        this.actionCompiler = new ActionCompiler(this.actionEditor, statusEl);
        // Initial compilation
        this.actionCompiler.compile();
      }
    }

    // Output container
    this.outputContainer = this.container.querySelector("#example-output");
  }

  private setupEventListeners(): void {
    // Run button
    const runBtn = this.container.querySelector(".example-run-btn");
    if (runBtn) {
      runBtn.addEventListener("click", () => this.run());
    }

    // Copy buttons
    const copyBtns = this.container.querySelectorAll(".example-copy-btn");
    copyBtns.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const target = (e.currentTarget as HTMLElement).dataset.target;
        this.copyToClipboard(target || "");
      });
    });

    // Ctrl+Enter to run
    this.inputEditor?.commands.addCommand({
      name: "run",
      bindKey: { win: "Ctrl-Enter", mac: "Cmd-Enter" },
      exec: () => this.run(),
    });
  }

  private updateEditorThemes(): void {
    const theme = this.getEditorTheme();
    this.grammarEditor?.setTheme(theme);
    this.inputEditor?.setTheme(theme);
    this.actionEditor?.setTheme(theme);
  }

  private copyToClipboard(target: string): void {
    let text = "";
    if (target === "grammar" && this.grammarEditor) {
      text = this.grammarEditor.getValue();
    } else if (target === "action" && this.actionEditor) {
      text = this.actionEditor.getValue();
    }

    if (text) {
      navigator.clipboard.writeText(text).then(() => {
        this.showCopyFeedback(target);
      });
    }
  }

  private showCopyFeedback(target: string): void {
    const btn = this.container.querySelector(`[data-target="${target}"]`);
    if (btn) {
      const originalHTML = btn.innerHTML;
      btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>`;
      setTimeout(() => {
        btn.innerHTML = originalHTML;
      }, 1500);
    }
  }

  private run(): void {
    if (!this.outputContainer) return;

    const grammarText = this.grammarEditor?.getValue() || "";
    const inputText = this.inputEditor?.getValue() || "";

    this.outputContainer.innerHTML = '<div class="example-loading">Running...</div>';

    try {
      // Compile grammar
      const [parser] = G.newParser(grammarText, {
        type: "lalr",
        flatten: true,
      });
      this.currentParser = parser;

      // Parse input
      const parseResult = parser.parse(inputText);

      // Run action if provided
      let actionResult: any = null;
      let actionError: { message: string; line?: number } | null = null;

      // Use ActionCompiler if code was modified, otherwise fall back to config.actionFn
      if (this.actionCompiler && this.actionCodeModified && parseResult) {
        // User modified the code - use the compiled version
        const runResult = this.actionCompiler.run(parseResult);
        if (runResult.success) {
          actionResult = runResult.result;
        } else if (runResult.error) {
          actionError = { message: runResult.error, line: runResult.line ?? undefined };
        }
      } else if (this.config.actionFn && parseResult) {
        // Use the config's action function (original behavior)
        try {
          actionResult = this.config.actionFn(parseResult);
        } catch (e: any) {
          actionError = { message: e.message };
        }
      } else if (this.actionCompiler && parseResult) {
        // No actionFn, use ActionCompiler
        const runResult = this.actionCompiler.run(parseResult);
        if (runResult.success) {
          actionResult = runResult.result;
        } else if (runResult.error) {
          actionError = { message: runResult.error, line: runResult.line ?? undefined };
        }
      }

      // Display results
      this.displayResults(parseResult, actionResult, actionError);
    } catch (e: any) {
      this.outputContainer.innerHTML = `<div class="example-error">${this.escapeHtml(e.message)}</div>`;
    }
  }

  private displayResults(
    parseResult: any,
    actionResult: any,
    actionError: { message: string; line?: number } | null = null,
  ): void {
    if (!this.outputContainer) return;

    let html = '<div class="example-results">';

    // Action error (if any) - show first with line marker
    if (actionError) {
      html += '<div class="example-result-section">';
      html += '<div class="example-result-label">Action Error:</div>';
      html += '<div class="example-action-error">';
      html += `<span class="example-error">${this.escapeHtml(actionError.message)}</span>`;
      if (actionError.line !== undefined) {
        html += `<span class="example-error-line"> (line ${actionError.line + 1})</span>`; // Display as 1-indexed
      }
      html += "</div>";
      html += "</div>";
    }

    // Action result (if any) - show first
    if (actionResult !== null && !actionError) {
      html += '<div class="example-result-section">';
      html += '<div class="example-result-label">Result:</div>';
      html += '<div class="example-action-result">';
      // For strings, display directly (preserving newlines); for other types, use JSON
      const displayValue = typeof actionResult === "string"
        ? actionResult
        : JSON.stringify(actionResult, null, 2);
      html += `<pre class="example-value">${this.escapeHtml(displayValue)}</pre>`;
      html += "</div>";
      html += "</div>";
    }

    // Parse tree
    html += '<div class="example-result-section">';
    html += '<div class="example-result-label">Parse Tree:</div>';
    html += '<div class="example-parse-tree">';
    html += this.renderParseTree(parseResult);
    html += "</div>";
    html += "</div>";

    html += "</div>";
    this.outputContainer.innerHTML = html;
  }

  private renderParseTree(node: any, indent: number = 0): string {
    if (!node) return '<span class="example-null">null</span>';

    const padding = "  ".repeat(indent);
    let html = "";

    const label = node.sym?.label || "?";
    const hasChildren = node.children && node.children.length > 0;

    if (hasChildren) {
      html += `${padding}<span class="example-node">${this.escapeHtml(label)}</span>\n`;
      for (const child of node.children) {
        html += this.renderParseTree(child, indent + 1);
      }
    } else {
      const value = node.value !== undefined ? `: ${JSON.stringify(node.value)}` : "";
      html += `${padding}<span class="example-leaf">${this.escapeHtml(label)}</span><span class="example-value">${this.escapeHtml(value)}</span>\n`;
    }

    return html;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}

// Auto-initialize from data attributes
document.addEventListener("DOMContentLoaded", () => {
  // Initialize common page setup (sidebar highlighting, etc.)
  initPageSetup();

  const containers = document.querySelectorAll("[data-example-runner]");
  containers.forEach((container) => {
    const id = container.id;
    const configAttr = container.getAttribute("data-example-config");
    if (id && configAttr) {
      try {
        const config = JSON.parse(configAttr);
        new ExampleRunner(id, config);
      } catch (e) {
        console.error("Failed to parse example config:", e);
      }
    }
  });
});

// Export for manual initialization
(window as any).ExampleRunner = ExampleRunner;

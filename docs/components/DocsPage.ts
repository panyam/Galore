/**
 * DocsPage.ts - Main entry point for documentation pages
 * Discovers and initializes grammar sandbox elements and code blocks on the page
 */

import * as G from "galore";
import { GrammarSandbox } from "./GrammarSandbox";
import { initCodeBlocks, initPageSetup } from "@panyam/tsappkit";

// Expose galore globally for debugging
(window as any).G = G;

export class DocsPage {
  sandboxes: GrammarSandbox[] = [];

  constructor() {
    this.initSandboxes();
    this.initCodeBlocks();
    initPageSetup();
  }

  private initSandboxes(): void {
    // Find all <grammar-sandbox> elements on the page
    const elements = document.querySelectorAll("grammar-sandbox");

    elements.forEach((element, index) => {
      // Ensure each sandbox has an ID
      if (!element.id) {
        element.id = `grammar-sandbox-${index}`;
      }

      const sandbox = new GrammarSandbox(element as HTMLElement);
      this.sandboxes.push(sandbox);
    });

    if (this.sandboxes.length > 0) {
      console.log(`DocsPage: Initialized ${this.sandboxes.length} grammar sandboxes`);
    }
  }

  private initCodeBlocks(): void {
    initCodeBlocks();
  }
}

// Initialize on DOM ready
document.addEventListener("DOMContentLoaded", () => {
  (window as any).docsPage = new DocsPage();
});

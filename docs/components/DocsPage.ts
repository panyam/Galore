/**
 * DocsPage.ts - Main entry point for documentation pages
 * Discovers and initializes grammar sandbox elements on the page
 */

import * as G from "galore";
import { GrammarSandbox } from "./GrammarSandbox";

// Expose galore globally for debugging
(window as any).G = G;

export class DocsPage {
  sandboxes: GrammarSandbox[] = [];

  constructor() {
    this.initSandboxes();
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

    console.log(`DocsPage: Initialized ${this.sandboxes.length} grammar sandboxes`);
  }
}

// Initialize on DOM ready
document.addEventListener("DOMContentLoaded", () => {
  (window as any).docsPage = new DocsPage();
});

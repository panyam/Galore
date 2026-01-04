/**
 * CodeBlock.ts - Enhances pre/code blocks with copy functionality
 * Automatically finds all pre>code elements and adds a copy button
 */

export class CodeBlock {
  private container: HTMLElement;
  private copyButton: HTMLButtonElement;
  private codeElement: HTMLElement;

  constructor(preElement: HTMLPreElement) {
    this.codeElement = preElement.querySelector('code') || preElement;

    // Wrap pre in a container for positioning
    this.container = document.createElement('div');
    this.container.className = 'code-block';
    preElement.parentNode?.insertBefore(this.container, preElement);
    this.container.appendChild(preElement);

    // Create copy button
    this.copyButton = document.createElement('button');
    this.copyButton.className = 'code-block-copy';
    this.copyButton.setAttribute('aria-label', 'Copy code');
    this.copyButton.innerHTML = this.getCopyIcon();
    this.copyButton.addEventListener('click', () => this.copyCode());

    this.container.appendChild(this.copyButton);
  }

  private getCopyIcon(): string {
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg>`;
  }

  private getCheckIcon(): string {
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>`;
  }

  private async copyCode(): Promise<void> {
    const text = this.codeElement.textContent || '';

    try {
      await navigator.clipboard.writeText(text);
      this.showSuccess();
    } catch (err) {
      // Fallback for older browsers
      this.fallbackCopy(text);
    }
  }

  private fallbackCopy(text: string): void {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();

    try {
      document.execCommand('copy');
      this.showSuccess();
    } catch (err) {
      console.error('Failed to copy:', err);
    }

    document.body.removeChild(textarea);
  }

  private showSuccess(): void {
    this.copyButton.innerHTML = this.getCheckIcon();
    this.copyButton.classList.add('copied');

    setTimeout(() => {
      this.copyButton.innerHTML = this.getCopyIcon();
      this.copyButton.classList.remove('copied');
    }, 2000);
  }
}

/**
 * Initialize all code blocks on the page
 */
export function initCodeBlocks(): void {
  const preElements = document.querySelectorAll('.content-body pre');

  preElements.forEach((pre) => {
    // Skip if already initialized
    if (pre.parentElement?.classList.contains('code-block')) {
      return;
    }
    new CodeBlock(pre as HTMLPreElement);
  });
}

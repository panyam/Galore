/**
 * Simple event hub for component communication
 */

type EventCallback = (...args: any[]) => void;

export class EventHub {
  private listeners: Map<string, Set<EventCallback>> = new Map();

  on(event: string, callback: EventCallback): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: EventCallback): void {
    this.listeners.get(event)?.delete(callback);
  }

  emit(event: string, ...args: any[]): void {
    this.listeners.get(event)?.forEach((callback) => {
      try {
        callback(...args);
      } catch (e) {
        console.error(`Error in event handler for ${event}:`, e);
      }
    });
  }
}

// Event names
export const Events = {
  GRAMMAR_COMPILED: "grammarCompiled",
  GRAMMAR_SELECTED: "grammarSelected",
  INPUT_PARSED: "inputParsed",
  LOG: "log",
};

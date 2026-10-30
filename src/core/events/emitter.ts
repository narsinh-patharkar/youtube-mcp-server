/**
 * Event Emitter - Lightweight typed event emitter
 */

type EventHandler<T = unknown> = (payload: T) => void | Promise<void>;

interface EventSubscription {
  unsubscribe: () => void;
}

/**
 * Typed event emitter with subscription management
 */
export class EventEmitter<TEventMap extends Record<string, unknown> = Record<string, unknown>> {
  private handlers: Map<keyof TEventMap, Set<EventHandler>> = new Map();

  /**
   * Subscribe to an event
   */
  on<K extends keyof TEventMap>(event: K, handler: EventHandler<TEventMap[K]>): EventSubscription {
    const handlers = this.handlers.get(event) ?? new Set();
    handlers.add(handler as EventHandler);
    this.handlers.set(event, handlers);

    return {
      unsubscribe: () => this.off(event, handler),
    };
  }

  /**
   * Subscribe to an event (one-time)
   */
  once<K extends keyof TEventMap>(event: K, handler: EventHandler<TEventMap[K]>): EventSubscription {
    const wrappedHandler: EventHandler<TEventMap[K]> = async (payload) => {
      this.off(event, wrappedHandler);
      await handler(payload);
    };
    return this.on(event, wrappedHandler);
  }

  /**
   * Unsubscribe from an event
   */
  off<K extends keyof TEventMap>(event: K, handler: EventHandler<TEventMap[K]>): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      handlers.delete(handler as EventHandler);
      if (handlers.size === 0) {
        this.handlers.delete(event);
      }
    }
  }

  /**
   * Emit an event to all subscribers
   */
  async emit<K extends keyof TEventMap>(event: K, payload: TEventMap[K]): Promise<void> {
    const handlers = this.handlers.get(event);
    if (!handlers || handlers.size === 0) {
      return;
    }

    await Promise.all(
      Array.from(handlers).map(async (handler) => {
        try {
          await handler(payload);
        } catch (error) {
          console.error(`Event handler error for ${String(event)}:`, error);
        }
      })
    );
  }

  /**
   * Emit synchronously (fire and forget)
   */
  emitSync<K extends keyof TEventMap>(event: K, payload: TEventMap[K]): void {
    const handlers = this.handlers.get(event);
    if (!handlers || handlers.size === 0) {
      return;
    }

    for (const handler of handlers) {
      try {
        handler(payload);
      } catch (error) {
        console.error(`Event handler error for ${String(event)}:`, error);
      }
    }
  }

  /**
   * Get handler count for an event
   */
  listenerCount<K extends keyof TEventMap>(event: K): number {
    return this.handlers.get(event)?.size ?? 0;
  }

  /**
   * Remove all handlers for an event
   */
  removeAllListeners<K extends keyof TEventMap>(event?: K): void {
    if (event) {
      this.handlers.delete(event);
    } else {
      this.handlers.clear();
    }
  }
}

/**
 * Global event emitter instance
 */
let _eventEmitter: EventEmitter | null = null;

export function getEventEmitter<TEventMap extends Record<string, unknown> = Record<string, unknown>>(): EventEmitter<TEventMap> {
  if (!_eventEmitter) {
    _eventEmitter = new EventEmitter();
  }
  return _eventEmitter as EventEmitter<TEventMap>;
}

export function initializeEventEmitter<TEventMap extends Record<string, unknown> = Record<string, unknown>>(): EventEmitter<TEventMap> {
  _eventEmitter = new EventEmitter();
  return _eventEmitter as EventEmitter<TEventMap>;
}

export function resetEventEmitter(): void {
  _eventEmitter = null;
}
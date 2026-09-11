export type EventHandler<T> = (payload: T) => void | Promise<void>;

export class EventBus<TEvents extends object> {
  private readonly handlers = new Map<keyof TEvents, Set<EventHandler<unknown>>>();

  on<K extends keyof TEvents>(type: K, handler: EventHandler<TEvents[K]>): () => void {
    const handlers = this.handlers.get(type) ?? new Set<EventHandler<unknown>>();
    handlers.add(handler as EventHandler<unknown>);
    this.handlers.set(type, handlers);
    return () => handlers.delete(handler as EventHandler<unknown>);
  }

  async emit<K extends keyof TEvents>(type: K, payload: TEvents[K]): Promise<void> {
    for (const handler of this.handlers.get(type) ?? []) await handler(payload);
  }

  clear(): void { this.handlers.clear(); }
}

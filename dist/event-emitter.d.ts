type EventsMap = Record<string, unknown[]>;
export declare class EventEmitter<E extends EventsMap> {
    private events;
    on<K extends keyof E>(event: K, listener: (...args: E[K]) => void): void;
    emit<K extends keyof E>(event: K, ...args: E[K]): void;
}
export {};

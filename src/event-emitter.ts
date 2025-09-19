type EventsMap = Record<string, unknown[]>;

export class EventEmitter<E extends EventsMap> {
	private events = new Map<keyof E, Set<(...args: E[keyof E]) => void>>();

	on<K extends keyof E>(event: K, listener: (...args: E[K]) => void): void {
		const set =
			(this.events.get(event) as Set<(...args: E[K]) => void>) ?? new Set();
		set.add(listener);
		this.events.set(
			event,
			set as unknown as Set<(...args: E[keyof E]) => void>,
		);
	}

	emit<K extends keyof E>(event: K, ...args: E[K]): void {
		const set = this.events.get(event) as
			| Set<(...args: E[K]) => void>
			| undefined;
		if (!set) return;
		for (const fn of set) setTimeout(() => fn(...args), 0);
	}
}

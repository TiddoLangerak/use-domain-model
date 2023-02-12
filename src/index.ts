
type Watchable = object;

function isWatchable(t: any): t is Watchable {
    return typeof t === 'object' && !!t;
}

export function watch<T extends Watchable>(obj: T, onChange: () => void) {
    for (const prop of Object.getOwnPropertyNames(obj)) {
        const original = Object.getOwnPropertyDescriptor(obj, prop);

        let val = (obj as Record<string, unknown>)[prop];

        if (isWatchable(val)) {
            watch(val, onChange);
        }

        Object.defineProperty(obj, prop, {
            get() {
                return val;
            },
            set(newVal) {
                val = newVal;
                // TODO: unwatch original val
                if (isWatchable(val)) {
                    watch(val, onChange);
                }
                onChange();
            },
            configurable: original!.configurable,
            enumerable: original!.enumerable,
        });
    }
}

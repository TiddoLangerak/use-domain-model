
export type Watchable = object;

function isWatchable(t: any): t is Watchable {
    return typeof t === 'object' && !!t;
}

export function watch<T extends Watchable>(obj: T, onChange: () => void) {
    for (const prop of Object.getOwnPropertyNames(obj)) {
        const descriptor = Object.getOwnPropertyDescriptor(obj, prop)!;

        if ('value' in descriptor) {
            setupPropertyWatcher(obj, prop as keyof T, descriptor, onChange);
        }
}

function setupPropertyWatcher<T extends Watchable>(obj: T, prop: keyof T, descriptor: PropertyDescriptor, onChange: () => void) {
    let val = obj[prop];

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
        configurable: descriptor.configurable,
        enumerable: descriptor.enumerable,
    });
}
}

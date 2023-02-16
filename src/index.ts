
export type Watchable = object;

function isWatchable(t: any): t is Watchable {
    return typeof t === 'object' && !!t;
}

export function watch<T extends Watchable>(obj: T, onChange: () => void) {
    for (const prop of Object.getOwnPropertyNames(obj)) {
        const descriptor = Object.getOwnPropertyDescriptor(obj, prop)!;

        if ('value' in descriptor) {
            setupPropertyWatcher(obj, prop as keyof T, descriptor, onChange);
        } else if ('set' in descriptor) {
            setupAccessorWatcher(obj, prop as keyof T, descriptor, onChange);
        } else {
            throw new Error("No value nor setter in the object");
        }
    }

    const proto = Object.getPrototypeOf(obj);
    if (isWatchable(proto) && proto !== Object) {
        // TODO: Can we do this?!?
        // TODO: needs tests
        watch(proto, onChange);
    }
}

// TODO: accessors on classes are set on prototype, and therefore not very suitable for the current approach.
// However, we might be able to use proxies for this.


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

// TODO: test accessors with nested values
function setupAccessorWatcher<T extends Watchable>(obj: T, prop: keyof T, descriptor: PropertyDescriptor, onChange: () => void) {

    Object.defineProperty(obj, prop, {
        get: descriptor.get,
        set(newVal) {
            descriptor.set!(newVal);
            onChange();
        },
        configurable: descriptor.configurable,
        enumerable: descriptor.enumerable,
    });
}

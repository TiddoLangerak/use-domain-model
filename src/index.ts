/**
 * TODO:
 * getters and setters are on the prototype
 * We can manually intercept the prototype and replace it with a proxy
 */

export type Watchable = object;
export type CB = () => void;

function isWatchable(t: any): t is Watchable {
    return typeof t === 'object' && !!t;
}

const watchers: WeakMap<Watchable, CB[]> = new WeakMap();
export function watch<T extends Watchable>(obj: T, onChange: CB) {
    // TODO: do thsi conditionally
    patchObject(obj);
    const w = watchers.get(obj) || [];
    w.push(onChange);
    watchers.set(obj, w);
    return function unwatch() {
        const idx = w.indexOf(onChange);
        if (idx !== -1) {
            w.splice(idx, 1);
        }
    }
}

function patchObject<T extends Watchable>(obj: T) {
    function onChange(thiz: any) {
        (watchers.get(thiz) || []).forEach(cb => cb());
    }
    return _patchObject(obj, onChange);
}

const patched: WeakSet<Watchable> = new WeakSet();

function _patchObject<T extends Watchable>(obj: T, onChange: (thiz: any) => void) {
    if (patched.has(obj)) {
        return;
    }

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
    patched.add(obj);

    const proto = Object.getPrototypeOf(obj);
    if (isWatchable(proto) && proto !== Object) {
        // TODO: Can we do this?!?
        // TODO: needs tests
        _patchObject(proto, onChange);
    }
}

// TODO: accessors on classes are set on prototype, and therefore not very suitable for the current approach.
// However, we might be able to use proxies for this.


function setupPropertyWatcher<T extends Watchable>(obj: T, prop: keyof T, descriptor: PropertyDescriptor, onChange: (thiz: T) => void) {
    let val = descriptor.value!;
    let unwatch = () => {};

    if (isWatchable(val)) {
        unwatch = watch(val, () => onChange(obj));
    }

    Object.defineProperty(obj, prop, {
        get() {
            return val;
        },
        set(newVal) {
            val = newVal;
            unwatch();
            // TODO: unwatch original val
            if (isWatchable(val)) {
                unwatch = watch(val, () => onChange(obj));
            }
            onChange(this);
        },
        configurable: descriptor.configurable,
        enumerable: descriptor.enumerable,
    });
}

// TODO: test accessors with nested values
function setupAccessorWatcher<T extends Watchable>(obj: T, prop: keyof T, descriptor: PropertyDescriptor, onChange: (thiz: T) => void) {

    Object.defineProperty(obj, prop, {
        get: descriptor.get,
        set(newVal) {
            descriptor.set!(newVal);
            onChange(this);
        },
        configurable: descriptor.configurable,
        enumerable: descriptor.enumerable,
    });
}

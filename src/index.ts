export type Watchable = object;
export type CB = () => void;

const watchers: WeakMap<Watchable, CB[]> = new WeakMap();

function getWatchers(target: Watchable) {
    if (!watchers.has(target)) {
        watchers.set(target, []);
    }
    return watchers.get(target)!;
}

function registerListener(obj: Watchable, onChange:CB) {
    getWatchers(obj).push(onChange);
}

export function watch<T extends Watchable>(obj: T, onChange: CB) {
    attachGlobalListeners(obj);
    registerListener(obj, onChange);

    return function unwatch() {
        const watchers = getWatchers(obj);
        const idx = watchers.indexOf(onChange);
        if (idx !== -1) {
            watchers.splice(idx, 1);
        }
    }
}

function attachGlobalListeners<T extends Watchable>(obj: T) {
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

    for (const prop of [...Object.getOwnPropertyNames(obj), ...Object.getOwnPropertySymbols(obj)]) {
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
        _patchObject(proto, onChange);
    }
}

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

function isWatchable(t: any): t is Watchable {
    return typeof t === 'object' && !!t;
}

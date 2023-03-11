export type Watchable = object;
export type CB = () => void;

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

function registerListener(obj: Watchable, onChange: CB) {
    getWatchers(obj).push(onChange);
}

function attachGlobalListeners<T extends Watchable>(obj: T) {
    function onChange(thiz: Watchable) {
        /**
         * It's not imediately obvious why we pass `thiz` around here, as it
         * seems that we could just as well use `obj`. However, that won't work:
         *
         * Lets say that we have 2 objects with the same prototype.
         * E.g. they both are of class BaseClass
         *
         * When we watch the first one, then we'll not only patch the instance,
         * but also it's prototype.
         * When we watch the second one, we've already patched the prototype,
         * so that will be skipped.
         *
         * But now let's say we have accessors defined on the class. Accessors
         * end up on the prototype, not the instance, and hence these are only patched
         * on watching the first instance. This also means that any triggers
         * through the accessors will always end up calling the `onChange` created
         * for the first watch, regardless on which instance the accessors are called.
         *
         * If we'd use `getWatchers(obj)`, then any time an accessor is called it would trigger
         * the _first_ instance, even if the accessors are called on different instances.
         *
         * We therefore must explicitely pass the `this` object around, such that we can trigger
         * the correct callbacks.
         */
        getWatchers(thiz).forEach(cb => cb());
    }
    return patchObject(obj, onChange);
}

const patched: WeakSet<Watchable> = new WeakSet();

function patchObject<T extends Watchable>(obj: T, onChange: (thiz: Watchable) => void) {
    if (patched.has(obj)) {
        return;
    }

    // Patching direct props
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

    // We'll also need to patch the proto. This is most relevant for accessors:
    // When defining accessors on a class, these will end up on the prototype.
    // We need to intercept those, too
    const proto = Object.getPrototypeOf(obj);
    if (isWatchable(proto) && proto !== Object) {
        patchObject(proto, onChange);
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
            if (isWatchable(val)) {
                unwatch = watch(val, () => onChange(this));
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

const watchers: WeakMap<Watchable, CB[]> = new WeakMap();
function getWatchers(target: Watchable) {
    if (!watchers.has(target)) {
        watchers.set(target, []);
    }
    return watchers.get(target)!;
}


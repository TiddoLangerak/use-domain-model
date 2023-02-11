export function watch<T extends object>(obj: T, onChange: () => void) {
    for (const prop of Object.getOwnPropertyNames(obj)) {
        const original = Object.getOwnPropertyDescriptor(obj, prop);

        let val = obj[prop];

        Object.defineProperty(obj, prop, {
            get() {
                return val;
            },
            set(newVal) {
                val = newVal;
                onChange();
            },
            configurable: original.configurable,
            enumerable: original.enumerable,
        });
    }
}

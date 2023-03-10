import tap from 'tap';
import sinon from 'sinon';
import { watch, Watchable } from './index';

interface Counter {
    incrementBound: null | ( () => unknown);
    incrementUnbound: null | ( () => unknown);
    incrementBoundAsync: null | ( () => Promise<any>);
    incrementUnboundAsync: null | ( () => Promise<any>);
    incrementBoundTimeout: null | ( () => unknown);
    incrementUnboundTimeout: null | (() => unknown);
}

class Base implements Counter {
    count: number = 0;
    construtor() {}

    incrementBound = () => this.count++;
    incrementUnbound() { this.count++; };
    incrementBoundAsync = async () => this.count++;
    async incrementUnboundAsync() { this.count++; };
    incrementBoundTimeout = () => {
        setTimeout(() => this.count++);
    }
    incrementUnboundTimeout() {
        setTimeout(() => this.count++);
    }
}

class InheritedChild extends Base {}

class BaseCounter {
    count: number = 0;
    constructor() {}
}

class ImplementedChild extends BaseCounter implements Counter {
    incrementBound = () => this.count++;
    incrementUnbound() { this.count++; };
    incrementBoundAsync = async () => this.count++;
    async incrementUnboundAsync() { this.count++; };
    incrementBoundTimeout = () => {
        setTimeout(() => this.count++);
    }
    incrementUnboundTimeout() {
        setTimeout(() => this.count++);
    }
}

const counts : WeakMap<Accessors, number> = new WeakMap();
class Accessors implements Counter {
    get count() {
        return counts.get(this)!;
    }
    set count(val) {
        counts.set(this, counts.get(this)! + 1);
    }

    construtor() {
        counts.set(this, 0);
    }

    incrementBound = () => this.count++;
    incrementUnbound() { this.count++; };
    incrementBoundAsync = async () => this.count++;
    async incrementUnboundAsync() { this.count++; };
    incrementBoundTimeout = () => {
        setTimeout(() => this.count++);
    }
    incrementUnboundTimeout() {
        setTimeout(() => this.count++);
    }
}

const countSymbol = Symbol();
class Symbols implements Counter {
    [countSymbol] = 0;
    construtor() {}

    incrementBound = () => this[countSymbol]++;
    incrementUnbound() { this[countSymbol]++; };
    incrementBoundAsync = async () => this[countSymbol]++;
    async incrementUnboundAsync() { this[countSymbol]++; };
    incrementBoundTimeout = () => {
        setTimeout(() => this[countSymbol]++);
    }
    incrementUnboundTimeout() {
        setTimeout(() => this[countSymbol]++);
    }
}

function createObject(): Counter {
    const obj = {
        count: 0,
        incrementUnbound: () => obj.count++,
        incrementUnboundAsync: async () => obj.count++,
        incrementUnboundTimeout: () => setTimeout(() => obj.count++),
        incrementBound: null,
        incrementBoundAsync: null,
        incrementBoundTimeout: null,
    };
    return obj;
}

function createAccessorObject(): Counter {
    let realCount = 0;
    const obj = {
        get count() {
            return realCount;
        },
        set count(val) {
            realCount = val;
        },
        incrementUnbound: () => obj.count++,
        incrementUnboundAsync: async () => obj.count++,
        incrementUnboundTimeout: () => setTimeout(() => obj.count++),
        incrementBound: null,
        incrementBoundAsync: null,
        incrementBoundTimeout: null,
    };
    return obj;
}

function createNestedAccessorObject(): Counter {
    let realCount = 0;
    const obj = {
        nested: {
            get count() {
                return realCount;
            },
            set count(val) {
                realCount = val;
            },
        },
        incrementUnbound: () => obj.nested.count++,
        incrementUnboundAsync: async () => obj.nested.count++,
        incrementUnboundTimeout: () => setTimeout(() => obj.nested.count++),
        incrementBound: null,
        incrementBoundAsync: null,
        incrementBoundTimeout: null,
    };
    return obj;
}

class NestedObject implements Counter {
    nested: { count: number };
    constructor() {
    this.nested = { count: 0 };
}

    incrementBound = () => this.nested.count++;
    incrementUnbound() {
        this.nested.count++;
    };
    incrementBoundAsync = async () => this.nested.count++;
    async incrementUnboundAsync() { this.nested.count++; };
    incrementBoundTimeout = () => {
        setTimeout(() => this.nested.count++);
    }
    incrementUnboundTimeout() {
        setTimeout(() => this.nested.count++);
    }
}

tap.only("watch", async t => {
    function setup(c: Watchable, op: string = "") {
        const cb = sinon.spy();
        const unwatch = watch(c, cb);

        return [cb, unwatch] as const;
    }
    t.only("object", async t => {

        async function check<C extends Counter>(t: Tap.Test, createCounter: () => C, { prepare } : { prepare?: (t: C) => unknown } = {} ) {
            async function checkMethod(op: keyof Counter) {
                const c = createCounter();
                const [cb] = setup(c, op);
                prepare && prepare(c);

                if (c[op] === null) {
                    return;
                }

                cb.resetHistory();
                await c[op]!();
                await timeout(0);
                t.ok(cb.called, op);
            }

            await t.test("setup", async () => {
                const c = createCounter();
                const cb = sinon.spy();
                watch(c, cb);
                t.notOk(cb.called, "Does not call onchange on construction");
            });

            await checkMethod("incrementBound");
            await checkMethod("incrementUnbound");
            await checkMethod("incrementBoundAsync");
            await checkMethod("incrementUnboundAsync");
            await checkMethod("incrementBoundTimeout");
            await checkMethod("incrementUnboundTimeout");
        }

        t.test("class", async t => {
            await check(t, () => new Base());
        });

        t.test("inherited methods", async t => {
            await check(t, () => new InheritedChild());
        });

        t.test("child with state from base", async t => {
            await check(t, () => new ImplementedChild());
        });

        t.test("object", async t => {
            await check(t, createObject);
        });

        t.test("object with accessor", async t => {
            await check(t, createAccessorObject);
        });

        t.test("object with nested accessor", async t => {
            await check(t, createNestedAccessorObject);
        });

        t.test("nested", async t => {
            await check(t, () => new NestedObject());
        });

        t.test("nested reassigned", async t => {
            await check(
                t,
                () => new NestedObject(),
                { prepare: c => c.nested = { count: 0 } }
            );
        });

        t.only("Accessors", async t => {
            await check(t, () => new Accessors());
        });

        t.test("Accessors don't trigger sibbling instances", async t => {
            const a = new Accessors();
            const b = new Accessors();
            const [cb] = setup(a);
            b.count++;
            t.notOk(cb.calledOnce, "Accessors don't trigger sibbling instances");
        });

        // It's tempting to replace prototypes to support some advanced cases (like accessors),
        // but this would break instanceof
        t.test("Watching does not break instanceof checks", async t => {
            const a = new Accessors();
            setup(a);
            t.ok(a instanceof Accessors, "Watching does not break instanceof checks");
        });

        t.test("Accessors stay active", async t => {
            let realCount = 0;
            const obj = {
                get count() {
                    return realCount + 2;
                },
                set count(val) {
                    realCount = val * 5;
                }
            }
            const [cb] = setup(obj);
            obj.count = 2;
            t.equal(obj.count, 12, "Getters and setters should be applied");
        });

        t.test("unwatch", async t => {
            const obj = {
                x: 1,
                nested : {
                    val: 2
                }
            };
            const [cb, unwatch] = setup(obj);
            unwatch();
            obj.x = 2;
            t.notOk(cb.called, "After unwatch, the callback isn't triggered");

            obj.nested.val = 3;
            t.notOk(cb.called, "After unwatch, the callback isn't triggered for nested vals");

        });

        t.test("Symbols", async t => {
            await check(t, () => new Symbols());
        });

        t.test("Removed nested fields", async t => {
            const c = {
                nested : {
                    count: 0
                }
            };
            const [cb] = setup(c)
            const removed = c.nested;
            c.nested = { count: 0 };
            cb.resetHistory();

            removed.count++;
            t.notOk(cb.called, "Removed fields do not trigger onchange");
        });

        t.test("Removed deeply nested fields", async t => {
            const c = {
                nested : {
                    nested2: {
                        count: 0
                    }
                }
            };
            const [cb] = setup(c)
            const removed = c.nested;
            c.nested = { nested2: { count: 0 } };
            cb.resetHistory();

            removed.nested2.count++;
            t.notOk(cb.called, "Removed nested fields do not trigger onchange");
        });

        t.test("Partially remove nested fields", async t => {
            // Same nested object used twice in the watched object
            const nested = { count: 0 };
            const c = { a: nested, b: nested };
            const [cb] = setup(c);
            // And then we remove it from one of the fields
            c.a = { count : 0 };
            cb.resetHistory();
            // But on the second field, it should still trigger
            c.b.count++;
            t.ok(cb.calledOnce, "Partially removed fields do trigger onchange");

            // And if we also remove the second field, then it should trigger no more
            c.b = { count: 0 };
            cb.resetHistory();
            nested.count++;
            t.notOk(cb.called, "Fully removed fields do not trigger onchange");
        });

        t.test("Partially remove nested fields (reversed)", async t => {
            // Same as above, but we remove b instead. This is to ensure that order doesn't matter.
            const nested = { count: 0 };
            const c = { a: nested, b: nested };
            const [cb] = setup(c);
            c.b = { count : 0 };
            cb.resetHistory();
            c.a.count++;
            t.ok(cb.called, "Partially removed fields do trigger onchange");
        });

        t.test("Shared nested fields", async t => {
            const shared = { count : 0 };
            const c1 = { a : shared };
            const c2 = { a : shared };
            const [cb1] = setup(c1);
            const [cb2] = setup(c2);

            shared.count++;
            t.equal(cb1.callCount, 1, "First callback called once");
            t.equal(cb2.callCount, 1, "Second callback called once");

            cb1.resetHistory();
            cb2.resetHistory();

            // Unassignment...
            c1.a = { count: 0 };
            cb1.resetHistory();
            cb2.resetHistory();
            shared.count++;

            t.notOk(cb1.called, "First callback no longer called");
            t.ok(cb2.calledOnce, "Second callback called");
        });

        t.test("Repeated watching", async t => {
            const obj = { count: 0 };
            const [cb1] = setup(obj);
            const descriptor = Object.getOwnPropertyDescriptor(obj, 'count')!;
            const [cb2] = setup(obj);

            obj.count++;
            t.ok(cb1.calledOnce, "First callback called");
            t.ok(cb2.calledOnce, "Second callback called");

            // Note that "t.same" is broken here. It works fine in --only mode, but in
            // full test mode we're getting some weird errors
            t.ok(
                equals(descriptor as any, Object.getOwnPropertyDescriptor(obj, 'count') as any),
                "Property descriptor does not get unnecessarily overwritten"
            );

        });

        t.test("Repeated watching on nested objects", async t => {
            const obj = { nested : { count: 0 } };
            const [cb1] = setup(obj.nested);
            const [cb2] = setup(obj);
            obj.nested.count++;
            t.ok(cb1.calledOnce, "First callback called");
            t.ok(cb2.calledOnce, "Second callback called");
        });
    });
});

function equals<T extends Record<string, unknown>>(a: T, b: T): boolean {
    const aKeys = Object.keys(a).sort();
    const bKeys = Object.keys(b).sort();
    return arrEquals(aKeys, bKeys)
        && aKeys.every(key => a[key] === b[key]);
}

function arrEquals<T>(a: T[], b: T[]): boolean {
    return a.length === b.length
        && a.every((el, i) => el === b[i]);
}

const timeout = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// TODO:
// - Nested objects
//  -> Circular dependencies
// - Arrays
// - Obscure define property combinations?

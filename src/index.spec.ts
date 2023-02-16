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

class Accessors implements Counter {
    _count = 0;
    get count() {
        return this._count;
    }
    set count(val) {
        this._count = val;
    }

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

tap.test("watch", async t => {
    function setup(c: Watchable) {
        const cb = sinon.spy();
        watch(c, cb);

        return  cb;
    }
    t.test("object", async t => {

        async function check<C extends Counter>(t: Tap.Test, createCounter: () => C, { prepare } : { prepare?: (t: C) => unknown } = {} ) {
            async function checkMethod(op: keyof Counter) {
                const c = createCounter();
                const cb = setup(c);
                prepare && prepare(c);

                if (c[op] === null) {
                    return;
                }

                cb.resetHistory();
                await c[op]!();
                await timeout(0);
                t.ok(cb.calledOnce, op);
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

        t.test("Accessors", async t => {
            await check(t, () => new Accessors());
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
            const cb = setup(c)
            const removed = c.nested;
            c.nested = { count: 0 };

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
            const cb = setup(c)
            const removed = c.nested;
            c.nested = { nested2: { count: 0 } };

            removed.nested2.count++;
            t.notOk(cb.called, "Removed nested fields do not trigger onchange");
        });

        t.test("Partially remove nested fields", async t => {
            // Same nested object used twice in the watched object
            const nested = { count: 0 };
            const c = { a: nested, b: nested };
            const cb = setup(c);
            // And then we remove it from one of the fields
            c.a = { count : 0 };
            // But on the second field, it should still trigger
            c.b.count++;
            t.ok(cb.calledOnce, "Partially removed fields do trigger onchange");

            // And if we also remove the second field, then it should trigger no more
            cb.resetHistory();
            c.b = { count: 0 };
            nested.count++;
            t.notOk(cb.called, "Fully removed fields do not trigger onchange");
        });

        t.test("Partially remove nested fields (reversed)", async t => {
            // Same as above, but we remove b instead. This is to ensure that order doesn't matter.
            const nested = { count: 0 };
            const c = { a: nested, b: nested };
            const cb = setup(c);
            c.b = { count : 0 };
            c.a.count++;
            t.ok(cb.called, "Partially removed fields do trigger onchange");
        });

        t.test("Shared nested fields", async t => {
            const shared = { count : 0 };
            const c1 = { a : shared };
            const c2 = { a : shared };
            const cb1 = setup(c1);
            const cb2 = setup(c2);

            shared.count++;
            t.ok(cb1.calledOnce, "First callback called");
            t.ok(cb2.calledOnce, "Second callback called");

            cb1.resetHistory();
            cb2.resetHistory();

            // Unassignment...
            c1.a = { count: 0 };
            shared.count++;

            t.notOk(cb1.called, "First callback no longer called");
            t.ok(cb2.calledOnce, "Second callback called");
        });

        t.test("Repeated watching", async t => {
            const obj = { count: 0 };
            const cb1 = setup(obj);
            const cb2 = setup(obj);

            obj.count++;
            t.ok(cb1.calledOnce, "First callback called");
            t.ok(cb2.calledOnce, "Second callback called");
        });

        t.test("Repeated watching on nested objects", async t => {
            const obj = { nested : { count: 0 } };
            const cb1 = setup(obj.nested);
            const cb2 = setup(obj);
            obj.nested.count++;
            t.ok(cb1.calledOnce, "First callback called");
            t.ok(cb2.calledOnce, "Second callback called");
        });
    });
});

const timeout = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// TODO:
// - Nested objects
//  -> Circular dependencies
// - Arrays
// - Obscure define property combinations?

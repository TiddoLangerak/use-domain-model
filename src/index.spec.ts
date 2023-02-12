import tap from 'tap';
import sinon from 'sinon';
import { watch } from './index';

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
    t.test("object", async t => {
        function setup(c: Counter) {
            const cb = sinon.spy();
            watch(c, cb);

            return  cb;
        }

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

        t.test("Removed nested fields", async t => {
            const c = new NestedObject()
            const cb = setup(c)
            const removed = c.nested;
            c.nested = { count: 0 };

            removed.count++;
            t.notOk(cb.called, "Removed fields do not trigger onchange");
        });

    });
});

const timeout = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// TODO:
// - Nested objects
//  -> unwatch reassigned
// - Getters
// - Arrays
// - Test repeated adding watchers
// - Symbols?
// - Obscure define property combinations?

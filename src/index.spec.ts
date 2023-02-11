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



tap.test("watch", async t => {
    t.test("object", async t => {
        async function check(t: Tap.Test, c: Counter) {
            async function checkMethod(msg: string, op: () => unknown) {
                cb.resetHistory();
                await op();
                await timeout(0);
                t.ok(cb.calledOnce, msg);
            }
            const cb = sinon.spy();
            watch(c, cb);

            t.notOk(cb.called, "Does not call onchange on construction");

            c.incrementBound && await checkMethod(
                "Increment bound",
                () => c.incrementBound()
            );
            c.incrementUnbound && await checkMethod(
                "Increment unbound",
                () => c.incrementUnbound()
            );

            c.incrementBoundAsync && await checkMethod(
                "Increment async bound",
                () => c.incrementBoundAsync()
            );

            c.incrementUnboundAsync && await checkMethod(
                "Increment async unbound",
                () => c.incrementUnboundAsync()
            );

            c.incrementBoundTimeout && await checkMethod(
                "Increment bound in timeout",
                () => c.incrementBoundTimeout()
            );

            c.incrementUnboundTimeout && await checkMethod(
                "Increment unbound in timeout",
                () => c.incrementUnboundTimeout()
            );
        }

        t.test("class", async t => {
            await check(t, new Base());
        });

        t.test("inherited methods", async t => {
            await check(t, new InheritedChild());
        });

        t.test("child with state from base", async t => {
            await check(t, new ImplementedChild());
        });

        t.test("object", async t => {
            await check(t, createObject());
        });
    });
});

const timeout = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// TODO:
// - Nested objects
// - Getters
// - Arrays
// - Test repeated adding watchers
// - Symbols?
// - Obscure define property combinations?

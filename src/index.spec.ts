import tap from 'tap';
import sinon from 'sinon';
import { watch } from './index';

interface Counter {
    incrementBound: () => unknown;
    incrementUnbound: () => unknown;
    incrementBoundAsync: () => Promise<any>;
    incrementUnboundAsync: () => Promise<any>;
    incrementBoundTimeout: () => unknown;
    incrementUnboundTimeout: () => unknown;
}

class Base implements Counter {
    count: number;
    construtor() {
        this.count = 0;
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

class InheritedChild extends Base {}

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

            await checkMethod(
                "Increment bound",
                () => c.incrementBound()
            );
            await checkMethod(
                "Increment unbound",
                () => c.incrementUnbound()
            );

            await checkMethod(
                "Increment async bound",
                () => c.incrementBoundAsync()
            );

            await checkMethod(
                "Increment async unbound",
                () => c.incrementUnboundAsync()
            );

            await checkMethod(
                "Increment bound in timeout",
                () => c.incrementBoundTimeout()
            );

            await checkMethod(
                "Increment unbound in timeout",
                () => c.incrementUnboundTimeout()
            );
        }

        t.test("class", async t => {
            await check(t, new Base());
        });
    });
});

// TODO:
// - Subclasses
// - Getters setters

const timeout = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

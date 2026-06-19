/**
 * Async mutex — only one runExclusive() at a time; overlapping calls wait in queue.
 */
function createMutex() {
    let chain = Promise.resolve();

    function runExclusive(fn) {
        const run = chain.then(() => fn());
        chain = run.then(
            () => {},
            () => {}
        );
        return run;
    }

    return { runExclusive };
}

module.exports = { createMutex };

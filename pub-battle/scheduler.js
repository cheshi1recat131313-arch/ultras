/**
 * Планировщик «Битвы за Паб» — старт по расписанию, тик live-боя.
 */

const config = require("./config");
const { createMutex } = require("../core/async-mutex");

function createPubBattleScheduler(service) {
    let timer = null;
    const tickMutex = createMutex();

    async function tick() {
        if (!service?.processScheduleTick) return;
        await tickMutex.runExclusive(() => service.processScheduleTick(Date.now()));
    }

    function start() {
        if (timer) return;
        tick().catch((e) => console.error("pub-battle scheduler tick:", e));
        timer = setInterval(() => {
            tick().catch((e) => console.error("pub-battle scheduler tick:", e));
        }, config.SCHEDULER_TICK_MS);
    }

    function stop() {
        if (timer) {
            clearInterval(timer);
            timer = null;
        }
    }

    return { start, stop, tick };
}

module.exports = { createPubBattleScheduler };

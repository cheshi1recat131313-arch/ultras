/**
 * Счётчик невыполненных заданий для кнопки «Задания» на главной.
 */

function computeQuestBadge(mainQuests = [], dailyQuests = []) {
    const mainPending = (mainQuests || []).filter((q) => !q.done).length;
    const dailyPending = (dailyQuests || []).filter((q) => !q.done).length;
    const total = mainPending + dailyPending;
    return {
        total,
        mainPending,
        dailyPending,
        hasIncompleteDaily: dailyPending > 0
    };
}

module.exports = {
    computeQuestBadge
};

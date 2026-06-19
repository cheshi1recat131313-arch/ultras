/**
 * Единый компонент лога боя (район, события, история, почта, PvP).
 * Только отображение — без расчёта урона.
 */
(function (root, factory) {
    if (typeof module === "object" && module.exports) {
        module.exports = factory();
    } else {
        root.BattleLog = factory();
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    let playerNameHtmlFn = typeof playerNameHtml === "function" ? playerNameHtml : null;
    if (!playerNameHtmlFn) {
        try {
            playerNameHtmlFn = require("./player-links.js").playerNameHtml;
        } catch {
            /* browser without prior load */
        }
    }

    const HEART_IMG =
        '<img src="/static/icons/heart.svg" class="fight-heart" alt="❤" width="18" height="18">';
    const ICO_SILVER = '<img src="/static/location/base/ser.svg" class="fight-reward-ico" alt="">';
    const ICO_REP = '<img src="/static/icons/rep.png" class="fight-reward-ico" alt="">';
    const ICO_XP = '<img src="/static/icons/xp.png" class="fight-reward-ico" alt="">';
    const ICO_SKULL = '<img src="/static/icons/skull.png" class="fight-reward-ico fight-reward-skull" alt="">';

    function escapeHtml(s) {
        return String(s ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function fightLogNameHtml(name, email) {
        if (playerNameHtmlFn) {
            return playerNameHtmlFn(name, email, { className: "player-link" });
        }
        return `<b>${escapeHtml(name)}</b>`;
    }

    function silverAmountHtml(n) {
        const amount = Math.max(0, Math.floor(Number(n) || 0));
        return `${amount} ${ICO_SILVER}`;
    }

    function fightAvatarImg(url, className, alt) {
        const src = escapeHtml(url || "/static/personage/current/tank.png");
        return `<img class="${className}" src="${src}" width="88" height="90" alt="${escapeHtml(alt || "")}">`;
    }

    function fightFramedAvatarImg(url, alt, fill, sideClass) {
        const src = escapeHtml(url || "/static/personage/current/fast.png");
        const side = sideClass || "fight-ava-pl";
        if (fill) {
            return (
                `<span class="fight-ava ${side} player-avatar-frame">` +
                `<span class="player-avatar-bg" style="background:${fill}" aria-hidden="true"></span>` +
                `<img class="fight-ava-img player-avatar-img" src="${src}" width="88" height="90" alt="${escapeHtml(alt || "")}">` +
                `</span>`
            );
        }
        return fightAvatarImg(url, `fight-ava ${side} fight-ava-img`, alt);
    }

    function fightPlayerAvatarImg(url, alt, fill) {
        return fightFramedAvatarImg(url, alt, fill, "fight-ava-pl");
    }

    function buildWinRewardHtml(ctx) {
        const parts = [];
        if (ctx.rublesGain > 0) {
            parts.push(`<span class="fight-reward-item">+${ctx.rublesGain} ${ICO_SILVER}</span>`);
        }
        if (ctx.repGain > 0) {
            parts.push(`<span class="fight-reward-item">+${ctx.repGain} ${ICO_REP}</span>`);
        }
        if (ctx.xpGain > 0) {
            parts.push(`<span class="fight-reward-item">+${ctx.xpGain} ${ICO_XP}</span>`);
        }
        if (ctx.dollarsGain > 0) {
            const icoUsd = '<img src="/static/icons/gold.svg" class="fight-reward-ico" alt="">';
            parts.push(`<span class="fight-reward-item">+${ctx.dollarsGain} ${icoUsd}</span>`);
        }
        if (ctx.skullsEarned > 0) {
            parts.push(`<span class="fight-reward-item">+${ctx.skullsEarned} ${ICO_SKULL}</span>`);
        }
        if (!parts.length) return "";
        return `<div class="fight-reward-box">${parts.join("")}</div>`;
    }

    function buildLossRewardHtml(ctx) {
        const loss = Math.max(0, Math.floor(Number(ctx.silverLoss) || 0));
        if (loss <= 0) return "";
        return `<div class="fight-reward-box fight-reward-box--loss"><span class="fight-reward-item">−${loss} ${ICO_SILVER}</span></div>`;
    }

    /**
     * @param {object} ctx — поля боя (status, playerName, opponentName, logLines, награды…)
     * @param {{ embedded?: boolean }} options
     */
    function buildBattleLogBlock(ctx, options) {
        const opts = options || {};
        const won = ctx.status === "won";
        const titleClass = won ? "fight-title-win" : "fight-title-lose";
        const titleText = won ? "Ты победил" : "Тебя отметелили";
        const levelUpBlock =
            ctx.levelUp && ctx.levelUp > 1
                ? `<p class="fight-levelup">🎉 Новый уровень! Теперь ты уровень ${escapeHtml(ctx.levelUp)}${
                      ctx.statPointsMessage
                          ? `<br>${escapeHtml(ctx.statPointsMessage)}. <a href="/gym.html">Прокачка →</a>`
                          : ""
                  }</p>`
                : "";
        const rewardBlock = won ? buildWinRewardHtml(ctx) : buildLossRewardHtml(ctx);

        const playerAva = fightPlayerAvatarImg(ctx.playerAvatar, ctx.playerName, ctx.playerAvatarFill);
        const enemyAva = ctx.opponentAvatar
            ? fightFramedAvatarImg(
                  ctx.opponentAvatar,
                  ctx.opponentName,
                  ctx.opponentAvatarFill,
                  "fight-ava-en"
              )
            : `<span class="fight-ava fight-ava-en">${ctx.opponentEmoji || "👤"}</span>`;

        const vsRow = `<p class="fight-vs-row">
  ${playerAva}
  <span class="fight-vs">VS</span>
  ${enemyAva}
</p>
<p class="fight-vs-names">${fightLogNameHtml(ctx.playerName, ctx.playerEmail)} — ${fightLogNameHtml(ctx.opponentName, ctx.opponentEmail)}</p>`;

        const logHtml = (ctx.logLines || []).join("\n");
        const te = Math.round(ctx.totalToPlayer || 0);
        const tp = Math.round(ctx.totalToEnemy || 0);
        const summary = `<p class="fight-summary">${fightLogNameHtml(ctx.playerName, ctx.playerEmail)} снёс <b>${tp}</b> ${HEART_IMG}<br>
${fightLogNameHtml(ctx.opponentName, ctx.opponentEmail)} снёс <b>${te}</b> ${HEART_IMG}</p>`;

        const wrapClass = opts.embedded ? "fight-main-block fight-main-block--embedded" : "fight-main-block";
        const logBlock = opts.embedded
            ? `<div class="fight-log-scroll">${logHtml}</div><div class="fight-summary-wrap">${summary}</div>`
            : `<div class="fight-log-scroll">${logHtml}
      ${summary}
      </div>`;

        return `<div class="${wrapClass}">
      ${levelUpBlock}
      <h5 class="fight-title ${titleClass}"><strong>${titleText}</strong></h5>
      ${rewardBlock}
      ${vsRow}
      ${logBlock}
    </div>`;
    }

    function buildBattleLogNav(ctx, options) {
        const opts = options || {};
        const parts = [];
        if (opts.showShmot !== false && ctx.fightId) {
            parts.push(
                `<a href="/shmot.html?fightId=${encodeURIComponent(ctx.fightId)}" class="fight-nav-btn fight-nav-green"><button type="button" class="fight-inner-btn">👕 Шмот и оружие</button></a>`
            );
        }
        if (opts.backHref) {
            parts.push(
                `<a href="${escapeHtml(opts.backHref)}" class="fight-nav-btn fight-nav-green"><button type="button" class="fight-inner-btn">← Назад</button></a>`
            );
        }
        if (opts.showDistrictNav) {
            parts.push(
                `<a href="/district.html" class="fight-nav-btn fight-nav-green fight-search-js"><button type="button" class="fight-inner-btn">🔎 Искать ещё</button></a>`,
                `<a href="/district.html" class="fight-nav-btn fight-nav-green"><button type="button" class="fight-inner-btn">🥖 В район</button></a>`
            );
        }
        return parts.join("\n");
    }

    return {
        HEART_IMG,
        ICO_SILVER,
        escapeHtml,
        silverAmountHtml,
        fightAvatarImg,
        fightPlayerAvatarImg,
        buildWinRewardHtml,
        buildLossRewardHtml,
        buildBattleLogBlock,
        buildBattleLogNav
    };
});

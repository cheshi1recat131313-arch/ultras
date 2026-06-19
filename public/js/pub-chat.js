/**
 * Чат паба — загрузка, отправка, автообновление.
 */
(function () {
    const POLL_MS = 10000;
    const MAX_LEN = 200;

    let pollTimer = null;
    let lastMessageId = 0;

    function escapeHtml(s) {
        const d = document.createElement("div");
        d.textContent = s;
        return d.innerHTML;
    }

    function renderMessages(messages) {
        const log = document.getElementById("pubChatLog");
        if (!log) return;

        if (!messages || !messages.length) {
            log.innerHTML = '<p class="pub-chat-empty">Пока тихо. Напиши первым!</p>';
            lastMessageId = 0;
            return;
        }

        const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 48;
        log.innerHTML = messages
            .map(
                (m) =>
                    `<article class="pub-msg" data-id="${m.id}">` +
                    `<p class="pub-msg-head"><span class="pub-msg-name">${playerNameHtml(m.playerName || "Игрок", m.email, { className: "player-link pub-msg-name-link" })}</span> ` +
                    `<span class="pub-msg-time">[${escapeHtml(m.timeLabel || "")}]</span></p>` +
                    `<p class="pub-msg-text">${escapeHtml(m.message || "")}</p></article>`
            )
            .join("");

        const last = messages[messages.length - 1];
        lastMessageId = last ? last.id : 0;

        if (atBottom) {
            log.scrollTop = log.scrollHeight;
        }
    }

    async function fetchMessages() {
        const res = await fetch("/api/pub/chat/messages");
        const data = await res.json();
        if (data.success) {
            renderMessages(data.messages || []);
        }
    }

    async function sendMessage() {
        const input = document.getElementById("pubChatInput");
        const btn = document.getElementById("pubChatSend");
        if (!input || !btn) return;

        const text = input.value.trim();
        if (!text) {
            showMsg("Введи сообщение", true);
            return;
        }

        btn.disabled = true;
        const { ok, data } = await postJson("/api/pub/chat/send", {
            email: getEmail(),
            message: text.slice(0, MAX_LEN)
        });
        btn.disabled = false;

        if (!ok || !data.success) {
            showMsg(data.error || "Не удалось отправить", true);
            return;
        }

        input.value = "";
        if (data.messages) {
            renderMessages(data.messages);
        } else {
            await fetchMessages();
        }
        const log = document.getElementById("pubChatLog");
        if (log) log.scrollTop = log.scrollHeight;
    }

    function bindCompose() {
        const input = document.getElementById("pubChatInput");
        const btn = document.getElementById("pubChatSend");
        if (!input || !btn) return;

        input.setAttribute("maxlength", String(MAX_LEN));

        btn.addEventListener("click", () => sendMessage());
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }

    function startPolling() {
        stopPolling();
        pollTimer = setInterval(fetchMessages, POLL_MS);
    }

    function stopPolling() {
        if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
        }
    }

    async function initPubChat() {
        bindCompose();
        await fetchMessages();
        startPolling();
        window.addEventListener("beforeunload", stopPolling);
    }

    window.initPubChat = initPubChat;
})();

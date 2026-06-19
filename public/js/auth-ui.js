const MIN_LOGIN_LENGTH = 2;
const MIN_PASSWORD_LENGTH = 6;
const REFERRAL_STORAGE_KEY = "referralRef";

let mode = "login";
let emailSkipped = false;

const tabLogin = document.getElementById("tabLogin");
const tabRegister = document.getElementById("tabRegister");
const loginPanel = document.getElementById("loginPanel");
const registerPanel = document.getElementById("registerPanel");
const message = document.getElementById("message");

const loginInput = document.getElementById("loginInput");
const passwordInput = document.getElementById("passwordInput");
const loginError = document.getElementById("loginError");
const passwordError = document.getElementById("passwordError");

const recoveryEmailInput = document.getElementById("recoveryEmailInput");
const emailRow = document.getElementById("emailRow");
const skipEmailBtn = document.getElementById("skipEmailBtn");
const recoveryWarning = document.getElementById("recoveryWarning");
const nicknameInput = document.getElementById("nicknameInput");
const registerPasswordInput = document.getElementById("registerPasswordInput");
const recoveryEmailError = document.getElementById("recoveryEmailError");
const nicknameError = document.getElementById("nicknameError");
const registerPasswordError = document.getElementById("registerPasswordError");

const resetModal = document.getElementById("resetModal");
const resetModalBackdrop = document.getElementById("resetModalBackdrop");
const resetEmailInput = document.getElementById("resetEmailInput");
const resetEmailError = document.getElementById("resetEmailError");
const resetModalMessage = document.getElementById("resetModalMessage");

try {
    const saved = getStoredEmail();
    if (saved && !loginInput.value) loginInput.value = saved;
} catch (e) {
    /* ignore */
}

(async function autoLoginIfSaved() {
    const user = await tryRestoreSession();
    if (user && isProfileComplete(user)) {
        window.location.replace("/game.html");
    } else if (user) {
        window.location.replace(onboardingUrl(user));
    }
})();

function clearErrors() {
    loginError.textContent = "";
    passwordError.textContent = "";
    recoveryEmailError.textContent = "";
    nicknameError.textContent = "";
    registerPasswordError.textContent = "";
    resetEmailError.textContent = "";
    message.textContent = "";
}

function setMode(nextMode, opts = {}) {
    mode = nextMode;
    clearErrors();

    const isLogin = mode === "login";
    tabLogin.classList.toggle("auth-tab--active", isLogin);
    tabRegister.classList.toggle("auth-tab--active", !isLogin);
    loginPanel.hidden = !isLogin;
    registerPanel.hidden = isLogin;

    if (isLogin && opts.prefillLogin) {
        loginInput.value = String(opts.prefillLogin).trim();
        loginInput.focus();
    }
}

function switchToLogin(prefillLogin, hint) {
    setMode("login", { prefillLogin });
    if (hint) message.textContent = hint;
}

function setEmailSkipped(skipped) {
    emailSkipped = skipped;
    emailRow.hidden = skipped;
    recoveryWarning.hidden = !skipped;
    if (skipped) {
        recoveryEmailInput.value = "";
    }
}

function openResetModal() {
    resetEmailError.textContent = "";
    resetModalMessage.textContent = "";
    resetEmailInput.value = loginInput.value.includes("@") ? loginInput.value.trim() : "";
    resetModal.hidden = false;
}

function closeResetModal() {
    resetModal.hidden = true;
}

async function postJson(url, payload) {
    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
    const data = await response.json();
    return { ok: response.ok, data };
}

function validateLoginForm() {
    const login = loginInput.value.trim();
    const password = passwordInput.value.trim();
    let valid = true;

    if (login.length < MIN_LOGIN_LENGTH) {
        loginError.textContent = "Введите ник или email (минимум 2 символа)";
        valid = false;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
        passwordError.textContent = `Минимум ${MIN_PASSWORD_LENGTH} символов в пароле`;
        valid = false;
    }

    return valid;
}

function validateRegisterForm() {
    const nickname = nicknameInput.value.trim();
    const password = registerPasswordInput.value.trim();
    let valid = true;

    if (nickname.length < MIN_LOGIN_LENGTH) {
        nicknameError.textContent = "Минимум 2 символа в нике";
        valid = false;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
        registerPasswordError.textContent = `Минимум ${MIN_PASSWORD_LENGTH} символов в пароле`;
        valid = false;
    }

    if (!emailSkipped) {
        const recoveryEmail = recoveryEmailInput.value.trim().toLowerCase();
        if (recoveryEmail && (!recoveryEmail.includes("@") || recoveryEmail.length < 5)) {
            recoveryEmailError.textContent = "Укажи корректный email";
            valid = false;
        }
    }

    return valid;
}

function captureReferralFromUrl() {
    try {
        const params = new URLSearchParams(window.location.search);
        const ref = params.get("ref");
        if (ref && String(ref).trim()) {
            sessionStorage.setItem(REFERRAL_STORAGE_KEY, String(ref).trim());
        }
    } catch {
        /* ignore */
    }
}

function getStoredReferralRef() {
    try {
        const ref = sessionStorage.getItem(REFERRAL_STORAGE_KEY);
        return ref && String(ref).trim() ? String(ref).trim() : null;
    } catch {
        return null;
    }
}

function clearStoredReferralRef() {
    try {
        sessionStorage.removeItem(REFERRAL_STORAGE_KEY);
    } catch {
        /* ignore */
    }
}

function getRegisterPayload() {
    const payload = {
        login: nicknameInput.value.trim(),
        password: registerPasswordInput.value.trim(),
        skipRecoveryEmail: emailSkipped
    };

    if (!emailSkipped) {
        const recoveryEmail = recoveryEmailInput.value.trim().toLowerCase();
        if (recoveryEmail) payload.recoveryEmail = recoveryEmail;
    }

    const referrerId = getStoredReferralRef();
    if (referrerId) payload.referrerId = referrerId;

    return payload;
}

async function submitLogin() {
    clearErrors();
    if (!validateLoginForm()) return;

    try {
        const { ok, data } = await postJson("/login", {
            login: loginInput.value.trim(),
            password: passwordInput.value.trim()
        });
        if (!ok) {
            message.textContent = data.error || "Ошибка при входе";
            return;
        }

        const sessionEmail = data.user?.email || loginInput.value.trim().toLowerCase();
        saveSessionEmail(sessionEmail);
        await handleAuthSuccess(sessionEmail, data.user);
    } catch (error) {
        message.textContent = "Ошибка соединения с сервером";
    }
}

async function ensureNoActiveSessionForRegister() {
    const savedEmail = getStoredEmail();
    if (!savedEmail) return true;

    const user = await fetchUserByEmail(savedEmail);
    if (!user) return true;

    message.textContent =
        "На этом устройстве уже есть аккаунт. Нажмите «Войти» или продолжите игру — повторная регистрация не нужна.";
    switchToLogin(user.name || savedEmail);
    return false;
}

function handleRegisterError(data) {
    const err = data?.error || "Ошибка при регистрации";
    const code = data?.code || "";
    const nickname = nicknameInput.value.trim();

    if (code === "nickname_taken" || /никнейм уже занят|ником уже есть/i.test(err)) {
        nicknameError.textContent = err;
        switchToLogin(
            nickname,
            "Такой ник уже зарегистрирован. Введите пароль и нажмите «Войти»."
        );
        return;
    }

    if (code === "recovery_email_taken" || /email уже/i.test(err)) {
        recoveryEmailError.textContent = err;
        switchToLogin(recoveryEmailInput.value.trim() || nickname, err);
        return;
    }

    message.textContent = err;
}

async function submitRegister() {
    clearErrors();
    if (!validateRegisterForm()) return;
    if (!(await ensureNoActiveSessionForRegister())) return;

    try {
        const { ok, data } = await postJson("/register", getRegisterPayload());
        if (!ok) {
            handleRegisterError(data);
            return;
        }

        saveSessionEmail(data.user.email);
        syncSessionFromUser(data.user);
        clearStoredReferralRef();
        window.location.replace(onboardingUrl(data.user));
    } catch (error) {
        message.textContent = "Ошибка соединения с сервером";
    }
}

async function submitResetRequest() {
    resetEmailError.textContent = "";
    resetModalMessage.textContent = "";

    const email = resetEmailInput.value.trim().toLowerCase();
    if (!email || !email.includes("@")) {
        resetEmailError.textContent = "Укажи корректный email";
        return;
    }

    try {
        const { ok, data } = await postJson("/auth/password-reset/request", { email });
        resetModalMessage.textContent = ok
            ? (data.message || "Запрос принят. Отправка писем будет доступна позже.")
            : (data.error || "Не удалось создать запрос");
        if (ok) {
            setTimeout(closeResetModal, 1800);
        }
    } catch (error) {
        resetModalMessage.textContent = "Ошибка соединения с сервером";
    }
}

tabLogin.addEventListener("click", () => setMode("login"));
tabRegister.addEventListener("click", async () => {
    const savedEmail = getStoredEmail();
    if (savedEmail) {
        const user = await fetchUserByEmail(savedEmail);
        if (user) {
            switchToLogin(
                user.name || savedEmail,
                "Аккаунт на этом устройстве уже есть. Войдите по нику и паролю."
            );
            return;
        }
    }
    setMode("register");
    setEmailSkipped(false);
});

document.getElementById("registerGoLoginBtn")?.addEventListener("click", () => {
    switchToLogin(nicknameInput.value.trim(), "");
});

skipEmailBtn.addEventListener("click", () => setEmailSkipped(true));

recoveryEmailInput.addEventListener("input", () => {
    if (recoveryEmailInput.value.trim()) {
        emailSkipped = false;
        recoveryWarning.hidden = true;
        emailRow.hidden = false;
    }
});

document.getElementById("loginBtn").addEventListener("click", submitLogin);
document.getElementById("registerBtn").addEventListener("click", submitRegister);
document.getElementById("forgotBtn").addEventListener("click", openResetModal);
document.getElementById("resetSubmitBtn").addEventListener("click", submitResetRequest);
document.getElementById("resetCloseBtn").addEventListener("click", closeResetModal);
resetModalBackdrop.addEventListener("click", closeResetModal);

captureReferralFromUrl();
setMode(getStoredReferralRef() ? "register" : "login");

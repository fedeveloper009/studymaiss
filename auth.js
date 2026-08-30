/* ==========================================
   STUDYMAIS
   auth.js

   Controla a tela de login/cadastro, a sessão do
   usuário (token + dados básicos) e o logout.
   Depende de services/api.js (deve ser carregado antes).
========================================== */

(function () {
    "use strict";

    const USER_STORAGE_KEY = "studymais_user";

    const api = window.StudyMaisAPI;

    const elements = {};

    let currentUser = null;
    let mode = "login"; // "login" | "register"

    function cacheElements() {
        elements.authScreen = document.getElementById("authScreen");
        elements.appRoot = document.getElementById("appRoot");

        elements.authError = document.getElementById("authError");
        elements.authTitle = document.getElementById("authTitle");
        elements.authSubtitle = document.getElementById("authSubtitle");
        elements.authModeLabel = document.getElementById("authModeLabel");

        elements.loginForm = document.getElementById("loginForm");
        elements.loginEmail = document.getElementById("loginEmail");
        elements.loginPassword = document.getElementById("loginPassword");
        elements.loginSubmit = document.getElementById("loginSubmit");

        elements.registerForm = document.getElementById("registerForm");
        elements.registerName = document.getElementById("registerName");
        elements.registerEmail = document.getElementById("registerEmail");
        elements.registerPassword = document.getElementById("registerPassword");
        elements.registerSubmit = document.getElementById("registerSubmit");

        elements.authToggleText = document.getElementById("authToggleText");
        elements.authToggleButton = document.getElementById("authToggleButton");

        elements.logoutButton = document.getElementById("logoutButton");
        elements.topbarAvatar = document.getElementById("topbarAvatar");
    }

    /* ---------- Persistência local do usuário ---------- */

    function getStoredUser() {
        const raw = localStorage.getItem(USER_STORAGE_KEY);
        if (!raw) return null;
        try {
            return JSON.parse(raw);
        } catch (error) {
            return null;
        }
    }

    function storeUser(user) {
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    }

    function clearStoredUser() {
        localStorage.removeItem(USER_STORAGE_KEY);
    }

    /* ---------- UI: telas ---------- */

    function showAuthScreen() {
        elements.authScreen.classList.remove("hidden");
        elements.appRoot.classList.add("hidden");
    }

    function showApp() {
        elements.authScreen.classList.add("hidden");
        elements.appRoot.classList.remove("hidden");
        updateTopbarUser();
        // Avisa outros módulos (dados.js) que já há usuário logado
        // e os dados reais (matérias/tarefas) podem ser carregados.
        document.dispatchEvent(new CustomEvent("studymais:ready", { detail: { user: currentUser } }));
    }

    function updateTopbarUser() {
        if (!currentUser || !elements.topbarAvatar) return;
        const nome = (currentUser.nome || "").trim();
        elements.topbarAvatar.textContent = nome ? nome.charAt(0).toUpperCase() : "?";
        elements.topbarAvatar.title = nome || currentUser.email || "";
    }

    function setMode(newMode) {
        mode = newMode;
        clearError();

        const isLogin = mode === "login";

        elements.loginForm.classList.toggle("hidden", !isLogin);
        elements.registerForm.classList.toggle("hidden", isLogin);

        elements.authModeLabel.textContent = isLogin ? "ENTRAR" : "CADASTRO";
        elements.authTitle.textContent = isLogin ? "Bem-vinda de volta" : "Crie sua conta";
        elements.authSubtitle.textContent = isLogin
            ? "Entre para continuar seus estudos."
            : "Leva menos de um minuto para começar.";
        elements.authToggleText.textContent = isLogin ? "Ainda não tem conta?" : "Já tem uma conta?";
        elements.authToggleButton.textContent = isLogin ? "Criar conta" : "Entrar";
    }

    function showError(message) {
        elements.authError.textContent = message;
        elements.authError.classList.remove("hidden");
    }

    function clearError() {
        elements.authError.textContent = "";
        elements.authError.classList.add("hidden");
    }

    function setButtonLoading(button, loading, loadingText, idleText) {
        button.disabled = loading;
        button.textContent = loading ? loadingText : idleText;
    }

    /* ---------- Sessão ---------- */

    async function loadCurrentUser() {
        const usuario = await api.usuarioService.obterAtual();
        if (!usuario) {
            throw new api.ApiError("Não foi possível carregar os dados do usuário.", 500);
        }
        currentUser = usuario;
        storeUser(usuario);
        return usuario;
    }

    function getCurrentUser() {
        return currentUser;
    }

    /**
     * Atualiza o usuário em memória (e no cache local) após uma
     * edição de perfil bem-sucedida, sem precisar de novo login.
     */
    function setCurrentUser(user) {
        if (!user) return;
        currentUser = user;
        storeUser(user);
        updateTopbarUser();
    }

    /* ---------- Handlers ---------- */

    async function handleLoginSubmit(event) {
        event.preventDefault();
        clearError();

        const email = elements.loginEmail.value.trim();
        const senha = elements.loginPassword.value;

        if (!email || !senha) {
            showError("Informe email e senha.");
            return;
        }

        setButtonLoading(elements.loginSubmit, true, "Entrando...", "Entrar");

        try {
            const resposta = await api.authService.login(email, senha);
            api.setToken(resposta.token);
            await loadCurrentUser();
            elements.loginForm.reset();
            showApp();
        } catch (error) {
            api.clearToken();
            showError(error.message || "Não foi possível entrar.");
        } finally {
            setButtonLoading(elements.loginSubmit, false, "Entrando...", "Entrar");
        }
    }

    async function handleRegisterSubmit(event) {
        event.preventDefault();
        clearError();

        const nome = elements.registerName.value.trim();
        const email = elements.registerEmail.value.trim();
        const senha = elements.registerPassword.value;

        if (!nome || !email || !senha) {
            showError("Preencha todos os campos.");
            return;
        }

        if (senha.length < 6) {
            showError("A senha deve ter no mínimo 6 caracteres.");
            return;
        }

        setButtonLoading(elements.registerSubmit, true, "Criando conta...", "Criar conta");

        try {
            await api.usuarioService.registrar(nome, email, senha);
            // A API de cadastro não devolve token; login automático em seguida.
            const resposta = await api.authService.login(email, senha);
            api.setToken(resposta.token);
            await loadCurrentUser();
            elements.registerForm.reset();
            showApp();
        } catch (error) {
            showError(error.message || "Não foi possível criar a conta.");
        } finally {
            setButtonLoading(elements.registerSubmit, false, "Criando conta...", "Criar conta");
        }
    }

    function handleLogout() {
        api.clearToken();
        clearStoredUser();
        currentUser = null;
        setMode("login");
        showAuthScreen();
        // Avisa dados.js para limpar o estado (matérias/tarefas) em memória.
        document.dispatchEvent(new CustomEvent("studymais:logout"));
    }

    /* ---------- Inicialização ---------- */

    async function init() {
        cacheElements();

        elements.loginForm.addEventListener("submit", handleLoginSubmit);
        elements.registerForm.addEventListener("submit", handleRegisterSubmit);

        elements.authToggleButton.addEventListener("click", function () {
            setMode(mode === "login" ? "register" : "login");
        });

        if (elements.logoutButton) {
            elements.logoutButton.addEventListener("click", handleLogout);
        }

        // Se o token expirar/for inválido em qualquer chamada futura,
        // api.js chama este hook para forçar o logout.
        api.onUnauthorized = function () {
            currentUser = null;
            clearStoredUser();
            api.clearToken();
            setMode("login");
            showAuthScreen();
            showError("Sua sessão expirou. Entre novamente.");
        };

        setMode("login");

        const token = api.getToken();
        if (!token) {
            showAuthScreen();
            return;
        }

        try {
            await loadCurrentUser();
            showApp();
        } catch (error) {
            api.clearToken();
            clearStoredUser();
            showAuthScreen();
        }
    }

    window.StudyMaisAuth = {
        getCurrentUser,
        setCurrentUser,
        logout: handleLogout,
    };

    document.addEventListener("DOMContentLoaded", init);
})();

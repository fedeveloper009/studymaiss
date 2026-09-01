/* ==========================================
   STUDYMAIS
   auth.js

   Controla a tela de login/cadastro, a sessão do
   usuário (token + dados básicos) e o logout.
   Depende de services/api.js (deve ser carregado antes).

   ---------------------------------------------------------
   Também centraliza a sincronização de progresso (xp,
   sequência, tempo estudado, matéria estudada e conquistas)
   com a API, através de atualizarProgresso(). Esses dados
   agora vivem só no model Usuario do back-end — nada mais
   fica salvo no localStorage.

   IMPORTANTE: o endpoint PUT /usuarios/{id} exige "senha"
   em todo envio (mesmo para atualizar só o xp, por exemplo).
   Como o front nunca guarda a senha do usuário em disco (só
   o token JWT), ela fica em memória (sessionPassword) durante
   a sessão atual, obtida no login/cadastro. Se a página for
   recarregada com um token ainda válido, essa senha em
   memória se perde e a sincronização automática de progresso
   fica pausada até o próximo login (a navegação continua
   funcionando normalmente, só o envio para a API é adiado).
   O ideal, no back-end, seria tornar "senha" opcional no
   UsuarioRequestDTO/UsuarioService (só recodificar quando
   vier preenchida), o que eliminaria essa limitação.
========================================== */

(function () {
    "use strict";

    const api = window.StudyMaisAPI;

    const elements = {};

    let currentUser = null;
    let mode = "login"; // "login" | "register"

    // Só em memória — nunca é persistida (ver nota acima).
    let sessionPassword = null;

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
        updateTopbarUser();
    }

    /**
     * Envia ao back-end os campos de progresso do usuário (xp,
     * diasDeSequencia, tempoEstudado, materiaEstudada, conquistas),
     * combinando o que já está salvo com o que foi passado em
     * `camposParciais`. Atualiza o usuário em memória/cache local
     * (apenas os dados básicos de sessão, iguais aos já guardados
     * pelo login) e avisa outros módulos via "studymais:usuario-atualizado".
     *
     * Retorna o usuário atualizado, ou null se não foi possível
     * sincronizar (sem sessão, ou sem a senha em memória — ver nota
     * no topo do arquivo).
     */
    async function atualizarProgresso(camposParciais) {
        if (!currentUser) return null;

        if (!sessionPassword) {
            console.warn(
                "[StudyMais] Progresso não sincronizado com o servidor: faça login " +
                "novamente nesta aba para retomar a sincronização (a API exige a " +
                "senha em toda atualização de usuário)."
            );
            return null;
        }

        const payload = {
            nome: currentUser.nome,
            email: currentUser.email,
            senha: sessionPassword,
            xp: currentUser.xp,
            diasDeSequencia: currentUser.diasDeSequencia,
            tempoEstudado: currentUser.tempoEstudado,
            materiaEstudada: currentUser.materiaEstudada,
            conquistas: currentUser.conquistas,
            ...camposParciais,
        };

        try {
            const atualizado = await api.usuarioService.atualizar(currentUser.id, payload);
            setCurrentUser(atualizado || { ...currentUser, ...camposParciais });
            document.dispatchEvent(
                new CustomEvent("studymais:usuario-atualizado", { detail: { user: currentUser } })
            );
            return currentUser;
        } catch (error) {
            console.error("[StudyMais] Falha ao sincronizar progresso com o servidor:", error);
            return null;
        }
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
            sessionPassword = senha;
            elements.loginForm.reset();
            showApp();
        } catch (error) {
            api.clearToken();
            sessionPassword = null;
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
            sessionPassword = senha;
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
        currentUser = null;
        sessionPassword = null;
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
            sessionPassword = null;
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
            showAuthScreen();
        }
    }

    /**
     * Usado por perfil.js após uma troca de senha bem-sucedida, para
     * manter a senha em memória (sessionPassword) igual à atual —
     * senão as próximas chamadas a atualizarProgresso() falhariam
     * silenciosamente (a API rejeita a senha antiga).
     */
    function setSessionPassword(senha) {
        sessionPassword = senha || sessionPassword;
    }

    window.StudyMaisAuth = {
        getCurrentUser,
        setCurrentUser,
        setSessionPassword,
        atualizarProgresso,
        logout: handleLogout,
    };

    document.addEventListener("DOMContentLoaded", init);
})();

/* ==========================================
   STUDYMAIS
   perfil.js

   - Página "Meu perfil": mostra e edita os dados reais
     do usuário logado (nome/email via API; senha exigida
     pela API em toda atualização). "Objetivo" não existe
     no back-end, então fica salvo só neste navegador.
   - Página "Configurações": preferências sem endpoint
     próprio na API, então também ficam só neste navegador
     (mas a meta diária reflete na Home).

   Depende de services/api.js e auth.js (carregados antes).
========================================== */

(function () {
    "use strict";

    const api = window.StudyMaisAPI;

    const GOAL_STORAGE_KEY = "studymais_goal";
    const SETTINGS_STORAGE_KEY = "studymais_settings";

    const elements = {};

    function cacheElements() {
        elements.profileAvatar = document.getElementById("profileAvatar");
        elements.profilePhoto = document.getElementById("profilePhoto");
        elements.removePhoto = document.getElementById("removePhoto");
        elements.profileName = document.getElementById("profileName");
        elements.profileSummary = document.getElementById("profileSummary");

        elements.accountName = document.getElementById("accountName");
        elements.accountEmail = document.getElementById("accountEmail");
        elements.accountCurrentPassword = document.getElementById("accountCurrentPassword");
        elements.accountNewPassword = document.getElementById("accountNewPassword");
        elements.accountConfirmPassword = document.getElementById("accountConfirmPassword");
        elements.changePassword = document.getElementById("changePassword");
        elements.saveAccount = document.getElementById("saveAccount");

        elements.accountGoal = document.getElementById("accountGoal");
        elements.saveGoal = document.getElementById("saveGoal");

        elements.dailyStudyGoal = document.getElementById("dailyStudyGoal");
        elements.studyReminder = document.getElementById("studyReminder");
        elements.saveSettings = document.getElementById("saveSettings");
        elements.dailyGoalHint = document.getElementById("dailyGoalHint");
    }

    /* ---------- Texto temporário em botões (feedback de "salvo") ---------- */

    function mostrarSucesso(botao, textoOriginal) {
        botao.textContent = "Salvo!";
        setTimeout(() => {
            botao.textContent = textoOriginal;
        }, 1800);
    }

    /* ---------- Perfil (dados reais do usuário) ---------- */

    function preencherPerfil() {
        const user = window.StudyMaisAuth && window.StudyMaisAuth.getCurrentUser();
        if (!user) return;

        const nome = (user.nome || "").trim();

        if (elements.profileAvatar) {
            renderizarAvatar(elements.profileAvatar, nome);
        }
        if (elements.profileName) elements.profileName.textContent = nome || "Minha conta";
        if (elements.profileSummary) elements.profileSummary.textContent = user.email || "Vamos estudar?";

        if (elements.accountName) elements.accountName.value = nome;
        if (elements.accountEmail) elements.accountEmail.value = user.email || "";
        if (elements.accountCurrentPassword) elements.accountCurrentPassword.value = "";
        if (elements.accountNewPassword) elements.accountNewPassword.value = "";
        if (elements.accountConfirmPassword) elements.accountConfirmPassword.value = "";
    }

    function renderizarAvatar(element, nome) {
        const user = window.StudyMaisAuth.getCurrentUser();
        element.textContent = "";
        if (user && user.fotoPerfilUrl) {
            const image = document.createElement("img");
            image.src = user.fotoPerfilUrl;
            image.alt = "Foto de perfil";
            element.appendChild(image);
        } else {
            element.textContent = nome ? nome.charAt(0).toUpperCase() : "?";
        }
    }

    function limparPerfil() {
        if (elements.profileAvatar) elements.profileAvatar.textContent = "?";
        if (elements.profileName) elements.profileName.textContent = "Minha conta";
        if (elements.profileSummary) elements.profileSummary.textContent = "Vamos estudar?";
        if (elements.accountName) elements.accountName.value = "";
        if (elements.accountEmail) elements.accountEmail.value = "";
        if (elements.accountCurrentPassword) elements.accountCurrentPassword.value = "";
        if (elements.accountNewPassword) elements.accountNewPassword.value = "";
        if (elements.accountConfirmPassword) elements.accountConfirmPassword.value = "";
    }

    async function salvarFoto(event) {
        const arquivo = event.target.files && event.target.files[0];
        const user = window.StudyMaisAuth.getCurrentUser();
        if (!arquivo || !user) return;
        if (!arquivo.type.startsWith("image/") || arquivo.size > 2 * 1024 * 1024) {
            window.alert("Escolha uma imagem válida de até 2 MB.");
            event.target.value = "";
            return;
        }
        try {
            const atualizado = await api.usuarioService.alterarFoto(user.id, arquivo);
            window.StudyMaisAuth.setCurrentUser(atualizado);
            preencherPerfil();
        } catch (error) {
            window.alert(error.message || "Não foi possível alterar a foto.");
        } finally {
            event.target.value = "";
        }
    }

    async function removerFoto() {
        const user = window.StudyMaisAuth.getCurrentUser();
        if (!user || !user.fotoPerfilUrl) return;
        try {
            const atualizado = await api.usuarioService.removerFoto(user.id);
            window.StudyMaisAuth.setCurrentUser(atualizado);
            preencherPerfil();
        } catch (error) {
            window.alert(error.message || "Não foi possível remover a foto.");
        }
    }

    async function salvarPerfil() {
        const user = window.StudyMaisAuth && window.StudyMaisAuth.getCurrentUser();
        if (!user) return;

        const nome = (elements.accountName.value || "").trim();
        const email = (elements.accountEmail.value || "").trim();
        const senhaAtual = elements.accountCurrentPassword.value;
        if (!nome || !email) {
            window.alert("Preencha nome e email.");
            return;
        }
        if (!senhaAtual) {
            window.alert("Informe sua senha atual para confirmar os dados da conta.");
            return;
        }
        const textoOriginal = elements.saveAccount.textContent;
        elements.saveAccount.disabled = true;
        elements.saveAccount.textContent = "Salvando...";

        try {
            // Os campos xp/diasDeSequencia/tempoEstudado/materiaEstudada/
            // conquistas não são enviados aqui: a API mantém os valores
            // já salvos quando eles vêm nulos no corpo da requisição.
            const atualizado = await api.usuarioService.atualizar(user.id, { nome, email, senha: senhaAtual });
            window.StudyMaisAuth.setCurrentUser(atualizado || { ...user, nome, email });
            preencherPerfil();
            mostrarSucesso(elements.saveAccount, textoOriginal);
        } catch (error) {
            window.alert(error.message || "Não foi possível salvar o perfil. Confira a senha e tente de novo.");
            elements.saveAccount.textContent = textoOriginal;
        } finally {
            elements.saveAccount.disabled = false;
        }
    }

    async function alterarSenha() {
        const user = window.StudyMaisAuth.getCurrentUser();
        const senhaAtual = elements.accountCurrentPassword.value;
        const novaSenha = elements.accountNewPassword.value;
        const confirmacao = elements.accountConfirmPassword.value;
        if (!senhaAtual || novaSenha.length < 6 || novaSenha !== confirmacao) {
            window.alert("Informe a senha atual, uma nova senha com no mínimo 6 caracteres e confirme-a corretamente.");
            return;
        }
        const textoOriginal = elements.changePassword.textContent;
        elements.changePassword.disabled = true;
        elements.changePassword.textContent = "Alterando...";
        try {
            const atualizado = await api.usuarioService.alterarSenha(user.id, {
                senhaAtual,
                novaSenha,
                confirmacaoNovaSenha: confirmacao,
            });
            window.StudyMaisAuth.setCurrentUser(atualizado || user);
            window.StudyMaisAuth.setSessionPassword(novaSenha);
            elements.accountCurrentPassword.value = "";
            elements.accountNewPassword.value = "";
            elements.accountConfirmPassword.value = "";
            mostrarSucesso(elements.changePassword, textoOriginal);
        } catch (error) {
            window.alert(error.message || "Não foi possível alterar a senha.");
        } finally {
            elements.changePassword.disabled = false;
            if (elements.changePassword.textContent === "Alterando...") elements.changePassword.textContent = textoOriginal;
        }
    }

    /* ---------- Objetivo (só local, API não tem esse campo) ---------- */

    function carregarObjetivo() {
        if (!elements.accountGoal) return;
        elements.accountGoal.value = localStorage.getItem(GOAL_STORAGE_KEY) || "";
    }

    function salvarObjetivo() {
        localStorage.setItem(GOAL_STORAGE_KEY, elements.accountGoal.value || "");
        const textoOriginal = elements.saveGoal.textContent;
        mostrarSucesso(elements.saveGoal, textoOriginal);
    }

    /* ---------- Configurações (só local, API não tem esses campos) ---------- */

    function lerConfiguracoes() {
        const padrao = { metaHoras: "2", lembrete: false };
        try {
            const salvo = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY));
            return salvo ? Object.assign(padrao, salvo) : padrao;
        } catch (error) {
            return padrao;
        }
    }

    function aplicarMetaNaHome(horas) {
        if (elements.dailyGoalHint) {
            elements.dailyGoalHint.textContent = `Meta: ${horas}h`;
        }
    }

    function carregarConfiguracoes() {
        const config = lerConfiguracoes();
        if (elements.dailyStudyGoal) elements.dailyStudyGoal.value = config.metaHoras;
        if (elements.studyReminder) elements.studyReminder.checked = !!config.lembrete;
        aplicarMetaNaHome(config.metaHoras);
    }

    function salvarConfiguracoes() {
        const config = {
            metaHoras: elements.dailyStudyGoal.value,
            lembrete: elements.studyReminder.checked,
        };
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(config));
        aplicarMetaNaHome(config.metaHoras);
        document.dispatchEvent(new CustomEvent("studymais:meta-atualizada"));

        const textoOriginal = elements.saveSettings.textContent;
        mostrarSucesso(elements.saveSettings, textoOriginal);
    }

    /* ---------- Ligações de UI ---------- */

    function bindUI() {
        if (elements.saveAccount) elements.saveAccount.addEventListener("click", salvarPerfil);
        if (elements.profilePhoto) elements.profilePhoto.addEventListener("change", salvarFoto);
        if (elements.removePhoto) elements.removePhoto.addEventListener("click", removerFoto);
        if (elements.changePassword) elements.changePassword.addEventListener("click", alterarSenha);
        if (elements.saveGoal) elements.saveGoal.addEventListener("click", salvarObjetivo);
        if (elements.saveSettings) elements.saveSettings.addEventListener("click", salvarConfiguracoes);
    }

    /* ---------- Inicialização ---------- */

    function init() {
        cacheElements();
        bindUI();
        carregarObjetivo();
        carregarConfiguracoes();

        document.addEventListener("studymais:ready", preencherPerfil);
        document.addEventListener("studymais:logout", limparPerfil);
    }

    document.addEventListener("DOMContentLoaded", init);
})();

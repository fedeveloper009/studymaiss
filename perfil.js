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
        elements.profileName = document.getElementById("profileName");
        elements.profileSummary = document.getElementById("profileSummary");

        elements.accountName = document.getElementById("accountName");
        elements.accountEmail = document.getElementById("accountEmail");
        elements.accountPassword = document.getElementById("accountPassword");
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
            elements.profileAvatar.textContent = nome ? nome.charAt(0).toUpperCase() : "?";
        }
        if (elements.profileName) elements.profileName.textContent = nome || "Minha conta";
        if (elements.profileSummary) elements.profileSummary.textContent = user.email || "Vamos estudar?";

        if (elements.accountName) elements.accountName.value = nome;
        if (elements.accountEmail) elements.accountEmail.value = user.email || "";
        if (elements.accountPassword) elements.accountPassword.value = "";
    }

    function limparPerfil() {
        if (elements.profileAvatar) elements.profileAvatar.textContent = "?";
        if (elements.profileName) elements.profileName.textContent = "Minha conta";
        if (elements.profileSummary) elements.profileSummary.textContent = "Vamos estudar?";
        if (elements.accountName) elements.accountName.value = "";
        if (elements.accountEmail) elements.accountEmail.value = "";
        if (elements.accountPassword) elements.accountPassword.value = "";
    }

    async function salvarPerfil() {
        const user = window.StudyMaisAuth && window.StudyMaisAuth.getCurrentUser();
        if (!user) return;

        const nome = (elements.accountName.value || "").trim();
        const email = (elements.accountEmail.value || "").trim();
        const senha = elements.accountPassword.value;

        if (!nome || !email) {
            window.alert("Preencha nome e email.");
            return;
        }
        if (!senha) {
            window.alert("Informe sua senha para confirmar as alterações.");
            return;
        }

        const textoOriginal = elements.saveAccount.textContent;
        elements.saveAccount.disabled = true;
        elements.saveAccount.textContent = "Salvando...";

        try {
            const atualizado = await api.usuarioService.atualizar(user.id, { nome, email, senha });
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

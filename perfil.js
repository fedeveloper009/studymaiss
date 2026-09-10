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
    let fotoPreviewUrl = null;

    function cacheElements() {
        elements.profileAvatar = document.getElementById("profileAvatar");
        elements.profilePhoto = document.getElementById("profilePhoto");
        elements.removePhoto = document.getElementById("removePhoto");
        elements.profileName = document.getElementById("profileName");
        elements.profileSummary = document.getElementById("profileSummary");
        elements.profilePhotoStatus = document.getElementById("profilePhotoStatus");
        elements.profilePasswordModal = document.getElementById("profilePasswordModal");
        elements.profilePasswordTitle = document.getElementById("profilePasswordTitle");
        elements.profilePasswordInput = document.getElementById("profilePasswordInput");
        elements.closeProfilePasswordModal = document.getElementById("closeProfilePasswordModal");
        elements.cancelProfilePassword = document.getElementById("cancelProfilePassword");
        elements.confirmProfilePassword = document.getElementById("confirmProfilePassword");

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

    function mostrarStatusFoto(mensagem, tipo) {
        if (!elements.profilePhotoStatus) return;
        elements.profilePhotoStatus.textContent = mensagem;
        elements.profilePhotoStatus.className = `profile-photo-status ${tipo}`;
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

    async function renderizarAvatar(element, nome, previewUrl) {
        const user = window.StudyMaisAuth.getCurrentUser();
        element.textContent = "";
        if (previewUrl || (user && user.fotoPerfilUrl)) {
            const image = document.createElement("img");
            const foto = previewUrl || user.fotoPerfilUrl;
            const separador = foto.includes("?") ? "&" : "?";
            image.alt = "Foto de perfil";
            image.onerror = () => {
                mostrarStatusFoto("A foto foi enviada, mas não foi possível carregá-la.", "error");
            };
            element.appendChild(image);
            if (previewUrl) {
                image.src = previewUrl;
                return;
            }
            try {
                const resposta = await fetch(`${foto}${separador}v=${Date.now()}`, {
                    cache: "no-store",
                    headers: { "Cache-Control": "no-cache" },
                });
                if (!resposta.ok) throw new Error("A imagem não pôde ser carregada.");
                const blob = await resposta.blob();
                image.src = URL.createObjectURL(blob);
            } catch (error) {
                console.error("[StudyMais] Falha ao carregar foto de perfil:", error);
                image.src = `${foto}${separador}v=${Date.now()}-fallback`;
            }
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

    function pedirSenhaConfirmacao(acao) {
        return new Promise((resolve) => {
            elements.profilePasswordTitle.textContent = `Confirme ${acao}`;
            elements.profilePasswordInput.value = "";
            elements.profilePasswordModal.classList.remove("hidden");
            elements.profilePasswordInput.focus();

            const finalizar = (senha) => {
                elements.profilePasswordModal.classList.add("hidden");
                elements.profilePasswordInput.value = "";
                resolve(senha && senha.trim() ? senha : null);
            };

            const confirmar = () => finalizar(elements.profilePasswordInput.value);
            elements.confirmProfilePassword.onclick = confirmar;
            elements.cancelProfilePassword.onclick = () => finalizar(null);
            elements.closeProfilePasswordModal.onclick = () => finalizar(null);
            elements.profilePasswordInput.onkeydown = (event) => {
                if (event.key === "Enter") confirmar();
                if (event.key === "Escape") finalizar(null);
            };
        });
    }

    async function fotoRemotaConfereComArquivo(url, arquivo) {
        const separador = url.includes("?") ? "&" : "?";
        const resposta = await fetch(`${url}${separador}verify=${Date.now()}`, {
            cache: "no-store",
            headers: { "Cache-Control": "no-cache" },
        });
        if (!resposta.ok) return false;
        const remoto = new Uint8Array(await resposta.arrayBuffer());
        const local = new Uint8Array(await arquivo.arrayBuffer());
        if (remoto.length !== local.length) return false;
        return remoto.every((byte, index) => byte === local[index]);
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
        const senha = await pedirSenhaConfirmacao("a alteração da foto");
        if (!senha) {
            mostrarStatusFoto("A foto não foi atualizada: confirmação cancelada.", "error");
            event.target.value = "";
            return;
        }
        try {
            await api.usuarioService.alterarFoto(user.id, arquivo, senha);
            // O POST pode retornar 200 sem devolver o usuário persistido.
            // Buscamos o registro novamente para confirmar a URL salva.
            const atualizado = await api.usuarioService.obterAtual();
            if (!atualizado) throw new Error("A API não confirmou a atualização da foto.");
            if (!atualizado.fotoPerfilUrl || !(await fotoRemotaConfereComArquivo(atualizado.fotoPerfilUrl, arquivo))) {
                throw new Error("O upload respondeu, mas a imagem nova ainda não está disponível na URL do perfil.");
            }
            window.StudyMaisAuth.setCurrentUser(atualizado);
            preencherPerfil();
            if (fotoPreviewUrl) URL.revokeObjectURL(fotoPreviewUrl);
            fotoPreviewUrl = URL.createObjectURL(arquivo);
            renderizarAvatar(elements.profileAvatar, (atualizado.nome || "").trim(), fotoPreviewUrl);
            mostrarStatusFoto("Foto de perfil atualizada com sucesso.", "success");
        } catch (error) {
            console.error("[StudyMais] Falha ao alterar foto de perfil:", error);
            mostrarStatusFoto(`A foto não foi atualizada. ${error.message || "Tente novamente."}`, "error");
        } finally {
            event.target.value = "";
        }
    }

    async function removerFoto() {
        const user = window.StudyMaisAuth.getCurrentUser();
        if (!user || !user.fotoPerfilUrl) return;
        const senha = await pedirSenhaConfirmacao("a remoção da foto");
        if (!senha) {
            mostrarStatusFoto("A foto não foi removida: confirmação cancelada.", "error");
            return;
        }
        try {
            const resposta = await api.usuarioService.removerFoto(user.id, senha);
            const atualizado = resposta || { ...user, fotoPerfilUrl: null };
            window.StudyMaisAuth.setCurrentUser(atualizado);
            if (fotoPreviewUrl) {
                URL.revokeObjectURL(fotoPreviewUrl);
                fotoPreviewUrl = null;
            }
            preencherPerfil();
            mostrarStatusFoto("Foto de perfil removida com sucesso.", "success");
        } catch (error) {
            console.error("[StudyMais] Falha ao remover foto de perfil:", error);
            mostrarStatusFoto(`A foto não foi removida. ${error.message || "Tente novamente."}`, "error");
        }
    }

    async function salvarPerfil() {
        const user = window.StudyMaisAuth && window.StudyMaisAuth.getCurrentUser();
        if (!user) return;

        const nome = (elements.accountName.value || "").trim();
        const email = (elements.accountEmail.value || "").trim();
        if (!nome || !email) {
            window.alert("Preencha nome e email.");
            return;
        }
        const senhaAtual = await pedirSenhaConfirmacao("as alterações do perfil");
        if (!senhaAtual) {
            window.alert("O salvamento do perfil foi cancelado.");
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
            console.error("[StudyMais] Falha ao salvar perfil:", error);
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

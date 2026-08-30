/* ==========================================
   STUDYMAIS
   cronometro.js

   Cronômetro de estudo (Iniciar/Pausar/Zerar).
   A API não tem conceito de "sessão de estudo", então,
   seguindo o mesmo padrão de gamificacao.js e perfil.js,
   o histórico de sessões fica salvo só no localStorage
   (por usuário) e alimenta o resumo "Hoje" e a meta diária
   da Home.

   Depende de auth.js (usuário atual) e dos elementos do
   cronômetro/Home já presentes no index.html.
========================================== */

(function () {
    "use strict";

    const SETTINGS_STORAGE_KEY = "studymais_settings";
    const META_PADRAO_HORAS = 2;

    const elements = {};

    let estadoTimer = {
        running: false,
        inicioMs: 0,
        acumuladoMs: 0,
        intervalId: null,
    };

    /* ---------- Elementos ---------- */

    function cacheElements() {
        elements.timerDisplay = document.getElementById("timerDisplay");
        elements.timerSubject = document.getElementById("timerSubject");
        elements.startTimer = document.getElementById("startTimer");
        elements.pauseTimer = document.getElementById("pauseTimer");
        elements.resetTimer = document.getElementById("resetTimer");

        elements.todayHours = document.getElementById("todayHours");
        elements.goalTitle = document.getElementById("goalTitle");
        elements.goalPercent = document.getElementById("goalPercent");
        elements.goalRing = document.getElementById("goalRing");
        elements.goalMessage = document.getElementById("goalMessage");
    }

    /* ---------- Persistência local (por usuário) ---------- */

    function chaveStorage() {
        const user = window.StudyMaisAuth && window.StudyMaisAuth.getCurrentUser();
        const uid = user && user.id != null ? user.id : "demo";
        return `studymais_cronometro_${uid}`;
    }

    function carregarSessoes() {
        try {
            const salvo = JSON.parse(localStorage.getItem(chaveStorage()));
            return Array.isArray(salvo) ? salvo : [];
        } catch (error) {
            return [];
        }
    }

    function salvarSessoes(sessoes) {
        localStorage.setItem(chaveStorage(), JSON.stringify(sessoes));
    }

    function registrarSessao(duracaoMs) {
        const select = elements.timerSubject;
        const materiaId = select ? select.value : "";
        const opcaoSelecionada = select && select.selectedOptions ? select.selectedOptions[0] : null;
        const materiaNome = opcaoSelecionada ? opcaoSelecionada.textContent.trim() : "📚 Estudo geral";

        const sessoes = carregarSessoes();
        sessoes.push({
            data: hojeISO(),
            materiaId: materiaId || null,
            materiaNome,
            duracaoMs,
            criadoEm: new Date().toISOString(),
        });
        salvarSessoes(sessoes);
        atualizarResumoHoje();

        // Avisa quem depender do tempo estudado (ex.: conquistas.js)
        // que uma nova sessão foi registrada.
        document.dispatchEvent(new CustomEvent("studymais:sessao-registrada"));
    }

    function totalGeralMs() {
        return carregarSessoes().reduce((soma, sessao) => soma + (sessao.duracaoMs || 0), 0);
    }

    /* ---------- Datas ---------- */

    function hojeISO() {
        const agora = new Date();
        const ano = agora.getFullYear();
        const mes = String(agora.getMonth() + 1).padStart(2, "0");
        const dia = String(agora.getDate()).padStart(2, "0");
        return `${ano}-${mes}-${dia}`;
    }

    /* ---------- Meta diária (só local, configurada em Configurações) ---------- */

    function lerMetaHoras() {
        try {
            const salvo = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY));
            const horas = salvo && salvo.metaHoras ? parseFloat(salvo.metaHoras) : NaN;
            return horas > 0 ? horas : META_PADRAO_HORAS;
        } catch (error) {
            return META_PADRAO_HORAS;
        }
    }

    function totalHojeMs() {
        const hojeStr = hojeISO();
        return carregarSessoes()
            .filter((sessao) => sessao.data === hojeStr)
            .reduce((soma, sessao) => soma + (sessao.duracaoMs || 0), 0);
    }

    function formatarHorasMinutos(ms) {
        const totalMinutos = Math.round(ms / 60000);
        const horas = Math.floor(totalMinutos / 60);
        const minutos = totalMinutos % 60;
        return `${horas}h ${minutos}min`;
    }

    function atualizarResumoHoje() {
        const totalMs = totalHojeMs();
        const metaHoras = lerMetaHoras();
        const metaMs = metaHoras * 3600000;
        const percentual = metaMs > 0 ? Math.min(100, Math.round((totalMs / metaMs) * 100)) : 0;

        if (elements.todayHours) {
            elements.todayHours.textContent = formatarHorasMinutos(totalMs);
        }
        if (elements.goalTitle) {
            elements.goalTitle.textContent = `${metaHoras} hora${metaHoras === 1 ? "" : "s"} de foco`;
        }
        if (elements.goalPercent) {
            elements.goalPercent.textContent = `${percentual}%`;
        }
        if (elements.goalRing) {
            elements.goalRing.style.setProperty("--goal-progress", `${percentual}%`);
        }
        if (elements.goalMessage) {
            if (totalMs === 0) {
                elements.goalMessage.textContent = "Inicie o cronômetro para começar.";
            } else if (percentual >= 100) {
                elements.goalMessage.textContent = "Meta batida! Muito bem.";
            } else {
                elements.goalMessage.textContent = `Faltam ${formatarHorasMinutos(Math.max(0, metaMs - totalMs))} para a meta de hoje.`;
            }
        }
    }

    /* ---------- Cronômetro ---------- */

    function tempoAtualMs() {
        return estadoTimer.acumuladoMs + (estadoTimer.running ? Date.now() - estadoTimer.inicioMs : 0);
    }

    function formatarCronometro(ms) {
        const totalSegundos = Math.floor(ms / 1000);
        const horas = String(Math.floor(totalSegundos / 3600)).padStart(2, "0");
        const minutos = String(Math.floor((totalSegundos % 3600) / 60)).padStart(2, "0");
        const segundos = String(totalSegundos % 60).padStart(2, "0");
        return `${horas}:${minutos}:${segundos}`;
    }

    function atualizarDisplay() {
        if (elements.timerDisplay) {
            elements.timerDisplay.textContent = formatarCronometro(tempoAtualMs());
        }
    }

    function atualizarBotoes() {
        if (elements.startTimer) elements.startTimer.disabled = estadoTimer.running;
        if (elements.pauseTimer) elements.pauseTimer.disabled = !estadoTimer.running;
        if (elements.timerSubject) elements.timerSubject.disabled = estadoTimer.running;
    }

    function pararIntervalo() {
        if (estadoTimer.intervalId) {
            window.clearInterval(estadoTimer.intervalId);
            estadoTimer.intervalId = null;
        }
    }

    function iniciarTimer() {
        if (estadoTimer.running) return;
        estadoTimer.running = true;
        estadoTimer.inicioMs = Date.now();
        estadoTimer.intervalId = window.setInterval(atualizarDisplay, 1000);
        atualizarBotoes();
        atualizarDisplay();
    }

    function pausarTimer() {
        if (!estadoTimer.running) return;
        estadoTimer.acumuladoMs += Date.now() - estadoTimer.inicioMs;
        estadoTimer.running = false;
        pararIntervalo();
        atualizarBotoes();
        atualizarDisplay();
    }

    function pararSemSalvar() {
        pararIntervalo();
        estadoTimer = { running: false, inicioMs: 0, acumuladoMs: 0, intervalId: null };
        atualizarBotoes();
        atualizarDisplay();
    }

    // "Zerar" também é o momento em que a sessão é encerrada: se havia
    // tempo estudado, ele é somado à meta diária antes do display voltar a 00:00:00.
    function zerarTimer() {
        const duracaoMs = tempoAtualMs();
        pararSemSalvar();

        if (duracaoMs >= 1000) {
            registrarSessao(duracaoMs);
        }
    }

    /* ---------- Ligações de UI ---------- */

    function bindUI() {
        if (elements.startTimer) elements.startTimer.addEventListener("click", iniciarTimer);
        if (elements.pauseTimer) elements.pauseTimer.addEventListener("click", pausarTimer);
        if (elements.resetTimer) elements.resetTimer.addEventListener("click", zerarTimer);
    }

    /* ---------- Inicialização ---------- */

    function init() {
        cacheElements();
        bindUI();
        atualizarBotoes();
        atualizarDisplay();

        document.addEventListener("studymais:ready", atualizarResumoHoje);
        document.addEventListener("studymais:meta-atualizada", atualizarResumoHoje);
        document.addEventListener("studymais:logout", pararSemSalvar);
    }

    document.addEventListener("DOMContentLoaded", init);

    /* ---------- API pública (usada por conquistas.js) ---------- */

    window.StudyMaisCronometro = {
        getTotalMinutosHoje: () => Math.round(totalHojeMs() / 60000),
        getTotalMinutosGeral: () => Math.round(totalGeralMs() / 60000),
    };
})();

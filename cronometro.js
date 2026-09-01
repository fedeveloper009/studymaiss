/* ==========================================
   STUDYMAIS
   cronometro.js

   Cronômetro de estudo (Iniciar/Pausar/Zerar).

   O tempo estudado (em segundos) e a última matéria estudada
   agora são campos reais do usuário na API (tempoEstudado e
   materiaEstudada) — ao encerrar uma sessão ("Zerar"), a
   duração é somada ao total do usuário e enviada com
   window.StudyMaisAuth.atualizarProgresso() (ver auth.js).
   Nada disso fica mais salvo no localStorage.

   ---------------------------------------------------------
   OBS. sobre o resumo "Hoje" e a meta diária da Home:

   O model Usuario guarda só um total acumulado de todo o
   histórico (tempoEstudado), sem quebrar por dia. Sem um
   campo de data no back-end, não dá para saber quanto desse
   total é "de hoje". Por isso, o resumo "Hoje"/meta diária
   passou a refletir só o tempo estudado NESTA sessão do
   navegador (uma variável em memória, não salva em lugar
   nenhum, zerada a cada vez que a página é recarregada) — não
   é mais um total real do dia calendário, e sim "desde que
   você abriu o app agora". Já o total de "TEMPO ESTUDADO" da
   página Meu progresso continua exato, pois vem direto do
   tempoEstudado acumulado do usuário na API.

   Depende de auth.js (usuário atual + sincronização) e dos
   elementos do cronômetro/Home já presentes no index.html.
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

    // Tempo estudado só nesta sessão do navegador (ver observação acima).
    // Não é persistido em lugar nenhum — existe apenas para alimentar o
    // resumo "Hoje" da Home enquanto o app está aberto.
    let estudadoNestaSessaoMs = 0;

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

    /* ---------- Sincronização com a API ---------- */

    function usuarioAtual() {
        return (window.StudyMaisAuth && window.StudyMaisAuth.getCurrentUser()) || {};
    }

    async function registrarSessao(duracaoMs) {
        const select = elements.timerSubject;
        const opcaoSelecionada = select && select.selectedOptions ? select.selectedOptions[0] : null;
        const materiaNome = opcaoSelecionada ? opcaoSelecionada.textContent.trim() : "📚 Estudo geral";

        const duracaoSegundos = Math.round(duracaoMs / 1000);
        const usuario = usuarioAtual();
        const novoTempoEstudado = (usuario.tempoEstudado || 0) + duracaoSegundos;

        estudadoNestaSessaoMs += duracaoMs;
        atualizarResumoHoje();

        await window.StudyMaisAuth.atualizarProgresso({
            tempoEstudado: novoTempoEstudado,
            materiaEstudada: materiaNome,
        });
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

    function formatarHorasMinutos(ms) {
        const totalMinutos = Math.round(ms / 60000);
        const horas = Math.floor(totalMinutos / 60);
        const minutos = totalMinutos % 60;
        return `${horas}h ${minutos}min`;
    }

    function atualizarResumoHoje() {
        const totalMs = estudadoNestaSessaoMs;
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
    // tempo estudado, ele é somado ao total do usuário (API) antes do
    // display voltar a 00:00:00.
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

        document.addEventListener("studymais:ready", () => {
            estudadoNestaSessaoMs = 0;
            atualizarResumoHoje();
        });
        document.addEventListener("studymais:meta-atualizada", atualizarResumoHoje);
        document.addEventListener("studymais:logout", () => {
            estudadoNestaSessaoMs = 0;
            pararSemSalvar();
        });
    }

    document.addEventListener("DOMContentLoaded", init);
})();

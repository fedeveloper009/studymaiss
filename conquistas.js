/* ==========================================
   STUDYMAIS
   conquistas.js

   Monta os badges da página "Conquistas" a partir dos
   dados de gamificação (XP, nível, sequência, tarefas)
   e do cronômetro (tempo total estudado).

   Não guarda nada por conta própria: só lê o que já está
   em memória em gamificacao.js (window.StudyMaisGamificacao)
   e cronometro.js (window.StudyMaisCronometro) e recalcula
   quais badges já foram desbloqueados sempre que algo muda.

   Depende de gamificacao.js e cronometro.js (carregados
   antes) e dos eventos que eles disparam.
========================================== */

(function () {
    "use strict";

    /* ---------- Lista de badges ---------- */
    // valorAtual(dados) retorna o progresso atual do usuário para
    // aquele critério; meta é o valor necessário para desbloquear.

    const BADGES = [
        {
            id: "tarefa-1",
            emoji: "🌱",
            titulo: "Primeiros passos",
            rotulo: "tarefa concluída",
            meta: 1,
            valorAtual: (d) => d.tarefasConcluidas,
            descricaoConquistada: "Você concluiu sua primeira tarefa. Continue assim!",
        },
        {
            id: "tarefa-10",
            emoji: "✅",
            titulo: "Produtiva(o)",
            rotulo: "tarefas concluídas",
            meta: 10,
            valorAtual: (d) => d.tarefasConcluidas,
            descricaoConquistada: "10 tarefas concluídas. Sua rotina está no ritmo certo.",
        },
        {
            id: "tarefa-50",
            emoji: "🏅",
            titulo: "Mestre das tarefas",
            rotulo: "tarefas concluídas",
            meta: 50,
            valorAtual: (d) => d.tarefasConcluidas,
            descricaoConquistada: "50 tarefas concluídas! Isso é dedicação de verdade.",
        },
        {
            id: "streak-3",
            emoji: "🔥",
            titulo: "Pegando o ritmo",
            rotulo: "dias seguidos",
            meta: 3,
            valorAtual: (d) => d.streak,
            descricaoConquistada: "3 dias seguidos estudando. O hábito está nascendo.",
        },
        {
            id: "streak-7",
            emoji: "🚀",
            titulo: "Uma semana inteira",
            rotulo: "dias seguidos",
            meta: 7,
            valorAtual: (d) => d.streak,
            descricaoConquistada: "7 dias de sequência. Nada te para agora.",
        },
        {
            id: "streak-30",
            emoji: "👑",
            titulo: "Inabalável",
            rotulo: "dias seguidos",
            meta: 30,
            valorAtual: (d) => d.streak,
            descricaoConquistada: "30 dias seguidos. Você é referência de consistência.",
        },
        {
            id: "nivel-5",
            emoji: "⭐",
            titulo: "Subindo de nível",
            rotulo: "nível",
            meta: 5,
            valorAtual: (d) => d.nivel,
            descricaoConquistada: "Você chegou ao nível 5. O esforço está valendo a pena.",
        },
        {
            id: "nivel-10",
            emoji: "💎",
            titulo: "Estudante lendária(o)",
            rotulo: "nível",
            meta: 10,
            valorAtual: (d) => d.nivel,
            descricaoConquistada: "Nível 10! Poucos chegam tão longe.",
        },
        {
            id: "foco-60",
            emoji: "⏱️",
            titulo: "Primeira hora de foco",
            rotulo: "min. estudados",
            meta: 60,
            valorAtual: (d) => d.minutosEstudados,
            descricaoConquistada: "Já são 60 minutos de estudo puro no cronômetro.",
        },
        {
            id: "foco-600",
            emoji: "🕐",
            titulo: "Maratonista dos estudos",
            rotulo: "min. estudados",
            meta: 600,
            valorAtual: (d) => d.minutosEstudados,
            descricaoConquistada: "10 horas de estudo acumuladas. Impressionante.",
        },
    ];

    const elements = {};

    function cacheElements() {
        elements.achievementsList = document.getElementById("achievementsList");
    }

    /* ---------- Utilidades ---------- */

    function escapeHtml(texto) {
        const div = document.createElement("div");
        div.textContent = texto == null ? "" : String(texto);
        return div.innerHTML;
    }

    /* ---------- Coleta dos dados (gamificacao.js + cronometro.js) ---------- */

    function coletarDados() {
        const gamificacao =
            (window.StudyMaisGamificacao && window.StudyMaisGamificacao.getEstado()) ||
            { xp: 0, tarefasConcluidas: 0, streak: 0 };

        const nivel =
            window.StudyMaisGamificacao && window.StudyMaisGamificacao.calcularNivel
                ? window.StudyMaisGamificacao.calcularNivel().nivel
                : 1;

        const minutosEstudados =
            (window.StudyMaisCronometro && window.StudyMaisCronometro.getTotalMinutosGeral()) || 0;

        return {
            tarefasConcluidas: gamificacao.tarefasConcluidas || 0,
            streak: gamificacao.streak || 0,
            nivel,
            minutosEstudados,
        };
    }

    /* ---------- Render ---------- */

    function renderizarBadges() {
        if (!elements.achievementsList) return;

        const dados = coletarDados();

        elements.achievementsList.innerHTML = BADGES.map((badge) => {
            const valor = Math.max(0, badge.valorAtual(dados) || 0);
            const conquistada = valor >= badge.meta;
            const progresso = `${Math.min(valor, badge.meta)}/${badge.meta} ${badge.rotulo}`;
            const descricao = conquistada ? badge.descricaoConquistada : progresso;

            return `
                <div class="achievement-card${conquistada ? "" : " locked"}" data-badge="${badge.id}">
                    <div class="achievement-icon">${badge.emoji}</div>
                    <h2>${escapeHtml(badge.titulo)}</h2>
                    <p>${escapeHtml(descricao)}</p>
                </div>
            `;
        }).join("");
    }

    /* ---------- Inicialização ---------- */

    function init() {
        cacheElements();
        renderizarBadges();

        document.addEventListener("studymais:ready", renderizarBadges);
        document.addEventListener("studymais:gamificacao-atualizada", renderizarBadges);
        document.addEventListener("studymais:sessao-registrada", renderizarBadges);
        document.addEventListener("studymais:logout", renderizarBadges);
    }

    document.addEventListener("DOMContentLoaded", init);
})();

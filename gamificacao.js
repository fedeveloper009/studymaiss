/* ==========================================
   STUDYMAIS
   gamificacao.js

   Sistema de XP e sequência (streak) do usuário.
   A API não tem esses campos, então tudo é guardado
   só no localStorage do navegador — serve apenas para
   demonstração (não sincroniza entre dispositivos).

   ---------------------------------------------------------
   Regras:

   1) A cada tarefa marcada como concluída, o usuário ganha
      +20 XP. Se ele desmarcar a tarefa, os 20 XP voltam
      (para não ser possível "farmar" XP marcando e
      desmarcando a mesma tarefa).

   2) A cada dia novo em que o usuário entra no app (ou
      conclui uma tarefa), a sequência sobe +1. Se um dia é
      pulado sem atividade, a sequência volta para 1.

   Depende de auth.js (para identificar o usuário atual) e
   é alimentado pelo evento "studymais:tarefa-status",
   disparado em dados.js sempre que uma tarefa é
   concluída/reaberta.
========================================== */

(function () {
    "use strict";

    const XP_POR_TAREFA = 20;
    const XP_POR_NIVEL = 100;

    const elements = {};
    let estado = estadoPadrao();

    function estadoPadrao() {
        return { xp: 0, tarefasConcluidas: 0, streak: 0, ultimoDiaAtivo: null };
    }

    /* ---------- Persistência local (por usuário) ---------- */

    function chaveStorage() {
        const user = window.StudyMaisAuth && window.StudyMaisAuth.getCurrentUser();
        const uid = user && user.id != null ? user.id : "demo";
        return `studymais_gamificacao_${uid}`;
    }

    function carregarEstado() {
        try {
            const salvo = JSON.parse(localStorage.getItem(chaveStorage()));
            estado = salvo ? Object.assign(estadoPadrao(), salvo) : estadoPadrao();
        } catch (error) {
            estado = estadoPadrao();
        }
    }

    function salvarEstado() {
        localStorage.setItem(chaveStorage(), JSON.stringify(estado));
    }

    /* ---------- Datas ---------- */

    function hojeISO() {
        const agora = new Date();
        const ano = agora.getFullYear();
        const mes = String(agora.getMonth() + 1).padStart(2, "0");
        const dia = String(agora.getDate()).padStart(2, "0");
        return `${ano}-${mes}-${dia}`;
    }

    function diasEntre(isoAntigo, isoNovo) {
        const [a1, m1, d1] = isoAntigo.split("-").map(Number);
        const [a2, m2, d2] = isoNovo.split("-").map(Number);
        const data1 = new Date(a1, m1 - 1, d1);
        const data2 = new Date(a2, m2 - 1, d2);
        return Math.round((data2 - data1) / 86400000);
    }

    /* ---------- Regras de jogo ---------- */

    function registrarDiaAtivo() {
        const hoje = hojeISO();

        if (!estado.ultimoDiaAtivo) {
            estado.streak = 1;
            estado.ultimoDiaAtivo = hoje;
        } else if (estado.ultimoDiaAtivo === hoje) {
            return; // já contabilizado hoje, nada a fazer
        } else {
            const diferenca = diasEntre(estado.ultimoDiaAtivo, hoje);
            estado.streak = diferenca === 1 ? estado.streak + 1 : 1;
            estado.ultimoDiaAtivo = hoje;
        }

        salvarEstado();
        render();
    }

    function tarefaConcluida() {
        estado.xp += XP_POR_TAREFA;
        estado.tarefasConcluidas += 1;
        salvarEstado();
        registrarDiaAtivo(); // concluir uma tarefa também conta como dia ativo
        render();
    }

    function tarefaReaberta() {
        estado.xp = Math.max(0, estado.xp - XP_POR_TAREFA);
        estado.tarefasConcluidas = Math.max(0, estado.tarefasConcluidas - 1);
        salvarEstado();
        render();
    }

    /* ---------- Nível (a cada 100 XP) ---------- */

    function calcularNivel() {
        const nivel = Math.floor(estado.xp / XP_POR_NIVEL) + 1;
        const xpNoNivel = estado.xp % XP_POR_NIVEL;
        return { nivel, xpNoNivel };
    }

    /* ---------- Render ---------- */

    function cacheElements() {
        elements.homeStreak = document.getElementById("homeStreak");
        elements.homeXp = document.getElementById("homeXp");
        elements.homeLevel = document.getElementById("homeLevel");

        elements.progressXp = document.getElementById("progressXp");
        elements.progressLevel = document.getElementById("progressLevel");
        elements.xpBar = document.getElementById("xpBar");
        elements.xpNext = document.getElementById("xpNext");
        elements.completedTaskCount = document.getElementById("completedTaskCount");
        elements.studyStreak = document.getElementById("studyStreak");
    }

    function textoDias(n) {
        return `${n} dia${n === 1 ? "" : "s"}`;
    }

    function render() {
        const { nivel, xpNoNivel } = calcularNivel();
        const percentual = Math.round((xpNoNivel / XP_POR_NIVEL) * 100);

        if (elements.homeStreak) elements.homeStreak.textContent = textoDias(estado.streak);
        if (elements.homeXp) elements.homeXp.textContent = `${estado.xp} XP`;
        if (elements.homeLevel) elements.homeLevel.textContent = `Nível ${nivel}`;

        if (elements.progressXp) elements.progressXp.textContent = `${estado.xp} XP`;
        if (elements.progressLevel) elements.progressLevel.textContent = `Nível ${nivel}`;
        if (elements.xpBar) elements.xpBar.style.width = `${percentual}%`;
        if (elements.xpNext) elements.xpNext.textContent = `${xpNoNivel} / ${XP_POR_NIVEL} XP`;
        if (elements.completedTaskCount) elements.completedTaskCount.textContent = String(estado.tarefasConcluidas);
        if (elements.studyStreak) elements.studyStreak.textContent = textoDias(estado.streak);

        // Avisa quem depender destes dados (ex.: conquistas.js) que
        // XP/streak/tarefas podem ter mudado.
        document.dispatchEvent(new CustomEvent("studymais:gamificacao-atualizada"));
    }

    function limparEstado() {
        estado = estadoPadrao();
        render();
    }

    /* ---------- Inicialização ---------- */

    function init() {
        cacheElements();

        document.addEventListener("studymais:ready", () => {
            carregarEstado();
            render();
            registrarDiaAtivo();
        });

        document.addEventListener("studymais:logout", limparEstado);

        document.addEventListener("studymais:tarefa-status", (evento) => {
            const concluida = !!(evento.detail && evento.detail.concluida);
            if (concluida) {
                tarefaConcluida();
            } else {
                tarefaReaberta();
            }
        });
    }

    document.addEventListener("DOMContentLoaded", init);

    /* ---------- API pública (usada por conquistas.js) ---------- */

    window.StudyMaisGamificacao = {
        getEstado: () => ({ ...estado }),
        calcularNivel,
    };
})();

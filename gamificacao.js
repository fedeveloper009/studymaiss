/* ==========================================
   STUDYMAIS
   gamificacao.js

   Sistema de XP, sequência (streak), tempo estudado e
   conquistas do usuário.

   Desde que a API ganhou os campos correspondentes no model
   Usuario (xp, diasDeSequencia, tempoEstudado, materiaEstudada,
   conquistas), nada disso é mais guardado no localStorage:
   o estado exibido aqui vem sempre do usuário autenticado
   (window.StudyMaisAuth.getCurrentUser()) e qualquer mudança
   é enviada de volta com window.StudyMaisAuth.atualizarProgresso(),
   que cuida de sincronizar com o back-end (ver auth.js para a
   explicação sobre a senha exigida pela API em todo PUT).

   ---------------------------------------------------------
   Regras:

   1) A cada tarefa marcada como concluída, o usuário ganha
      +20 XP. Se ele desmarcar a tarefa, os 20 XP voltam
      (para não ser possível "farmar" XP marcando e
      desmarcando a mesma tarefa).

   2) A cada dia novo em que o usuário conclui uma tarefa, a
      sequência (diasDeSequencia) sobe +1.

      OBS: o model Usuario guarda só a contagem de dias
      (Integer), sem guardar a *data* do último dia ativo. Sem
      esse dado, não é possível detectar de forma confiável,
      entre sessões diferentes, se um dia foi pulado (o que
      zeraria a sequência) — isso exigiria um novo campo no
      back-end (ex.: "ultimaAtividade", do tipo data). Por ora,
      a sequência só é incrementada uma vez por sessão contínua
      do navegador (nunca duas vezes seguidas sem recarregar a
      página), o que evita contagem duplicada enquanto o app
      estiver aberto, mas não substitui um controle por data.

   3) O tempo estudado (tempoEstudado, em segundos) e a última
      matéria estudada (materiaEstudada) são atualizados por
      cronometro.js ao final de cada sessão de estudo, e chegam
      aqui só para exibição (não há lógica de cronômetro neste
      arquivo).

   4) Conquistas: a lista de "chaves" já desbloqueadas é o
      campo `conquistas` do usuário (sincronizado com a API).
      O catálogo abaixo (título, descrição, condição) é só a
      definição de cada conquista — não precisa ser salvo em
      lugar nenhum, é o mesmo para todo mundo.

   Depende de auth.js (usuário atual + sincronização) e de
   dados.js (contagem de tarefas concluídas). É alimentado pelo
   evento "studymais:tarefa-status", disparado em dados.js
   sempre que uma tarefa é concluída/reaberta.
========================================== */

(function () {
    "use strict";

    const XP_POR_TAREFA = 20;
    const XP_POR_NIVEL = 100;

    const elements = {};

    // Evita contar mais de um "dia ativo" na mesma sessão do navegador
    // (ver observação da regra 2 acima). Reseta ao recarregar a página.
    let diaJaContadoNestaSessao = false;

    /* ---------- Catálogo de conquistas ---------- */

    const CATALOGO_CONQUISTAS = [
        {
            chave: "primeira-tarefa",
            titulo: "Primeiro passo",
            descricao: "Conclua sua primeira tarefa.",
            icone: "🏁",
            condicao: (usuario, tarefasConcluidas) => tarefasConcluidas >= 1,
        },
        {
            chave: "dez-tarefas",
            titulo: "Ritmo de estudo",
            descricao: "Conclua 10 tarefas.",
            icone: "📘",
            condicao: (usuario, tarefasConcluidas) => tarefasConcluidas >= 10,
        },
        {
            chave: "streak-3",
            titulo: "Constância",
            descricao: "Alcance 3 dias de sequência.",
            icone: "🔥",
            condicao: (usuario) => (usuario.diasDeSequencia || 0) >= 3,
        },
        {
            chave: "streak-7",
            titulo: "Uma semana inteira",
            descricao: "Alcance 7 dias de sequência.",
            icone: "🏆",
            condicao: (usuario) => (usuario.diasDeSequencia || 0) >= 7,
        },
        {
            chave: "xp-100",
            titulo: "Nível 2",
            descricao: "Alcance 100 XP.",
            icone: "⭐",
            condicao: (usuario) => (usuario.xp || 0) >= 100,
        },
        {
            chave: "xp-500",
            titulo: "Veterano dos estudos",
            descricao: "Alcance 500 XP.",
            icone: "🌟",
            condicao: (usuario) => (usuario.xp || 0) >= 500,
        },
        {
            chave: "uma-hora",
            titulo: "Foco total",
            descricao: "Estude 1 hora no total.",
            icone: "⏱️",
            condicao: (usuario) => (usuario.tempoEstudado || 0) >= 3600,
        },
    ];

    /* ---------- Leitura do usuário atual ---------- */

    function usuarioAtual() {
        return (window.StudyMaisAuth && window.StudyMaisAuth.getCurrentUser()) || {};
    }

    function tarefasConcluidasCount() {
        return (window.StudyMaisDados && window.StudyMaisDados.contarTarefasConcluidas()) || 0;
    }

    /* ---------- Nível (a cada 100 XP) ---------- */

    function calcularNivel(xp) {
        const nivel = Math.floor(xp / XP_POR_NIVEL) + 1;
        const xpNoNivel = xp % XP_POR_NIVEL;
        return { nivel, xpNoNivel };
    }

    /* ---------- Conquistas: avaliação e sincronização ---------- */

    async function avaliarConquistas() {
        const usuario = usuarioAtual();
        const jaDesbloqueadas = new Set(usuario.conquistas || []);
        const tarefasConcluidas = tarefasConcluidasCount();

        const novasConquistas = CATALOGO_CONQUISTAS.filter(
            (conquista) => !jaDesbloqueadas.has(conquista.chave) && conquista.condicao(usuario, tarefasConcluidas)
        );

        if (novasConquistas.length === 0) {
            renderAchievements();
            return;
        }

        const listaAtualizada = [...(usuario.conquistas || []), ...novasConquistas.map((c) => c.chave)];
        await window.StudyMaisAuth.atualizarProgresso({ conquistas: listaAtualizada });
        renderAchievements();
    }

    /* ---------- Regras de jogo ---------- */

    async function registrarDiaAtivo() {
        if (diaJaContadoNestaSessao) return;
        diaJaContadoNestaSessao = true;

        const usuario = usuarioAtual();
        const novoStreak = (usuario.diasDeSequencia || 0) + 1;
        await window.StudyMaisAuth.atualizarProgresso({ diasDeSequencia: novoStreak });
        render();
        avaliarConquistas();
    }

    async function tarefaConcluida() {
        const usuario = usuarioAtual();
        const novoXp = (usuario.xp || 0) + XP_POR_TAREFA;
        await window.StudyMaisAuth.atualizarProgresso({ xp: novoXp });
        render();
        // Concluir uma tarefa também conta como dia ativo.
        await registrarDiaAtivo();
        avaliarConquistas();
    }

    async function tarefaReaberta() {
        const usuario = usuarioAtual();
        const novoXp = Math.max(0, (usuario.xp || 0) - XP_POR_TAREFA);
        await window.StudyMaisAuth.atualizarProgresso({ xp: novoXp });
        render();
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
        elements.totalStudyTime = document.getElementById("totalStudyTime");

        elements.achievementsList = document.getElementById("achievementsList");
    }

    function textoDias(n) {
        return `${n} dia${n === 1 ? "" : "s"}`;
    }

    // tempoEstudado vem da API em segundos.
    function formatarHorasMinutos(segundos) {
        const totalMinutos = Math.round(segundos / 60);
        const horas = Math.floor(totalMinutos / 60);
        const minutos = totalMinutos % 60;
        return `${horas}h ${minutos}min`;
    }

    function render() {
        const usuario = usuarioAtual();
        const xp = usuario.xp || 0;
        const streak = usuario.diasDeSequencia || 0;
        const tempoEstudado = usuario.tempoEstudado || 0;

        const { nivel, xpNoNivel } = calcularNivel(xp);
        const percentual = Math.round((xpNoNivel / XP_POR_NIVEL) * 100);

        if (elements.homeStreak) elements.homeStreak.textContent = textoDias(streak);
        if (elements.homeXp) elements.homeXp.textContent = `${xp} XP`;
        if (elements.homeLevel) elements.homeLevel.textContent = `Nível ${nivel}`;

        if (elements.progressXp) elements.progressXp.textContent = `${xp} XP`;
        if (elements.progressLevel) elements.progressLevel.textContent = `Nível ${nivel}`;
        if (elements.xpBar) elements.xpBar.style.width = `${percentual}%`;
        if (elements.xpNext) elements.xpNext.textContent = `${xpNoNivel} / ${XP_POR_NIVEL} XP`;
        if (elements.completedTaskCount) elements.completedTaskCount.textContent = String(tarefasConcluidasCount());
        if (elements.studyStreak) elements.studyStreak.textContent = textoDias(streak);
        if (elements.totalStudyTime) elements.totalStudyTime.textContent = formatarHorasMinutos(tempoEstudado);
    }

    function renderAchievements() {
        if (!elements.achievementsList) return;

        const usuario = usuarioAtual();
        const desbloqueadas = new Set(usuario.conquistas || []);

        elements.achievementsList.innerHTML = CATALOGO_CONQUISTAS.map((conquista) => {
            const desbloqueada = desbloqueadas.has(conquista.chave);
            return `
                <div class="achievement-card${desbloqueada ? "" : " locked"}">
                    <div class="achievement-icon">${conquista.icone}</div>
                    <h2>${conquista.titulo}</h2>
                    <p>${conquista.descricao}</p>
                </div>
            `;
        }).join("");
    }

    function limparEstado() {
        diaJaContadoNestaSessao = false;
        render();
        renderAchievements();
    }

    /* ---------- Inicialização ---------- */

    function init() {
        cacheElements();

        document.addEventListener("studymais:ready", () => {
            diaJaContadoNestaSessao = false;
            render();
            renderAchievements();
            registrarDiaAtivo();
        });

        // Disparado por auth.js sempre que o progresso é sincronizado
        // com sucesso (ex.: por cronometro.js, ao encerrar uma sessão).
        document.addEventListener("studymais:usuario-atualizado", () => {
            render();
            avaliarConquistas();
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
})();

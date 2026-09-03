/* ==========================================
   STUDYMAIS
   dados.js

   Integração com a API real: matérias e tarefas.
   Depende de services/api.js e auth.js (carregados antes).

   ---------------------------------------------------------
   Contrato da API (conforme documentado pelo usuário):

   Matéria (POST/GET /api/materias)
     { id, nomeMateria, descricao, cor, usuarioId }

   Tarefa (POST/GET /api/tarefas)
     { id, titulo, descricao, dataEntrega ("YYYY-MM-DD"),
       materiaId, usuarioId, status, prioridade }
     status:     "PENDENTE" | "CONCLUIDA"
     prioridade: "BAIXA" | "MEDIA" | "ALTA"

   Plataforma (POST/GET /api/plataformas)
     { id, nomePlataforma, descricao, url, usuarioId }

   ---------------------------------------------------------
   ATENÇÃO / PREMISSAS ASSUMIDAS (a API não tem esses campos,
   então foram resolvidos no front-end — ajuste se necessário):

   1) Não existe campo de "horário" em Tarefa. O horário
      escolhido no modal (#taskTime) é guardado dentro de
      `descricao`, prefixado como "⏰HH:MM ". Ele é extraído
      de volta na hora de exibir a tarefa. Se a API ganhar um
      campo próprio de horário no futuro, é só trocar as
      funções `codificarDescricao` / `decodificarDescricao`.

   2) Não existe campo de "ícone" em Matéria (só `cor`).
      O emoji escolhido no modal é mapeado para uma cor fixa
      (SUBJECT_PALETTE) e a cor recebida da API é usada para
      "adivinhar" de volta o emoji mais próximo ao exibir.
========================================== */

(function () {
    "use strict";

    const api = window.StudyMaisAPI;

    /* ---------- Estado em memória ---------- */

    let materias = [];
    let tarefas = [];
    let plataformas = [];

    const hoje = new Date();
    let viewYear = hoje.getFullYear();
    let viewMonth = hoje.getMonth(); // 0-11
    let selectedDate = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());

    const elements = {};

    /* ---------- Paleta emoji <-> cor (matérias) ---------- */

    const SUBJECT_PALETTE = [
        { emoji: "📚", cor: "#3498DB" },
        { emoji: "🧮", cor: "#9B59B6" },
        { emoji: "🧪", cor: "#2ECC71" },
        { emoji: "🌎", cor: "#1ABC9C" },
        { emoji: "📖", cor: "#E67E22" },
        { emoji: "🎨", cor: "#E84393" },
    ];

    function emojiParaCor(emoji) {
        const encontrado = SUBJECT_PALETTE.find((item) => item.emoji === emoji);
        return encontrado ? encontrado.cor : SUBJECT_PALETTE[0].cor;
    }

    function corParaEmoji(cor) {
        if (!cor) return SUBJECT_PALETTE[0].emoji;
        const alvo = cor.toLowerCase();
        const encontrado = SUBJECT_PALETTE.find((item) => item.cor.toLowerCase() === alvo);
        return encontrado ? encontrado.emoji : "📚";
    }

    /* ---------- Horário embutido na descrição ---------- */

    function codificarDescricao(horario, textoBase) {
        const texto = (textoBase || "").trim();
        if (!horario) return texto;
        return `⏰${horario} ${texto}`.trim();
    }

    function decodificarDescricao(descricao) {
        const raw = descricao || "";
        const match = raw.match(/^⏰(\d{2}:\d{2})\s?([\s\S]*)$/);
        if (match) {
            return { horario: match[1], texto: match[2] || "" };
        }
        return { horario: null, texto: raw };
    }

    /* ---------- Prioridade / status: API (maiúsculo) <-> UI (minúsculo) ---------- */

    function prioridadeParaApi(p) {
        return (p || "media").toUpperCase();
    }

    function prioridadeParaUi(p) {
        return (p || "MEDIA").toLowerCase();
    }

    function rotuloPrioridade(p) {
        const mapa = { alta: "Alta", media: "Média", baixa: "Baixa" };
        return mapa[prioridadeParaUi(p)] || "Média";
    }

    /* ---------- Datas ---------- */

    function paraISO(date) {
        const ano = date.getFullYear();
        const mes = String(date.getMonth() + 1).padStart(2, "0");
        const dia = String(date.getDate()).padStart(2, "0");
        return `${ano}-${mes}-${dia}`;
    }

    function deISO(iso) {
        const [ano, mes, dia] = iso.split("-").map(Number);
        return new Date(ano, mes - 1, dia);
    }

    function mesmoDia(a, b) {
        return (
            a.getFullYear() === b.getFullYear() &&
            a.getMonth() === b.getMonth() &&
            a.getDate() === b.getDate()
        );
    }

    const NOMES_MES = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
    ];

    const NOMES_DIA_SEMANA = [
        "Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira",
        "Quinta-feira", "Sexta-feira", "Sábado",
    ];

    /* ---------- Utilidades ---------- */

    function escapeHtml(texto) {
        const div = document.createElement("div");
        div.textContent = texto == null ? "" : String(texto);
        return div.innerHTML;
    }

    function getUsuarioId() {
        const user = window.StudyMaisAuth && window.StudyMaisAuth.getCurrentUser();
        return user ? user.id : null;
    }

    function materiaPorId(id) {
        return materias.find((m) => String(m.id) === String(id)) || null;
    }

    function tarefasDoDia(date) {
        const iso = paraISO(date);
        return tarefas.filter((t) => t.dataEntrega === iso);
    }

    /* ---------- Cache de elementos ---------- */

    function cacheElements() {
        elements.calendar = document.getElementById("calendar");
        elements.monthTitle = document.getElementById("monthTitle");
        elements.previousMonth = document.getElementById("previousMonth");
        elements.nextMonth = document.getElementById("nextMonth");
        elements.todayButton = document.getElementById("todayButton");
        elements.selectedDate = document.getElementById("selectedDate");
        elements.tasks = document.getElementById("tasks");
        elements.addTaskButton = document.getElementById("addTaskButton");

        elements.homeSubjectsList = document.getElementById("homeSubjectsList");
        elements.todayTasksList = document.getElementById("todayTasksList");
        elements.focusTasks = document.getElementById("focusTasks");
        elements.todayTaskCount = document.getElementById("todayTaskCount");

        elements.subjectsList = document.getElementById("subjectsList");
        elements.addSubjectButton = document.getElementById("addSubjectButton");

        elements.taskModal = document.getElementById("taskModal");
        elements.closeModal = document.getElementById("closeModal");
        elements.taskTitle = document.getElementById("taskTitle");
        elements.taskSubject = document.getElementById("taskSubject");
        elements.taskTime = document.getElementById("taskTime");
        elements.taskPriority = document.getElementById("taskPriority");
        elements.saveTask = document.getElementById("saveTask");

        elements.subjectModal = document.getElementById("subjectModal");
        elements.closeSubjectModal = document.getElementById("closeSubjectModal");
        elements.subjectName = document.getElementById("subjectName");
        elements.subjectEmoji = document.getElementById("subjectEmoji");
        elements.saveSubject = document.getElementById("saveSubject");

        elements.platformsList = document.getElementById("platformsList");
        elements.addPlatformButton = document.getElementById("addPlatformButton");
        elements.platformModal = document.getElementById("platformModal");
        elements.closePlatformModal = document.getElementById("closePlatformModal");
        elements.platformName = document.getElementById("platformName");
        elements.platformDescription = document.getElementById("platformDescription");
        elements.platformUrl = document.getElementById("platformUrl");
        elements.savePlatform = document.getElementById("savePlatform");

        elements.planSubject = document.getElementById("planSubject");
        elements.timerSubject = document.getElementById("timerSubject");
    }

    /* ---------- Carregamento ---------- */

    async function carregarDados() {
        try {
            const [listaMaterias, listaTarefas, listaPlataformas] = await Promise.all([
                api.materiaService.listar(),
                api.tarefaService.listar(),
                api.plataformaService.listar(),
            ]);
            materias = Array.isArray(listaMaterias) ? listaMaterias : [];
            tarefas = Array.isArray(listaTarefas) ? listaTarefas : [];
            plataformas = Array.isArray(listaPlataformas) ? listaPlataformas : [];
        } catch (error) {
            materias = [];
            tarefas = [];
            plataformas = [];
            console.error("Não foi possível carregar matérias/tarefas/plataformas:", error);
        }
        renderTudo();
    }

    function limparEstado() {
        materias = [];
        tarefas = [];
        plataformas = [];
        selectedDate = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
        viewYear = hoje.getFullYear();
        viewMonth = hoje.getMonth();
    }

    /* ---------- Render: seletores de matéria (modal tarefa / plano) ---------- */

    function popularSelectsDeMateria() {
        [elements.taskSubject, elements.planSubject].forEach((select) => {
            if (!select) return;
            select.innerHTML = "";

            if (materias.length === 0) {
                const opt = document.createElement("option");
                opt.value = "";
                opt.textContent = "Cadastre uma matéria primeiro";
                select.appendChild(opt);
                return;
            }

            materias.forEach((materia) => {
                const opt = document.createElement("option");
                opt.value = materia.id;
                opt.textContent = materia.nomeMateria;
                select.appendChild(opt);
            });
        });

        // O select do cronômetro sempre mantém a opção "Estudo geral",
        // além das matérias reais do usuário (se houver alguma).
        if (elements.timerSubject) {
            elements.timerSubject.innerHTML = "";

            const geral = document.createElement("option");
            geral.value = "";
            geral.textContent = "📚 Estudo geral";
            elements.timerSubject.appendChild(geral);

            materias.forEach((materia) => {
                const opt = document.createElement("option");
                opt.value = materia.id;
                opt.textContent = `${corParaEmoji(materia.cor)} ${materia.nomeMateria}`;
                elements.timerSubject.appendChild(opt);
            });
        }
    }

    /* ---------- Render: página Matérias ---------- */

    function renderSubjectsPage() {
        if (!elements.subjectsList) return;

        if (materias.length === 0) {
            elements.subjectsList.innerHTML =
                '<p class="no-tasks">Você ainda não cadastrou nenhuma matéria.</p>';
            return;
        }

        elements.subjectsList.innerHTML = materias
            .map((materia) => {
                const emoji = corParaEmoji(materia.cor);
                const totalTarefas = tarefas.filter(
                    (t) => String(t.materiaId) === String(materia.id)
                ).length;
                return `
                    <div class="subject-card" data-id="${materia.id}">
                        <div class="subject-icon" style="background:${escapeHtml(materia.cor || "")}22;color:${escapeHtml(materia.cor || "")}">${emoji}</div>
                        <h2>${escapeHtml(materia.nomeMateria)}</h2>
                        <p>${escapeHtml(materia.descricao) || "Sem descrição."}</p>
                        <p>${totalTarefas} tarefa${totalTarefas === 1 ? "" : "s"}</p>
                        <button type="button" class="text-button" data-delete-subject="${materia.id}">Excluir matéria</button>
                    </div>
                `;
            })
            .join("");

        elements.subjectsList.querySelectorAll("[data-delete-subject]").forEach((btn) => {
            btn.addEventListener("click", () => excluirMateria(btn.dataset.deleteSubject));
        });
    }

    /* ---------- Render: página Plataformas ---------- */

    function renderPlatformsPage() {
        if (!elements.platformsList) return;

        if (plataformas.length === 0) {
            elements.platformsList.innerHTML =
                '<p class="no-tasks">Você ainda não cadastrou nenhuma plataforma.</p>';
            return;
        }

        elements.platformsList.innerHTML = plataformas
            .map((plataforma) => {
                const linkHtml = plataforma.url
                    ? `<a href="${escapeHtml(plataforma.url)}" target="_blank" rel="noopener noreferrer" class="text-button">Abrir ↗</a>`
                    : "";
                return `
                    <div class="subject-card" data-id="${plataforma.id}">
                        <div class="subject-icon">🖥️</div>
                        <h2>${escapeHtml(plataforma.nomePlataforma)}</h2>
                        <p>${escapeHtml(plataforma.descricao) || "Sem descrição."}</p>
                        ${linkHtml}
                        <button type="button" class="text-button" data-delete-platform="${plataforma.id}">Excluir plataforma</button>
                    </div>
                `;
            })
            .join("");

        elements.platformsList.querySelectorAll("[data-delete-platform]").forEach((btn) => {
            btn.addEventListener("click", () => excluirPlataforma(btn.dataset.deletePlatform));
        });
    }

    /* ---------- Render: matérias na Home ---------- */

    function renderHomeSubjects() {
        if (!elements.homeSubjectsList) return;

        if (materias.length === 0) {
            elements.homeSubjectsList.innerHTML =
                '<p class="no-tasks">Cadastre suas matérias para começar.</p>';
            return;
        }

        elements.homeSubjectsList.innerHTML = materias
            .slice(0, 4)
            .map((materia) => {
                const emoji = corParaEmoji(materia.cor);
                const totalTarefas = tarefas.filter(
                    (t) => String(t.materiaId) === String(materia.id)
                ).length;
                return `
                    <div class="home-subject">
                        <div>${emoji}</div>
                        <strong>${escapeHtml(materia.nomeMateria)}</strong>
                        <small>${totalTarefas} tarefa${totalTarefas === 1 ? "" : "s"}</small>
                    </div>
                `;
            })
            .join("");
    }

    /* ---------- Render: item de tarefa (reusado em Home e Cronograma) ---------- */

    function renderTaskItem(tarefa) {
        const materia = materiaPorId(tarefa.materiaId);
        const { horario, texto } = decodificarDescricao(tarefa.descricao);
        const concluida = tarefa.status === "CONCLUIDA";
        const prioridadeUi = prioridadeParaUi(tarefa.prioridade);

        const detalhes = [
            materia ? materia.nomeMateria : "Sem matéria",
            horario,
            texto,
        ]
            .filter(Boolean)
            .map(escapeHtml)
            .join(" • ");

        return `
            <div class="task${concluida ? " completed" : ""}" data-id="${tarefa.id}">
                <button type="button" class="task-check" data-toggle-task="${tarefa.id}" aria-label="Concluir tarefa">${concluida ? "✓" : ""}</button>
                <div class="task-info">
                    <strong>${escapeHtml(tarefa.titulo)}</strong>
                    <small>${detalhes}</small>
                </div>
                <span class="priority ${prioridadeUi}">${rotuloPrioridade(tarefa.prioridade)}</span>
                <button type="button" class="text-button" data-delete-task="${tarefa.id}">🗑</button>
            </div>
        `;
    }

    function ligarAcoesDeTarefas(container) {
        if (!container) return;
        container.querySelectorAll("[data-toggle-task]").forEach((btn) => {
            btn.addEventListener("click", () => alternarConclusaoTarefa(btn.dataset.toggleTask));
        });
        container.querySelectorAll("[data-delete-task]").forEach((btn) => {
            btn.addEventListener("click", () => excluirTarefa(btn.dataset.deleteTask));
        });
    }

    /* ---------- Render: lista de tarefas do dia selecionado (Cronograma) ---------- */

    function renderTasksSection() {
        if (!elements.tasks || !elements.selectedDate) return;

        const nomeDiaSemana = NOMES_DIA_SEMANA[selectedDate.getDay()];
        elements.selectedDate.textContent = `${nomeDiaSemana}, ${selectedDate.getDate()} de ${NOMES_MES[selectedDate.getMonth()].toLowerCase()}`;

        const tarefasDia = tarefasDoDia(selectedDate);

        if (tarefasDia.length === 0) {
            elements.tasks.innerHTML = '<p class="no-tasks">Nenhuma tarefa para este dia.</p>';
            return;
        }

        elements.tasks.innerHTML = tarefasDia.map(renderTaskItem).join("");
        ligarAcoesDeTarefas(elements.tasks);
    }

    /* ---------- Render: tarefas de hoje (Home) ---------- */

    function renderHomeTasks() {
        const tarefasHoje = tarefasDoDia(hoje);
        const concluidas = tarefasHoje.filter((t) => t.status === "CONCLUIDA").length;

        if (elements.todayTaskCount) {
            elements.todayTaskCount.textContent = `${concluidas}/${tarefasHoje.length}`;
        }

        if (elements.todayTasksList) {
            elements.todayTasksList.innerHTML =
                tarefasHoje.length === 0
                    ? '<p class="no-tasks">Nenhuma tarefa para hoje.</p>'
                    : tarefasHoje.map(renderTaskItem).join("");
            ligarAcoesDeTarefas(elements.todayTasksList);
        }

        if (elements.focusTasks) {
            const pendentes = tarefasHoje.filter((t) => t.status !== "CONCLUIDA");
            elements.focusTasks.innerHTML = pendentes
                .slice(0, 4)
                .map((t) => `<span class="focus-task">${escapeHtml(t.titulo)}</span>`)
                .join("");
        }
    }

    /* ---------- Render: calendário ---------- */

    function renderCalendar() {
        if (!elements.calendar || !elements.monthTitle) return;

        elements.monthTitle.textContent = `${NOMES_MES[viewMonth]} de ${viewYear}`;

        const primeiroDiaMes = new Date(viewYear, viewMonth, 1);
        // Semana começa na segunda (SEG..DOM); getDay() 0=domingo.
        const offset = (primeiroDiaMes.getDay() + 6) % 7;
        const inicioGrade = new Date(viewYear, viewMonth, 1 - offset);

        const celulas = [];
        for (let i = 0; i < 42; i++) {
            const dia = new Date(inicioGrade.getFullYear(), inicioGrade.getMonth(), inicioGrade.getDate() + i);
            celulas.push(dia);
        }

        elements.calendar.innerHTML = celulas
            .map((dia) => {
                const outroMes = dia.getMonth() !== viewMonth;
                const isHoje = mesmoDia(dia, hoje);
                const isSelecionado = mesmoDia(dia, selectedDate);
                const temTarefa = tarefasDoDia(dia).length > 0;

                const classes = ["day"];
                if (outroMes) classes.push("other-month");
                if (isHoje) classes.push("today");
                if (isSelecionado) classes.push("selected");

                return `
                    <div class="${classes.join(" ")}" data-date="${paraISO(dia)}">
                        <span class="day-number">${dia.getDate()}</span>
                        ${temTarefa ? '<span class="task-dot"></span>' : ""}
                    </div>
                `;
            })
            .join("");

        elements.calendar.querySelectorAll("[data-date]").forEach((celula) => {
            celula.addEventListener("click", () => {
                selectedDate = deISO(celula.dataset.date);
                renderCalendar();
                renderTasksSection();
            });
        });
    }

    /* ---------- Render geral ---------- */

    function renderTudo() {
        popularSelectsDeMateria();
        renderSubjectsPage();
        renderPlatformsPage();
        renderHomeSubjects();
        renderHomeTasks();
        renderCalendar();
        renderTasksSection();
    }

    /* ---------- Ações: Tarefas ---------- */

    async function alternarConclusaoTarefa(id) {
        const tarefa = tarefas.find((t) => String(t.id) === String(id));
        if (!tarefa) return;

        const novoStatus = tarefa.status === "CONCLUIDA" ? "PENDENTE" : "CONCLUIDA";
        const payload = {
            titulo: tarefa.titulo,
            descricao: tarefa.descricao,
            dataEntrega: tarefa.dataEntrega,
            materiaId: tarefa.materiaId,
            usuarioId: tarefa.usuarioId,
            status: novoStatus,
            prioridade: tarefa.prioridade,
        };

        try {
            await api.tarefaService.atualizar(tarefa.id, payload);
            tarefa.status = novoStatus;
            renderHomeTasks();
            renderTasksSection();
            renderCalendar();
            // Avisa gamificacao.js para atualizar XP e sequência.
            document.dispatchEvent(
                new CustomEvent("studymais:tarefa-status", {
                    detail: { id: tarefa.id, concluida: novoStatus === "CONCLUIDA" },
                })
            );
        } catch (error) {
            window.alert(error.message || "Não foi possível atualizar a tarefa.");
        }
    }

    async function excluirTarefa(id) {
        if (!window.confirm("Excluir esta tarefa?")) return;
        try {
            await api.tarefaService.deletar(id);
            tarefas = tarefas.filter((t) => String(t.id) !== String(id));
            renderHomeTasks();
            renderTasksSection();
            renderCalendar();
            renderSubjectsPage();
            renderHomeSubjects();
        } catch (error) {
            window.alert(error.message || "Não foi possível excluir a tarefa.");
        }
    }

    async function handleSaveTask() {
        const titulo = (elements.taskTitle.value || "").trim();
        const materiaId = elements.taskSubject.value;
        const horario = elements.taskTime.value || "";
        const prioridade = prioridadeParaApi(elements.taskPriority.value);
        const usuarioId = getUsuarioId();

        if (!titulo) {
            window.alert("Informe um título para a tarefa.");
            return;
        }
        if (!materiaId) {
            window.alert("Cadastre e selecione uma matéria antes de criar a tarefa.");
            return;
        }

        const payload = {
            titulo,
            descricao: codificarDescricao(horario, ""),
            dataEntrega: paraISO(selectedDate),
            materiaId,
            usuarioId,
            status: "PENDENTE",
            prioridade,
        };

        const textoOriginal = elements.saveTask.textContent;
        elements.saveTask.disabled = true;
        elements.saveTask.textContent = "Criando...";

        try {
            const criada = await api.tarefaService.criar(payload);
            tarefas.push(criada || payload);
            elements.taskModal.classList.add("hidden");
            elements.taskTitle.value = "";
            elements.taskTime.value = "";
            renderHomeTasks();
            renderTasksSection();
            renderCalendar();
            renderSubjectsPage();
            renderHomeSubjects();
        } catch (error) {
            window.alert(error.message || "Não foi possível criar a tarefa.");
        } finally {
            elements.saveTask.disabled = false;
            elements.saveTask.textContent = textoOriginal;
        }
    }

    /* ---------- Ações: Matérias ---------- */

    async function excluirMateria(id) {
        if (!window.confirm("Excluir esta matéria? As tarefas ligadas a ela podem ser afetadas.")) return;
        try {
            await api.materiaService.deletar(id);
            materias = materias.filter((m) => String(m.id) !== String(id));
            popularSelectsDeMateria();
            renderSubjectsPage();
            renderHomeSubjects();
        } catch (error) {
            window.alert(error.message || "Não foi possível excluir a matéria.");
        }
    }

    async function handleSaveSubject() {
        const nomeMateria = (elements.subjectName.value || "").trim();
        const emoji = elements.subjectEmoji.value;
        const usuarioId = getUsuarioId();

        if (!nomeMateria) {
            window.alert("Informe um nome para a matéria.");
            return;
        }

        const payload = {
            nomeMateria,
            descricao: "",
            cor: emojiParaCor(emoji),
            usuarioId,
        };

        const textoOriginal = elements.saveSubject.textContent;
        elements.saveSubject.disabled = true;
        elements.saveSubject.textContent = "Adicionando...";

        try {
            const criada = await api.materiaService.criar(payload);
            materias.push(criada || payload);
            elements.subjectModal.classList.add("hidden");
            elements.subjectName.value = "";
            popularSelectsDeMateria();
            renderSubjectsPage();
            renderHomeSubjects();
        } catch (error) {
            window.alert(error.message || "Não foi possível criar a matéria.");
        } finally {
            elements.saveSubject.disabled = false;
            elements.saveSubject.textContent = textoOriginal;
        }
    }

    /* ---------- Ações: Plataformas ---------- */

    async function excluirPlataforma(id) {
        if (!window.confirm("Excluir esta plataforma?")) return;
        try {
            await api.plataformaService.deletar(id);
            plataformas = plataformas.filter((p) => String(p.id) !== String(id));
            renderPlatformsPage();
        } catch (error) {
            window.alert(error.message || "Não foi possível excluir a plataforma.");
        }
    }

    async function handleSavePlatform() {
        const nomePlataforma = (elements.platformName.value || "").trim();
        const descricao = (elements.platformDescription.value || "").trim();
        const url = (elements.platformUrl.value || "").trim();
        const usuarioId = getUsuarioId();

        if (!nomePlataforma) {
            window.alert("Informe um nome para a plataforma.");
            return;
        }

        const payload = { nomePlataforma, descricao, url, usuarioId };

        const textoOriginal = elements.savePlatform.textContent;
        elements.savePlatform.disabled = true;
        elements.savePlatform.textContent = "Adicionando...";

        try {
            const criada = await api.plataformaService.criar(payload);
            plataformas.push(criada || payload);
            elements.platformModal.classList.add("hidden");
            elements.platformName.value = "";
            elements.platformDescription.value = "";
            elements.platformUrl.value = "";
            renderPlatformsPage();
        } catch (error) {
            window.alert(error.message || "Não foi possível criar a plataforma.");
        } finally {
            elements.savePlatform.disabled = false;
            elements.savePlatform.textContent = textoOriginal;
        }
    }

    /* ---------- Ligações de UI ---------- */

    function bindUI() {
        if (elements.previousMonth) {
            elements.previousMonth.addEventListener("click", () => {
                viewMonth -= 1;
                if (viewMonth < 0) {
                    viewMonth = 11;
                    viewYear -= 1;
                }
                renderCalendar();
            });
        }

        if (elements.nextMonth) {
            elements.nextMonth.addEventListener("click", () => {
                viewMonth += 1;
                if (viewMonth > 11) {
                    viewMonth = 0;
                    viewYear += 1;
                }
                renderCalendar();
            });
        }

        if (elements.todayButton) {
            elements.todayButton.addEventListener("click", () => {
                viewYear = hoje.getFullYear();
                viewMonth = hoje.getMonth();
                selectedDate = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
                renderCalendar();
                renderTasksSection();
            });
        }

        if (elements.addTaskButton) {
            elements.addTaskButton.addEventListener("click", () => {
                if (materias.length === 0) {
                    window.alert("Cadastre uma matéria antes de criar tarefas.");
                    return;
                }
                elements.taskModal.classList.remove("hidden");
            });
        }
        if (elements.closeModal) {
            elements.closeModal.addEventListener("click", () => {
                elements.taskModal.classList.add("hidden");
            });
        }
        if (elements.saveTask) {
            elements.saveTask.addEventListener("click", handleSaveTask);
        }

        if (elements.addSubjectButton) {
            elements.addSubjectButton.addEventListener("click", () => {
                elements.subjectModal.classList.remove("hidden");
            });
        }
        if (elements.closeSubjectModal) {
            elements.closeSubjectModal.addEventListener("click", () => {
                elements.subjectModal.classList.add("hidden");
            });
        }
        if (elements.saveSubject) {
            elements.saveSubject.addEventListener("click", handleSaveSubject);
        }

        if (elements.addPlatformButton) {
            elements.addPlatformButton.addEventListener("click", () => {
                elements.platformModal.classList.remove("hidden");
            });
        }
        if (elements.closePlatformModal) {
            elements.closePlatformModal.addEventListener("click", () => {
                elements.platformModal.classList.add("hidden");
            });
        }
        if (elements.savePlatform) {
            elements.savePlatform.addEventListener("click", handleSavePlatform);
        }
    }

    /* ---------- Tema (claro/escuro) ---------- */

    function initTema() {
        const themeButton = document.getElementById("themeButton");
        if (!themeButton) return;

        const atualizarIcone = () => {
            themeButton.textContent = document.body.classList.contains("dark") ? "☀️" : "🌙";
        };
        atualizarIcone();

        themeButton.addEventListener("click", () => {
            document.body.classList.toggle("dark");
            const tema = document.body.classList.contains("dark") ? "dark" : "light";
            localStorage.setItem("studymais-theme", tema);
            atualizarIcone();
        });
    }

    /* ---------- Inicialização ---------- */

    function init() {
        cacheElements();
        bindUI();
        initTema();

        document.addEventListener("studymais:ready", carregarDados);
        document.addEventListener("studymais:logout", () => {
            limparEstado();
            renderTudo();
        });
    }

    document.addEventListener("DOMContentLoaded", init);

    /* ---------- Exposição global ----------
       Usado por gamificacao.js: a quantidade de tarefas concluídas
       não precisa (nem deve) ser guardada à parte — a própria API
       de tarefas já é a fonte da verdade (campo "status"). */
    window.StudyMaisDados = {
        contarTarefasConcluidas() {
            return tarefas.filter((t) => t.status === "CONCLUIDA").length;
        },
    };
})();

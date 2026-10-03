/* ==========================================
   STUDYMAIS
   exercicios.js

    Exercícios organizados por matéria > tópico a partir do
    catálogo de conteúdo introdutório do back-end.
   Depende de services/api.js, auth.js e calendario.js
   (carregados antes).

   ---------------------------------------------------------
   Responsabilidades do FRONT-END:
    - montar o menu (matéria > tópicos) a partir do back-end;
     - pedir uma questão por vez ao back-end;
     - mostrar enunciado e alternativas recebidas;
     - enviar as alternativas marcadas;
     - mostrar o resultado devolvido pelo servidor.

   Responsabilidades do BACK-END (NÃO duplicadas aqui):
     - escolher a próxima questão (aleatória, sem repetir
       dentro da mesma sessão);
     - corrigir a resposta;
     - devolver resposta correta e explicação (quando liberado).

     Endpoints usados (ver services/api.js > exercicioService):
         GET  /api/exercicios/topicos?materia=
     GET  /api/exercicios/questoes/proxima?materia=&topico=&sessaoId=
     POST /api/exercicios/questoes/{apresentacaoId}/resposta
          corpo: { "respostas": ["texto da alternativa", ...] }

   ---------------------------------------------------------
    O menu e a introdução são gerados pela hierarquia retornada
    por GET /api/exercicios/topicos. Os nomes de matéria e tópico
    também são enviados à API de questões.
========================================== */

(function () {
    "use strict";

    const api = window.StudyMaisAPI;

    const TIPO_UNICA = "ALTERNATIVA_UNICA";
    const TIPO_MULTIPLA = "SELECAO_MULTIPLA";
    const CONTEUDO_FRACOES = {
        resumo: "Uma fração representa partes iguais de um todo. O número de cima, chamado numerador, mostra quantas partes foram consideradas. O número de baixo, chamado denominador, mostra em quantas partes iguais o todo foi dividido.",
        formulas: [],
        significadosSimbolos: [
            { simbolo: "numerador", significado: "Número de cima; mostra quantas partes foram consideradas." },
            { simbolo: "denominador", significado: "Número de baixo; mostra em quantas partes iguais o todo foi dividido." },
        ],
        exemploResolvido: "Em 3/4, o todo foi dividido em 4 partes iguais e 3 foram consideradas.",
        revisaoNecessaria: false,
        notaRevisao: null,
    };

    /* ---------- Estado em memória ---------- */

    /**
    * Um estado por matéria/tópico. Seleções e questões abertas são
    * preservadas ao navegar para outra página e voltar.
    *
    * fase: "introducao" | "carregando" | "erro" | "vazio" | "questao"
     */
    let estados = {};
    let topicoAtivo = null; // { materia, topico }
    let catalogo = [];
    let catalogoCarregando = false;
    let erroCatalogo = "";

    const elements = {};

    function novoEstado() {
        return {
            fase: "introducao",
            reqId: 0,
            sessaoId: null,
            questao: null,
            selecionadas: new Set(), // índices das alternativas marcadas
            enviando: false,
            resultado: null, // resposta do servidor à correção
            erroEnvio: "", // erro ao enviar a resposta (rede, 409, ...)
            podeAvancar: false, // envio impossível (ex.: já respondida)
            erro: "",
        };
    }

    function chaveDoTopico(ctx) {
        return JSON.stringify([ctx.materia.nome, ctx.topico.nome]);
    }

    function conteudoDoTopico(materia, topico) {
        const conteudo = topico.conteudo || {};
        if (
            materia.nome === "Matemática" &&
            topico.nome === "Frações" &&
            !(typeof conteudo.resumo === "string" && conteudo.resumo.trim())
        ) {
            return CONTEUDO_FRACOES;
        }
        return conteudo;
    }

    function estadoDe(ctx) {
        const chave = chaveDoTopico(ctx);
        if (!estados[chave]) {
            estados[chave] = novoEstado();
        }
        return estados[chave];
    }

    function estaAtivo(ctx, estado) {
        return (
            topicoAtivo !== null &&
            chaveDoTopico(topicoAtivo) === chaveDoTopico(ctx) &&
            estados[chaveDoTopico(ctx)] === estado
        );
    }

    /* ---------- Utilitário DOM ---------- */

    function el(tag, props, children) {
        const node = document.createElement(tag);
        Object.entries(props || {}).forEach(([chave, valor]) => {
            if (valor === null || valor === undefined || valor === false) return;
            if (chave === "class") node.className = valor;
            else if (chave === "text") node.textContent = valor;
            else if (chave.startsWith("on")) node.addEventListener(chave.slice(2), valor);
            else node.setAttribute(chave, valor === true ? "" : valor);
        });
        []
            .concat(children || [])
            .forEach((filho) => {
                if (filho !== null && filho !== undefined) node.append(filho);
            });
        return node;
    }

    /* ---------- Abrir um tópico ---------- */

    function abrirTopico(materia, topico) {
        topicoAtivo = { materia, topico };

        elements.subject.textContent = materia.nome.toLocaleUpperCase("pt-BR");
        elements.title.textContent = topico.nome;
        elements.description.textContent = "";
        elements.description.hidden = true;

        if (window.StudyMaisNav) window.StudyMaisNav.goToPage("exercises");

        const estado = estadoDe(topicoAtivo);
        if (estado.fase === "introducao") estado.conteudo = conteudoDoTopico(materia, topico);
        render(topicoAtivo, estado, { foco: estado.fase === "introducao" ? "introducao" : null });
    }

    async function carregarCatalogo() {
        if (catalogoCarregando) return;
        catalogoCarregando = true;
        erroCatalogo = "";
        if (!topicoAtivo && elements.page.classList.contains("active")) {
            renderListaTopicos();
        }

        try {
            const resposta = await api.exercicioService.listarTopicos();
            catalogo = Array.isArray(resposta)
                ? resposta
                    .filter((materia) => materia && typeof materia.materia === "string")
                    .map((materia) => ({
                        nome: materia.materia,
                        topicos: Array.isArray(materia.topicos)
                            ? materia.topicos.filter((topico) => topico && typeof topico.nome === "string")
                            : [],
                    }))
                : [];
        } catch (error) {
            erroCatalogo = error.message || "Não foi possível carregar os tópicos.";
        } finally {
            catalogoCarregando = false;
            if (!topicoAtivo && elements.page.classList.contains("active")) {
                renderListaTopicos();
            }
        }
    }

    /* ---------- Chamadas ao back-end ---------- */

    async function carregarProxima(ctx, estado) {
        const meuId = ++estado.reqId;

        estado.fase = "carregando";
        estado.erro = "";
        estado.erroEnvio = "";
        estado.podeAvancar = false;
        render(ctx, estado, { foco: "estado" });

        let proxima = null;
        let falha = null;

        try {
            proxima = await api.exercicioService.proximaQuestao({
                materia: ctx.materia.nome,
                topico: ctx.topico.nome,
                sessaoId: estado.sessaoId,
            });
        } catch (error) {
            falha = error;
        }

        // Ignora respostas atrasadas (logout, outra requisição em curso...).
        if (estados[chaveDoTopico(ctx)] !== estado || meuId !== estado.reqId) return;

        if (falha) {
            if (falha.status === 404) {
                estado.fase = "vazio";
            } else {
                estado.fase = "erro";
                estado.erro = falha.message || "Não foi possível carregar a questão.";
            }
        } else if (!questaoValida(proxima)) {
            estado.fase = "erro";
            estado.erro = "A questão recebida está incompleta. Tente novamente.";
        } else if (proxima.tipoResposta !== TIPO_UNICA && proxima.tipoResposta !== TIPO_MULTIPLA) {
            estado.fase = "erro";
            estado.erro = "Este tipo de questão ainda não é suportado. Tente outra questão.";
        } else {
            estado.sessaoId = proxima.sessaoId || estado.sessaoId;
            estado.questao = proxima;
            estado.selecionadas = new Set();
            estado.resultado = null;
            estado.fase = "questao";
        }

        if (estaAtivo(ctx, estado)) {
            render(ctx, estado, { foco: estado.fase === "questao" ? "enunciado" : "estado" });
        }
    }

    function questaoValida(questao) {
        return Boolean(
            questao &&
                questao.apresentacaoId !== null &&
                questao.apresentacaoId !== undefined &&
                typeof questao.enunciado === "string" &&
                Array.isArray(questao.alternativas) &&
                questao.alternativas.length > 0
        );
    }

    /** Envia a resposta. Sem validação de acerto: quem corrige é o servidor. */
    async function enviarResposta(ctx, estado, ui) {
        if (estado.enviando || estado.resultado) return;

        const respostas = Array.from(estado.selecionadas)
            .sort((a, b) => a - b)
            .map((indice) => estado.questao.alternativas[indice]);

        if (respostas.length === 0) {
            ui.mensagem.textContent =
                estado.questao.tipoResposta === TIPO_MULTIPLA
                    ? "Marque ao menos uma alternativa antes de enviar."
                    : "Escolha uma alternativa antes de enviar.";
            const primeira = ui.opcoes[0] && ui.opcoes[0].input;
            if (primeira) primeira.focus();
            return;
        }

        const meuId = estado.reqId;
        estado.enviando = true;
        estado.erroEnvio = "";
        ui.mensagem.textContent = "";
        atualizarAcaoEnviar(estado, ui);

        let resultado = null;
        let falha = null;

        try {
            resultado = await api.exercicioService.responder(
                estado.questao.apresentacaoId,
                respostas
            );
        } catch (error) {
            falha = error;
        }

        if (estados[chaveDoTopico(ctx)] !== estado || meuId !== estado.reqId) return;

        estado.enviando = false;

        if (falha) {
            estado.erroEnvio = falha.message || "Não foi possível enviar a resposta.";
            // 404/409: esta apresentação não aceita mais envio; só resta avançar.
            if (falha.status === 404 || falha.status === 409) {
                estado.podeAvancar = true;
            }
            // Re-renderiza a partir do estado (as seleções são preservadas).
            if (estaAtivo(ctx, estado)) render(ctx, estado, { foco: "mensagem" });
            return;
        }

        estado.resultado = resultado || {};
        if (window.StudyMaisGamificacao) {
            window.StudyMaisGamificacao.registrarRespostaExercicio(
                estado.questao.tipoResposta,
                estado.resultado.correta
            );
        }
        if (estaAtivo(ctx, estado)) render(ctx, estado, { foco: "resultado" });
    }

    /* ---------- Render ---------- */

    function render(ctx, estado, opcoes) {
        const foco = (opcoes && opcoes.foco) || null;
        const corpo = elements.body;

        let conteudo;
        switch (estado.fase) {
            case "introducao":
                corpo.setAttribute("aria-busy", "false");
                conteudo = renderIntroducao(ctx, estado);
                break;
            case "carregando":
                corpo.setAttribute("aria-busy", "true");
                conteudo = renderCarregando();
                break;
            case "erro":
                corpo.setAttribute("aria-busy", "false");
                conteudo = renderErro(ctx, estado);
                break;
            case "vazio":
                corpo.setAttribute("aria-busy", "false");
                conteudo = renderVazio(ctx, estado);
                break;
            case "questao":
                corpo.setAttribute("aria-busy", "false");
                conteudo = renderQuestao(ctx, estado);
                break;
            default:
                corpo.setAttribute("aria-busy", "false");
                conteudo = null;
        }

        corpo.replaceChildren();
        if (conteudo) {
            corpo.append(
                el("button", {
                    type: "button",
                    class: "exercise-back-button",
                    text: "← Lista de tópicos",
                    onclick: voltarAListaDeTopicos,
                }),
                conteudo
            );
        }

        if (foco && elements.page.classList.contains("active")) {
            const alvo = corpo.querySelector(`[data-foco="${foco}"]`);
            if (alvo) alvo.focus();
        }
    }

    function renderIntroducao(ctx, estado) {
        const conteudo = estado.conteudo || {};
        const resumo = typeof conteudo.resumo === "string" ? conteudo.resumo.trim() : "";
        const formulas = Array.isArray(conteudo.formulas)
            ? conteudo.formulas.filter((formula) => formula && typeof formula.expressao === "string" && formula.expressao.trim())
            : [];
        const simbolos = Array.isArray(conteudo.significadosSimbolos)
            ? conteudo.significadosSimbolos.filter((item) => item && item.simbolo && item.significado)
            : [];
        const blocos = [
            el("h2", {
                class: "exercise-intro-title",
                tabindex: "-1",
                "data-foco": "introducao",
                text: `Antes de começar: ${ctx.topico.nome}`,
            }),
            el("section", { class: "exercise-intro-section" }, [
                el("h3", { text: "Resumo" }),
                el("p", {
                    class: "exercise-intro-summary",
                    text: resumo || "O resumo deste tópico ainda não foi cadastrado.",
                }),
            ]),
        ];

        if (formulas.length > 0) {
            blocos.push(
                el("section", { class: "exercise-intro-section" }, [
                    el("h3", { text: "Fórmulas" }),
                    el(
                        "ul",
                        { class: "exercise-formula-list" },
                        formulas.map((formula) =>
                            el("li", { class: "exercise-formula" }, [
                                el("code", { text: formula.expressao.trim() }),
                                formula.descricao
                                    ? el("p", { text: formula.descricao })
                                    : null,
                            ])
                        )
                    )
                ])
            );
        }

        if (simbolos.length > 0) {
            blocos.push(
                el("section", { class: "exercise-intro-section exercise-symbols" }, [
                    el("h3", { text: "Significado dos símbolos" }),
                    el(
                        "dl",
                        {},
                        simbolos.flatMap((item) => [
                            el("dt", { text: item.simbolo }),
                            el("dd", { text: item.significado }),
                        ])
                    ),
                ])
            );
        }

        if (typeof conteudo.exemploResolvido === "string" && conteudo.exemploResolvido.trim()) {
            blocos.push(
                el("section", { class: "exercise-intro-section" }, [
                    el("h3", { text: "Exemplo resolvido" }),
                    el("p", {
                        class: "exercise-intro-summary",
                        text: conteudo.exemploResolvido.trim(),
                    }),
                ])
            );
        }

        if (conteudo.revisaoNecessaria && conteudo.notaRevisao) {
            blocos.push(
                el("p", {
                    class: "exercise-review-note",
                    text: `Conteúdo em revisão: ${conteudo.notaRevisao}`,
                })
            );
        }

        blocos.push(
            el("div", { class: "exercise-actions" }, [
                el("button", {
                    type: "button",
                    class: "save-task",
                    text: "Começar exercício",
                    onclick: () => carregarProxima(ctx, estado),
                }),
            ])
        );

        return el("article", { class: "exercise-card exercise-intro" }, blocos);
    }

    function renderListaTopicos() {
        elements.subject.textContent = "EXERCÍCIOS";
        elements.title.textContent = "Escolha um tópico";
        elements.description.textContent = "";
        elements.description.hidden = true;

        if (catalogoCarregando) {
            elements.body.setAttribute("aria-busy", "true");
            elements.body.replaceChildren(renderCarregando());
            return;
        }

        if (erroCatalogo) {
            elements.body.setAttribute("aria-busy", "false");
            elements.body.replaceChildren(
                el("div", { class: "exercise-state is-error", role: "alert" }, [
                    el("p", { class: "exercise-state-title", text: "Não foi possível carregar os tópicos" }),
                    el("p", { class: "exercise-state-text", text: erroCatalogo }),
                    el("button", {
                        type: "button",
                        class: "secondary-button",
                        text: "Tentar novamente",
                        onclick: carregarCatalogo,
                    }),
                ])
            );
            return;
        }

        const grupos = catalogo.map((materia, indice) => {
            const listaId = `exercise-topic-list-${indice}`;
            const icones = {
                Matemática: "📐",
                Português: "📖",
            };
            const lista = el(
                "ul",
                { id: listaId, class: "exercise-topic-list", hidden: true },
                materia.topicos.map((topico) =>
                    el("li", {}, [
                        el("button", {
                            type: "button",
                            class: "exercise-topic-link",
                            text: topico.nome,
                            onclick: () => abrirTopico(materia, topico),
                        }),
                    ])
                )
            );
            const botaoMateria = el("button", {
                type: "button",
                class: "exercise-subject-button",
                "aria-expanded": "false",
                "aria-controls": listaId,
                onclick: (evento) => {
                    const expandido = evento.currentTarget.getAttribute("aria-expanded") === "true";
                    evento.currentTarget.setAttribute("aria-expanded", String(!expandido));
                    lista.hidden = expandido;
                },
            }, [
                el("span", { class: "exercise-subject-icon", "aria-hidden": "true", text: icones[materia.nome] || "📚" }),
                el("span", { text: materia.nome }),
            ]);

            return el("section", { class: "exercise-topic-group" }, [botaoMateria, lista]);
        });

        elements.body.setAttribute("aria-busy", "false");
        elements.body.replaceChildren(
            el("div", { class: "exercise-topic-index" },
                grupos.length > 0
                    ? grupos
                    : [el("p", { class: "exercise-state-text", text: "Nenhum tópico disponível." })]
            )
        );
    }

    function voltarAListaDeTopicos() {
        topicoAtivo = null;
        renderListaTopicos();
    }

    function renderCarregando() {
        return el(
            "div",
            { class: "exercise-state", role: "status", tabindex: "-1", "data-foco": "estado" },
            [
                el("div", { class: "exercise-spinner", "aria-hidden": "true" }),
                el("p", { class: "exercise-state-title", text: "Buscando uma questão…" }),
            ]
        );
    }

    function renderErro(ctx, estado) {
        return el(
            "div",
            { class: "exercise-state is-error", role: "alert", tabindex: "-1", "data-foco": "estado" },
            [
                el("div", { class: "exercise-state-icon", "aria-hidden": "true", text: "⚠️" }),
                el("p", { class: "exercise-state-title", text: "Não foi possível carregar a questão" }),
                el("p", { class: "exercise-state-text", text: estado.erro }),
                el("button", {
                    type: "button",
                    class: "secondary-button",
                    text: "Tentar novamente",
                    onclick: () => carregarProxima(ctx, estado),
                }),
            ]
        );
    }

    function renderVazio(ctx, estado) {
        return el(
            "div",
            { class: "exercise-state", role: "status", tabindex: "-1", "data-foco": "estado" },
            [
                el("div", { class: "exercise-state-icon", "aria-hidden": "true", text: "📭" }),
                el("p", { class: "exercise-state-title", text: "Nenhuma questão disponível" }),
                el("p", {
                    class: "exercise-state-text",
                    text: `Não há questões de ${ctx.topico.nome} disponíveis no momento.`,
                }),
                el("button", {
                    type: "button",
                    class: "secondary-button",
                    text: "Verificar novamente",
                    onclick: () => carregarProxima(ctx, estado),
                }),
            ]
        );
    }

    function renderQuestao(ctx, estado) {
        const questao = estado.questao;
        const multipla = questao.tipoResposta === TIPO_MULTIPLA;
        const respondida = Boolean(estado.resultado);
        const travado = respondida || estado.enviando;

        const certas =
            respondida &&
            Array.isArray(estado.resultado.respostasCorretas) &&
            estado.resultado.respostasCorretas.length > 0
                ? new Set(estado.resultado.respostasCorretas)
                : null;

        const ui = { opcoes: [], mensagem: null, botaoEnviar: null };

        /* Alternativas */
        const fieldset = el("fieldset", {
            class: "exercise-options",
            "aria-labelledby": "exerciseStatement",
            "aria-describedby": "exerciseHint",
            disabled: estado.enviando || null,
        });

        questao.alternativas.forEach((texto, indice) => {
            const input = el("input", {
                type: multipla ? "checkbox" : "radio",
                id: `exerciseOption${indice}`,
                name: "exerciseAnswer",
                value: String(indice),
                disabled: respondida || null,
            });
            input.checked = estado.selecionadas.has(indice);

            const corpoOpcao = el("span", { class: "exercise-option-body" }, [
                el("span", { class: "exercise-option-text", text: texto }),
            ]);

            const label = el("label", { class: "exercise-option", for: input.id }, [input, corpoOpcao]);

            if (respondida) {
                label.classList.add("is-locked");
                const marcada = estado.selecionadas.has(indice);
                const tag = rotuloDaOpcao(marcada, certas ? certas.has(texto) : null);
                if (tag) {
                    corpoOpcao.append(el("span", { class: "exercise-option-tag", text: tag.texto }));
                    if (tag.classe) label.classList.add(tag.classe);
                }
            }

            input.addEventListener("change", () => {
                if (multipla) {
                    if (input.checked) estado.selecionadas.add(indice);
                    else estado.selecionadas.delete(indice);
                } else {
                    estado.selecionadas = input.checked ? new Set([indice]) : new Set();
                }
                ui.opcoes.forEach((item, i) => {
                    item.label.classList.toggle("is-selected", estado.selecionadas.has(i));
                });
                estado.erroEnvio = "";
                ui.mensagem.textContent = "";
                atualizarAcaoEnviar(estado, ui);
            });

            label.classList.toggle("is-selected", input.checked && !respondida);
            ui.opcoes.push({ input, label });
            fieldset.append(label);
        });

        /* Mensagem de validação/erro (região de alerta persistente) */
        ui.mensagem = el("p", {
            class: "exercise-message",
            id: "exerciseMessage",
            role: "alert",
            tabindex: "-1",
            "data-foco": "mensagem",
            text: estado.erroEnvio,
        });

        /* Resultado devolvido pelo servidor */
        const resultado = respondida ? renderResultado(estado.resultado) : null;

        /* Ações: enviar OU avançar */
        let acao;
        if (respondida || estado.podeAvancar) {
            acao = el("button", {
                type: "button",
                class: "save-task",
                text: "Próxima questão →",
                onclick: () => carregarProxima(ctx, estado),
            });
        } else {
            ui.botaoEnviar = el("button", {
                type: "submit",
                class: "save-task",
                "aria-describedby": "exerciseHint",
            });
            acao = ui.botaoEnviar;
        }

        const form = el(
            "form",
            {
                class: "exercise-form",
                novalidate: true,
                onsubmit: (evento) => {
                    evento.preventDefault();
                    if (ui.botaoEnviar) enviarResposta(ctx, estado, ui);
                },
            },
            [
                questao.textoBase
                    ? el("section", { class: "exercise-source-text", "aria-label": "Texto-base" }, [
                        el("h3", { text: "Texto-base" }),
                        el("p", { text: questao.textoBase }),
                    ])
                    : null,
                el("p", {
                    class: "exercise-statement",
                    id: "exerciseStatement",
                    tabindex: "-1",
                    "data-foco": "enunciado",
                    text: questao.enunciado,
                }),
                el("p", {
                    class: "exercise-hint",
                    id: "exerciseHint",
                    text: multipla
                        ? "Selecione todas as alternativas corretas. Mais de uma pode estar certa."
                        : "Escolha uma alternativa.",
                }),
                fieldset,
                ui.mensagem,
                resultado,
                el("div", { class: "exercise-actions" }, [acao]),
            ]
        );

        if (ui.botaoEnviar) atualizarAcaoEnviar(estado, ui);

        return el(
            "article",
            {
                class: "exercise-card",
                "aria-label": `Questão de ${ctx.topico.nome}`,
            },
            [
                el("span", {
                    class: "small-title",
                    text: (questao.topico || ctx.topico.nome).toLocaleUpperCase("pt-BR"),
                }),
                form,
            ]
        );
    }

    /** Texto/estilo do marcador de cada alternativa após a correção.
     *  `ehCorreta` é null quando o servidor não revelou as respostas. */
    function rotuloDaOpcao(marcada, ehCorreta) {
        if (ehCorreta === null) {
            return marcada ? { texto: "Sua resposta", classe: "is-chosen" } : null;
        }
        if (marcada && ehCorreta) return { texto: "Sua resposta · correta", classe: "is-correct" };
        if (marcada && !ehCorreta) return { texto: "Sua resposta · incorreta", classe: "is-wrong" };
        if (!marcada && ehCorreta) return { texto: "Resposta correta", classe: "is-correct" };
        return null;
    }

    function renderResultado(resultado) {
        const acertou = resultado.correta === true;
        const certas = Array.isArray(resultado.respostasCorretas)
            ? resultado.respostasCorretas.filter((texto) => typeof texto === "string")
            : [];

        const blocos = [
            el("h3", {
                class: "exercise-result-title",
                id: "exerciseResultTitle",
                tabindex: "-1",
                "data-foco": "resultado",
            }, [
                el("span", { "aria-hidden": "true", text: acertou ? "✓ " : "✕ " }),
                acertou ? "Resposta correta!" : "Resposta incorreta",
            ]),
        ];

        if (certas.length > 0) {
            blocos.push(
                el("p", { class: "exercise-result-label", text: certas.length > 1 ? "Respostas corretas:" : "Resposta correta:" })
            );
            blocos.push(
                el(
                    "ul",
                    { class: "exercise-result-answers" },
                    certas.map((texto) => el("li", { text: texto }))
                )
            );
        }

        if (resultado.explicacao) {
            blocos.push(el("p", { class: "exercise-result-label", text: "Explicação:" }));
            blocos.push(el("p", { class: "exercise-result-explanation", text: resultado.explicacao }));
        }

        return el(
            "section",
            {
                class: `exercise-result ${acertou ? "is-correct" : "is-wrong"}`,
                "aria-labelledby": "exerciseResultTitle",
            },
            blocos
        );
    }

    /** Botão "Enviar": sem resposta marcada fica inativo (aria-disabled,
     *  para continuar focável e explicar o motivo via #exerciseHint). */
    function atualizarAcaoEnviar(estado, ui) {
        const botao = ui.botaoEnviar;
        if (!botao) return;

        const semResposta = estado.selecionadas.size === 0;
        botao.textContent = estado.enviando ? "Enviando…" : "Enviar resposta";
        botao.setAttribute("aria-disabled", String(semResposta || estado.enviando));
        botao.setAttribute("aria-busy", String(estado.enviando));

        const fieldset = ui.opcoes[0] && ui.opcoes[0].input.closest("fieldset");
        if (fieldset) fieldset.disabled = estado.enviando;
    }

    /* ---------- Navegação / sessão ---------- */

    function onPageChange(evento) {
        if (!evento.detail) return;

        if (evento.detail.page === "exercises") {
            if (!topicoAtivo) renderListaTopicos();
        } else {
            topicoAtivo = null;
        }
    }

    function reiniciar() {
        estados = {};
        topicoAtivo = null;
        catalogo = [];
        erroCatalogo = "";
        if (elements.body) renderListaTopicos();
    }

    function init() {
        elements.page = document.getElementById("exercisesPage");
        elements.subject = document.getElementById("exercisesSubject");
        elements.title = document.getElementById("exercisesTitle");
        elements.description = document.getElementById("exercisesDescription");
        elements.body = document.getElementById("exercisesBody");

        if (!elements.page || !elements.body) return;

        document.addEventListener("studymais:page-change", onPageChange);
        document.addEventListener("studymais:ready", () => {
            reiniciar();
            carregarCatalogo();
        });
        document.addEventListener("studymais:logout", reiniciar);
    }

    document.addEventListener("DOMContentLoaded", init);
})();

/* ==========================================
   STUDYMAIS
   services/api.js

   Camada de acesso à API REST do StudyMais.
   Não possui interface própria: apenas monta as
   requisições, trata erros e expõe funções prontas
   para os módulos de tela (auth.js, calendario.js...).
========================================== */

(function () {
    "use strict";

    const API_BASE_URL = "https://studymais.onrender.com/api";

    const TOKEN_STORAGE_KEY = "studymais_token";

    /* ---------- Token ---------- */

    function getToken() {
        return localStorage.getItem(TOKEN_STORAGE_KEY);
    }

    function setToken(token) {
        localStorage.setItem(TOKEN_STORAGE_KEY, token);
    }

    function clearToken() {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
    }

    /* ---------- Erro padronizado ---------- */

    class ApiError extends Error {
        constructor(message, status, details) {
            super(message);
            this.name = "ApiError";
            this.status = status;
            this.details = details || null;
        }
    }

    /* ---------- Requisição central ---------- */

    /**
     * Executa uma requisição para a API.
     * @param {string} path - caminho a partir de /api, ex: "/materias"
     * @param {object} options
     * @param {"GET"|"POST"|"PUT"|"DELETE"} [options.method="GET"]
     * @param {object} [options.body] - corpo da requisição (será serializado em JSON)
     * @param {boolean} [options.auth=true] - se deve enviar o token JWT
     */
    async function request(path, options = {}) {
        const { method = "GET", body, auth = true } = options;

        const headers = {
            "Content-Type": "application/json",
        };

        if (auth) {
            const token = getToken();
            if (token) {
                headers.Authorization = `Bearer ${token}`;
            }
        }

        let response;

        try {
            response = await fetch(`${API_BASE_URL}${path}`, {
                method,
                headers,
                body: body !== undefined ? JSON.stringify(body) : undefined,
            });
        } catch (networkError) {
            throw new ApiError(
                "Não foi possível conectar ao StudyMais. Verifique sua internet e tente novamente.",
                0,
                networkError
            );
        }

        // 204 No Content (ex: DELETE) não tem corpo para ler.
        if (response.status === 204) {
            return null;
        }

        let payload = null;
        const rawText = await response.text();

        if (rawText) {
            try {
                payload = JSON.parse(rawText);
            } catch (parseError) {
                payload = null;
            }
        }

        if (!response.ok) {
            const message =
                (payload && payload.message) ||
                "Ocorreu um erro ao falar com o servidor.";

            const error = new ApiError(message, response.status, payload);

            // Sessão expirada/token inválido: avisa quem estiver escutando
            // (auth.js registra esse hook) para forçar o logout.
            if (
                (response.status === 401 || response.status === 403) &&
                auth &&
                typeof window.StudyMaisAPI.onUnauthorized === "function"
            ) {
                window.StudyMaisAPI.onUnauthorized(error);
            }

            throw error;
        }

        return payload;
    }

    /* ---------- Serviço: Autenticação ---------- */

    const authService = {
        /**
         * Efetua login. Retorna { token }.
         */
        login(email, senha) {
            return request("/auth/login", {
                method: "POST",
                body: { email, senha },
                auth: false,
            });
        },
    };

    /* ---------- Serviço: Usuários ---------- */

    const usuarioService = {
        /**
         * Cria uma nova conta (endpoint público).
         * Retorna { id, nome, email }.
         */
        registrar(nome, email, senha) {
            return request("/usuarios", {
                method: "POST",
                body: { nome, email, senha },
                auth: false,
            });
        },

        /**
         * A API sempre retorna, autenticada, uma lista com um único
         * item: o próprio usuário do token (não existe filtro por id
         * na prática). Usamos isso como um "/me".
         */
        async obterAtual() {
            const usuarios = await request("/usuarios", { method: "GET" });
            return Array.isArray(usuarios) ? usuarios[0] || null : null;
        },

        /**
         * Atualiza nome/email/senha. A API exige os três campos
         * mesmo que apenas um esteja mudando.
         */
        atualizar(id, dadosCompletos) {
            return request(`/usuarios/${id}`, {
                method: "PUT",
                body: dadosCompletos,
            });
        },

        deletar(id) {
            return request(`/usuarios/${id}`, { method: "DELETE" });
        },
    };

    /* ---------- Serviço: Matérias ---------- */

    const materiaService = {
        listar() {
            return request("/materias", { method: "GET" });
        },

        criar(materia) {
            return request("/materias", { method: "POST", body: materia });
        },

        atualizar(id, materia) {
            return request(`/materias/${id}`, { method: "PUT", body: materia });
        },

        deletar(id) {
            return request(`/materias/${id}`, { method: "DELETE" });
        },
    };

    /* ---------- Serviço: Tarefas ---------- */

    const tarefaService = {
        listar() {
            return request("/tarefas", { method: "GET" });
        },

        criar(tarefa) {
            return request("/tarefas", { method: "POST", body: tarefa });
        },

        atualizar(id, tarefa) {
            return request(`/tarefas/${id}`, { method: "PUT", body: tarefa });
        },

        deletar(id) {
            return request(`/tarefas/${id}`, { method: "DELETE" });
        },
    };

    /* ---------- Serviço: Plataformas ---------- */

    const plataformaService = {
        listar() {
            return request("/plataformas", { method: "GET" });
        },

        criar(plataforma) {
            return request("/plataformas", { method: "POST", body: plataforma });
        },

        atualizar(id, plataforma) {
            return request(`/plataformas/${id}`, { method: "PUT", body: plataforma });
        },

        deletar(id) {
            return request(`/plataformas/${id}`, { method: "DELETE" });
        },
    };

    /* ---------- Exposição global ---------- */

    window.StudyMaisAPI = {
        ApiError,
        getToken,
        setToken,
        clearToken,
        // preenchido por auth.js: function(error) => void
        onUnauthorized: null,
        authService,
        usuarioService,
        materiaService,
        tarefaService,
        plataformaService,
    };
})();

/* ==========================================
   STUDYMAIS
   calendario.js

   ATENCAO: por enquanto este arquivo so resolve a
   NAVEGACAO entre as paginas (menu lateral e os
   atalhos "data-go-to"). A renderizacao de dados reais
   (calendario, tarefas, materias, progresso, cronograma
   premium) ainda sera implementada em uma etapa futura.
========================================== */

(function () {
    "use strict";

    const DEFAULT_PAGE = "home";

    let menuItems = [];
    let pages = [];

    function cacheElements() {
        menuItems = Array.from(document.querySelectorAll(".menu-item[data-page]"));
        pages = Array.from(document.querySelectorAll(".app-page[data-page]"));
    }

    function goToPage(pageName) {
        // O item "Premium" do menu nao tem uma pagina propria:
        // ele abre o modal de criacao de cronograma.
        if (pageName === "premium") {
            openPremiumModal();
            return;
        }

        const pageExists = pages.some((page) => page.dataset.page === pageName);
        if (!pageExists) return;

        pages.forEach((page) => {
            page.classList.toggle("active", page.dataset.page === pageName);
        });

        menuItems.forEach((item) => {
            item.classList.toggle("active", item.dataset.page === pageName);
        });
    }

    function openPremiumModal() {
        const modal = document.getElementById("premiumModal");
        if (modal) modal.classList.remove("hidden");
    }

    function closePremiumModal() {
        const modal = document.getElementById("premiumModal");
        if (modal) modal.classList.add("hidden");
    }

    function bindNavigation() {
        menuItems.forEach((item) => {
            item.addEventListener("click", () => goToPage(item.dataset.page));
        });

        document.querySelectorAll("[data-go-to]").forEach((element) => {
            element.addEventListener("click", () => goToPage(element.dataset.goTo));
        });

        const openPremiumButton = document.getElementById("openPremium");
        if (openPremiumButton) {
            openPremiumButton.addEventListener("click", openPremiumModal);
        }

        const closePremiumButton = document.getElementById("closePremiumModal");
        if (closePremiumButton) {
            closePremiumButton.addEventListener("click", closePremiumModal);
        }
    }

    function init() {
        cacheElements();
        bindNavigation();
        goToPage(DEFAULT_PAGE);
    }

    document.addEventListener("DOMContentLoaded", init);
})();

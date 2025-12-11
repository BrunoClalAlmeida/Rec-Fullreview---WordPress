// wp-sites-presets.js
// Lista de sites pré-configurados para publicação no WordPress

const WP_SITES_PRESETS = [
    {
        id: "ouniversodoscartoes",
        label: "O Universo dos Cartões",
        baseUrl: "https://ouniversodoscartoes.com",
        user: "",
        appPassword: "",
        defaultCategoryId: 0,
        defaultStatus: "draft"
    },
    {
        id: "investedigital",
        label: "Investe Digital",
        baseUrl: "https://investedigital.com.br",
        user: "",
        appPassword: "",
        defaultCategoryId: 0,
        defaultStatus: "draft"
    },
    {
        id: "aprovapp",
        label: "Aprov",
        baseUrl: "https://aprov.app",
        user: "",
        appPassword: "",
        defaultCategoryId: 0,
        defaultStatus: "draft"
    },
    {
        id: "xtudoreceitas",
        label: "X Tudo Receitas",
        baseUrl: "https://xtudoreceitas.com",
        user: "",
        appPassword: "",
        defaultCategoryId: 0,
        defaultStatus: "draft"
    },
    {
        id: "cartaocerto",
        label: "Cartão Certo",
        baseUrl: "https://cartaocerto.com.br",
        user: "",
        appPassword: "",
        defaultCategoryId: 0,
        defaultStatus: "draft"
    },
    {
        id: "curiosidadefinancas",
        label: "Curiosidade Finanças",
        baseUrl: "https://curiosidadefinancas.com",
        user: "",
        appPassword: "",
        defaultCategoryId: 0,
        defaultStatus: "draft"
    },
    {
        id: "meusbeneficios",
        label: "Meus Benefícios",
        baseUrl: "https://meusbeneficios.net",
        user: "",
        appPassword: "",
        defaultCategoryId: 0,
        defaultStatus: "draft"
    },
    {
        id: "maquininha",
        label: "Maquininha",
        baseUrl: "https://www.maquininha.com.br",
        user: "",
        appPassword: "",
        defaultCategoryId: 0,
        defaultStatus: "draft"
    },
    {
        id: "creditfinder",
        label: "CreditFinder",
        baseUrl: "https://creditfinder.app",
        user: "",
        appPassword: "",
        defaultCategoryId: 0,
        defaultStatus: "draft"
    },
    {
        id: "blogrs",
        label: "BlogRS",
        baseUrl: "https://blogrs.com.br",
        user: "",
        appPassword: "",
        defaultCategoryId: 0,
        defaultStatus: "draft"
    },
    {
        id: "thecredittips",
        label: "The Credit Tips",
        baseUrl: "https://thecredittips.com",
        user: "",
        appPassword: "",
        defaultCategoryId: 0,
        defaultStatus: "draft"
    }
];

(function () {
    document.addEventListener("DOMContentLoaded", () => {
        const select = document.getElementById("wpSitePreset");
        if (!select) return;

        const baseUrlInput = document.getElementById("wpBaseUrl");
        const userInput = document.getElementById("wpUser");
        const passInput = document.getElementById("wpAppPassword");
        const categoryInput = document.getElementById("wpCategoryId");
        const statusSelect = document.getElementById("wpStatus");

        if (!baseUrlInput || !userInput || !passInput) return;

        // por padrão: travado e sem interação
        baseUrlInput.readOnly = true;
        baseUrlInput.style.pointerEvents = "none";

        // Limpa opções atuais e adiciona padrão
        select.innerHTML = "";
        const optDefault = document.createElement("option");
        optDefault.value = "";
        optDefault.textContent = "Selecione um Site Pré-Configurado";
        select.appendChild(optDefault);


        // Adiciona opções da lista
        if (Array.isArray(WP_SITES_PRESETS)) {
            WP_SITES_PRESETS.forEach((site) => {
                if (!site || !site.id || !site.label) return;
                const opt = document.createElement("option");
                opt.value = site.id;
                opt.textContent = site.label;
                select.appendChild(opt);
            });
        }

        // Ao selecionar um site, preenche os campos
        select.addEventListener("change", () => {
            const value = select.value;

            // Modo manual: destrava o campo para digitação
            if (value === "__manual") {
                baseUrlInput.readOnly = false;
                baseUrlInput.style.pointerEvents = "auto";
                baseUrlInput.focus();
                return;
            }

            // Nenhum site selecionado: trava e limpa
            if (!value) {
                baseUrlInput.readOnly = true;
                baseUrlInput.style.pointerEvents = "none";
                baseUrlInput.value = "";
                return;
            }

            // Site pré-configurado: preenche e trava
            const site = (WP_SITES_PRESETS || []).find((s) => s.id === value);
            if (!site) return;

            baseUrlInput.value = site.baseUrl || "";
            baseUrlInput.readOnly = true;
            baseUrlInput.style.pointerEvents = "none";

            if (site.user) userInput.value = site.user;
            if (site.appPassword) passInput.value = site.appPassword;

            if (categoryInput && typeof site.defaultCategoryId === "number") {
                categoryInput.value = String(site.defaultCategoryId);
            }

            if (statusSelect && site.defaultStatus) {
                const allowed = ["draft", "publish"];
                if (allowed.includes(site.defaultStatus)) {
                    statusSelect.value = site.defaultStatus;
                }
            }
        });
    });
})();

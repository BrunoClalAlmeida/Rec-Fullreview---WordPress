// wp-sites-presets.js esse codigo pertence
// Lista de sites pré-configurados para publicação no WordPress

// wp-sites-presets.js
// Lista de sites para o sistema Multi-Poster

// Definimos na janela global para o main.js conseguir ler
window.WP_SITES = [
    {
        id: "ouniversodoscartoes",
        name: "O Universo dos Cartões",
        url: "https://ouniversodoscartoes.com",
        user: "admin",
        appPassword: "MsBl 9FTg 1yqA sbzF 72c6 BV1K"
    },
    {
        id: "investedigital",
        name: "Investe Digital",
        url: "https://investedigital.com.br",
        user: "admininvestedigital",
        appPassword: "Bufa eADD g5Yz BUtv 6er6 Q3EG"
    },
    {
        id: "aprovapp",
        name: "Aprov",
        url: "https://aprov.app",
        user: "admin2",
        appPassword: "uekb KlWF s2Ij DnjC HDDH U1KA"
    },
    {
        id: "xtudoreceitas",
        name: "X Tudo Receitas",
        url: "https://xtudoreceitas.com",
        user: "xtudoreceitas.com",
        appPassword: "fZCO MxIk qBUA 1eWO JCyj kOuF"
    },
    {
        id: "cartaocerto",
        name: "Cartão Certo",
        url: "https://cartaocerto.com.br",
        user: "adminwp2",
        appPassword: "WQM4 bXk9 WcHL f8hQ s0uL CaxD"
    },
    {
        id: "curiosidadefinancas",
        name: "Curiosidade Finanças",
        url: "https://curiosidadefinancas.com",
        user: "admin",
        appPassword: "Qxpw 9f5y V41Q UicY NRLa T11r"
    },
    {
        id: "meusbeneficios",
        name: "Meus Benefícios",
        url: "https://meusbeneficios.net",
        user: "adminwp2",
        appPassword: "sixE YFRy ZcWj 6qii pRej W3Qz"
    },
    {
        id: "maquininha",
        name: "Maquininha",
        url: "https://www.maquininha.com.br",
        user: "adminwp2",
        appPassword: "btSm tMq4 pHvP pzcx RxjB 4mkT"
    },
    {
        id: "thecredittips",
        name: "The Credit Tips",
        url: "https://thecredittips.com",
        user: "adminwp2",
        appPassword: "5hQ9 QyDd RNok CRGt 5p7a kxrX"
    },
    {
        id: "emmeusbeneficios",
        name: "Em Meus Benefícios",
        url: "https://em.meusbeneficios.net",
        user: "adminwp2",
        appPassword: "Lw8A Ei0z ldxi casV Tp8F pnPx"
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

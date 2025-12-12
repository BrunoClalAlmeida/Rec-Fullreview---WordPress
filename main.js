// main.js

// ===== Estado em memória =====
let lastArticleJson = null;
let lastArticleHtml = "";

// ===== 1. Gerar artigo =====
async function generateArticle() {
    const model = "gpt-5.1"; // Fixo

    const topic = document.getElementById("topic").value.trim();
    const language = document.getElementById("language").value;
    const articleType = document.getElementById("articleType").value;

    const wordCountRaw = document.getElementById("wordCount")?.value || "";
    let approxWordCount = parseInt(wordCountRaw, 10);
    if (isNaN(approxWordCount) || approxWordCount <= 0) approxWordCount = 0;

    const hasLimit = approxWordCount > 0;
    const maxTokens = hasLimit ? Math.round(approxWordCount * 1.8) : 2048;

    const statusEl = document.getElementById("statusGenerate");
    const btn = document.getElementById("btnGenerate");
    const previewREC = document.getElementById("previewREC");
    const previewFULL = document.getElementById("previewFULL");

    if (!topic) {
        statusEl.classList.add("error");
        statusEl.innerHTML = "<strong>Erro:</strong> informe um tema.";
        return;
    }

    statusEl.classList.remove("error");
    statusEl.innerHTML = "Gerando texto com a IA...";
    btn.disabled = true;

    try {
        const systemPrompt = buildSystemPrompt(articleType, language, approxWordCount);
        let userPrompt;

        if (hasLimit) {
            userPrompt = `Crie um texto do tipo "${articleType}" usando o schema dado, no idioma "${language}", sobre o seguinte tópico EXATO: "${topic}". Regras: Não mude o assunto. Texto com NO MÁXIMO ${approxWordCount} palavras.`.trim();
        } else {
            userPrompt = `Crie um texto do tipo "${articleType}" usando o schema dado, no idioma "${language}", sobre o seguinte tópico EXATO: "${topic}". Regras: Não mude o assunto. Tamanho natural.`.trim();
        }

        const response = await fetch("/api/generate-article", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model, systemPrompt, userPrompt, maxTokens }),
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error("Erro da API interna: " + errText);
        }

        const data = await response.json();
        let content = data.choices?.[0]?.message?.content || "";

        content = content.trim();
        if (content.startsWith("```")) {
            const firstNewline = content.indexOf("\n");
            const lastTicks = content.lastIndexOf("```");
            if (firstNewline !== -1 && lastTicks !== -1) {
                content = content.substring(firstNewline + 1, lastTicks).trim();
            }
        }

        let articleJson;
        try {
            articleJson = JSON.parse(content);
        } catch (err) {
            console.error(content);
            throw new Error("Falha ao interpretar JSON da IA.");
        }

        articleJson.type = articleType;
        articleJson.language = language;
        articleJson.topic = topic;
        if (!articleJson.h1) articleJson.h1 = topic;

        lastArticleJson = articleJson;
        lastArticleHtml = buildHtmlFromArticle(articleJson);

        const previewHtml = buildPreviewHtmlFromArticle(articleJson) || "<em>Nenhum HTML gerado.</em>";

        // Lógica de Janelas: Preenche a certa, limpa a errada
        if (articleType === "REC") {
            if (previewREC) previewREC.innerHTML = previewHtml;
            if (previewFULL) previewFULL.innerHTML = '<div style="display:flex; height:100%; align-items:center; justify-content:center; color:#94a3b8; font-style:italic;">(Vazio - Último gerado foi REC)</div>';
        } else {
            if (previewFULL) previewFULL.innerHTML = previewHtml;
            if (previewREC) previewREC.innerHTML = '<div style="display:flex; height:100%; align-items:center; justify-content:center; color:#94a3b8; font-style:italic;">(Vazio - Último gerado foi FULL)</div>';
        }

        const btnPub = document.getElementById("btnPublish");
        if (btnPub) btnPub.disabled = false;

        let totalWords = articleJson.word_count_estimate || 0;
        statusEl.classList.remove("error");
        statusEl.innerHTML = `<strong>Sucesso:</strong> texto gerado (${articleType}). Estimativa: ${totalWords} palavras.`;

    } catch (err) {
        console.error(err);
        statusEl.classList.add("error");
        statusEl.innerHTML = "<strong>Erro:</strong> " + err.message;
    } finally {
        btn.disabled = false;
    }
}

// ===== 2. Carregar Checkboxes dos Sites =====
function renderSiteCheckboxes() {
    const container = document.getElementById("wpSitesCheckboxes");
    if (!container) return;

    const sites = (typeof WP_SITES !== "undefined" && Array.isArray(WP_SITES)) ? WP_SITES : [];

    if (sites.length === 0) {
        container.innerHTML = "<em>Nenhum site configurado em wp-sites-presets.js</em>";
        return;
    }

    container.innerHTML = "";

    sites.forEach((site, index) => {
        const label = document.createElement("label");
        label.className = "site-checkbox-label";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.name = "selected_wp_sites";
        checkbox.value = JSON.stringify(site);

        const span = document.createElement("span");
        span.textContent = site.name || site.label || `Site ${index + 1}`;

        label.appendChild(checkbox);
        label.appendChild(span);
        container.appendChild(label);
    });
}

// ===== 3. Carregar Categorias do Primeiro Site Marcado =====
async function loadCategoriesFromFirstChecked() {
    const select = document.getElementById("wpCategorySelectMulti");
    const btn = document.getElementById("btnLoadCats");

    // Pega o primeiro checkbox marcado
    const checkboxes = document.querySelectorAll('input[name="selected_wp_sites"]:checked');
    if (checkboxes.length === 0) {
        alert("Selecione pelo menos um site na lista antes de carregar as categorias.");
        return;
    }

    // Pega os dados do primeiro site
    let siteData = {};
    try {
        siteData = JSON.parse(checkboxes[0].value);
    } catch (e) {
        alert("Erro ao ler dados do site.");
        return;
    }

    btn.disabled = true;
    btn.textContent = "⏳...";
    select.innerHTML = '<option>Carregando...</option>';

    try {
        const urlRaw = siteData.url || siteData.baseUrl || "";
        const endpoint = urlRaw.replace(/\/$/, "") + "/wp-json/wp/v2/categories?per_page=100";

        // Tenta sem auth primeiro, se der 401 tenta com auth
        let response = await fetch(endpoint);
        if (!response.ok && response.status === 401) {
            const authHeader = "Basic " + btoa(siteData.user + ":" + siteData.appPassword);
            response = await fetch(endpoint, { headers: { "Authorization": authHeader } });
        }

        if (!response.ok) throw new Error("Erro " + response.status);

        const cats = await response.json();

        select.innerHTML = '<option value="">Sem Categoria (Padrão)</option>';
        cats.forEach(cat => {
            const opt = document.createElement("option");
            opt.value = cat.name; // Usamos o NOME para buscar dinamicamente depois
            opt.textContent = cat.name;
            select.appendChild(opt);
        });

        btn.textContent = "✅ OK";
        setTimeout(() => btn.textContent = "🔄 Carregar", 2000);

    } catch (err) {
        console.error(err);
        select.innerHTML = '<option value="">Erro ao carregar</option>';
        alert("Não foi possível ler as categorias de " + (siteData.name) + ". Verifique se o site está online.");
        btn.textContent = "🔄 Carregar";
    } finally {
        btn.disabled = false;
    }
}

// ===== 4. Função Auxiliar: Descobrir ID pelo Nome no Site Destino =====
async function getCategoryIdByName(siteData, categoryName) {
    if (!categoryName) return 1; // Padrão

    try {
        const urlRaw = siteData.url || siteData.baseUrl || "";
        const searchSlug = slugify(categoryName);
        const endpoint = urlRaw.replace(/\/$/, "") + `/wp-json/wp/v2/categories?slug=${searchSlug}`;

        const response = await fetch(endpoint);
        if (!response.ok) return 1;

        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
            return data[0].id; // Achou!
        }
        return 1; // Não achou
    } catch (e) {
        return 1;
    }
}

// ===== 5. Publicar em Múltiplos Sites (LOOP INTELIGENTE) =====
async function publishToSelectedSites() {
    const logEl = document.getElementById("wpResultLog");
    const btn = document.getElementById("btnPublish");
    const catSelect = document.getElementById("wpCategorySelectMulti");

    if (!lastArticleJson || !lastArticleHtml) {
        alert("Gere um artigo primeiro!");
        return;
    }

    const checkboxes = document.querySelectorAll('input[name="selected_wp_sites"]:checked');
    if (checkboxes.length === 0) {
        alert("Selecione pelo menos um site para publicar.");
        return;
    }

    const wpStatus = document.getElementById("wpStatus").value;
    const targetCategoryName = catSelect.value;
    const articleConfig = readArticleSettingsFromForm();

    const title = lastArticleJson.h1 || "Texto IA";
    const baseSlug = slugify(title);
    let typePrefix = (lastArticleJson.type || "").toString().toLowerCase();
    if (typePrefix !== "rec" && typePrefix !== "fullreview") typePrefix = "";
    const slug = typePrefix ? `${typePrefix}-${baseSlug}` : baseSlug;

    const introField = lastArticleJson.intro_html || lastArticleJson.subtitle_html || "";
    const metaDescription = stripHtml(introField).slice(0, 160);
    const excerpt = stripHtml(introField).slice(0, 200);

    // Bloqueia UI
    btn.disabled = true;
    logEl.innerHTML = `> Iniciando publicação em ${checkboxes.length} site(s)...\n> Categoria alvo: ${targetCategoryName || "Padrão"}\n----------------------------------\n`;

    for (const checkbox of checkboxes) {
        let siteData = {};
        try { siteData = JSON.parse(checkbox.value); } catch (e) { continue; }

        const siteName = siteData.name || siteData.url;
        logEl.innerHTML += `> ${siteName}: Verificando categoria...\n`;

        try {
            // 1. Descobre o ID
            const realCatId = await getCategoryIdByName(siteData, targetCategoryName);

            // 2. Monta o corpo
            const postBody = {
                title,
                content: lastArticleHtml,
                status: wpStatus,
                categories: [realCatId],
                slug,
                excerpt,
                meta: {
                    cf_article_type: lastArticleJson.type || "",
                    cf_meta_description: metaDescription,
                },
                config_artigo: articleConfig,
            };

            // 3. Envia
            const urlRaw = siteData.url || siteData.baseUrl || "";
            const authHeader = "Basic " + btoa(siteData.user + ":" + siteData.appPassword);
            const endpoint = urlRaw.replace(/\/$/, "") + "/wp-json/wp/v2/posts";

            const response = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": authHeader,
                },
                body: JSON.stringify(postBody),
            });

            if (!response.ok) {
                const txt = await response.text();
                throw new Error(txt);
            }

            const jsonResp = await response.json();

            logEl.innerHTML += `> [SUCESSO] ${siteName} (ID: ${jsonResp.id})\n`;

        } catch (err) {
            console.error(err);
            logEl.innerHTML += `> [ERRO] ${siteName}: ${err.message.substring(0, 40)}...\n`;
        }
    }

    logEl.innerHTML += "----------------------------------\n> Processo finalizado.";
    logEl.scrollTop = logEl.scrollHeight; // Auto-scroll
    btn.disabled = false;
}

// ===== Funções Auxiliares =====
function readArticleSettingsFromForm() {
    const preloaderEnableEl = document.getElementById("cfgPreloaderEnable");
    const preloaderTimeEl = document.getElementById("cfgPreloaderTime");
    const enablePreloader = !!(preloaderEnableEl && preloaderEnableEl.checked);
    let preloaderTime = null;
    if (enablePreloader && preloaderTimeEl) {
        const val = parseInt(preloaderTimeEl.value || "0", 10);
        preloaderTime = isNaN(val) || val <= 0 ? 3500 : val;
    }

    return {
        habilitar_preloader: enablePreloader,
        personalizar_preloader: enablePreloader,
        tempo_preloader: enablePreloader ? preloaderTime : null,
        habilitar_imagem: !!document.getElementById("cfgEnableImage")?.checked,
        ocultar_categoria: !!document.getElementById("cfgHideCategory")?.checked,
        ocultar_autor: !!document.getElementById("cfgHideAuthor")?.checked,
        ocultar_data: !!document.getElementById("cfgHideDate")?.checked,
        ocultar_menu: !!document.getElementById("cfgHideMenu")?.checked,
        ocultar_social: !!document.getElementById("cfgHideSocial")?.checked,
        ocultar_footer: !!document.getElementById("cfgHideFooter")?.checked,
        persistir_parametro: !!document.getElementById("cfgPersistParam")?.checked,
        artquiz_associado: null,
    };
}

function syncPreloaderTimeField() {
    const checkbox = document.getElementById("cfgPreloaderEnable");
    const input = document.getElementById("cfgPreloaderTime");
    if (checkbox && input) {
        input.disabled = !checkbox.checked;
    }
}

// ===== Inicialização =====
document.addEventListener("DOMContentLoaded", () => {
    renderSiteCheckboxes();

    const btnGenerate = document.getElementById("btnGenerate");
    if (btnGenerate) btnGenerate.addEventListener("click", (e) => { e.preventDefault(); generateArticle(); });

    const btnPublish = document.getElementById("btnPublish");
    if (btnPublish) btnPublish.addEventListener("click", (e) => { e.preventDefault(); publishToSelectedSites(); });

    const btnLoadCats = document.getElementById("btnLoadCats");
    if (btnLoadCats) btnLoadCats.addEventListener("click", (e) => { e.preventDefault(); loadCategoriesFromFirstChecked(); });

    const preloaderCheckbox = document.getElementById("cfgPreloaderEnable");
    if (preloaderCheckbox) preloaderCheckbox.addEventListener("change", syncPreloaderTimeField);
    syncPreloaderTimeField();
});
// ===== Estado em memória =====
let recPack = null;      // { json, html, previewHtml, type, totalWords }
let fullPacks = [];      // array de packs FULL
let selectedFullIndex = -1;

// ===== Util: cria campos FULL conforme fullCount =====
function buildFullTopicFields() {
    const container = document.getElementById("fullTopicsContainer");
    const fullCountEl = document.getElementById("fullCount");
    if (!container || !fullCountEl) return;

    let n = parseInt(fullCountEl.value || "0", 10);
    if (isNaN(n) || n < 0) n = 0;
    if (n > 10) n = 10;

    const existing = Array.from(container.querySelectorAll("textarea")).map((t) => t.value || "");
    container.innerHTML = "";

    for (let i = 0; i < n; i++) {
        const wrap = document.createElement("div");
        wrap.className = "full-topic-item";

        const label = document.createElement("label");
        label.setAttribute("for", `topicFull_${i}`);
        label.textContent = `Tema FULLREVIEW ${i + 1}`;

        const ta = document.createElement("textarea");
        ta.id = `topicFull_${i}`;
        ta.placeholder = `Ex: Tema do FULLREVIEW ${i + 1}`;
        ta.value = existing[i] || "";

        wrap.appendChild(label);
        wrap.appendChild(ta);
        container.appendChild(wrap);
    }
}

function getFullTopicsFromFields() {
    const container = document.getElementById("fullTopicsContainer");
    if (!container) return [];
    return Array.from(container.querySelectorAll("textarea"))
        .map((t) => (t.value || "").trim())
        .filter((t) => t.length > 0);
}

// ===== Preview render =====
function renderRecPreview() {
    const previewEl = document.getElementById("htmlPreviewRec");
    const infoEl = document.getElementById("previewInfoRec");
    const btnPublish = document.getElementById("btnPublishRec");

    if (!recPack) {
        if (previewEl) previewEl.innerHTML = "<em>Nenhum REC gerado ainda.</em>";
        if (infoEl) infoEl.textContent = "";
        if (btnPublish) btnPublish.disabled = true;
        return;
    }

    previewEl.innerHTML = recPack.previewHtml || "<em>Nenhum HTML gerado.</em>";
    infoEl.innerHTML = `<strong>REC:</strong> palavras ~ ${recPack.totalWords || 0}`;
    btnPublish.disabled = false;
}

function getSelectedFullPack() {
    if (selectedFullIndex < 0 || selectedFullIndex >= fullPacks.length) return null;
    return fullPacks[selectedFullIndex];
}

function renderFullPreview() {
    const previewEl = document.getElementById("htmlPreviewFull");
    const infoEl = document.getElementById("previewInfoFull");
    const btnPrev = document.getElementById("btnPrevFull");
    const btnNext = document.getElementById("btnNextFull");
    const btnPublish = document.getElementById("btnPublishFull");

    const pack = getSelectedFullPack();

    if (!pack) {
        if (previewEl) previewEl.innerHTML = "<em>Nenhum FULLREVIEW gerado ainda.</em>";
        if (infoEl) infoEl.textContent = "";
        btnPrev.disabled = true;
        btnNext.disabled = true;
        btnPublish.disabled = true;
        return;
    }

    previewEl.innerHTML = pack.previewHtml || "<em>Nenhum HTML gerado.</em>";
    infoEl.innerHTML = `<strong>FULL:</strong> ${selectedFullIndex + 1} / ${fullPacks.length} (palavras ~ ${pack.totalWords || 0})`;

    btnPrev.disabled = selectedFullIndex <= 0;
    btnNext.disabled = selectedFullIndex >= fullPacks.length - 1;
    btnPublish.disabled = false;
}

function renderAll() {
    renderRecPreview();
    renderFullPreview();
}

// ===== Gerar 1 artigo =====
async function generateOneArticle({ topic, language, type, approxWordCount }) {
    const hasLimit = typeof approxWordCount === "number" && approxWordCount > 0;
    const maxTokens = hasLimit ? Math.round(approxWordCount * 1.8) : 2048;

    const systemPrompt = buildSystemPrompt(type, language, approxWordCount);

    const userPrompt = hasLimit
        ? `
Crie um texto do tipo "${type}" usando o schema dado, no idioma "${language}", sobre o seguinte tópico EXATO:

"${topic}"

Regras específicas deste pedido:
- Não mude o assunto central do topic. Não troque por um tema parecido ou genérico.
- Todo o conteúdo deve falar diretamente sobre esse tema e suas variações naturais.
- O texto deve ter NO MÁXIMO ${approxWordCount} palavras (soma de todos os campos de conteúdo). Se precisar errar, erre para menos.
`.trim()
        : `
Crie um texto do tipo "${type}" usando o schema dado, no idioma "${language}", sobre o seguinte tópico EXATO:

"${topic}"

Regras específicas deste pedido:
- Não mude o assunto central do topic. Não troque por um tema parecido ou genérico.
- Todo o conteúdo deve falar diretamente sobre esse tema e variações naturais dele.
- O usuário não definiu um número exato de palavras. Escolha um tamanho natural, editorial, sem exagerar.
`.trim();

    const response = await fetch("/api/generate-article", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemPrompt, userPrompt, maxTokens }),
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error("Erro da API interna (/api/generate-article): " + errText);
    }

    const data = await response.json();
    let content = (data.choices?.[0]?.message?.content || "").trim();

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
    } catch {
        console.error("JSON bruto retornado:", content);
        throw new Error("Falha ao interpretar o JSON retornado pela IA. Veja o console.");
    }

    articleJson.type = type;
    articleJson.language = language;
    articleJson.topic = topic;
    articleJson.word_count_target = approxWordCount;
    if (!articleJson.h1 || !articleJson.h1.trim()) articleJson.h1 = topic;

    let totalWords = 0;
    if (articleJson.subtitle_html) totalWords += countWordsFromHtml(articleJson.subtitle_html);
    if (articleJson.intro_html) totalWords += countWordsFromHtml(articleJson.intro_html);
    if (articleJson.body_html) totalWords += countWordsFromHtml(articleJson.body_html);
    if (articleJson.steps_html) totalWords += countWordsFromHtml(articleJson.steps_html);
    if (Array.isArray(articleJson.faq)) {
        articleJson.faq.forEach((f) => {
            if (f.question) totalWords += countWordsFromHtml(f.question);
            if (f.answer_html) totalWords += countWordsFromHtml(f.answer_html);
        });
    }
    if (articleJson.conclusion_html) totalWords += countWordsFromHtml(articleJson.conclusion_html);
    articleJson.word_count_estimate = totalWords;

    const html = buildHtmlFromArticle(articleJson);
    const previewHtml = buildPreviewHtmlFromArticle(articleJson);

    return { json: articleJson, html, previewHtml, type, totalWords };
}

// ===== Gerar REC + FULL =====
async function generateAllArticles() {
    const statusEl = document.getElementById("statusGenerate");
    const btn = document.getElementById("btnGenerate");

    const language = document.getElementById("language").value;

    const topicRec = (document.getElementById("topicRec").value || "").trim();
    const fullTopics = getFullTopicsFromFields();

    const wordRecRaw = document.getElementById("wordCountRec")?.value || "";
    let wordRec = parseInt(wordRecRaw, 10);
    if (isNaN(wordRec) || wordRec <= 0) wordRec = 0;

    const wordFullRaw = document.getElementById("wordCountFull")?.value || "";
    let wordFull = parseInt(wordFullRaw, 10);
    if (isNaN(wordFull) || wordFull <= 0) wordFull = 0;

    if (!topicRec && fullTopics.length === 0) {
        statusEl.classList.add("error");
        statusEl.innerHTML = "<strong>Erro:</strong> informe o tema do REC e/ou pelo menos 1 tema de FULLREVIEW.";
        return;
    }

    statusEl.classList.remove("error");
    btn.disabled = true;

    recPack = null;
    fullPacks = [];
    selectedFullIndex = -1;
    renderAll();

    try {
        let done = 0;
        const total = (topicRec ? 1 : 0) + fullTopics.length;

        if (topicRec) {
            statusEl.innerHTML = `Gerando REC… (${done + 1}/${total})`;
            recPack = await generateOneArticle({
                topic: topicRec,
                language,
                type: "REC",
                approxWordCount: wordRec,
            });
            done++;
            renderRecPreview();
        }

        for (let i = 0; i < fullTopics.length; i++) {
            statusEl.innerHTML = `Gerando FULLREVIEW ${i + 1}/${fullTopics.length}… (${done + 1}/${total})`;
            const pack = await generateOneArticle({
                topic: fullTopics[i],
                language,
                type: "FULLREVIEW",
                approxWordCount: wordFull,
            });
            fullPacks.push(pack);
            done++;
            if (selectedFullIndex === -1) selectedFullIndex = 0;
            renderFullPreview();
        }

        statusEl.innerHTML = `<strong>Sucesso:</strong> gerado(s) ${total} texto(s).`;
    } catch (err) {
        console.error(err);
        statusEl.classList.add("error");
        statusEl.innerHTML = "<strong>Erro ao gerar:</strong> " + err.message;
    } finally {
        btn.disabled = false;
    }
}

// ===== Lê as configs do artigo =====
function readArticleSettingsFromForm() {
    const preloaderEnableEl = document.getElementById("cfgPreloaderEnable");
    const preloaderTimeEl = document.getElementById("cfgPreloaderTime");

    const enablePreloader = !!(preloaderEnableEl && preloaderEnableEl.checked);

    let preloaderTime = null;
    if (enablePreloader && preloaderTimeEl) {
        const val = parseInt(preloaderTimeEl.value || "0", 10);
        preloaderTime = isNaN(val) || val <= 0 ? 3500 : val;
    }

    const enableImage = !!document.getElementById("cfgEnableImage")?.checked;
    const hideCategory = !!document.getElementById("cfgHideCategory")?.checked;
    const hideAuthor = !!document.getElementById("cfgHideAuthor")?.checked;
    const hideDate = !!document.getElementById("cfgHideDate")?.checked;
    const hideMenu = !!document.getElementById("cfgHideMenu")?.checked;
    const hideSocial = !!document.getElementById("cfgHideSocial")?.checked;
    const hideFooter = !!document.getElementById("cfgHideFooter")?.checked;
    const persistParam = !!document.getElementById("cfgPersistParam")?.checked;

    return {
        habilitar_preloader: enablePreloader,
        personalizar_preloader: enablePreloader,
        tempo_preloader: enablePreloader ? preloaderTime : null,

        habilitar_imagem: enableImage,
        ocultar_categoria: hideCategory,
        ocultar_autor: hideAuthor,
        ocultar_data: hideDate,
        ocultar_menu: hideMenu,
        ocultar_social: hideSocial,
        ocultar_footer: hideFooter,
        persistir_parametro: persistParam,

        artquiz_associado: null,
    };
}

// ===== Carregar categorias (principal) =====
async function loadWpCategories() {
    const baseUrlInput = document.getElementById("wpBaseUrl");
    const categorySelect = document.getElementById("wpCategorySelect");
    const hiddenCategoryId = document.getElementById("wpCategoryId");

    if (!baseUrlInput || !categorySelect || !hiddenCategoryId) return;

    const baseUrl = baseUrlInput.value.trim();
    if (!baseUrl) {
        categorySelect.innerHTML = '<option value="">Informe a URL do WordPress</option>';
        hiddenCategoryId.value = "0";
        return;
    }

    const url = baseUrl.replace(/\/$/, "") + "/wp-json/wp/v2/categories?per_page=100";
    categorySelect.innerHTML = '<option value="">Carregando categorias...</option>';
    hiddenCategoryId.value = "0";

    try {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error("Status " + resp.status);

        const cats = await resp.json();
        if (!Array.isArray(cats) || cats.length === 0) {
            categorySelect.innerHTML = '<option value="">Nenhuma categoria encontrada</option>';
            return;
        }

        categorySelect.innerHTML = '<option value="">Selecione a categoria</option>';
        cats.forEach((cat) => {
            if (!cat || typeof cat.id === "undefined" || !cat.name) return;
            const opt = document.createElement("option");
            opt.value = String(cat.id);
            opt.textContent = cat.name;
            categorySelect.appendChild(opt);
        });
    } catch (err) {
        console.error("Erro ao carregar categorias do WordPress:", err);
        categorySelect.innerHTML = '<option value="">Erro ao carregar categorias</option>';
    }
}
window.loadWpCategories = loadWpCategories;

// ===== Helper: pega o NOME da categoria selecionada no principal =====
function getPrimaryCategoryName() {
    const sel = document.getElementById("wpCategorySelect");
    if (!sel) return "";
    const opt = sel.options?.[sel.selectedIndex];
    const name = (opt?.textContent || "").trim();
    if (!name || name.toLowerCase().includes("selecione") || name.toLowerCase().includes("informe")) return "";
    return name;
}

// ===== Helper: resolve categoryId por nome em um site =====
async function resolveCategoryIdForSite({ baseUrl, authHeader, fallbackId, desiredName }) {
    if (!desiredName) return fallbackId || 0;

    try {
        const url = baseUrl.replace(/\/$/, "") + "/wp-json/wp/v2/categories?per_page=100";
        const resp = await fetch(url, {
            headers: { Authorization: authHeader }
        });

        if (!resp.ok) return fallbackId || 0;

        const cats = await resp.json();
        if (!Array.isArray(cats)) return fallbackId || 0;

        const found = cats.find((c) => (c?.name || "").trim().toLowerCase() === desiredName.toLowerCase());
        if (found?.id) return parseInt(found.id, 10);

        return fallbackId || 0;
    } catch (e) {
        return fallbackId || 0;
    }
}

// ===== Publicar 1 site (AGORA retorna resultado, não “engole” erro) =====
async function publishToWordpress(articlePack, siteLabel = "") {
    if (!articlePack?.json || !articlePack?.html) {
        return {
            ok: false,
            siteLabel,
            slug: "",
            link: "",
            id: null,
            error: "Gere um texto antes de publicar."
        };
    }

    const baseUrl = document.getElementById("wpBaseUrl").value.trim();
    const user = document.getElementById("wpUser").value.trim();
    const appPassword = document.getElementById("wpAppPassword").value.trim();

    const categoryId = parseInt(document.getElementById("wpCategoryId").value || "0", 10);
    const wpStatus = document.getElementById("wpStatus").value;

    const title = articlePack.json.h1 || "Texto IA";
    const baseSlug = slugify(title);

    let typePrefix = (articlePack.json.type || "").toString().toLowerCase();
    if (typePrefix !== "rec" && typePrefix !== "fullreview") typePrefix = "";
    const slug = typePrefix ? `${typePrefix}-${baseSlug}` : baseSlug;

    if (!baseUrl || !user || !appPassword) {
        return {
            ok: false,
            siteLabel,
            slug,
            link: "",
            id: null,
            error: "Preencha URL, usuário e application password do WordPress."
        };
    }

    const introField = articlePack.json.intro_html || articlePack.json.subtitle_html || "";
    const metaDescription = stripHtml(introField).slice(0, 160);
    const excerpt = stripHtml(introField).slice(0, 200);

    const articleConfig = readArticleSettingsFromForm();

    const body = {
        title,
        content: articlePack.html,
        status: wpStatus,
        categories: categoryId > 0 ? [categoryId] : [],
        slug,
        excerpt,
        meta: {
            cf_article_type: articlePack.json.type || "",
            cf_meta_description: metaDescription,
        },
        config_artigo: articleConfig,
    };

    try {
        const authHeader = "Basic " + btoa(user + ":" + appPassword);

        const response = await fetch(baseUrl.replace(/\/$/, "") + "/wp-json/wp/v2/posts", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: authHeader,
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errText = await response.text();
            return {
                ok: false,
                siteLabel,
                slug,
                link: "",
                id: null,
                error: errText || ("Erro HTTP " + response.status)
            };
        }

        const data = await response.json();

        return {
            ok: true,
            siteLabel,
            slug,
            link: data?.link || "",
            id: data?.id || null,
            error: ""
        };
    } catch (err) {
        return {
            ok: false,
            siteLabel,
            slug,
            link: "",
            id: null,
            error: err?.message || "Erro desconhecido"
        };
    }
}

// ✅ Publicar em TODOS os sites selecionados (com resumo real + slug)
async function publishToAllSelectedSites(articlePack) {
    const statusEl = document.getElementById("statusPublish");
    const resultEl = document.getElementById("wpResult");

    const selectedIds = (typeof window.getSelectedWpSites === "function")
        ? window.getSelectedWpSites()
        : [];

    if (!selectedIds || selectedIds.length === 0) {
        statusEl.classList.add("error");
        statusEl.innerHTML = "<strong>Erro:</strong> selecione pelo menos 1 site para publicar.";
        return;
    }

    statusEl.classList.remove("error");
    resultEl.innerHTML = "";

    // categoria escolhida no PRINCIPAL
    const primaryCategoryId = parseInt(document.getElementById("wpCategoryId").value || "0", 10);
    const primaryCategoryName = getPrimaryCategoryName();

    const results = [];
    let okCount = 0;
    let failCount = 0;

    for (let i = 0; i < selectedIds.length; i++) {
        const siteId = selectedIds[i];
        const site = (window.WP_SITES_PRESETS || WP_SITES_PRESETS || []).find((s) => s.id === siteId);
        if (!site) continue;

        // aplica credenciais/URL do site atual
        document.getElementById("wpBaseUrl").value = site.baseUrl || "";
        document.getElementById("wpUser").value = site.user || "";
        document.getElementById("wpAppPassword").value = site.appPassword || "";

        // status mantém UI; se quiser default do preset, descomente:
        // if (site.defaultStatus) document.getElementById("wpStatus").value = site.defaultStatus;

        // resolve categoria por nome (melhor) ou fallback
        const user = (site.user || "").trim();
        const pass = (site.appPassword || "").trim();
        const authHeader = "Basic " + btoa(user + ":" + pass);

        const fallbackId =
            (typeof site.defaultCategoryId === "number" && site.defaultCategoryId > 0)
                ? site.defaultCategoryId
                : primaryCategoryId;

        const resolvedCatId = await resolveCategoryIdForSite({
            baseUrl: site.baseUrl || "",
            authHeader,
            fallbackId,
            desiredName: primaryCategoryName
        });

        document.getElementById("wpCategoryId").value = String(resolvedCatId || 0);

        statusEl.innerHTML = `Publicando em: <strong>${site.label}</strong> (${i + 1}/${selectedIds.length})...`;

        const r = await publishToWordpress(articlePack, site.label);
        results.push(r);

        if (r.ok) okCount++;
        else failCount++;
    }

    // Render resumo
    const lines = results.map((r) => {
        if (r.ok) {
            const linkPart = r.link ? ` — <a href="${r.link}" target="_blank" rel="noopener noreferrer">abrir</a>` : "";
            return `✅ <strong>${r.siteLabel}</strong> — ID: ${r.id || "-"} | slug: <strong>${r.slug}</strong>${linkPart}`;
        }
        const msg = (r.error || "").includes("rest_cannot_create")
            ? "Sem permissão para criar posts com este usuário."
            : (r.error || "Falhou.");
        return `❌ <strong>${r.siteLabel}</strong> — ERRO: ${stripHtml(msg)} | slug: <strong>${r.slug}</strong>`;
    });

    if (failCount > 0) {
        statusEl.classList.add("error");
        statusEl.innerHTML = `<strong>Atenção:</strong> ${okCount} publicado(s), ${failCount} falharam.`;
    } else {
        statusEl.classList.remove("error");
        statusEl.innerHTML = `<strong>Sucesso:</strong> publicação finalizada em todos os sites selecionados.`;
    }

    resultEl.innerHTML = lines.join("<br/>");
}

// ===== Toggle preloader time =====
function syncPreloaderTimeField() {
    const checkbox = document.getElementById("cfgPreloaderEnable");
    const input = document.getElementById("cfgPreloaderTime");
    if (!checkbox || !input) return;
    input.disabled = !checkbox.checked;
}

// ===== Listeners =====
document.addEventListener("DOMContentLoaded", () => {
    buildFullTopicFields();

    document.getElementById("fullCount")?.addEventListener("input", buildFullTopicFields);

    document.getElementById("btnGenerate")?.addEventListener("click", (e) => {
        e.preventDefault();
        generateAllArticles();
    });

    document.getElementById("btnPrevFull")?.addEventListener("click", (e) => {
        e.preventDefault();
        if (selectedFullIndex > 0) selectedFullIndex--;
        renderFullPreview();
    });

    document.getElementById("btnNextFull")?.addEventListener("click", (e) => {
        e.preventDefault();
        if (selectedFullIndex < fullPacks.length - 1) selectedFullIndex++;
        renderFullPreview();
    });

    document.getElementById("btnPublishRec")?.addEventListener("click", (e) => {
        e.preventDefault();
        publishToAllSelectedSites(recPack);
    });

    document.getElementById("btnPublishFull")?.addEventListener("click", (e) => {
        e.preventDefault();
        publishToAllSelectedSites(getSelectedFullPack());
    });

    document.getElementById("cfgPreloaderEnable")?.addEventListener("change", syncPreloaderTimeField);
    syncPreloaderTimeField();

    document.getElementById("wpCategorySelect")?.addEventListener("change", () => {
        document.getElementById("wpCategoryId").value =
            document.getElementById("wpCategorySelect").value || "0";
    });

    const wpBaseUrlInput = document.getElementById("wpBaseUrl");
    wpBaseUrlInput?.addEventListener("change", loadWpCategories);
    wpBaseUrlInput?.addEventListener("blur", loadWpCategories);

    if (wpBaseUrlInput?.value?.trim()) loadWpCategories();

    renderAll();
});

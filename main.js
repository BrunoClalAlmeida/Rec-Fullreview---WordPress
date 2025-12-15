// ===== Estado em memória =====
let recArticles = [];
let fullArticles = [];
let selectedRecIndex = -1;
let selectedFullIndex = -1;

// ===== Helpers =====
function getSelectedRec() {
    if (selectedRecIndex < 0 || selectedRecIndex >= recArticles.length) return null;
    return recArticles[selectedRecIndex];
}
function getSelectedFull() {
    if (selectedFullIndex < 0 || selectedFullIndex >= fullArticles.length) return null;
    return fullArticles[selectedFullIndex];
}

// ===== Render Previews =====
function renderRecPreview() {
    const previewEl = document.getElementById("htmlPreviewRec");
    const infoEl = document.getElementById("previewInfoRec");
    const btnPrev = document.getElementById("btnPrevRec");
    const btnNext = document.getElementById("btnNextRec");
    const btnPublish = document.getElementById("btnPublishRec");

    const a = getSelectedRec();
    if (!a) {
        if (previewEl) previewEl.innerHTML = "<em>Nenhum REC gerado ainda.</em>";
        if (infoEl) infoEl.textContent = "";
        if (btnPrev) btnPrev.disabled = true;
        if (btnNext) btnNext.disabled = true;
        if (btnPublish) btnPublish.disabled = true;
        return;
    }

    previewEl.innerHTML = a.previewHtml || "<em>Nenhum HTML gerado.</em>";
    infoEl.innerHTML = `<strong>REC:</strong> ${selectedRecIndex + 1} / ${recArticles.length}`;
    btnPrev.disabled = selectedRecIndex <= 0;
    btnNext.disabled = selectedRecIndex >= recArticles.length - 1;
    btnPublish.disabled = false;
}

function renderFullPreview() {
    const previewEl = document.getElementById("htmlPreviewFull");
    const infoEl = document.getElementById("previewInfoFull");
    const btnPrev = document.getElementById("btnPrevFull");
    const btnNext = document.getElementById("btnNextFull");
    const btnPublish = document.getElementById("btnPublishFull");

    const a = getSelectedFull();
    if (!a) {
        if (previewEl) previewEl.innerHTML = "<em>Nenhum FULLREVIEW gerado ainda.</em>";
        if (infoEl) infoEl.textContent = "";
        if (btnPrev) btnPrev.disabled = true;
        if (btnNext) btnNext.disabled = true;
        if (btnPublish) btnPublish.disabled = true;
        return;
    }

    previewEl.innerHTML = a.previewHtml || "<em>Nenhum HTML gerado.</em>";
    infoEl.innerHTML = `<strong>FULLREVIEW:</strong> ${selectedFullIndex + 1} / ${fullArticles.length}`;
    btnPrev.disabled = selectedFullIndex <= 0;
    btnNext.disabled = selectedFullIndex >= fullArticles.length - 1;
    btnPublish.disabled = false;
}

function renderAllPreviews() {
    renderRecPreview();
    renderFullPreview();
}

// ===== Gerar 1 artigo =====
async function generateOneArticle({ topic, language, type, approxWordCount }) {
    const hasLimit = approxWordCount > 0;
    const maxTokens = hasLimit ? Math.round(approxWordCount * 1.8) : 2048;

    const systemPrompt = buildSystemPrompt(type, language, approxWordCount);

    const userPrompt = hasLimit
        ? `
Crie um texto do tipo "${type}" usando o schema dado, no idioma "${language}", sobre o seguinte tópico EXATO:

"${topic}"

Regras específicas deste pedido:
- Não mude o assunto central do topic. Não troque por um tema parecido ou genérico.
- Todo o conteúdo (títulos, parágrafos, comparações, bloco especial, passo a passo, FAQ e conclusão) deve falar diretamente sobre esse tema e suas variações naturais.
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
    let content = data.choices?.[0]?.message?.content || "";
    content = content.trim();

    // remove ```json ... ```
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

    // normaliza
    articleJson.type = type;
    articleJson.language = language;
    articleJson.topic = topic;
    articleJson.word_count_target = approxWordCount;
    if (!articleJson.h1 || !articleJson.h1.trim()) articleJson.h1 = topic;

    // estima palavras
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

// ===== Gerar em lote =====
async function generateBatch() {
    const topic = document.getElementById("topic").value.trim();
    const language = document.getElementById("language").value;

    const recCount = parseInt(document.getElementById("recCount")?.value || "0", 10) || 0;
    const fullCount = parseInt(document.getElementById("fullCount")?.value || "0", 10) || 0;

    const wordCountRaw = document.getElementById("wordCount")?.value || "";
    let approxWordCount = parseInt(wordCountRaw, 10);
    if (isNaN(approxWordCount) || approxWordCount <= 0) approxWordCount = 0;

    const totalToGenerate = recCount + fullCount;

    const statusEl = document.getElementById("statusGenerate");
    const btn = document.getElementById("btnGenerate");

    if (!topic) {
        statusEl.classList.add("error");
        statusEl.innerHTML = "<strong>Erro:</strong> informe um tema para o texto.";
        return;
    }
    if (totalToGenerate <= 0) {
        statusEl.classList.add("error");
        statusEl.innerHTML = "<strong>Erro:</strong> informe a quantidade de REC e/ou FULLREVIEW.";
        return;
    }

    statusEl.classList.remove("error");
    btn.disabled = true;

    // reset
    recArticles = [];
    fullArticles = [];
    selectedRecIndex = -1;
    selectedFullIndex = -1;
    renderAllPreviews();

    try {
        let done = 0;

        // REC primeiro (vai aparecer na esquerda)
        for (let i = 0; i < recCount; i++) {
            statusEl.innerHTML = `Gerando REC ${i + 1}/${recCount}… (total ${done + 1}/${totalToGenerate})`;
            const result = await generateOneArticle({ topic, language, type: "REC", approxWordCount });
            recArticles.push(result);
            done++;
            if (selectedRecIndex === -1) selectedRecIndex = 0;
            renderRecPreview();
        }

        // FULLREVIEW (vai aparecer na direita)
        for (let i = 0; i < fullCount; i++) {
            statusEl.innerHTML = `Gerando FULLREVIEW ${i + 1}/${fullCount}… (total ${done + 1}/${totalToGenerate})`;
            const result = await generateOneArticle({ topic, language, type: "FULLREVIEW", approxWordCount });
            fullArticles.push(result);
            done++;
            if (selectedFullIndex === -1) selectedFullIndex = 0;
            renderFullPreview();
        }

        const totalWords =
            recArticles.reduce((s, a) => s + (a.totalWords || 0), 0) +
            fullArticles.reduce((s, a) => s + (a.totalWords || 0), 0);

        statusEl.innerHTML =
            `<strong>Sucesso:</strong> gerados ${totalToGenerate} textos ` +
            `(REC: ${recCount} | FULLREVIEW: ${fullCount}). ` +
            `Palavras estimadas (soma): ${totalWords}.`;

        renderAllPreviews();
    } catch (err) {
        console.error(err);
        statusEl.classList.add("error");
        statusEl.innerHTML = "<strong>Erro ao gerar:</strong> " + err.message;
    } finally {
        btn.disabled = false;
    }
}

// ===== Lê as configs do artigo e monta config_artigo =====
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

// ===== Carregar categorias do WordPress =====
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

// ===== Publicar (REC ou FULL selecionado) =====
async function publishToWordpress(articlePack) {
    const statusEl = document.getElementById("statusPublish");
    const resultEl = document.getElementById("wpResult");

    if (!articlePack?.json || !articlePack?.html) {
        statusEl.classList.add("error");
        statusEl.innerHTML = "<strong>Erro:</strong> gere um texto antes de publicar.";
        return;
    }

    const baseUrl = document.getElementById("wpBaseUrl").value.trim();
    const user = document.getElementById("wpUser").value.trim();
    const appPassword = document.getElementById("wpAppPassword").value.trim();

    const categoryId = parseInt(document.getElementById("wpCategoryId").value || "1", 10);
    const wpStatus = document.getElementById("wpStatus").value;

    if (!baseUrl || !user || !appPassword) {
        statusEl.classList.add("error");
        statusEl.innerHTML = "<strong>Erro:</strong> preencha URL, usuário e application password do WordPress.";
        return;
    }

    const title = articlePack.json.h1 || "Texto IA";

    const baseSlug = slugify(title);
    let typePrefix = (articlePack.json.type || "").toString().toLowerCase();
    if (typePrefix !== "rec" && typePrefix !== "fullreview") typePrefix = "";
    const slug = typePrefix ? `${typePrefix}-${baseSlug}` : baseSlug;

    const introField = articlePack.json.intro_html || articlePack.json.subtitle_html || "";
    const metaDescription = stripHtml(introField).slice(0, 160);
    const excerpt = stripHtml(introField).slice(0, 200);

    const articleConfig = readArticleSettingsFromForm();

    const body = {
        title,
        content: articlePack.html,
        status: wpStatus,
        categories: [categoryId],
        slug,
        excerpt,
        meta: {
            cf_article_type: articlePack.json.type || "",
            cf_meta_description: metaDescription,
        },
        config_artigo: articleConfig,
    };

    statusEl.classList.remove("error");
    statusEl.innerHTML = "Publicando no WordPress...";
    resultEl.innerHTML = "";

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
            throw new Error("Erro da API WordPress: " + errText);
        }

        const data = await response.json();

        statusEl.classList.remove("error");
        statusEl.innerHTML = "<strong>Sucesso:</strong> post criado com ID " + data.id;

        if (data.link) {
            resultEl.innerHTML =
                '🔗 <strong>Link do post:</strong> <a href="' +
                data.link +
                '" target="_blank" rel="noopener noreferrer">' +
                data.link +
                "</a>";
        }
    } catch (err) {
        console.error(err);
        statusEl.classList.add("error");
        statusEl.innerHTML = "<strong>Erro ao publicar:</strong> " + err.message;
    }
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
    document.getElementById("btnGenerate")?.addEventListener("click", (e) => {
        e.preventDefault();
        generateBatch();
    });

    // Navegação REC (esquerda)
    document.getElementById("btnPrevRec")?.addEventListener("click", (e) => {
        e.preventDefault();
        if (selectedRecIndex > 0) selectedRecIndex--;
        renderRecPreview();
    });
    document.getElementById("btnNextRec")?.addEventListener("click", (e) => {
        e.preventDefault();
        if (selectedRecIndex < recArticles.length - 1) selectedRecIndex++;
        renderRecPreview();
    });

    // Navegação FULLREVIEW (direita)
    document.getElementById("btnPrevFull")?.addEventListener("click", (e) => {
        e.preventDefault();
        if (selectedFullIndex > 0) selectedFullIndex--;
        renderFullPreview();
    });
    document.getElementById("btnNextFull")?.addEventListener("click", (e) => {
        e.preventDefault();
        if (selectedFullIndex < fullArticles.length - 1) selectedFullIndex++;
        renderFullPreview();
    });

    // Publish botões separados
    document.getElementById("btnPublishRec")?.addEventListener("click", (e) => {
        e.preventDefault();
        publishToWordpress(getSelectedRec());
    });

    document.getElementById("btnPublishFull")?.addEventListener("click", (e) => {
        e.preventDefault();
        publishToWordpress(getSelectedFull());
    });

    // preloader time toggle
    document.getElementById("cfgPreloaderEnable")?.addEventListener("change", syncPreloaderTimeField);
    syncPreloaderTimeField();

    // categorias
    const wpCategorySelect = document.getElementById("wpCategorySelect");
    const hiddenCategoryId = document.getElementById("wpCategoryId");
    wpCategorySelect?.addEventListener("change", () => {
        hiddenCategoryId.value = wpCategorySelect.value || "0";
    });

    const wpBaseUrlInput = document.getElementById("wpBaseUrl");
    wpBaseUrlInput?.addEventListener("change", loadWpCategories);
    wpBaseUrlInput?.addEventListener("blur", loadWpCategories);

    document.getElementById("wpSitePreset")?.addEventListener("change", () => {
        setTimeout(loadWpCategories, 150);
    });

    if (wpBaseUrlInput?.value?.trim()) loadWpCategories();

    renderAllPreviews();
});

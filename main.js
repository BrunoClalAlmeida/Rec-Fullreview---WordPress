//main.js

// ===== Estado em memória =====
let recPacks = [];        // array de packs REC
let fullPacks = [];       // array de packs FULL
let selectedRecIndex = -1;
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

// ===== (NOVO) REC: quantidade + campos dinâmicos =====
// ⚠️ Se você ainda não colocou esses elementos no HTML, isso não quebra nada.
function buildRecTopicFields() {
    const container = document.getElementById("recTopicsContainer");
    const recCountEl = document.getElementById("recCount");
    if (!container || !recCountEl) return;

    let n = parseInt(recCountEl.value || "0", 10);
    if (isNaN(n) || n < 0) n = 0;
    if (n > 10) n = 10;

    const existing = Array.from(container.querySelectorAll("textarea")).map((t) => t.value || "");
    container.innerHTML = "";

    for (let i = 0; i < n; i++) {
        const wrap = document.createElement("div");
        wrap.className = "full-topic-item";

        const label = document.createElement("label");
        label.setAttribute("for", `topicRec_${i}`);
        label.textContent = `Tema REC ${i + 1}`;

        const ta = document.createElement("textarea");
        ta.id = `topicRec_${i}`;
        ta.placeholder = `Ex: Tema do REC ${i + 1}`;
        ta.value = existing[i] || "";

        wrap.appendChild(label);
        wrap.appendChild(ta);
        container.appendChild(wrap);
    }
}

function getRecTopicsFromFields() {
    const container = document.getElementById("recTopicsContainer");
    if (!container) return [];
    return Array.from(container.querySelectorAll("textarea"))
        .map((t) => (t.value || "").trim())
        .filter((t) => t.length > 0);
}

// ===== Botão único: habilita/desabilita =====
function syncPublishAllButton() {
    const btnAll = document.getElementById("btnPublishAll");
    if (!btnAll) return;

    const hasRec = Array.isArray(recPacks) && recPacks.length > 0;
    const hasFull = Array.isArray(fullPacks) && fullPacks.length > 0;

    btnAll.disabled = !(hasRec || hasFull);
}

// ===== Escape HTML (para strings em UI) =====
function escapeHtml(str) {
    return (str || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

// ✅ FIX: garante exatamente 3 CTAs em REC (se a IA mandar 0/1/2, completa)
function getDefaultRecCtas(language) {
    const lang = (language || "").toLowerCase();
    if (lang.startsWith("en")) return ["SEE OPTIONS", "CONTINUE", "CHECK NOW"];
    if (lang.startsWith("es")) return ["VER OPCIONES", "CONTINUAR", "COMPROBAR AHORA"];
    return ["VER OPÇÕES", "CONTINUAR", "CONFERIR AGORA"]; // pt-BR
}

function ensureThreeRecCtas(articleJson) {
    if (!articleJson) return;

    let arr = Array.isArray(articleJson.ctas) ? articleJson.ctas : [];
    arr = arr
        .map((x) => (x || "").toString().trim())
        .filter((x) => x.length > 0);

    const defaults = getDefaultRecCtas(articleJson.language);

    for (let i = 0; i < defaults.length && arr.length < 3; i++) {
        if (!arr.some((a) => a.toLowerCase() === defaults[i].toLowerCase())) {
            arr.push(defaults[i]);
        }
    }

    while (arr.length < 3) {
        arr.push(defaults[arr.length] || defaults[defaults.length - 1] || "CONTINUAR");
    }

    articleJson.ctas = arr.slice(0, 3);
}

// ===== Preview render =====
function getSelectedRecPack() {
    if (selectedRecIndex < 0 || selectedRecIndex >= recPacks.length) return null;
    return recPacks[selectedRecIndex];
}

function renderRecPreview() {
    const previewEl = document.getElementById("htmlPreviewRec");
    const infoEl = document.getElementById("previewInfoRec");

    const btnPrev = document.getElementById("btnPrevRec");
    const btnNext = document.getElementById("btnNextRec");

    const pack = getSelectedRecPack();

    if (!pack) {
        if (previewEl) previewEl.innerHTML = "<em>Nenhum REC gerado ainda.</em>";
        if (infoEl) infoEl.textContent = "";
        if (btnPrev) btnPrev.disabled = true;
        if (btnNext) btnNext.disabled = true;
        syncPublishAllButton();
        return;
    }

    if (previewEl) previewEl.innerHTML = pack.previewHtml || "<em>Nenhum HTML gerado.</em>";
    if (infoEl) infoEl.innerHTML = `<strong>REC:</strong> ${selectedRecIndex + 1} / ${recPacks.length} (palavras ~ ${pack.totalWords || 0})`;

    if (btnPrev) btnPrev.disabled = selectedRecIndex <= 0;
    if (btnNext) btnNext.disabled = selectedRecIndex >= recPacks.length - 1;

    syncPublishAllButton();
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

    const pack = getSelectedFullPack();

    if (!pack) {
        if (previewEl) previewEl.innerHTML = "<em>Nenhum FULLREVIEW gerado ainda.</em>";
        if (infoEl) infoEl.textContent = "";
        if (btnPrev) btnPrev.disabled = true;
        if (btnNext) btnNext.disabled = true;
        syncPublishAllButton();
        return;
    }

    if (previewEl) previewEl.innerHTML = pack.previewHtml || "<em>Nenhum HTML gerado.</em>";
    if (infoEl) infoEl.innerHTML = `<strong>FULL:</strong> ${selectedFullIndex + 1} / ${fullPacks.length} (palavras ~ ${pack.totalWords || 0})`;

    if (btnPrev) btnPrev.disabled = selectedFullIndex <= 0;
    if (btnNext) btnNext.disabled = selectedFullIndex >= fullPacks.length - 1;

    syncPublishAllButton();
}

function renderAll() {
    renderRecPreview();
    renderFullPreview();
    syncPublishAllButton();
}

// ===== FULL: CTA label chamativo (sem “site oficial”) =====
function getAttractiveFullCtaLabel(articleJson) {
    const raw = (articleJson?.content_block_cta_label || articleJson?.cta_label || "").trim();

    if (raw) {
        const lower = raw.toLowerCase();
        if (lower.includes("site oficial") || lower.includes("official site")) {
            return "Veja como funciona agora";
        }
        return raw;
    }

    return "Veja como funciona agora";
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

REGRA CRÍTICA DE IDIOMA:
- Se o topic estiver em português e o idioma for "${language}" (ex: en-US), TRADUZA o topic e use apenas a versão traduzida.
- É PROIBIDO deixar palavras do topic no idioma original dentro do texto final.
- Não misture idiomas em nenhum campo do JSON.

Regras específicas deste pedido:
- Não mude o assunto central do topic. Não troque por um tema parecido ou genérico.
- Todo o conteúdo deve falar diretamente sobre esse tema e suas variações naturais.
- O texto deve ter NO MÁXIMO ${approxWordCount} palavras (soma de todos os campos de conteúdo). Se precisar errar, erre para menos.

IMPORTANTE (FULLREVIEW):
- O bloco da FULLREVIEW possui LINK e LABEL.
- O LINK deve ser o site oficial da entidade/serviço/tema citado (fonte primária).
- O LABEL deve ser um CTA chamativo e NÃO deve dizer "site oficial".
`.trim()
        : `
Crie um texto do tipo "${type}" usando o schema dado, no idioma "${language}", sobre o seguinte tópico EXATO:

"${topic}"

REGRA CRÍTICA DE IDIOMA:
- Se o topic estiver em português e o idioma for "${language}" (ex: en-US), TRADUZA o topic e use apenas a versão traduzida.
- É PROIBIDO deixar palavras do topic no idioma original dentro do texto final.
- Não misture idiomas em nenhum campo do JSON.

Regras específicas deste pedido:
- Não mude o assunto central do topic. Não troque por um tema parecido ou genérico.
- Todo o conteúdo deve falar diretamente sobre esse tema e variações naturais dele.
- O usuário não definiu um número exato de palavras. Escolha um tamanho natural, editorial, sem exagerar.

IMPORTANTE (FULLREVIEW):
- O bloco da FULLREVIEW possui LINK e LABEL.
- O LINK deve ser o site oficial da entidade/serviço/tema citado (fonte primária).
- O LABEL deve ser um CTA chamativo e NÃO deve dizer "site oficial".
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

    if ((type || "").toUpperCase() === "FULLREVIEW") {
        articleJson.content_block_cta_label = getAttractiveFullCtaLabel(articleJson);
    }

    if ((type || "").toUpperCase() === "REC") {
        ensureThreeRecCtas(articleJson);
    }

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

// ===== Gerar REC(s) + FULL(s) =====
async function generateAllArticles() {
    const statusEl = document.getElementById("statusGenerate");
    const btn = document.getElementById("btnGenerate");

    const language = document.getElementById("language").value;

    // ✅ REC topics:
    // - Se existir recTopicsContainer (novo), usa ele
    // - Se não existir, usa o textarea antigo topicRec (fallback)
    const recTopics = (() => {
        const fromFields = getRecTopicsFromFields();
        if (fromFields.length > 0) return fromFields;

        const single = (document.getElementById("topicRec")?.value || "").trim();
        return single ? [single] : [];
    })();

    const fullTopics = getFullTopicsFromFields();

    const wordRecRaw = document.getElementById("wordCountRec")?.value || "";
    let wordRec = parseInt(wordRecRaw, 10);
    if (isNaN(wordRec) || wordRec <= 0) wordRec = 0;

    const wordFullRaw = document.getElementById("wordCountFull")?.value || "";
    let wordFull = parseInt(wordFullRaw, 10);
    if (isNaN(wordFull) || wordFull <= 0) wordFull = 0;

    if (recTopics.length === 0 && fullTopics.length === 0) {
        statusEl.classList.add("error");
        statusEl.innerHTML = "<strong>Erro:</strong> informe pelo menos 1 tema de REC e/ou 1 tema de FULLREVIEW.";
        return;
    }

    statusEl.classList.remove("error");
    btn.disabled = true;

    recPacks = [];
    fullPacks = [];
    selectedRecIndex = -1;
    selectedFullIndex = -1;
    renderAll();

    try {
        let done = 0;
        const total = recTopics.length + fullTopics.length;

        for (let i = 0; i < recTopics.length; i++) {
            statusEl.innerHTML = `Gerando REC ${i + 1}/${recTopics.length}… (${done + 1}/${total})`;
            const pack = await generateOneArticle({
                topic: recTopics[i],
                language,
                type: "REC",
                approxWordCount: wordRec,
            });
            recPacks.push(pack);
            done++;
            if (selectedRecIndex === -1) selectedRecIndex = 0;
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
        syncPublishAllButton();
    }
}

// ===== ✅ RESTAURADO: Lê as configs do artigo (ERA ISSO QUE ESTAVA FALTANDO) =====
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
        const resp = await fetch(url, { headers: { Authorization: authHeader } });

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

// ===== Publicar 1 site =====
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

/**
 * ✅ SEMPRE retorna 3 links para os 3 botões do CTA-list
 * - Se houver 1 FULL: [L0, L0, L0]
 * - Se houver 2 FULL: [L0, L1, L0] (rotaciona)
 * - Se houver 3+ FULL: pega 3 consecutivos com wrap, começando em recIndex
 */
function pickThreeFullLinksForRec(fullLinks, recIndex) {
    const links = Array.isArray(fullLinks) ? fullLinks.map((x) => (x || "").trim()).filter(Boolean) : [];
    if (links.length === 0) return [];

    const n = links.length;
    const start = ((recIndex || 0) % n + n) % n;

    const out = [
        links[start],
        links[(start + 1) % n],
        links[(start + 2) % n],
    ];

    return out.map((x) => x || links[0]).filter(Boolean);
}

// ✅ Publica FULLs primeiro, depois RECs distribuindo FULLs por REC (3 links por REC)
async function publishFullsThenRecsForOneSite(site, primaryCategoryId, primaryCategoryName, statusEl) {
    document.getElementById("wpBaseUrl").value = site.baseUrl || "";
    document.getElementById("wpUser").value = site.user || "";
    document.getElementById("wpAppPassword").value = site.appPassword || "";

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

    const siteResults = [];

    // 1) PUBLICA FULLS
    const publishedFullLinks = [];

    for (let i = 0; i < fullPacks.length; i++) {
        const pack = fullPacks[i];
        const title = pack?.json?.h1 || pack?.json?.topic || `FULLREVIEW ${i + 1}`;

        if (statusEl) {
            statusEl.innerHTML =
                `Publicando <strong>FULLREVIEW ${i + 1}/${fullPacks.length}</strong> em <strong>${escapeHtml(site.label)}</strong>…` +
                `<br/><span style="font-size:12px;opacity:.85">${escapeHtml(title)}</span>`;
        }

        const r = await publishToWordpress(pack, site.label);
        siteResults.push({ kind: `FULLREVIEW ${i + 1}`, title, ...r });

        if (r.ok && r.link) {
            publishedFullLinks.push(r.link);
        }
    }

    // 2) PUBLICA RECs (cada REC recebe 3 links)
    for (let r = 0; r < recPacks.length; r++) {
        const pack = recPacks[r];
        const recTitle = pack?.json?.h1 || pack?.json?.topic || `REC ${r + 1}`;

        const fullLinksForThisRec = pickThreeFullLinksForRec(publishedFullLinks, r);

        const recPackForThisSite = {
            ...pack,
            html: buildHtmlFromArticle(pack.json, { fullLinks: fullLinksForThisRec }),
        };

        if (statusEl) {
            statusEl.innerHTML =
                `Publicando <strong>REC ${r + 1}/${recPacks.length}</strong> em <strong>${escapeHtml(site.label)}</strong>…` +
                `<br/><span style="font-size:12px;opacity:.85">${escapeHtml(recTitle)}</span>`;
        }

        const rRec = await publishToWordpress(recPackForThisSite, site.label);
        siteResults.push({ kind: `REC ${r + 1}`, title: recTitle, ...rRec });
    }

    return siteResults;
}

// ✅ Publica REC + TODAS FULL com a regra correta (REC usa links das FULL publicadas; FULL usa link oficial do tema)
async function publishAllGeneratedArticles() {
    const statusEl = document.getElementById("statusPublish");
    const resultEl = document.getElementById("wpResult");
    const btnAll = document.getElementById("btnPublishAll");

    const hasRec = Array.isArray(recPacks) && recPacks.length > 0;
    const hasFull = Array.isArray(fullPacks) && fullPacks.length > 0;

    if (!hasRec && !hasFull) {
        statusEl.classList.add("error");
        statusEl.innerHTML = "<strong>Erro:</strong> gere pelo menos 1 artigo (REC ou FULLREVIEW) antes de publicar.";
        return;
    }

    const selectedIds = (typeof window.getSelectedWpSites === "function")
        ? window.getSelectedWpSites()
        : [];

    if (!selectedIds || selectedIds.length === 0) {
        statusEl.classList.add("error");
        statusEl.innerHTML = "<strong>Erro:</strong> selecione pelo menos 1 site para publicar.";
        if (resultEl) resultEl.innerHTML = "";
        return;
    }

    statusEl.classList.remove("error");
    if (resultEl) resultEl.innerHTML = "";
    btnAll.disabled = true;

    const primaryCategoryId = parseInt(document.getElementById("wpCategoryId").value || "0", 10);
    const primaryCategoryName = getPrimaryCategoryName();

    const publishedBySite = [];

    try {
        for (let s = 0; s < selectedIds.length; s++) {
            const siteId = selectedIds[s];
            const site = (window.WP_SITES_PRESETS || WP_SITES_PRESETS || []).find((x) => x.id === siteId);
            if (!site) continue;

            const rows = await publishFullsThenRecsForOneSite(site, primaryCategoryId, primaryCategoryName, statusEl);
            publishedBySite.push({ siteLabel: site.label, rows });
        }

        const blocks = publishedBySite.map((siteBlock) => {
            const header =
                `<div style="margin:14px 0 8px">` +
                `  <div style="font-weight:900;color:#0f172a">🌐 ${escapeHtml(siteBlock.siteLabel)}</div>` +
                `</div>`;

            const list = (siteBlock.rows || []).map((r) => {
                const kind = r.kind || "";
                const title = r.title || "";
                if (r.ok) {
                    const link = r.link
                        ? `<a href="${r.link}" target="_blank" rel="noopener noreferrer">abrir</a>`
                        : "(sem link)";
                    return `✅ <strong>${escapeHtml(kind)}</strong> — ${link} <span style="opacity:.8;font-size:12px">(${escapeHtml(title)})</span>`;
                }
                return `❌ <strong>${escapeHtml(kind)}</strong> — <span style="opacity:.85">${escapeHtml(stripHtml(r.error || "Falhou"))}</span> <span style="opacity:.8;font-size:12px">(${escapeHtml(title)})</span>`;
            }).join("<br/>");

            return `${header}<div style="padding-left:2px">${list}</div><hr style="border:none;border-top:1px solid #e5e7eb;margin:12px 0" />`;
        });

        if (resultEl) {
            resultEl.innerHTML =
                `<div style="margin-bottom:10px;font-weight:900">✅ Links de todas as publicações</div>` +
                blocks.join("");
        }

        statusEl.classList.remove("error");
        statusEl.innerHTML =
            `<strong>Sucesso:</strong> finalizado. ` +
            `Cada REC foi publicada com 3 CTAs linkados (rotacionando entre as FULLs publicadas).`;
    } catch (err) {
        console.error(err);
        statusEl.classList.add("error");
        statusEl.innerHTML = "<strong>Erro ao publicar todos:</strong> " + (err?.message || "erro desconhecido");
    } finally {
        btnAll.disabled = false;
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
    buildRecTopicFields();
    buildFullTopicFields();

    document.getElementById("recCount")?.addEventListener("input", buildRecTopicFields);
    document.getElementById("fullCount")?.addEventListener("input", buildFullTopicFields);

    document.getElementById("btnGenerate")?.addEventListener("click", (e) => {
        e.preventDefault();
        generateAllArticles();
    });

    // Navegação REC (se existir no HTML)
    document.getElementById("btnPrevRec")?.addEventListener("click", (e) => {
        e.preventDefault();
        if (selectedRecIndex > 0) selectedRecIndex--;
        renderRecPreview();
    });

    document.getElementById("btnNextRec")?.addEventListener("click", (e) => {
        e.preventDefault();
        if (selectedRecIndex < recPacks.length - 1) selectedRecIndex++;
        renderRecPreview();
    });

    // Navegação FULL
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

    // ✅ BOTÃO ÚNICO
    document.getElementById("btnPublishAll")?.addEventListener("click", (e) => {
        e.preventDefault();
        publishAllGeneratedArticles();
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

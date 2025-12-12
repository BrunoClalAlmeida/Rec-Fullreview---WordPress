// ===== OpenAI agora via BACKEND (/api/generate-article) =====
// A chave real fica SOMENTE na variável de ambiente OPENAI_API_KEY no servidor (Vercel).
// Este arquivo NÃO terá nenhuma chave sensível.

// ===== Estado em memória =====
let lastArticleJson = null;
let lastArticleHtml = "";

// ===== Gerar artigo (via backend /api/generate-article) =====
async function generateArticle() {
    const model = document.getElementById("model").value.trim() || "gpt-5.1";
    const topic = document.getElementById("topic").value.trim();
    const language = document.getElementById("language").value;
    const articleType = document.getElementById("articleType").value;

    const wordCountRaw = document.getElementById("wordCount")?.value || "";
    let approxWordCount = parseInt(wordCountRaw, 10);
    if (isNaN(approxWordCount) || approxWordCount <= 0) {
        approxWordCount = 0; // sem limite fixo se o usuário deixar vazio
    }
    const hasLimit = approxWordCount > 0;
    const maxTokens = hasLimit ? Math.round(approxWordCount * 1.8) : 2048;

    const statusEl = document.getElementById("statusGenerate");
    const btn = document.getElementById("btnGenerate");

    if (!topic) {
        statusEl.classList.add("error");
        statusEl.innerHTML =
            "<strong>Erro:</strong> informe um tema para o texto.";
        return;
    }

    statusEl.classList.remove("error");
    statusEl.innerHTML = "Gerando texto com a IA...";
    btn.disabled = true;

    try {
        const systemPrompt = buildSystemPrompt(
            articleType,
            language,
            approxWordCount
        );

        let userPrompt;
        if (hasLimit) {
            userPrompt = `
Crie um texto do tipo "${articleType}" usando o schema dado, no idioma "${language}", sobre o seguinte tópico EXATO:

"${topic}"

Regras específicas deste pedido:
- Não mude o assunto central do topic. Não troque por um tema parecido ou genérico.
- Todo o conteúdo (títulos, parágrafos, comparações, bloco especial, passo a passo, FAQ e conclusão) deve falar diretamente sobre esse tema e suas variações naturais.
- O texto deve ter NO MÁXIMO ${approxWordCount} palavras (soma de todos os campos de conteúdo). Se precisar errar, erre para menos.
`.trim();
        } else {
            userPrompt = `
Crie um texto do tipo "${articleType}" usando o schema dado, no idioma "${language}", sobre o seguinte tópico EXATO:

"${topic}"

Regras específicas deste pedido:
- Não mude o assunto central do topic. Não troque por um tema parecido ou genérico.
- Todo o conteúdo (títulos, parágrafos, comparações, bloco especial, passo a passo, FAQ e conclusão) deve falar diretamente sobre esse tema e variações naturais dele.
- O usuário não definiu um número exato de palavras. Escolha um tamanho natural, editorial, sem exagerar.
`.trim();
        }

        const response = await fetch("/api/generate-article", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model,
                systemPrompt,
                userPrompt,
                maxTokens,
            }),
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error("Erro da API interna (/api/generate-article): " + errText);
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
            console.error("JSON bruto retornado:", content);
            throw new Error(
                "Falha ao interpretar o JSON retornado pela IA. Veja o console para o conteúdo bruto."
            );
        }

        articleJson.type = articleType;
        articleJson.language = language;
        articleJson.topic = topic;
        articleJson.word_count_target = approxWordCount;

        if (!articleJson.h1 || !articleJson.h1.trim()) {
            articleJson.h1 = topic;
        }

        let totalWords = 0;
        if (articleJson.subtitle_html)
            totalWords += countWordsFromHtml(articleJson.subtitle_html);
        if (articleJson.intro_html)
            totalWords += countWordsFromHtml(articleJson.intro_html);
        if (articleJson.body_html)
            totalWords += countWordsFromHtml(articleJson.body_html);
        if (articleJson.steps_html)
            totalWords += countWordsFromHtml(articleJson.steps_html);
        if (Array.isArray(articleJson.faq)) {
            articleJson.faq.forEach((f) => {
                if (f.question) totalWords += countWordsFromHtml(f.question);
                if (f.answer_html) totalWords += countWordsFromHtml(f.answer_html);
            });
        }
        if (articleJson.conclusion_html) {
            totalWords += countWordsFromHtml(articleJson.conclusion_html);
        }
        articleJson.word_count_estimate = totalWords;

        lastArticleJson = articleJson;
        lastArticleHtml = buildHtmlFromArticle(articleJson);

        // ================================
        // REMOVIDO: NÃO EXISTE MAIS JSONOUTPUT
        // ================================
        // document.getElementById("jsonOutput").textContent = JSON.stringify(
        //     articleJson,
        //     null,
        //     2
        // );

        const previewEl = document.getElementById("htmlPreview");
        const previewHtml = buildPreviewHtmlFromArticle(articleJson);
        previewEl.innerHTML =
            previewHtml || "<em>Nenhum HTML gerado.</em>";

        document.getElementById("btnPublish").disabled = false;

        statusEl.classList.remove("error");
        statusEl.innerHTML =
            "<strong>Sucesso:</strong> texto gerado. Revise abaixo antes de publicar. (Estimativa de palavras: " +
            totalWords +
            (hasLimit ? " | Limite: " + approxWordCount : "") +
            ")";
    } catch (err) {
        console.error(err);
        statusEl.classList.add("error");
        statusEl.innerHTML =
            "<strong>Erro ao gerar texto:</strong> " + err.message;
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

// ===== Carregar categorias do WordPress (por nome) =====
async function loadWpCategories() {
    const baseUrlInput = document.getElementById("wpBaseUrl");
    const categorySelect = document.getElementById("wpCategorySelect");
    const hiddenCategoryId = document.getElementById("wpCategoryId");

    if (!baseUrlInput || !categorySelect || !hiddenCategoryId) return;

    const baseUrl = baseUrlInput.value.trim();
    if (!baseUrl) {
        categorySelect.innerHTML =
            '<option value="">Informe a URL do WordPress</option>';
        hiddenCategoryId.value = "0";
        return;
    }

    const url =
        baseUrl.replace(/\/$/, "") +
        "/wp-json/wp/v2/categories?per_page=100";

    categorySelect.innerHTML =
        '<option value="">Carregando categorias...</option>';
    hiddenCategoryId.value = "0";

    try {
        const resp = await fetch(url);
        if (!resp.ok) {
            throw new Error("Status " + resp.status);
        }

        const cats = await resp.json();
        if (!Array.isArray(cats) || cats.length === 0) {
            categorySelect.innerHTML =
                '<option value="">Nenhuma categoria encontrada</option>';
            return;
        }

        categorySelect.innerHTML =
            '<option value="">Selecione a categoria</option>';

        cats.forEach((cat) => {
            if (!cat || typeof cat.id === "undefined" || !cat.name) return;
            const opt = document.createElement("option");
            opt.value = String(cat.id);
            opt.textContent = cat.name;
            categorySelect.appendChild(opt);
        });
    } catch (err) {
        console.error("Erro ao carregar categorias do WordPress:", err);
        categorySelect.innerHTML =
            '<option value="">Erro ao carregar categorias</option>';
    }
}

// ===== Publicar no WordPress =====
async function publishToWordpress() {
    const statusEl = document.getElementById("statusPublish");
    const resultEl = document.getElementById("wpResult");
    const btn = document.getElementById("btnPublish");

    if (!lastArticleJson || !lastArticleHtml) {
        statusEl.classList.add("error");
        statusEl.innerHTML =
            "<strong>Erro:</strong> gere um texto antes de publicar.";
        return;
    }

    const baseUrl = document.getElementById("wpBaseUrl").value.trim();
    const user = document.getElementById("wpUser").value.trim();
    const appPassword = document
        .getElementById("wpAppPassword")
        .value.trim();
    const categoryId = parseInt(
        document.getElementById("wpCategoryId").value || "1",
        10
    );
    const wpStatus = document.getElementById("wpStatus").value;

    if (!baseUrl || !user || !appPassword) {
        statusEl.classList.add("error");
        statusEl.innerHTML =
            "<strong>Erro:</strong> preencha URL, usuário e application password do WordPress.";
        return;
    }

    const title = lastArticleJson.h1 || "Texto IA";

    const baseSlug = slugify(title);
    let typePrefix = (lastArticleJson.type || "").toString().toLowerCase();
    if (typePrefix !== "rec" && typePrefix !== "fullreview") {
        typePrefix = "";
    }
    const slug = typePrefix ? `${typePrefix}-${baseSlug}` : baseSlug;

    const introField =
        lastArticleJson.intro_html || lastArticleJson.subtitle_html || "";
    const metaDescription = stripHtml(introField).slice(0, 160);
    const excerpt = stripHtml(introField).slice(0, 200);

    const articleConfig = readArticleSettingsFromForm();

    const body = {
        title,
        content: lastArticleHtml,
        status: wpStatus,
        categories: [categoryId],
        slug,
        excerpt,
        meta: {
            cf_article_type: lastArticleJson.type || "",
            cf_meta_description: metaDescription,
        },
        config_artigo: articleConfig,
    };

    statusEl.classList.remove("error");
    statusEl.innerHTML = "Publicando no WordPress...";
    btn.disabled = true;
    resultEl.innerHTML = "";

    try {
        const authHeader = "Basic " + btoa(user + ":" + appPassword);

        const response = await fetch(
            baseUrl.replace(/\/$/, "") + "/wp-json/wp/v2/posts",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: authHeader,
                },
                body: JSON.stringify(body),
            }
        );

        if (!response.ok) {
            const errText = await response.text();
            throw new Error("Erro da API WordPress: " + errText);
        }

        const data = await response.json();

        statusEl.classList.remove("error");
        statusEl.innerHTML =
            "<strong>Sucesso:</strong> post criado com ID " + data.id;

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
        statusEl.innerHTML =
            "<strong>Erro ao publicar:</strong> " + err.message;
    } finally {
        btn.disabled = false;
    }
}

// ===== Habilita/desabilita campo tempo do preloader =====
function syncPreloaderTimeField() {
    const checkbox = document.getElementById("cfgPreloaderEnable");
    const input = document.getElementById("cfgPreloaderTime");
    if (!checkbox || !input) return;

    if (checkbox.checked) {
        input.disabled = false;
    } else {
        input.disabled = true;
    }
}

// ===== Listeners =====
document.addEventListener("DOMContentLoaded", () => {
    const keyInput = document.getElementById("openaiKey");
    if (keyInput) {
        keyInput.value = "Configuração via servidor (Vercel)";
        keyInput.readOnly = true;
        keyInput.style.pointerEvents = "none";
    }

    const btnGenerate = document.getElementById("btnGenerate");
    if (btnGenerate) {
        btnGenerate.addEventListener("click", (e) => {
            e.preventDefault();
            generateArticle();
        });
    }

    const btnPublish = document.getElementById("btnPublish");
    if (btnPublish) {
        btnPublish.addEventListener("click", (e) => {
            e.preventDefault();
            publishToWordpress();
        });
    }

    const preloaderCheckbox = document.getElementById("cfgPreloaderEnable");
    if (preloaderCheckbox) {
        preloaderCheckbox.addEventListener("change", syncPreloaderTimeField);
    }
    syncPreloaderTimeField();

    // ===== Integração categorias =====
    const wpBaseUrlInput = document.getElementById("wpBaseUrl");
    const wpCategorySelect = document.getElementById("wpCategorySelect");
    const hiddenCategoryId = document.getElementById("wpCategoryId");
    const sitePresetSelect = document.getElementById("wpSitePreset");

    if (wpCategorySelect && hiddenCategoryId) {
        wpCategorySelect.addEventListener("change", () => {
            hiddenCategoryId.value = wpCategorySelect.value || "0";
        });
    }

    if (wpBaseUrlInput) {
        wpBaseUrlInput.addEventListener("change", () => {
            loadWpCategories();
        });
        wpBaseUrlInput.addEventListener("blur", () => {
            loadWpCategories();
        });
    }

    if (sitePresetSelect) {
        sitePresetSelect.addEventListener("change", () => {
            setTimeout(() => {
                loadWpCategories();
            }, 150);
        });
    }

    if (wpBaseUrlInput && wpBaseUrlInput.value.trim()) {
        loadWpCategories();
    }
});

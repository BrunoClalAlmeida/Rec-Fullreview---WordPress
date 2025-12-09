// ===== OpenAI agora via BACKEND (/api/generate-article) =====
// A chave real fica SOMENTE na variável de ambiente OPENAI_API_KEY no servidor (Vercel).
// Este arquivo NÃO terá nenhuma chave sensível.

// ===== Estado em memória =====
let lastArticleJson = null;
let lastArticleHtml = "";

// ===== Schema por tipo (REC ou FULLREVIEW) =====
function getArticleSchema(articleType, languageCode, approxWordCount) {
    const lang = languageCode || "pt-BR";
    const defaultRec = 650;
    const defaultFull = 1000;

    const targetWords =
        typeof approxWordCount === "number" && approxWordCount > 0
            ? approxWordCount
            : articleType === "FULLREVIEW"
                ? defaultFull
                : defaultRec;

    if (articleType === "FULLREVIEW") {
        return {
            type: "FULLREVIEW",
            language: lang,
            topic: "string",
            h1: "string",
            intro_html:
                "HTML string (1 parágrafo, 3–4 linhas, pode ter emoji, explicando o objetivo sem instruir).",
            body_html:
                "HTML string com 7–9 seções, alternando H2/H3. Cada título com exatamente 2 parágrafos. Dentro do body_html deve existir exatamente 1 lista (ul ou ol) e exatamente 1 tabela (<table>) usada como comparação.",
            steps_html:
                "HTML string com lista numerada (7 a 10 passos: 1. 2. 3. ...), cada passo com explicação curta e natural.",
            faq: [
                {
                    question:
                        "string (curta, linguagem natural). O array FAQ deve ter exatamente 7 perguntas.",
                    answer_html:
                        "HTML string (1–2 linhas por resposta, linguagem natural).",
                },
            ],
            conclusion_html:
                "HTML string com exatamente 3 parágrafos, cada um com no máximo 6 linhas (~até 450–500 caracteres), tom motivador, sem CTA visual.",

            // BLOCO CONTENT (3º título) – SEMPRE RELACIONADO AO TEMA
            content_block_tag:
                "string muito curta (até 4 palavras) usada como Tag dentro de um bloco especial que ficará na seção do 3º H2. DEVE estar diretamente relacionada ao tema principal do artigo (topic). Ex.: para Robux: 'Economia do Robux'; para roupas Shein: 'Testes Shein'.",
            content_block_title:
                "string: título chamativo em Title Case para o bloco especial do 3º H2, com cerca de 6–10 palavras e no máximo ~70 caracteres. O título DEVE mencionar explicitamente o assunto do artigo (topic) ou um benefício muito claro ligado ao tema.",
            content_block_summary:
                "string: resumo curto em 1 frase, com no máximo ~90 caracteres, explicando de forma bem chamativa o que a pessoa vai entender/descobrir sobre o tema do artigo. Tem que citar o tema ou algo muito diretamente relacionado.",
            content_block_cta_label:
                "string: label curto do CTA do bloco (até 4 palavras), chamativo e RELACIONADO ao tema. Ex.: para Robux: 'Veja mais sobre Robux'; para Shein: 'Descubra ofertas Shein'. Nada genérico.",
            content_block_cta_link:
                "string (opcional, pode ficar vazio).",
            content_block_warning:
                "string curta (obrigatória, até ~40 caracteres), usada como Aviso no bloco. Deve ser coerente com o tema. Ex.: 'Informações sujeitas às regras do Roblox', 'Conteúdo sujeito a mudanças na plataforma'.",
            content_block_target_blank:
                "string: '0' ou '1' indicando se o link abre em nova aba (use '0' por padrão).",
            content_block_fixed:
                "string: '0' ou '1' indicando se o bloco é fixo (use '1' por padrão).",
            content_block_custom_color:
                "string: '0' ou '1' indicando se é necessário personalizar a cor (use '0' por padrão).",

            approx_word_count: targetWords,
        };
    }

    // REC
    return {
        type: "REC",
        language: lang,
        topic: "string",
        h1: "string",
        subtitle_html:
            "HTML string (1 parágrafo, até 4 linhas, aproximadamente 180–320 caracteres, explicação leve, sem negrito/CTA).",
        ctas: [
            "array de 3 strings; cada uma deve começar com ✅ e ter exatamente 7 palavras.",
        ],
        intro_html:
            "HTML string (1 parágrafo, até 4 linhas, aproximadamente 220–380 caracteres, contexto do tema, sem instrução nem passo a passo).",
        body_html:
            "HTML string com exatamente 7 H2, cada um com 2 parágrafos. Dentro do body_html deve existir exatamente 1 lista (ul ou ol) e exatamente 1 tabela (<table>) usada como comparação.",

        // CTA do 7º título
        section_cta_label:
            "string: CTA em MAIÚSCULAS, até 6 palavras, chamativo e diretamente ligado ao tema do artigo (topic). Ex.: para Robux: 'APROVEITE AGORA DICAS SOBRE ROBUX'; para Shein: 'VEJA COMO GANHAR ROUPAS SHEIN'.",

        // BLOCO CONTENT (3º título) – SEMPRE RELACIONADO AO TEMA
        content_block_tag:
            "string muito curta (até 4 palavras) usada como Tag dentro de um bloco especial que ficará na seção do 3º H2. DEVE resumir um subtema ligado ao assunto principal. Ex.: 'Economia do Robux', 'Testes Shein', 'Benefícios do cartão'.",
        content_block_title:
            "string: título chamativo em Title Case para o bloco especial do 3º H2, com cerca de 6–10 palavras e no máximo ~70 caracteres. O título precisa ser claramente conectado ao tema do artigo (topic), usando o nome da plataforma/marca ou o benefício principal.",
        content_block_summary:
            "string: resumo curto em 1 frase, com no máximo ~90 caracteres, explicando o que a pessoa vai entender sobre o tema do artigo ao clicar/ver o bloco. Sempre relacionado ao assunto principal.",
        content_block_cta_label:
            "string: label curto do CTA do bloco (até 4 palavras), chamativo e específico do tema. Ex.: 'Entenda o Robux hoje', 'Veja benefícios Shein'. Nada genérico como 'Veja mais detalhes'.",
        content_block_cta_link:
            "string (opcional, pode ficar vazio).",
        content_block_warning:
            "string curta (obrigatória, até ~40 caracteres) para o Aviso do bloco. Sempre alinhada ao tema. Ex.: 'Informações sujeitas às regras do Roblox', 'Conteúdo sujeito a mudanças na plataforma'.",
        content_block_target_blank:
            "string: '0' ou '1' indicando se o link abre em nova aba (use '0' por padrão).",
        content_block_fixed:
            "string: '0' ou '1' indicando se o bloco é fixo (use '1' por padrão).",
        content_block_custom_color:
            "string: '0' ou '1' indicando se é necessário personalizar a cor (use '0' por padrão).",

        faq: [
            {
                question:
                    "string (curta, linguagem natural). O array FAQ deve ter exatamente 7 perguntas.",
                answer_html:
                    "HTML string (1–2 linhas por resposta, linguagem natural).",
            },
        ],
        conclusion_html:
            "HTML string com exatamente 3 parágrafos, cada um com no máximo 6 linhas (~até 450–500 caracteres), tom inspirador, sem CTA visual.",
        approx_word_count: targetWords,
    };
}

// ===== Prompt do sistema =====
function buildSystemPrompt(articleType, languageCode, approxWordCount) {
    // descrição humana do idioma
    let languageInstruction = "português do Brasil";
    if (languageCode === "en-US") {
        languageInstruction = "inglês dos Estados Unidos (inglês americano)";
    } else if (languageCode === "es-ES") {
        languageInstruction = "espanhol padrão (internacional)";
    }

    const defaultRec = 650;
    const defaultFull = 1000;
    const resolvedApprox =
        typeof approxWordCount === "number" && approxWordCount > 0
            ? approxWordCount
            : articleType === "FULLREVIEW"
                ? defaultFull
                : defaultRec;

    const schema = JSON.stringify(
        getArticleSchema(articleType, languageCode, resolvedApprox),
        null,
        2
    );

    const baseRules = `
Regras gerais (valem para REC e FULLREVIEW):

- Controle de tamanho (MUITO IMPORTANTE):
  - Considere que o LIMITE MÁXIMO ABSOLUTO de palavras para este texto é de ${resolvedApprox} palavras, somando todos os campos de texto (subtitle_html, intro_html, body_html, steps_html, faq, conclusion_html).
  - NUNCA ultrapasse esse limite. É melhor ficar um pouco abaixo do que acima.
  - Busque ficar aproximadamente entre 0,85 x ${resolvedApprox} e ${resolvedApprox} palavras.
  - Se perceber que o conteúdo está ficando muito longo, reduza o tamanho dos parágrafos, use frases mais curtas e finalize as últimas seções de forma objetiva, em vez de continuar expandindo.

- Idioma:
  - Escreva TODO o conteúdo exclusivamente em ${languageInstruction}.
  - Isso vale para títulos, parágrafos, listas, tabelas, CTAs, FAQs, avisos e qualquer outro texto.
  - Não misture com outros idiomas, nem palavras soltas em outra língua.
  - Se o usuário escrever o tema/tópico em outro idioma, você deve ADAPTAR e TRADUZIR o título (h1) e TODO o conteúdo para ${languageInstruction}, mantendo apenas o sentido do tema original.

- Linguagem:
  - Natural, jornalística/editorial.
  - Sem repetições desnecessárias.
  - Sem frases artificiais ou linguagem robótica.
  - Fugir de repetições de ideias e palavras.

- Estrutura visual:
  - Conteúdo totalmente pronto para WordPress.
  - Use apenas HTML simples: <h2>, <h3>, <p>, <ul>, <ol>, <li>, <table>, <thead>, <tbody>, <tr>, <td>, <strong>, <em>, <a>, <span>.
  - NÃO use barras, separadores ou linhas como "---" ou "###".
  - NÃO use negrito em títulos; usar <strong> apenas em perguntas do FAQ se desejar.
  - O título principal (H1) será usado apenas fora do HTML (como título do post), então NÃO inserir <h1> dentro de nenhum campo HTML.

- Proibições:
  - Nunca usar as palavras "REC" ou "FULLREVIEW" dentro do texto.
  - Nunca usar "artigo", "post" ou "guia" para se referir ao próprio texto.
  - Nunca repetir a palavra-chave em excesso.

- Sempre:
  - Misturar estilos de blocos (parágrafos, listas, tabelas, comparações).
  - Manter ritmo dinâmico.
  - Variar vocabulário.
  - Criar textos 100% originais.
  - Respeitar os campos do schema.

- Listas e comparações (body_html):
  - Em TODO texto (REC ou FULLREVIEW), o body_html deve conter:
    - Exatamente 1 lista comum (ul ou ol).
    - Exatamente 1 bloco de comparação em formato de tabela (<table>).
  - A lista e a tabela DEVEM estar em seções diferentes do body_html (não coloque a lista e a tabela uma imediatamente depois da outra).
  - NÃO crie mais de uma lista no body_html.
  - NÃO crie mais de uma tabela no body_html.
  - A posição da lista e da tabela NÃO deve ser fixa. Em cada novo texto, VARIE a posição em que a lista aparece (pode estar mais no início, mais no meio ou mais no final) e VARIE também a posição da tabela.
  - Evite criar sempre a lista ou a tabela na mesma altura do texto (por exemplo, não coloque sempre a lista no 2º subtítulo e a tabela no 5º). Pense como um redator humano que decide, a cada novo texto, onde faz mais sentido comparar em tabela e onde faz mais sentido listar.

- BLOCO CONTENT (3º TÍTULO):
  - Todos os campos content_block_* DEVEM ser claramente relacionados ao tema principal do artigo (campo "topic").
  - Se o topic fala de Robux, o bloco precisa falar de Robux, golpes, economia do Roblox, etc.
  - Se o topic fala de roupas da Shein, o bloco precisa falar de roupas Shein, testes, cupons, avaliações, etc.
  - Nunca use textos genéricos como "Veja mais detalhes", "Conteúdo importante", "Informações úteis".
  - O bloco deve parecer um mini-card promocional diretamente ligado ao tema, como se fosse um destaque dentro do texto principal.
  - Os textos de content_block_tag, content_block_title, content_block_summary, content_block_cta_label e content_block_warning são EXCLUSIVOS desse bloco especial.
  - NUNCA repita esses textos (nem trechos idênticos) dentro de body_html, steps_html, faq ou conclusion_html.
  - Não escreva parágrafos em body_html que sejam iguais ou praticamente iguais ao conteúdo desses campos.
  - Se quiser falar de benefícios, cupons, avisos ou pontos no corpo do texto, use frases diferentes, não copie o que já foi colocado em content_block_*.
`.trim();

    const recRules = `
REC:

- Explica o tema, não ensina passo a passo.
- H1 (campo "h1") deve ser um TÍTULO equivalente ao tópico digitado pelo usuário, escrito no MESMO IDIOMA do texto. Você pode adaptar e traduzir o texto do tópico, mantendo apenas o sentido.
- Subtítulo (subtitle_html) e introdução (intro_html): até 4 linhas cada.
- Corpo com exatamente 7 H2, cada um com 2 parágrafos.
- Dentro do body_html:
  - Use exatamente 1 lista (ul ou ol) e 1 tabela (<table>), em seções diferentes.
  - Em cada novo texto, escolha de forma diferente em qual H2 a lista será inserida e em qual H2 a tabela será inserida.
- Em média, produza um texto que fique PRÓXIMO de ${resolvedApprox} palavras, sem ultrapassar esse limite. Se necessário, encurte parágrafos para respeitar o tamanho.
- section_cta_label: CTA em MAIÚSCULAS, até 6 palavras, relacionado ao tema e escrito NO MESMO IDIOMA do texto (por exemplo, em ${languageInstruction}). 
  - NUNCA use palavras em português como "APROVEITE", "VEJA", "GANHE", "ROUPAS" quando o idioma solicitado não for português. 
  - Todo o texto do CTA deve seguir exatamente o idioma pedido.

- FAQ com exatamente 7 perguntas, cada uma com resposta de 1–2 linhas.

- Para o BLOCO CONTENT (3º título) em REC:
  - Use a Tag para resumir em 1–4 palavras um subtema do assunto.
  - O Título deve chamar atenção e mencionar o tema (Robux, Shein, cartão, etc.).
  - O Resumo deve ser uma frase curta dizendo por que aquilo é importante para quem se interessou pelo tema.
  - O Label do CTA deve ser curto (até 4 palavras) e específico sobre o tema, nunca genérico e SEMPRE no mesmo idioma do texto.
  - O Aviso é obrigatório: use uma frase curta ligada ao tema, como 'Informações sujeitas às regras do Roblox' ou 'Conteúdo sujeito a mudanças na plataforma', também no mesmo idioma do texto.
`.trim();

    const fullRules = `
FULLREVIEW:

- Ensina como fazer, com passo a passo.
- H1 (campo "h1") deve ser um TÍTULO equivalente ao tópico digitado pelo usuário, escrito no MESMO IDIOMA do texto. Você pode adaptar e traduzir o texto do tópico, mantendo apenas o sentido.
- Corpo com 7–9 seções (H2/H3), cada título com 2 parágrafos.
- Dentro do body_html:
  - Use exatamente 1 lista (ul ou ol) e 1 tabela (<table>), em seções diferentes.
  - Varie em qual seção a lista aparece e em qual seção a tabela aparece, para que os textos não fiquem sempre com a mesma estrutura.
- steps_html: lista numerada com 7–10 passos.
- Em média, produza um texto que fique PRÓXIMO de ${resolvedApprox} palavras, sem ultrapassar esse limite. Se estiver chegando no limite, faça passos e parágrafos mais curtos.
- FAQ com exatamente 7 perguntas, cada uma com resposta de 1–2 linhas.
- Bloco CONTENT (3º título) segue as mesmas regras do REC:
  - Sempre conectado ao tema principal.
  - Nada genérico; use o nome da plataforma/marca ou benefício principal.
  - Todos os textos do bloco devem estar no MESMO idioma do texto principal (${languageInstruction}).
  - O Aviso também é obrigatório e curto.
`.trim();

    const typeSpecific = articleType === "REC" ? recRules : fullRules;

    return `
Você é uma IA que escreve textos editoriais com qualidade de revista para blogs de finanças, games, benefícios e temas relacionados.

O usuário escolheu uma quantidade aproximada de palavras para este texto (approx_word_count). 
Trate esse valor como LIMITE MÁXIMO de tamanho: o texto inteiro não deve ultrapassar ${resolvedApprox} palavras somando todos os campos.
É melhor ficar um pouco abaixo do que acima, mantendo fluidez e naturalidade.

Sua resposta DEVE ser SEMPRE um JSON VÁLIDO, seguindo EXATAMENTE o schema abaixo.
NUNCA escreva nada fora do JSON.

Schema:

${schema}

${baseRules}

Regras específicas do tipo "${articleType}":

${typeSpecific}
`.trim();
}

// ===== Utilitários =====
function stripHtml(html) {
    const div = document.createElement("div");
    div.innerHTML = html;
    return div.textContent || div.innerText || "";
}

function countWordsFromHtml(html) {
    if (!html) return 0;
    const text = stripHtml(html);
    if (!text) return 0;
    return text
        .split(/\s+/)
        .map((t) => t.trim())
        .filter((t) => t.length > 0).length;
}

function slugify(text) {
    return text
        .toString()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");
}

function generateRowId() {
    return (
        Date.now().toString(16) +
        Math.floor(Math.random() * 999999).toString(16)
    );
}

// labels PT/EN/ES para FAQ / conclusão / passos
function getLocalizedLabels(language) {
    const lang = (language || "").toLowerCase();
    const isEn =
        lang === "en-us" ||
        lang === "en" ||
        lang.startsWith("en-") ||
        lang.startsWith("en_");
    const isEs =
        lang === "es-es" ||
        lang === "es" ||
        lang.startsWith("es-") ||
        lang.startsWith("es_");

    if (isEn) {
        return {
            faqTitle: "Frequently Asked Questions",
            conclusionTitle: "Conclusion",
            stepsTitle: "Step by Step",
        };
    }

    if (isEs) {
        return {
            faqTitle: "Preguntas Frecuentes",
            conclusionTitle: "Conclusión",
            stepsTitle: "Paso a Paso",
        };
    }

    // padrão pt-BR
    return {
        faqTitle: "Perguntas Frequentes",
        conclusionTitle: "Conclusão",
        stepsTitle: "Passo a Passo",
    };
}

// ===== HTML -> blocos Gutenberg =====
function convertHtmlToBlocks(html) {
    if (!html) return "";
    const container = document.createElement("div");
    container.innerHTML = html;
    const blocks = [];

    function walk(node) {
        if (node.nodeType === 1) {
            const tag = node.tagName.toLowerCase();

            if (tag === "h2" || tag === "h3") {
                const level = tag === "h2" ? 2 : 3;
                blocks.push(
                    `<!-- wp:heading {"level":${level}} -->${node.outerHTML}<!-- /wp:heading -->`
                );
                return;
            }

            if (tag === "p") {
                blocks.push(
                    `<!-- wp:paragraph -->${node.outerHTML}<!-- /wp:paragraph -->`
                );
                return;
            }

            if (tag === "ul" || tag === "ol") {
                blocks.push(`<!-- wp:list -->${node.outerHTML}<!-- /wp:list -->`);
                return;
            }

            if (tag === "table") {
                blocks.push(`<!-- wp:table -->${node.outerHTML}<!-- /wp:table -->`);
                return;
            }

            let child = node.firstChild;
            while (child) {
                walk(child);
                child = child.nextSibling;
            }
            return;
        }

        if (node.nodeType === 3) {
            const text = node.textContent.trim();
            if (!text) return;
            blocks.push(
                `<!-- wp:paragraph --><p>${text}</p><!-- /wp:paragraph -->`
            );
        }
    }

    let child = container.firstChild;
    while (child) {
        walk(child);
        child = child.nextSibling;
    }

    return blocks.join("\n\n");
}

function htmlToBlocks(html) {
    return convertHtmlToBlocks(html);
}

// ===== Bloco de lista de CTAs (3 CTAs iniciais) =====
function buildCtaAcfBlock(ctasArray) {
    if (!Array.isArray(ctasArray) || ctasArray.length === 0) return "";

    const rows = {};
    ctasArray.slice(0, 3).forEach((ctaText) => {
        const id = generateRowId();
        rows[id] = {
            field_6634ebe08b3bb: ctaText || "",
            field_6634ebe08bc5a: "",
            field_6634ebe08f76e: "0",
        };
    });

    const data = {
        field_6634ebe0907be: "0",
        field_6634ec18cf579: rows,
    };

    return `<!-- wp:acf/block-cta-list {"name":"acf/block-cta-list","data":${JSON.stringify(
        data
    )},"mode":"edit"} /-->`;
}

// ===== CTA do 7º título =====
function buildSectionCtaLabel(article) {
    const raw =
        (article && (article.section_cta_label || article.section_cta)) || "";
    if (!raw || !raw.trim()) return "";
    const upper = raw.toUpperCase();
    const words = upper
        .split(/\s+/)
        .map((w) => w.trim())
        .filter((w) => w.length > 0)
        .slice(0, 6);
    return words.join(" ");
}

function buildMiddleSectionCtaBlock(label) {
    const data = {
        field_6613fe14eb5ae: label || "",
        field_6613fe1deb5af: "",
        field_6613fe26eb5b0: "0",
        field_6633f9ad87030: "0",
    };

    return `<!-- wp:acf/block-cta {"name":"acf/block-cta","data":${JSON.stringify(
        data
    )},"mode":"edit"} /-->`;
}

function injectSeventhHeadingCta(blocks, article) {
    const label = buildSectionCtaLabel(article);
    if (!label) return blocks;

    const markerH2 = '<!-- wp:heading {"level":2}';
    let from = 0;
    let count = 0;
    let seventhIndex = -1;

    while (true) {
        const pos = blocks.indexOf(markerH2, from);
        if (pos === -1) break;
        count++;
        if (count === 7) {
            seventhIndex = pos;
            break;
        }
        from = pos + markerH2.length;
    }

    if (seventhIndex === -1) return blocks;

    const paraStartMarker = "<!-- wp:paragraph -->";
    const paraEndMarker = "<!-- /wp:paragraph -->";

    const firstParaStart = blocks.indexOf(paraStartMarker, seventhIndex);
    if (firstParaStart === -1) return blocks;

    const firstParaEnd = blocks.indexOf(paraEndMarker, firstParaStart);
    if (firstParaEnd === -1) return blocks;

    const insertPos = firstParaEnd + paraEndMarker.length;
    const ctaBlock = "\n" + buildMiddleSectionCtaBlock(label) + "\n";

    return blocks.slice(0, insertPos) + ctaBlock + blocks.slice(insertPos);
}

function injectPreviewSeventhCtaIntoBodyHtml(bodyHtml, article) {
    if (!bodyHtml) return bodyHtml;

    const label = buildSectionCtaLabel(article);
    if (!label) return bodyHtml;

    const wrapper = document.createElement("div");
    wrapper.innerHTML = bodyHtml;

    const headings = wrapper.querySelectorAll("h2");
    if (headings.length < 7) return bodyHtml;

    const h7 = headings[6];
    let node = h7.nextSibling;
    let firstPara = null;

    while (node) {
        if (node.nodeType === 1 && node.tagName.toLowerCase() === "p") {
            firstPara = node;
            break;
        }
        node = node.nextSibling;
    }

    if (!firstPara || !firstPara.parentNode) return bodyHtml;

    const ctaEl = document.createElement("p");
    ctaEl.className = "section-cta-preview";
    ctaEl.textContent = label;

    firstPara.parentNode.insertBefore(ctaEl, firstPara.nextSibling);

    return wrapper.innerHTML;
}

// ===== BLOCO CONTENT (3º título) – mapeado igual ao WordPress =====
function buildContentAcfBlock(article) {
    if (!article) return "";

    const tag = article.content_block_tag || "";
    const title = article.content_block_title || "";
    const summary = article.content_block_summary || "";
    const ctaLabel = article.content_block_cta_label || "";
    let warning = article.content_block_warning || "";
    const topic = article.topic || "";

    const hasMain = tag || title || summary || ctaLabel || warning;
    if (!hasMain) return "";

    // fallback de aviso, se vier vazio
    if (!warning || !warning.trim()) {
        if (topic && topic.toLowerCase().includes("robux")) {
            warning = "Informações sujeitas às regras do Roblox.";
        } else if (topic && topic.toLowerCase().includes("shein")) {
            warning = "Conteúdo sujeito às políticas da Shein.";
        } else {
            warning = "Conteúdo sujeito a mudanças na plataforma.";
        }
    }

    const data = {
        imagem: 0,
        _imagem: "field_661541391c60e",

        tag: tag,
        _tag: "field_6615414b1c60f",

        titulo: title,
        _titulo: "field_661541511c610",

        resumo: summary,
        _resumo: "field_661541581c611",

        label: ctaLabel,
        _label: "field_661541621c612",

        link: "",
        _link: "field_6615416b1c613",

        aviso: warning,
        _aviso: "field_6615433184ec1",

        target: "0",
        _target: "field_661541861c614",

        fixo: "1",
        _fixo: "field_66154f45a58c2",

        personalizar: "0",
        _personalizar: "field_6634e948cf410",
    };

    return `<!-- wp:acf/block-content {"name":"acf/block-content","data":${JSON.stringify(
        data
    )},"mode":"edit"} /-->`;
}

function injectThirdHeadingContentBlock(blocks, article) {
    const contentBlock = buildContentAcfBlock(article);
    if (!contentBlock) return blocks;

    const markerH2 = '<!-- wp:heading {"level":2}';
    let from = 0;
    let count = 0;
    let thirdIndex = -1;

    while (true) {
        const pos = blocks.indexOf(markerH2, from);
        if (pos === -1) break;
        count++;
        if (count === 3) {
            thirdIndex = pos;
            break;
        }
        from = pos + markerH2.length;
    }

    if (thirdIndex === -1) return blocks;

    const paraStartMarker = "<!-- wp:paragraph -->";
    const paraEndMarker = "<!-- /wp:paragraph -->";

    const firstParaStart = blocks.indexOf(paraStartMarker, thirdIndex);
    if (firstParaStart === -1) return blocks;

    const firstParaEnd = blocks.indexOf(paraEndMarker, firstParaStart);
    if (firstParaEnd === -1) return blocks;

    const insertPos = firstParaEnd + paraEndMarker.length;
    const blockToInsert = "\n" + contentBlock + "\n";

    return blocks.slice(0, insertPos) + blockToInsert + blocks.slice(insertPos);
}

function injectPreviewContentBlockIntoBodyHtml(bodyHtml, article) {
    if (!bodyHtml) return bodyHtml;

    const tag = article.content_block_tag || "";
    const title = article.content_block_title || "";
    const summary = article.content_block_summary || "";
    const ctaLabel = article.content_block_cta_label || "";
    const warning =
        article.content_block_warning ||
        "Conteúdo sujeito a mudanças na plataforma.";

    const hasMain = tag || title || summary || ctaLabel || warning;
    if (!hasMain) return bodyHtml;

    const wrapper = document.createElement("div");
    wrapper.innerHTML = bodyHtml;

    const headings = wrapper.querySelectorAll("h2");
    if (headings.length < 3) return bodyHtml;

    const h3 = headings[2];
    let node = h3.nextSibling;
    let firstPara = null;

    while (node) {
        if (node.nodeType === 1 && node.tagName.toLowerCase() === "p") {
            firstPara = node;
            break;
        }
        node = node.nextSibling;
    }

    if (!firstPara || !firstPara.parentNode) return bodyHtml;

    const card = document.createElement("div");
    card.className = "content-block-preview";
    let inner = "";

    if (tag) inner += `<div class="cb-tag">${tag}</div>`;
    if (title) inner += `<div class="cb-title">${title}</div>`;
    if (summary) inner += `<p class="cb-summary">${summary}</p>`;
    if (ctaLabel) inner += `<div class="cb-cta">${ctaLabel}</div>`;
    if (warning) inner += `<div class="cb-warning">${warning}</div>`;

    card.innerHTML = inner;
    firstPara.parentNode.insertBefore(card, firstPara.nextSibling);

    return wrapper.innerHTML;
}

// ===== HTML final para WordPress =====
function buildHtmlFromArticle(article) {
    if (!article) return "";
    const type = article.type;
    const parts = [];

    const { faqTitle, conclusionTitle, stepsTitle } = getLocalizedLabels(
        article.language
    );

    if (type === "REC") {
        if (article.subtitle_html) {
            parts.push(htmlToBlocks(article.subtitle_html));
        }

        if (Array.isArray(article.ctas) && article.ctas.length > 0) {
            parts.push(buildCtaAcfBlock(article.ctas));
        }

        if (article.intro_html) {
            parts.push(htmlToBlocks(article.intro_html));
        }

        if (article.body_html) {
            let bodyBlocks = htmlToBlocks(article.body_html);
            bodyBlocks = injectThirdHeadingContentBlock(bodyBlocks, article);
            bodyBlocks = injectSeventhHeadingCta(bodyBlocks, article);
            parts.push(bodyBlocks);
        }

        if (Array.isArray(article.faq) && article.faq.length > 0) {
            let faqHtml = `<h2>${faqTitle}</h2>`;
            article.faq.forEach((item) => {
                if (!item) return;
                if (item.question) faqHtml += `<p><strong>${item.question}</strong></p>`;
                if (item.answer_html) faqHtml += item.answer_html;
            });
            parts.push(htmlToBlocks(faqHtml));
        }

        if (article.conclusion_html) {
            const conclHtml = `<h2>${conclusionTitle}</h2>` + article.conclusion_html;
            parts.push(htmlToBlocks(conclHtml));
        }

        return parts.join("\n\n");
    }

    // FULLREVIEW
    if (article.intro_html) parts.push(htmlToBlocks(article.intro_html));
    if (article.body_html) {
        let bodyBlocks = htmlToBlocks(article.body_html);
        bodyBlocks = injectThirdHeadingContentBlock(bodyBlocks, article);
        parts.push(bodyBlocks);
    }

    if (article.steps_html) {
        const stepsHtml = `<h2>${stepsTitle}</h2>` + article.steps_html;
        parts.push(htmlToBlocks(stepsHtml));
    }

    if (Array.isArray(article.faq) && article.faq.length > 0) {
        let faqHtml = `<h2>${faqTitle}</h2>`;
        article.faq.forEach((item) => {
            if (!item) return;
            if (item.question) faqHtml += `<p><strong>${item.question}</strong></p>`;
            if (item.answer_html) faqHtml += item.answer_html;
        });
        parts.push(htmlToBlocks(faqHtml));
    }

    if (article.conclusion_html) {
        const conclHtml = `<h2>${conclusionTitle}</h2>` + article.conclusion_html;
        parts.push(htmlToBlocks(conclHtml));
    }

    return parts.join("\n\n");
}

// ===== Preview HTML =====
function buildPreviewHtmlFromArticle(article) {
    if (!article) return "";
    const type = article.type;
    const parts = [];

    const { faqTitle, conclusionTitle } = getLocalizedLabels(article.language);

    if (type === "REC") {
        if (article.subtitle_html) {
            parts.push(article.subtitle_html);
        }

        if (Array.isArray(article.ctas) && article.ctas.length > 0) {
            const lis = article.ctas
                .slice(0, 3)
                .map((cta) => `<li>${cta}</li>`)
                .join("");
            parts.push(`<ul class="cta-preview-list">${lis}</ul>`);
        }

        if (article.intro_html) {
            parts.push(article.intro_html);
        }
    } else {
        if (article.intro_html) {
            parts.push(article.intro_html);
        }
    }

    if (article.body_html) {
        let bodyHtml = article.body_html;

        bodyHtml = injectPreviewContentBlockIntoBodyHtml(bodyHtml, article);
        if (type === "REC") {
            bodyHtml = injectPreviewSeventhCtaIntoBodyHtml(bodyHtml, article);
        }

        parts.push(bodyHtml);
    }

    if (Array.isArray(article.faq) && article.faq.length > 0) {
        let faqHtml = `<h2>${faqTitle}</h2>`;
        article.faq.forEach((item) => {
            if (!item) return;
            if (item.question) faqHtml += `<p><strong>${item.question}</strong></p>`;
            if (item.answer_html) faqHtml += item.answer_html;
        });
        parts.push(faqHtml);
    }

    if (article.conclusion_html) {
        parts.push(`<h2>${conclusionTitle}</h2>` + article.conclusion_html);
    }

    return parts.join("\n\n");
}

// ===== Gerar artigo (via backend /api/generate-article) =====
async function generateArticle() {
    const model = document.getElementById("model").value.trim() || "gpt-5.1";
    const topic = document.getElementById("topic").value.trim();
    const language = document.getElementById("language").value;
    const articleType = document.getElementById("articleType").value;

    const wordCountRaw = document.getElementById("wordCount")?.value || "";
    let approxWordCount = parseInt(wordCountRaw, 10);
    if (isNaN(approxWordCount) || approxWordCount <= 0) {
        approxWordCount = articleType === "FULLREVIEW" ? 1000 : 650;
    }

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
        const systemPrompt = buildSystemPrompt(articleType, language, approxWordCount);

        const userPrompt = `Crie um texto do tipo "${articleType}" no idioma "${language}" sobre o tópico (o texto do tópico pode estar em outro idioma, mas o conteúdo deve seguir o idioma solicitado): ${topic}. O texto deve respeitar o limite máximo de ${approxWordCount} palavras no total, ficando de preferência um pouco abaixo desse número.`;

        const response = await fetch("/api/generate-article", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model,
                systemPrompt,
                userPrompt,
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

        document.getElementById("jsonOutput").textContent = JSON.stringify(
            articleJson,
            null,
            2
        );

        const previewEl = document.getElementById("htmlPreview");
        const previewHtml = buildPreviewHtmlFromArticle(articleJson);
        previewEl.innerHTML =
            previewHtml || "<em>Nenhum HTML gerado.</em>";

        document.getElementById("btnPublish").disabled = false;

        statusEl.classList.remove("error");
        statusEl.innerHTML =
            "<strong>Sucesso:</strong> texto gerado. Revise abaixo antes de publicar. (Estimativa de palavras: " +
            totalWords +
            " | Limite configurado: " + approxWordCount + ")";
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

    // Objeto que o snippet PHP espera em $request->get_param('config_artigo')
    return {
        habilitar_preloader: enablePreloader,
        personalizar_preloader: enablePreloader, // usamos o mesmo toggle
        tempo_preloader: enablePreloader ? preloaderTime : null,

        habilitar_imagem: enableImage,
        ocultar_categoria: hideCategory,
        ocultar_autor: hideAuthor,
        ocultar_data: hideDate,
        ocultar_menu: hideMenu,
        ocultar_social: hideSocial,
        ocultar_footer: hideFooter,
        persistir_parametro: persistParam,

        // por enquanto não tem campo de quiz na tela; deixamos nulo
        artquiz_associado: null,
    };
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

    // Lê configurações da tela e monta objeto esperado pelo snippet
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
        // Este objeto será lido pelo snippet PHP (rest_after_insert_post)
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
    // Campo de chave agora é só visual (se existir), sem chave real
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

    // Preloader: linkar toggle com input de tempo
    const preloaderCheckbox = document.getElementById("cfgPreloaderEnable");
    if (preloaderCheckbox) {
        preloaderCheckbox.addEventListener("change", syncPreloaderTimeField);
    }
    syncPreloaderTimeField();
});

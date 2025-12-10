// ===== OpenAI agora via BACKEND (/api/generate-article) =====
// A chave real fica SOMENTE na variável de ambiente OPENAI_API_KEY no servidor (Vercel).
// Este arquivo NÃO terá nenhuma chave sensível.

// ===== Estado em memória =====
let lastArticleJson = null;
let lastArticleHtml = "";

// ===== Schema por tipo (REC ou FULLREVIEW) =====
// Aqui é só estrutura de campos. Quem define conteúdo, idioma, títulos etc. é o GPT.
function getArticleSchema(articleType, languageCode, approxWordCount) {
    const lang = languageCode || "pt-BR";

    const targetWords =
        typeof approxWordCount === "number" && approxWordCount > 0
            ? approxWordCount
            : 0;

    if (articleType === "FULLREVIEW") {
        return {
            type: "FULLREVIEW",
            language: lang,
            topic: "string",

            h1: "string",

            intro_html: "string (HTML)",
            body_html: "string (HTML)",

            steps_title: "string",
            steps_html: "string (HTML)",

            faq_title: "string",
            faq: [
                {
                    question: "string",
                    answer_html: "string (HTML)",
                },
            ],

            conclusion_title: "string",
            conclusion_html: "string (HTML)",

            content_block_tag: "string",
            content_block_title: "string",
            content_block_summary: "string",
            content_block_cta_label: "string",
            content_block_cta_link: "string",
            content_block_warning: "string",
            content_block_target_blank: "string",
            content_block_fixed: "string",
            content_block_custom_color: "string",

            approx_word_count: targetWords,
        };
    }

    // REC
    return {
        type: "REC",
        language: lang,
        topic: "string",
        h1: "string",

        subtitle_html: "string (HTML)",
        ctas: ["string"],
        intro_html: "string (HTML)",
        body_html: "string (HTML)",

        section_cta_label: "string",

        content_block_tag: "string",
        content_block_title: "string",
        content_block_summary: "string",
        content_block_cta_label: "string",
        content_block_cta_link: "string",
        content_block_warning: "string",
        content_block_target_blank: "string",
        content_block_fixed: "string",
        content_block_custom_color: "string",

        faq_title: "string",
        faq: [
            {
                question: "string",
                answer_html: "string (HTML)",
            },
        ],

        conclusion_title: "string",
        conclusion_html: "string (HTML)",

        approx_word_count: targetWords,
    };
}

// ===== Prompt do sistema =====
// Tudo que “educa” o GPT está aqui, em TEXTO. JS não traduz, não escolhe título, não inventa conteúdo.
function buildSystemPrompt(articleType, languageCode, approxWordCount) {
    const hasLimit =
        typeof approxWordCount === "number" && approxWordCount > 0;
    const resolvedApprox = hasLimit ? approxWordCount : 0;

    const schema = JSON.stringify(
        getArticleSchema(articleType, languageCode, resolvedApprox),
        null,
        2
    );

    const wordLimitGeneral = hasLimit
        ? `
- Limite de palavras (REGRA PRINCIPAL):
  - Considere ${resolvedApprox} como LIMITE MÁXIMO ABSOLUTO de palavras para todo o texto (somando todos os campos de conteúdo).
  - O texto DEVE ficar SEMPRE menor ou igual a ${resolvedApprox} palavras.
  - Você pode produzir menos palavras se for necessário. Se tiver dúvida, erre para MENOS, nunca para MAIS.
  - Se perceber que o texto ficou maior, RESUMA e CORTE mentalmente ANTES de responder.
  - Se QUALQUER outra regra de estrutura (número de títulos, parágrafos por título, tamanho de conclusão etc.) conflitar com o limite de palavras, ignore a estrutura e PRIORIZE o limite de palavras.
`
        : `
- Limite de palavras:
  - O usuário não definiu um número exato de palavras.
  - Escreva um texto completo, natural e equilibrado, sem exagerar no volume.
`;

    const recWordRule = hasLimit
        ? `
- Tamanho do texto (REC):
  - Produza ENTRE ${Math.max(
            Math.round(resolvedApprox * 0.8),
            resolvedApprox - 150
        )} e ${resolvedApprox} palavras.
  - Nunca ultrapasse ${resolvedApprox} palavras.
  - Você pode ajustar livremente a quantidade de subtítulos, o tamanho dos parágrafos e o nível de detalhe para caber no limite.`
        : `
- Tamanho do texto (REC):
  - Não há limite fixo.
  - Escreva um texto completo e equilibrado.`;

    const fullWordRule = hasLimit
        ? `
- Tamanho do texto (FULLREVIEW):
  - Produza ENTRE ${Math.max(
            Math.round(resolvedApprox * 0.8),
            resolvedApprox - 200
        )} e ${resolvedApprox} palavras.
  - Nunca ultrapasse ${resolvedApprox} palavras.
  - Você pode ajustar livremente a quantidade de seções, o tamanho dos parágrafos e o nível de detalhe do passo a passo para caber no limite.`
        : `
- Tamanho do texto (FULLREVIEW):
  - Não há limite fixo.
  - Escreva um texto completo, explicando o processo de forma clara e objetiva.`;

    const baseRules = `
Regras gerais (valem para REC e FULLREVIEW):

- Idioma:
  - Escreva TODO o conteúdo no idioma especificado pelo campo "language" do JSON final (por exemplo: "pt-BR", "en-US", "es-ES").
  - Títulos, parágrafos, listas, tabelas, CTAs, FAQ, avisos e qualquer outro texto devem estar nesse mesmo idioma.
  - Se o topic vier em outro idioma, adapte o texto para o idioma indicado em "language", mantendo o mesmo assunto.

- Títulos fixos por idioma (VOCÊ DEVE USAR EXATAMENTE ESTES TEXTOS):
  - Se o campo "language" do JSON final for "pt-BR":
    - faq_title: "Perguntas frequentes"
    - conclusion_title: "Conclusão"
    - se existir passo a passo (FULLREVIEW): steps_title: "Passo a passo"
  - Se o campo "language" do JSON final for "en-US":
    - faq_title: "Frequently Asked Questions"
    - conclusion_title: "Conclusion"
    - se existir passo a passo (FULLREVIEW): steps_title: "Step by Step"
  - Se o campo "language" do JSON final for "es-ES":
    - faq_title: "Preguntas frecuentes"
    - conclusion_title: "Conclusión"
    - se existir passo a passo (FULLREVIEW): steps_title: "Paso a paso"
  - Não invente outras variações para esses títulos. Use exatamente os textos acima, sem adicionar o tema neles.

- Tema (topic) – REGRA MUITO FORTE:
  - O campo "topic" é o tema exato que o usuário quer.
  - Você NÃO pode trocar o assunto principal por outro parecido ou mais genérico.
  - NÃO generalize o topic. Exemplo de erro: transformar "vestidos gratuitos" em "roupas gratuitas".
  - Use o topic como base do título (h1) e do conteúdo. Você pode reescrever o título para ficar natural no idioma, mas SEM mudar o foco.
  - TODO o conteúdo (h1, intro, body_html, steps_html, FAQ, conclusão e blocos content_block_*) deve estar claramente ligado ao topic.

${wordLimitGeneral}

- Linguagem:
  - Use tom natural, claro e fluido, em estilo editorial.
  - Evite repetições desnecessárias e frases artificiais.
  - Não se refira ao próprio texto como “artigo”, “post” ou “guia”; apenas escreva o conteúdo direto.

- Estrutura de HTML:
  - Use apenas HTML simples: <h2>, <h3>, <p>, <ul>, <ol>, <li>, <table>, <thead>, <tbody>, <tr>, <td>, <strong>, <em>, <a>, <span>.
  - NÃO use <h1> dentro de HTML. O h1 será usado somente no campo de texto "h1".
  - Não use scripts, estilos ou códigos especiais.

- Listas e tabelas:
  - Em TODO texto (REC ou FULLREVIEW), o body_html deve conter:
    - Exatamente 1 lista (ul ou ol).
    - Exatamente 1 tabela (<table>) de comparação.
  - A lista e a tabela devem aparecer em seções diferentes do body_html.
  - Não crie mais de uma lista.
  - Não crie mais de uma tabela.

- Bloco CONTENT (3º título):
  - Todos os campos content_block_* devem ser diretamente relacionados ao tema principal (topic).
  - Não use textos genéricos. Seja específico em relação ao tema.
  - Os textos content_block_tag, content_block_title, content_block_summary, content_block_cta_label e content_block_warning são exclusivos do bloco especial.
  - NÃO copie nem repita esses textos dentro de body_html, steps_html, FAQ ou conclusão.

- Campo section_cta_label (REC):
  - Este campo é OBRIGATÓRIO.
  - Nunca deixe section_cta_label vazio ou ausente.
  - Deve ser um CTA curto, em MAIÚSCULAS, com até 6 palavras, diretamente ligado ao tema e no mesmo idioma do campo "language".
`.trim();

    const recRules = `
REC:

- Objetivo:
  - Explicar o tema de forma clara e completa, sem passo a passo detalhado.

- Título (h1):
  - Deve ser um título equivalente ao topic, no idioma indicado em "language", mantendo o MESMO assunto.

- Subtítulo e introdução:
  - subtitle_html: 1 parágrafo curto apresentando o tema.
  - intro_html: 1 parágrafo com contexto e motivação.

${hasLimit
            ? `- Corpo (quando existe limite de palavras):
  - Use subtítulos e parágrafos de forma FLEXÍVEL.
  - A quantidade de subtítulos e o número de parágrafos por subtítulo NÃO são fixos.
  - Você pode ajustar qualquer coisa na estrutura (número de H2, quantidade de parágrafos, tamanho das respostas de FAQ, conclusão mais curta, etc.) para caber dentro do limite de palavras.`
            : `- Corpo (sem limite de palavras definido):
  - Use vários subtítulos para organizar o conteúdo.
  - Em geral, use 2 parágrafos por subtítulo, mas você pode ajustar se fizer sentido.`
        }

- Dentro do body_html (REC):
  - Use exatamente 1 lista (ul ou ol) em uma das seções.
  - Use exatamente 1 tabela de comparação (<table>) em outra seção.
  - Não repita lista ou tabela mais de uma vez.

${recWordRule}

- section_cta_label:
  - Campo OBRIGATÓRIO.
  - Nunca deixe vazio.
  - Texto curto, em MAIÚSCULAS, com até 6 palavras, diretamente ligado ao tema e no idioma do campo "language".

- FAQ (REC):
  - faq_title deve seguir a regra dos títulos fixos por idioma descrita nas regras gerais.
  - Crie exatamente 7 perguntas.
  - Cada answer_html deve ter 1 frase curta (cerca de 6 palavras, máximo 12).

- Conclusão (REC):
  - conclusion_title deve seguir a regra dos títulos fixos por idioma descrita nas regras gerais.
${hasLimit
            ? `  - Use 1 ou 2 parágrafos curtos, ajustando o tamanho para respeitar o limite de palavras.`
            : `  - Use alguns parágrafos curtos para fechar o assunto de forma clara.`
        }

- Bloco CONTENT (3º título) em REC:
  - content_block_tag: tag curta ligada ao tema.
  - content_block_title: título chamativo e direto sobre o tema.
  - content_block_summary: 1 frase curta explicando por que esse bloco é relevante para quem se interessa pelo tema.
  - content_block_cta_label: CTA curto (até 4 palavras), específico do tema.
  - content_block_warning: aviso curto consistente com o tema.
`.trim();

    const fullRules = `
FULLREVIEW:

- Objetivo:
  - Ensinar como fazer algo ligado ao tema, com passo a passo prático.

- Título (h1):
  - Deve ser um título equivalente ao topic, no idioma indicado em "language", mantendo o MESMO assunto.

- Introdução:
  - intro_html: 1 parágrafo apresentando o que a pessoa vai aprender e por que isso é útil.

${hasLimit
            ? `- Corpo (quando existe limite de palavras):
  - Use seções e parágrafos de forma FLEXÍVEL.
  - A quantidade de seções e o número de parágrafos por seção NÃO são fixos.
  - Você pode ajustar qualquer coisa na estrutura para caber no limite de palavras (inclusive encurtar ou resumir partes do passo a passo).`
            : `- Corpo (sem limite de palavras definido):
  - Use várias seções para organizar o conteúdo.
  - Em geral, use 2 parágrafos por seção, mas você pode ajustar se fizer sentido.`
        }

- Dentro do body_html (FULLREVIEW):
  - Use exatamente 1 lista (ul ou ol).
  - Use exatamente 1 tabela de comparação (<table>).
  - Coloque lista e tabela em seções diferentes, sem repetir.

${fullWordRule}

- Passo a passo (FULLREVIEW):
  - steps_title deve seguir a regra dos títulos fixos por idioma descrita nas regras gerais.
  - steps_html deve ser uma lista numerada de 7 a 10 passos, com frases curtas e práticas.

- FAQ (FULLREVIEW):
  - faq_title deve seguir a regra dos títulos fixos por idioma descrita nas regras gerais.
  - Crie exatamente 7 perguntas.
  - Cada answer_html deve ter 1 frase curta (cerca de 6 palavras, máximo 12).

- Conclusão (FULLREVIEW):
  - conclusion_title deve seguir a regra dos títulos fixos por idioma descrita nas regras gerais.
${hasLimit
            ? `  - Use 1 ou 2 parágrafos curtos, respeitando o limite total de palavras.`
            : `  - Use alguns parágrafos curtos para fechar o assunto de forma clara.`
        }

- Bloco CONTENT (3º título) em FULLREVIEW:
  - Siga as mesmas regras do REC.
  - Todos os textos do bloco devem estar no mesmo idioma indicado em "language" e ligados diretamente ao tema.
`.trim();

    const typeSpecific = articleType === "REC" ? recRules : fullRules;

    return `
Você é uma IA que escreve textos editoriais de alta qualidade para blogs de finanças, games, benefícios e temas relacionados.

O sistema cliente apenas envia:
- o tema (topic),
- o código do idioma (language),
- o tipo de texto (REC ou FULLREVIEW),
- e, opcionalmente, um limite máximo de palavras.

VOCÊ é totalmente responsável por:
- Respeitar o tema EXATO informado (sem trocar por outro assunto, nem generalizar).
- Escrever todo o conteúdo no idioma especificado em "language".
- Respeitar o limite máximo de palavras, quando fornecido.
- Ajustar livremente a estrutura (quantidade de títulos, parágrafos, tamanho de seções, tamanho das respostas de FAQ e da conclusão) para cumprir o limite de palavras.
- Preencher corretamente todos os campos do JSON.

Regras sobre limite de palavras:
- Quando o usuário informar uma quantidade de palavras:
  - Esse valor é o limite máximo absoluto.
  - Qualquer instrução de quantidade exata de parágrafos ou títulos é apenas uma referência, NÃO uma obrigação.
  - Se precisar escolher entre manter uma estrutura fixa ou respeitar o limite, SEMPRE respeite o limite de palavras.
- Quando não houver quantidade de palavras definida:
  - Use uma estrutura natural para o tipo de texto (REC ou FULLREVIEW), sem exagero no tamanho.

Sua resposta DEVE ser SEMPRE um JSON VÁLIDO, seguindo EXATAMENTE o schema abaixo.
NUNCA escreva nada fora do JSON.
NÃO explique as regras; apenas aplique.

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

    // fallback de aviso, se vier vazio (isso é só pra não quebrar UX; GPT continua responsável pelo principal)
    if (!warning || !warning.trim()) {
        if (topic && topic.toLowerCase().includes("robux")) {
            warning = "Informações sujeitas às regras da plataforma.";
        } else if (topic && topic.toLowerCase().includes("shein")) {
            warning = "Conteúdo sujeito às políticas da plataforma.";
        } else {
            warning = "Conteúdo sujeito a mudanças.";
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
        article.content_block_warning || "Conteúdo sujeito a mudanças.";

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

    const faqTitle =
        (article.faq_title && article.faq_title.trim()) || "";
    const conclusionTitle =
        (article.conclusion_title && article.conclusion_title.trim()) || "";
    const stepsTitle =
        (article.steps_title && article.steps_title.trim()) || "";

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
            let faqHtml = "";
            if (faqTitle) {
                faqHtml += `<h2>${faqTitle}</h2>`;
            }
            article.faq.forEach((item) => {
                if (!item) return;
                if (item.question) faqHtml += `<p><strong>${item.question}</strong></p>`;
                if (item.answer_html) faqHtml += item.answer_html;
            });
            parts.push(htmlToBlocks(faqHtml));
        }

        if (article.conclusion_html) {
            const conclHtml =
                (conclusionTitle ? `<h2>${conclusionTitle}</h2>` : "") +
                article.conclusion_html;
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
        const stepsHtml =
            (stepsTitle ? `<h2>${stepsTitle}</h2>` : "") +
            article.steps_html;
        parts.push(htmlToBlocks(stepsHtml));
    }

    if (Array.isArray(article.faq) && article.faq.length > 0) {
        let faqHtml = "";
        if (faqTitle) {
            faqHtml += `<h2>${faqTitle}</h2>`;
        }
        article.faq.forEach((item) => {
            if (!item) return;
            if (item.question) faqHtml += `<p><strong>${item.question}</strong></p>`;
            if (item.answer_html) faqHtml += item.answer_html;
        });
        parts.push(htmlToBlocks(faqHtml));
    }

    if (article.conclusion_html) {
        const conclHtml =
            (conclusionTitle ? `<h2>${conclusionTitle}</h2>` : "") +
            article.conclusion_html;
        parts.push(htmlToBlocks(conclHtml));
    }

    return parts.join("\n\n");
}

// ===== Preview HTML =====
function buildPreviewHtmlFromArticle(article) {
    if (!article) return "";
    const type = article.type;
    const parts = [];

    const faqTitle =
        (article.faq_title && article.faq_title.trim()) || "";
    const conclusionTitle =
        (article.conclusion_title && article.conclusion_title.trim()) || "";

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
        let faqHtml = "";
        if (faqTitle) {
            faqHtml += `<h2>${faqTitle}</h2>`;
        }
        article.faq.forEach((item) => {
            if (!item) return;
            if (item.question) faqHtml += `<p><strong>${item.question}</strong></p>`;
            if (item.answer_html) faqHtml += item.answer_html;
        });
        parts.push(faqHtml);
    }

    if (article.conclusion_html) {
        const conclHtml =
            (conclusionTitle ? `<h2>${conclusionTitle}</h2>` : "") +
            article.conclusion_html;
        parts.push(conclHtml);
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
});

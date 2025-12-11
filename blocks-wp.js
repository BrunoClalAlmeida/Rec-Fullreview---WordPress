//blocks-wp.js esse codigo pertence
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
                    `${node.outerHTML}`
                );
                return;
            }

            if (tag === "p") {
                blocks.push(
                    `${node.outerHTML}`
                );
                return;
            }

            if (tag === "ul" || tag === "ol") {
                blocks.push(`${node.outerHTML}`);
                return;
            }

            if (tag === "table") {
                blocks.push(`${node.outerHTML}`);
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
                `<p>${text}</p>`
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

    return ``;
}

// ===== CTA do 7º título (ou último / fim do body) =====
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

    return ``;
}

function injectSeventhHeadingCta(blocks, article) {
    const label = buildSectionCtaLabel(article);
    if (!label) return blocks;

    const ctaBlock = "\n" + buildMiddleSectionCtaBlock(label) + "\n";

    const markerH2 = "";
    const paraEndMarker = "";

    // Se tiver H2: usa o último (ou o 7º, se tiver 7+)
    if (h2Positions.length > 0) {
        const targetPos =
            h2Positions.length >= 7 ? h2Positions[6] : h2Positions[h2Positions.length - 1];

        const firstParaStart = blocks.indexOf(paraStartMarker, targetPos);
        if (firstParaStart === -1) return blocks;

        const firstParaEnd = blocks.indexOf(paraEndMarker, firstParaStart);
        if (firstParaEnd === -1) return blocks;

        const insertPos = firstParaEnd + paraEndMarker.length;
        return blocks.slice(0, insertPos) + ctaBlock + blocks.slice(insertPos);
    }

    // Se NÃO tiver H2 nenhum: injeta depois do último parágrafo do body_html
    let lastParaStart = blocks.lastIndexOf(paraStartMarker);
    if (lastParaStart === -1) {
        // Se nem parágrafo achar, joga o CTA no final mesmo
        return blocks + ctaBlock;
    }

    const lastParaEnd = blocks.indexOf(paraEndMarker, lastParaStart);
    if (lastParaEnd === -1) {
        return blocks + ctaBlock;
    }

    const insertPos = lastParaEnd + paraEndMarker.length;
    return blocks.slice(0, insertPos) + ctaBlock + blocks.slice(insertPos);
}

function injectPreviewSeventhCtaIntoBodyHtml(bodyHtml, article) {
    if (!bodyHtml) return bodyHtml;

    const label = buildSectionCtaLabel(article);
    if (!label) return bodyHtml;

    const wrapper = document.createElement("div");
    wrapper.innerHTML = bodyHtml;

    const headings = wrapper.querySelectorAll("h2");
    let firstPara = null;

    if (headings.length > 0) {
        // Usa o 7º h2 se existir, senão o último h2
        const targetHeading =
            headings.length >= 7 ? headings[6] : headings[headings.length - 1];

        let node = targetHeading.nextSibling;
        while (node) {
            if (node.nodeType === 1 && node.tagName.toLowerCase() === "p") {
                firstPara = node;
                break;
            }
            node = node.nextSibling;
        }
    } else {
        // Sem h2: pega o último parágrafo do body_html
        const allParas = wrapper.querySelectorAll("p");
        if (allParas.length > 0) {
            firstPara = allParas[allParas.length - 1];
        }
    }

    const ctaEl = document.createElement("p");
    ctaEl.className = "section-cta-preview";
    ctaEl.textContent = label;

    if (firstPara && firstPara.parentNode) {
        firstPara.parentNode.insertBefore(ctaEl, firstPara.nextSibling);
    } else {
        // fallback: adiciona no final do body
        wrapper.appendChild(ctaEl);
    }

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

    // fallback de aviso
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

    return ``;
}

function injectThirdHeadingContentBlock(blocks, article) {
    const contentBlock = buildContentAcfBlock(article);
    if (!contentBlock) return blocks;

    const markerH2 = "";
    const paraEndMarker = "";

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

    // Título Visual no Preview
    const titlePreview = article.h1 || article.topic || "";
    if (titlePreview) {
        parts.push(`<h1 style="margin-bottom: 10px;">${titlePreview}</h1>`);
        parts.push(`<hr style="margin-bottom: 20px; border: 0; border-top: 1px solid #ccc;">`);
    }

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
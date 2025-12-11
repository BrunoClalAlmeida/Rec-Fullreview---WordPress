//article-schema.js esse codigo pertence
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
// Tudo que "educa" o GPT está aqui, em TEXTO. JS não traduz, não escolhe título, não inventa conteúdo.
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
  - **Ao gerar textos maiores, como 1000 ou 1500 ou mais palavras, adicione mais títulos (h2) e subtítulos para distribuir o conteúdo de forma equilibrada e atingir a contagem de palavras.**`
    : `- Limite de palavras:
  - O usuário não definiu um número exato de palavras.
  - Escreva um texto completo, natural e equilibrado, sem exagerar no volume.`;

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
    - Exatamente 1 tabela de comparação.
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
  - Deve ser um CTA curto, em MAIÚSCULAS, com até 6 palavras, diretamente ligado ao tema e no mesmo idioma do campo "language".`.trim();

  const recRules = `
REC:

- Objetivo:
  - Explicar o tema de forma clara e completa, sem passo a passo detalhado.

- Título (h1):
  - Deve ser um título equivalente ao topic, no idioma indicado em "language", mantendo o MESMO assunto.

- Subtítulo e introdução:
  - subtitle_html:
    - 1 bloco curto apresentando o tema.
    - Use até 3 linhas/frases curtas (no máximo).
    - Não exagere no tamanho para não consumir muitas palavras do limite.
  - intro_html:
    - 1 parágrafo com contexto e motivação.

${hasLimit
      ? `- Corpo (quando existe limite de palavras):
  - Use subtítulos com <h2> e parágrafos de forma FLEXÍVEL.
  - A quantidade de subtítulos (h2) e o número de parágrafos por subtítulo NÃO são fixos.
  - Você pode ajustar qualquer coisa na estrutura (número de H2, quantidade de parágrafos, tamanho das respostas de FAQ, conclusão mais curta, etc.) para caber dentro do limite de palavras.`
      : `- Corpo (sem limite de palavras definido):
  - Use vários subtítulos com <h2> para organizar o conteúdo.
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
  - Use seções com <h2>/<h3> e parágrafos de forma FLEXÍVEL.
  - A quantidade de seções e o número de parágrafos por seção NÃO são fixos.
  - Você pode ajustar qualquer coisa na estrutura para caber no limite de palavras (inclusive encurtar ou resumir partes do passo a passo).`
      : `- Corpo (sem limite de palavras definido):
  - Use várias seções com <h2>/<h3> para organizar o conteúdo.
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
  - Se o texto ficar abaixo do limite de palavras, acrescente mais conteúdo relevante e adicione subtítulos (h2), se necessário.

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


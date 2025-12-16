//article-schema.js
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

      // ✅ BLOCO (3º título) - FULL também tem bloco e PRECISA link
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

    // ✅ BLOCO (3º título) - REC também tem bloco
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

  // Lógica de texto para meta de palavras (Target) - SEM CÁLCULOS JS
  const wordLimitGeneral = hasLimit
    ? `
- CONTROLE DE QUANTIDADE (Instrução de Ouro):
  - O usuário definiu um ALVO de aproximadamente ${resolvedApprox} palavras.
  - Este número (${resolvedApprox}) é o CENTRO do seu alvo.
  - Variação permitida: Você pode escrever um pouco a mais ou um pouco a menos para manter a qualidade (margem de ~10%).
  - PROIBIÇÃO DE EXCESSO: Não extrapole absurdamente. Exemplo: Se o pedido é 1500, NÃO escreva 2500. Mantenha-se perto de 1500.
  - PROIBIÇÃO DE ESCASSEZ: Não escreva muito menos. Exemplo: Se o pedido é 1500, NÃO escreva 800.
  - SEU JULGAMENTO: Se o texto estiver ficando muito longo, RESUMA os pontos menos importantes. Se estiver curto, EXPANDA as explicações.`
    : `- Limite de palavras:
  - O usuário não definiu um número exato de palavras.
  - Escreva um texto completo, natural e equilibrado, sem exagerar no volume.`;

  const recWordRule = hasLimit
    ? `
- Tamanho (REC):
  - Trabalhe para atingir o alvo de ${resolvedApprox} palavras.
  - Adicione ou remova subtítulos (H2) conforme necessário para ajustar o tamanho.
  - Monitore o tamanho enquanto escreve: se já explicou tudo e ainda falta muito para ${resolvedApprox}, crie uma seção de "Curiosidades" ou "Dicas Extras". Se já escreveu muito, pare.`
    : `
- Tamanho (REC):
  - Não há limite fixo. Escreva um texto completo e equilibrado.`;

  const fullWordRule = hasLimit
    ? `
- Tamanho (FULLREVIEW):
  - Trabalhe para atingir o alvo de ${resolvedApprox} palavras.
  - Ajuste o nível de detalhe do passo a passo.
  - Para textos pedidos como LONGOS (ex: 1500+), detalhe cada clique.
  - Para textos pedidos como CURTOS, seja direto.
  - NÃO ultrapasse excessivamente o alvo.`
    : `
- Tamanho (FULLREVIEW):
  - Não há limite fixo. Escreva um texto completo, explicando o processo de forma clara e objetiva.`;

  const baseRules = `
Regras gerais (valem para REC e FULLREVIEW):

- Idioma:
  - Escreva TODO o conteúdo no idioma especificado pelo campo "language" do JSON final (por exemplo: "pt-BR", "en-US", "es-ES").
  - Títulos, parágrafos, listas, tabelas, CTAs, FAQ, avisos e qualquer outro texto devem estar nesse mesmo idioma.
  - Se o topic vier em outro idioma, adapte o texto para o idioma indicado em "language", mantendo o mesmo assunto.

- REGRA CRÍTICA (ANTI-VAZAMENTO DE IDIOMA DO TOPIC):
  - Se o topic original estiver em um idioma diferente do campo "language", você DEVE traduzir o topic para o idioma de "language" e usar SOMENTE a versão traduzida no texto.
  - É PROIBIDO manter palavras, expressões ou trechos do topic no idioma original dentro do conteúdo final.
  - Isso vale para TODOS os campos: h1, subtitle_html, intro_html, body_html, steps_html, FAQ, conclusion_html, section_cta_label e TODOS os content_block_*.
  - Se perceber que incluiu qualquer palavra fora do idioma de "language", reescreva a frase inteira no idioma correto.

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

- Introdução e Subtítulo (SIMETRIA VISUAL OBRIGATÓRIA):
  - ATENÇÃO AO LAYOUT: Existe uma lista de CTAs posicionada EXATAMENTE entre o subtitle_html (acima) e o intro_html (abaixo).
  - REGRA DE OURO: O parágrafo acima dos botões (subtitle_html) deve ter VISUALMENTE o mesmo tamanho do parágrafo abaixo dos botões (intro_html).
  - INSTRUÇÃO: Escreva ambos com aproximadamente a mesma quantidade de palavras (sugestão: 40 a 50 palavras cada, cerca de 3 a 4 frases).
  - Não faça um curto e o outro longo. Eles devem parecer blocos gêmeos em tamanho.

${hasLimit
      ? `- Corpo (com instrução de quantidade):
  - Use subtítulos com <h2> e parágrafos de forma FLEXÍVEL.
  - Se a meta de palavras for alta (${resolvedApprox}), crie VÁRIOS tópicos (H2).
  - Se a meta for baixa, seja conciso.`
      : `- Corpo (sem limite definido):
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
  - Use parágrafos suficientes para um fechamento de qualidade.

- Bloco CONTENT (3º título) em REC:
  - content_block_tag: tag curta ligada ao tema.
  - content_block_title: título chamativo e direto sobre o tema.
  - content_block_summary: 1 frase curta explicando por que esse bloco é relevante para quem se interessa pelo tema.
  - content_block_cta_label: CTA curto (até 4 palavras), específico do tema.
  - content_block_cta_link:
    - Pode ser deixado vazio no REC, pois o sistema pode injetar links das FULLs automaticamente.
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
      ? `- Corpo (com instrução de quantidade):
  - Use seções com <h2>/<h3> e parágrafos de forma FLEXÍVEL.
  - Se a meta de palavras for alta (${resolvedApprox}), adicione introdução teórica antes do passo a passo.`
      : `- Corpo (sem limite definido):
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
  - steps_html deve ser uma lista numerada de 7 a 10 passos.

- FAQ (FULLREVIEW):
  - faq_title deve seguir a regra dos títulos fixos por idioma descrita nas regras gerais.
  - Crie exatamente 7 perguntas.
  - Cada answer_html deve ter 1 frase curta (cerca de 6 palavras, máximo 12).

- Conclusão (FULLREVIEW):
  - conclusion_title deve seguir a regra dos títulos fixos por idioma descrita nas regras gerais.
  - Use parágrafos suficientes para um fechamento de qualidade.

- Bloco CONTENT (3º título) em FULLREVIEW:
  - Siga as mesmas regras do REC.

- LINK OFICIAL (OBRIGATÓRIO NA FULLREVIEW):
  - O campo content_block_cta_link deve conter o LINK DO SITE OFICIAL do serviço/plataforma/marca citada no topic.
  - Deve ser uma URL completa começando com "https://".
  - Não use links de terceiros, encurtadores ou afiliados.
  - Não adicione parâmetros de tracking (utm, ref, etc.).
  - Exemplo: se o tema for Roblox, use o site oficial do Roblox; se for Shein, use o site oficial da Shein.
`.trim();

  const typeSpecific = articleType === "REC" ? recRules : fullRules;

  return `
Você é uma IA redatora experiente.

O sistema cliente envia:
- Idioma: ${languageCode}
- Tipo: ${articleType}
${hasLimit ? `- ALVO DE PALAVRAS (TARGET): ${resolvedApprox} palavras.` : ""}

VOCÊ é totalmente responsável por:
1. Respeitar o tema EXATO informado.
2. Escrever todo o conteúdo no idioma especificado.
3. **CALIBRAR A QUANTIDADE DE PALAVRAS**:
   - O número ${resolvedApprox} é o seu CENTRO.
   - Variação aceitável de ~10%. NÃO extrapole (nem muito mais, nem muito menos).
4. **MANTER A SIMETRIA VISUAL (apenas REC)**:
   - Os parágrafos acima (subtitle) e abaixo (intro) dos CTAs devem ter o mesmo tamanho visual (aprox. 40-50 palavras cada).

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


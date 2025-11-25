/**
 * OpenAI API Helper
 * Funções para integração com a API do OpenAI
 */

import { generateCacheKey, withCache } from './ai-cache';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.EXPO_PUBLIC_OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// Cache TTL constants (in seconds)
const CACHE_TTL = {
    RECIPE: 30 * 24 * 60 * 60, // 30 days
    INSIGHT: 7 * 24 * 60 * 60, // 7 days
    MEAL_IMAGE: null, // Permanent (no expiration)
    MEAL_PLAN: 30 * 24 * 60 * 60, // 30 days
    DIET_PLAN: 30 * 24 * 60 * 60, // 30 days
    PANTRY_IMAGE: null, // Permanent
};

// ... existing interfaces ...

/**
 * Gera insights de progresso de peso
 * Com cache de 7 dias (weight data changes frequently)
 */
export async function generateGoalInsights(profile: any, weightHistory: any[], userId: string): Promise<any> {
    console.log('Generating Goal Insights for user:', userId);
    console.log('Weight History Length:', weightHistory.length);
    if (!profile || weightHistory.length === 0) return null;

    const currentWeight = weightHistory[0].weight;
    const startWeight = weightHistory[weightHistory.length - 1].weight;
    const targetWeight = parseFloat(profile.target_weight);
    const goal = profile.goal || (targetWeight < startWeight ? 'lose_weight' : 'gain_muscle');

    // Get last 3 entries for trend context
    const recentHistory = weightHistory.slice(0, 3).map(h => ({
        weight: h.weight,
        date: h.date,
        notes: h.notes
    }));

    // Gera chave de cache
    const cacheKey = await generateCacheKey('insight', {
        goal,
        startWeight,
        currentWeight,
        targetWeight,
        recentHistory,
    });

    // Usa cache wrapper
    const result = await withCache(
        cacheKey,
        userId,
        'insight',
        { profile, weightHistory },
        async () => {
            const systemPrompt = `Atue como um nutricionista e coach fitness especialista e motivador do app FitBody AI.
Analise o progresso do usuário e forneça um insight curto, direto e personalizado.
Sempre retorne um JSON válido.`;

            const userPrompt = `
    DADOS DO USUÁRIO:
    - Meta: ${goal === 'lose_weight' ? 'Perder Peso' : 'Ganhar Massa Muscular/Peso'}
    - Peso Inicial: ${startWeight}kg
    - Peso Atual: ${currentWeight}kg
    - Peso Meta: ${targetWeight}kg
    - Histórico Recente (do mais novo para o antigo): ${JSON.stringify(recentHistory)}
    
    INSTRUÇÕES AVANÇADAS DE ANÁLISE:
    1. **Analise a Tendência e Qualidade:** Não olhe apenas o número. Se o usuário ganhou peso mas disse "gordura" ou "sujo", isso é um alerta. Se perdeu peso dizendo "perdi gordura" ou "sequei", isso é progresso, mesmo que a meta seja ganhar peso (pois está limpando o shape).
    2. **Contexto Temporal:** Se o usuário bateu o peso meta antes (ex: 90kg) mas com qualidade ruim, e agora baixou (ex: 89kg) perdendo gordura, ELOGIE a decisão de limpar o shape. O conselho deve ser: "Ótimo ajuste! Perdeu gordura para crescer limpo agora."
    3. **O termo "Sheipado":** Se a meta é ganhar massa, o objetivo final é chegar no peso com definição ("sheipado"). Incentive a troca de gordura por músculo.

    REGRAS DE NEGÓCIO:
    - Ganhar Músculo: Subir peso limpo é Verde. Subir com gordura é Amarelo/Laranja. Descer peso perdendo gordura é Verde (ajuste estratégico). Descer perdendo músculo é Vermelho.
    - Perder Peso: Descer é Verde. Subir é Vermelho (salvo se for ganho óbvio de massa magra).

    RETORNE APENAS UM JSON com o seguinte formato:
    {
        "emoji": "emoji relevante (ex: 💪, 📉, 🥩, ⚠️)",
        "title": "Título curto (max 25 chars)",
        "message": "Mensagem motivacional ou alerta (max 140 chars). Seja específico sobre o contexto das notas (ex: 'Você ajustou bem ao perder aquela gordura...').",
        "color": "código hex da cor do texto",
        "bgColor": "código hex do fundo",
        "borderColor": "código hex da borda"
    }
    
    Cores sugeridas (Tailwind):
    - Verde (Bom/Estratégico): text=#16a34a, bg=#dcfce7, border=#86efac
    - Vermelho (Ruim): text=#dc2626, bg=#fee2e2, border=#fca5a5
    - Amarelo/Laranja (Alerta/Atenção): text=#d97706, bg=#fef3c7, border=#fcd34d
    - Dourado (Celebração): text=#ca8a04, bg=#fef9c3, border=#fde047
    `;

            const response = await callOpenAI({
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                temperature: 0.7,
                max_tokens: 300,
            });

            try {
                const jsonMatch = response.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    return JSON.parse(jsonMatch[0]);
                }
                return JSON.parse(response);
            } catch (error) {
                console.error('Erro ao parsear insights:', error);
                return null;
            }
        },
        CACHE_TTL.INSIGHT
    );

    return result.data;
}

/**
 * Chat genérico com o assistente
 */
export async function chatWithAssistant(messages: { role: string; content: string }[]): Promise<string> {
    const systemPrompt = `Você é o FitBody AI, um assistente pessoal de fitness e nutrição altamente motivador e conhecedor.
    Seu objetivo é ajudar o usuário a atingir seus objetivos de saúde, respondendo dúvidas sobre dieta, treino, receitas e nutrição.
    Seja conciso, amigável e use emojis ocasionalmente.
    Responda sempre em português do Brasil.`;

    const response = await callOpenAI({
        messages: [
            { role: 'system', content: systemPrompt },
            ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
        ],
        temperature: 0.7,
        max_tokens: 500,
    });

    return response;
}

/**
 * Transcreve áudio usando OpenAI Whisper
 */
export async function transcribeAudio(uri: string): Promise<string> {
    if (!OPENAI_API_KEY) {
        throw new Error('OpenAI API key not configured');
    }

    try {
        const formData = new FormData();
        formData.append('file', {
            uri,
            name: 'audio.m4a',
            type: 'audio/m4a',
        } as any);
        formData.append('model', 'whisper-1');
        formData.append('language', 'pt');

        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                // Content-Type is handled automatically by FormData
            },
            body: formData,
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Whisper API error:', response.status, errorText);
            throw new Error(`Whisper API error: ${response.status}`);
        }

        const data = await response.json();
        return data.text;
    } catch (error) {
        console.error('Error transcribing audio:', error);
        throw error;
    }
}

/**
 * Retry a function with exponential backoff
 */
async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    initialDelay: number = 1000
): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error: any) {
            lastError = error;

            // Don't retry on certain errors
            if (error.message?.includes('JSON Parse') || error.message?.includes('Invalid')) {
                throw error;
            }

            // If it's the last attempt, throw
            if (attempt === maxRetries - 1) {
                throw error;
            }

            // Wait with exponential backoff
            const delay = initialDelay * Math.pow(2, attempt);
            console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw lastError || new Error('Max retries exceeded');
}

interface OpenAIMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

interface OpenAIRequest {
    model?: string;
    messages: OpenAIMessage[];
    temperature?: number;
    max_tokens?: number;
    response_format?: { type: 'text' | 'json_object' };
}

interface OpenAIResponse {
    choices: Array<{
        message: {
            content: string;
        };
    }>;
}

/**
 * Faz uma chamada à API do OpenAI
 */
export async function callOpenAI(request: OpenAIRequest): Promise<string> {
    if (!OPENAI_API_KEY) {
        throw new Error('OpenAI API key not configured');
    }

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
                model: request.model || 'gpt-4o-mini',
                messages: request.messages,
                temperature: request.temperature ?? 0.7,
                max_tokens: request.max_tokens ?? 2000,
                ...(request.response_format && { response_format: request.response_format }),
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('OpenAI API error:', response.status, errorText);

            if (response.status === 429) {
                throw new Error('Rate limit exceeded. Please try again in a moment.');
            } else if (response.status === 401) {
                throw new Error('Invalid API key');
            } else if (response.status >= 500) {
                throw new Error('OpenAI service temporarily unavailable');
            }

            throw new Error(`OpenAI API error: ${response.status}`);
        }

        const data = await response.json();

        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new Error('Invalid response format from OpenAI');
        }

        const content = data.choices[0].message.content;

        // Check if response is HTML (error page)
        if (content.trim().startsWith('<')) {
            console.error('Received HTML instead of JSON:', content.substring(0, 200));
            throw new Error('Received invalid response format (HTML)');
        }

        return content;
    } catch (error: any) {
        if (error.message?.includes('Network request failed')) {
            throw new Error('Network error. Please check your internet connection.');
        }
        throw error;
    }
}

/**
 * Gera receitas fitness baseadas em ingredientes e perfil do usuário
 * Com cache para evitar chamadas desnecessárias à API
 */
export async function generateRecipes(params: {
    ingredients: string[];
    goal: string;
    targetCalories: number;
    macros: { protein: number; carbs: number; fat: number };
    // Novos parâmetros do perfil
    dietaryRestrictions?: string[];
    allergies?: string[];
    flavorPreferences?: string[];
    cookingTime?: number;
    availableEquipment?: string[];
    budgetLevel?: string;
    mealType?: string;
    userId: string; // Required for caching
}): Promise<any> {
    // Gera chave de cache
    const cacheKey = await generateCacheKey('recipe', {
        ingredients: params.ingredients.sort(), // Sort for consistency
        goal: params.goal,
        targetCalories: params.targetCalories,
        macros: params.macros,
        dietaryRestrictions: params.dietaryRestrictions?.sort(),
        allergies: params.allergies?.sort(),
        flavorPreferences: params.flavorPreferences?.sort(),
        cookingTime: params.cookingTime,
        availableEquipment: params.availableEquipment?.sort(),
        budgetLevel: params.budgetLevel,
        mealType: params.mealType,
    });

    // Usa cache wrapper
    const result = await withCache(
        cacheKey,
        params.userId,
        'recipe',
        params,
        async () => {
            // Função original de geração
            const systemPrompt = `Você é um nutricionista especializado em fitness e receitas saudáveis.
Sua tarefa é criar receitas fitness personalizadas baseadas nos ingredientes disponíveis e nas metas nutricionais do usuário.
IMPORTANTE: Sempre respeite as restrições alimentares, alergias e preferências do usuário.
Sempre retorne as receitas em formato JSON válido.`;

            // Build dietary constraints
            const constraints = [];
            if (params.dietaryRestrictions?.length) {
                constraints.push(`Restrições alimentares: ${params.dietaryRestrictions.join(', ')}`);
            }
            if (params.allergies?.length) {
                constraints.push(`ALERGIAS (NUNCA use): ${params.allergies.join(', ')}`);
            }
            if (params.flavorPreferences?.length) {
                constraints.push(`Preferências de sabor: ${params.flavorPreferences.join(', ')}`);
            }
            if (params.availableEquipment?.length) {
                constraints.push(`Equipamentos disponíveis: ${params.availableEquipment.join(', ')}`);
            }
            if (params.cookingTime) {
                constraints.push(`Tempo máximo de preparo: ${params.cookingTime} minutos`);
            }
            if (params.budgetLevel) {
                const budgetDesc = {
                    low: 'ingredientes econômicos',
                    moderate: 'ingredientes de custo moderado',
                    high: 'ingredientes premium permitidos'
                };
                constraints.push(`Orçamento: ${budgetDesc[params.budgetLevel as keyof typeof budgetDesc]}`);
            }

            const userPrompt = `Crie 3 receitas fitness usando os seguintes ingredientes: ${params.ingredients.join(', ')}.

Informações do usuário:
- Objetivo: ${params.goal}
- Calorias alvo por refeição: ~${Math.round(params.targetCalories / 4)} kcal
- Macros alvo: ${params.macros.protein}g proteína, ${params.macros.carbs}g carboidratos, ${params.macros.fat}g gorduras
${params.mealType ? `- Tipo de refeição: ${params.mealType}` : ''}
${constraints.length ? `\n${constraints.join('\n')}` : ''}

Para cada receita, retorne um JSON com:
{
  "name": "Nome da receita",
  "description": "Breve descrição",
  "prepTime": tempo em minutos,
  "ingredients": [
    { "name": "ingrediente", "quantity": "quantidade", "unit": "unidade" }
  ],
  "instructions": ["passo 1", "passo 2", ...],
  "nutrition": {
    "calories": número,
    "protein": número,
    "carbs": número,
    "fat": número
  },
  "tips": ["dica 1", "dica 2"]
}

Retorne um array JSON com as 3 receitas.`;

            const response = await callOpenAI({
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                temperature: 0.8,
                max_tokens: 2000,
            });

            try {
                // Tenta extrair JSON da resposta
                const jsonMatch = response.match(/\[[\s\S]*\]/);
                if (jsonMatch) {
                    return JSON.parse(jsonMatch[0]);
                }
                return JSON.parse(response);
            } catch (error) {
                console.error('Erro ao parsear resposta da OpenAI:', error);
                throw new Error('Erro ao processar receitas geradas');
            }
        },
        CACHE_TTL.RECIPE
    );

    return result.data;
}

/**
 * Gera um plano alimentar semanal
 * Com cache de 30 dias
 */
export async function generateMealPlan(params: {
    days: number;
    mealsPerDay: number;
    targetCalories: number;
    macros: { protein: number; carbs: number; fat: number };
    goal: string;
    restrictions?: string[];
    userId: string; // Required for caching
}): Promise<any> {
    // Gera chave de cache
    const cacheKey = await generateCacheKey('meal_plan', {
        days: params.days,
        mealsPerDay: params.mealsPerDay,
        targetCalories: params.targetCalories,
        macros: params.macros,
        goal: params.goal,
        restrictions: params.restrictions?.sort(),
    });

    // Usa cache wrapper
    const result = await withCache(
        cacheKey,
        params.userId,
        'meal_plan',
        params,
        async () => {
            const systemPrompt = `Você é um nutricionista especializado em planejamento alimentar para fitness.
Crie planos alimentares balanceados e personalizados baseados nas metas do usuário.
Sempre retorne em formato JSON válido.`;

            const userPrompt = `Crie um plano alimentar de ${params.days} dias com ${params.mealsPerDay} refeições por dia.

Informações:
- Objetivo: ${params.goal}
- Calorias diárias: ${params.targetCalories} kcal
- Macros diários: ${params.macros.protein}g proteína, ${params.macros.carbs}g carboidratos, ${params.macros.fat}g gorduras
${params.restrictions?.length ? `- Restrições: ${params.restrictions.join(', ')}` : ''}

Retorne um JSON com a estrutura:
{
  "days": [
    {
      "day": 1,
      "meals": [
        {
          "name": "Café da Manhã",
          "time": "08:00",
          "foods": [
            { "name": "alimento", "quantity": "quantidade", "unit": "unidade" }
          ],
          "nutrition": { "calories": número, "protein": número, "carbs": número, "fat": número }
        }
      ]
    }
  ]
}`;

            const response = await callOpenAI({
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                temperature: 0.7,
                max_tokens: 3000,
            });

            try {
                const jsonMatch = response.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    return JSON.parse(jsonMatch[0]);
                }
                return JSON.parse(response);
            } catch (error) {
                console.error('Erro ao parsear plano alimentar:', error);
                throw new Error('Erro ao processar plano alimentar');
            }
        },
        CACHE_TTL.MEAL_PLAN
    );

    return result.data;
}

/**
 * Detecta ingredientes em uma descrição de texto
 */
export async function detectIngredients(text: string): Promise<string[]> {
    const systemPrompt = `Você é um assistente que identifica ingredientes alimentares em textos.
Retorne apenas uma lista JSON de ingredientes, sem explicações.`;

    const userPrompt = `Identifique todos os ingredientes alimentares neste texto: "${text}"
Retorne apenas um array JSON com os nomes dos ingredientes em português, exemplo: ["frango", "arroz", "tomate"]`;

    const response = await callOpenAI({
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 500,
    });

    try {
        const jsonMatch = response.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        return JSON.parse(response);
    } catch (error) {
        console.error('Erro ao parsear ingredientes:', error);
        return [];
    }
}

/**
 * Analisa uma imagem de refeição para estimar calorias e macros
 * Com cache permanente (mesma imagem = mesma análise)
 */
export async function analyzeMealImage(base64Image: string, userId: string): Promise<any> {
    // Gera chave de cache baseada no hash da imagem
    const cacheKey = await generateCacheKey('meal_image', { imageHash: base64Image.substring(0, 100) });

    // Usa cache wrapper (sem TTL = permanente)
    const result = await withCache(
        cacheKey,
        userId,
        'meal_image',
        { imagePreview: base64Image }, // Store full image for admin dashboard
        async () => {
            const systemPrompt = `Você é um nutricionista brasileiro especialista em análise visual de pratos e estimativa de porções.
Sua tarefa é analisar fotos de refeições e fornecer estimativas PRECISAS de peso e valores nutricionais.
Use referências visuais comuns (tamanho do prato, talheres, mãos) para estimar porções.
Sempre retorne um JSON válido.`;

            const userPrompt = `Analise esta foto de comida e retorne um JSON DETALHADO com:

CONTEXTO DE PORÇÕES PADRÃO BRASILEIRAS (use como referência):
- 1 concha de arroz = 100g
- 1 concha de feijão = 80g  
- 1 filé de frango (peito) = 120-150g
- 1 bife médio = 100-120g
- 1 ovo = 50g
- 1 batata média = 150g
- 1 colher de sopa de azeite = 10ml
- 1 pão francês = 50g
- 1 fatia de queijo = 20g

INSTRUÇÕES:
1. Identifique CADA componente visível no prato
2. Estime o PESO EM GRAMAS de cada componente usando referências visuais
3. Calcule calorias e macros baseado nos pesos estimados
4. Seja conservador nas estimativas (melhor subestimar que superestimar)

RETORNE JSON:
{
    "name": "Nome do prato completo",
    "description": "Descrição breve dos componentes",
    "portionSize": "pequena" | "média" | "grande",
    "components": [
        {
            "food": "nome do alimento",
            "estimatedWeight": peso em gramas (número),
            "unit": "g",
            "calories": calorias deste componente,
            "protein": proteína em g,
            "carbs": carboidratos em g,
            "fat": gordura em g
        }
    ],
    "calories": total de calorias (soma dos components),
    "protein": total de proteína em g,
    "carbs": total de carboidratos em g,
    "fat": total de gorduras em g,
    "confidence": "alta" | "média" | "baixa"
}

Se não for comida, retorne { "error": "Não identifiquei comida nesta imagem" }.`;

            const response = await callOpenAI({
                model: 'gpt-4o-mini', // Vision capable model
                messages: [
                    { role: 'system', content: systemPrompt },
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: userPrompt },
                            {
                                type: 'image_url',
                                image_url: {
                                    url: `data:image/jpeg;base64,${base64Image}`,
                                    detail: 'high'
                                }
                            }
                        ] as any // Cast to any to avoid TS issues with simple types
                    },
                ],
                max_tokens: 1000, // Increased for detailed component breakdown
            });

            try {
                const jsonMatch = response.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    return JSON.parse(jsonMatch[0]);
                }
                return JSON.parse(response);
            } catch (error) {
                console.error('Erro ao parsear análise de imagem:', error);
                return null;
            }
        },
        CACHE_TTL.MEAL_IMAGE // null = permanent
    );

    return result.data;
}

/**
 * Analisa múltiplas imagens de refeição com contexto adicional
 * Suporta: múltiplas fotos (prato + tabela nutricional), descrição do usuário, bebidas e suplementos
 */
export async function analyzeMealWithContext(params: {
    images: string[]; // Array de base64 images (pode ser vazio)
    description?: string; // Descrição opcional do usuário (obrigatória se não houver imagens)
    mealTypes: string[]; // ['meal', 'drink', 'supplement']
    userId: string;
}): Promise<any> {
    // Validação básica
    if (params.images.length === 0 && !params.description) {
        throw new Error('É necessário fornecer pelo menos uma imagem ou uma descrição.');
    }

    // Gera chave de cache baseada em todas as imagens + descrição
    const imagesHash = params.images.length > 0
        ? params.images.map(img => img.substring(0, 50)).join('|')
        : 'no-images';

    const cacheKey = await generateCacheKey('meal_image', {
        imagesHash,
        description: params.description || '',
        mealTypes: params.mealTypes.sort().join(',')
    });

    const result = await withCache(
        cacheKey,
        params.userId,
        'meal_image',
        {
            images: params.images, // Store full images for admin dashboard
            hasDescription: !!params.description,
            mealTypes: params.mealTypes,
            description: params.description
        },
        async () => {
            const systemPrompt = `Você é um nutricionista brasileiro especialista em análise de alimentos.
Sua tarefa é analisar as informações fornecidas (imagens e/ou descrição) e fornecer estimativas PRECISAS de peso e valores nutricionais.
PRIORIDADE: Se houver tabela nutricional nas imagens, use os valores EXATOS dela.
Sempre retorne um JSON válido.`;

            // Build type context
            const typeContext = params.mealTypes.includes('drink')
                ? 'Isso pode incluir BEBIDAS (sucos, shakes, refrigerantes, etc.).'
                : params.mealTypes.includes('supplement')
                    ? 'Isso pode incluir SUPLEMENTOS (whey protein, creatina, vitaminas, etc.).'
                    : 'Isso é uma REFEIÇÃO sólida.';

            const hasImages = params.images.length > 0;

            let userPrompt = '';

            if (hasImages) {
                userPrompt = `Analise TODAS as ${params.images.length} imagens fornecidas e retorne um JSON DETALHADO.

${typeContext}

${params.description ? `DESCRIÇÃO DO USUÁRIO: "${params.description}"
Use esta descrição para complementar a análise visual.` : ''}

INSTRUÇÕES CRÍTICAS:
1. Se houver TABELA NUTRICIONAL em alguma imagem:
   - Use os valores EXATOS da tabela (calorias, proteínas, carboidratos, gorduras)
   - Identifique a porção indicada na tabela
   - Priorize esses dados sobre estimativas visuais

2. Se NÃO houver tabela nutricional:
   - Use as referências de porções brasileiras
   - Estime o peso de cada componente
   - Calcule macros baseado nos pesos`;
            } else {
                // Text only prompt
                userPrompt = `Analise a seguinte descrição de refeição e retorne um JSON DETALHADO com estimativas nutricionais.

${typeContext}

DESCRIÇÃO DO USUÁRIO: "${params.description}"

INSTRUÇÕES CRÍTICAS:
1. Estime porções realistas baseadas na descrição (padrão brasileiro).
2. Se a quantidade não for especificada, assuma uma porção média padrão.
3. Calcule macros e calorias com base nessas estimativas.`;
            }

            userPrompt += `

3. Para BEBIDAS:
   - Se for suco/refrigerante, estime o açúcar/carboidratos corretamente
   - Se for bebida alcoólica, inclua as calorias do álcool

FORMATO DE RESPOSTA (JSON):
{
  "name": "Nome curto e descritivo da refeição (Ex: Almoço: Arroz, Feijão e Frango)",
  "calories": 0,
  "protein": 0,
  "carbs": 0,
  "fats": 0,
  "items": [
    {
      "name": "Nome do item (Ex: Arroz Branco)",
      "portion": "Estimativa de porção (Ex: 4 colheres de sopa / 100g)",
      "calories": 0,
      "protein": 0,
      "carbs": 0,
      "fats": 0
    }
  ],
  "confidence": "high" | "medium" | "low",
  "tips": "Dica curta nutricional sobre a refeição (max 1 frase)"
}`;

            // Build content array with text + all images
            const content: any[] = [
                { type: 'text', text: userPrompt }
            ];

            // Add images if present
            if (hasImages) {
                params.images.forEach(base64Image => {
                    content.push({
                        type: 'image_url',
                        image_url: {
                            url: `data:image/jpeg;base64,${base64Image}`,
                            detail: 'high'
                        }
                    });
                });
            }

            const response = await callOpenAI({
                model: 'gpt-4o-mini', // Vision capable model
                messages: [
                    { role: 'system', content: systemPrompt },
                    {
                        role: 'user',
                        content: content as any // Cast to any to support multiple images
                    },
                ],
                max_tokens: 1500, // Increased for multiple images + detailed breakdown
            });

            try {
                const jsonMatch = response.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    return JSON.parse(jsonMatch[0]);
                }
                return JSON.parse(response);
            } catch (error) {
                console.error('Erro ao parsear análise de imagem:', error);
                throw new Error('Erro ao processar análise da refeição');
            }
        },
        CACHE_TTL.MEAL_IMAGE // null = permanent
    );

    return result.data;

}


/**
 * Analisa uma imagem da despensa/geladeira para identificar ingredientes
 */
export async function analyzePantryImage(base64Image: string): Promise<string[]> {
    const systemPrompt = `Você é um assistente especializado em identificar alimentos e produtos alimentícios em fotos de despensa/geladeira.
Seja ESPECÍFICO com produtos industrializados: identifique marcas, tipos e sabores quando visíveis.
Liste APENAS os ingredientes e produtos comestíveis visíveis.`;

    const userPrompt = `Analise esta foto de despensa/geladeira e liste TODOS os produtos alimentícios visíveis.

INSTRUÇÕES IMPORTANTES:
1. Para produtos INDUSTRIALIZADOS (bolachas, salgadinhos, biscoitos, etc.):
   - Identifique a MARCA se visível (ex: "Oreo", "Doritos", "Ruffles")
   - Identifique o TIPO específico (ex: "bolacha recheada", "salgadinho de queijo", "biscoito wafer")
   - Identifique o SABOR se visível (ex: "chocolate", "queijo", "morango")
   - Exemplo: "Oreo Original", "Doritos Nacho", "Ruffles Queijo"

2. Para ingredientes NATURAIS:
   - Use nomes genéricos (ex: "arroz", "feijão", "tomate")

3. Para produtos EMBALADOS sem marca visível:
   - Descreva o tipo (ex: "bolacha água e sal", "macarrão espaguete", "leite integral")

RETORNE apenas um array JSON de strings em português.
Exemplo: ["Oreo Original", "arroz branco", "feijão preto", "Doritos Nacho", "leite integral", "tomate"]`;

    const response = await callOpenAI({
        model: 'gpt-4o-mini',
        messages: [
            { role: 'system', content: systemPrompt },
            {
                role: 'user',
                content: [
                    { type: 'text', text: userPrompt },
                    {
                        type: 'image_url',
                        image_url: {
                            url: `data:image/jpeg;base64,${base64Image}`,
                            detail: 'high'
                        }
                    }
                ] as any
            },
        ],
        max_tokens: 800, // Increased for detailed product names
    });

    try {
        const jsonMatch = response.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        return JSON.parse(response);
    } catch (error) {
        console.error('Erro ao parsear ingredientes da foto:', error);
        return [];
    }
}
export interface DietPlan {
    name: string;
    duration_days: number;
    meals: {
        day: number;
        type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
        name: string;
        calories: number;
        macros: { protein: number; carbs: number; fat: number };
        ingredients: string[];
        instructions: string[];
        cooking_time: number;
        difficulty: 'easy' | 'medium' | 'hard';
    }[];
}

export async function generatePersonalizedDiet(params: {
    userId: string;
    profile: {
        goal: string;
        targetCalories: number;
        cookingTime: number;
        availableEquipment: string[];
        dietaryRestrictions: string[];
        allergies: string[];
        flavorPreferences: string[];
        budgetLevel: string;
        trainingFrequency: string;
    };
    durationDays: number;
    forceRefresh?: boolean;
}): Promise<DietPlan> {
    // Generate cache key
    const cacheKey = await generateCacheKey('diet_plan', {
        profile: params.profile,
        durationDays: params.durationDays
    });

    // Use cache wrapper
    const result = await withCache(
        cacheKey,
        params.userId,
        'diet_plan',
        params,
        async () => {
            const systemPrompt = `Você é um nutricionista de elite especializado em criar planos alimentares altamente personalizados para BRASILEIROS.
Crie um plano de dieta de ${params.durationDays} dias baseado EXATAMENTE no perfil do usuário.

PERFIL DO USUÁRIO:
- Objetivo: ${params.profile.goal}
- Calorias Diárias: ${params.profile.targetCalories}
- Tempo para Cozinhar: ${params.profile.cookingTime} minutos
- Equipamentos: ${params.profile.availableEquipment.join(', ')}
- Restrições: ${params.profile.dietaryRestrictions.join(', ') || 'Nenhuma'}
- Alergias: ${params.profile.allergies.join(', ') || 'Nenhuma'}
- Preferências de Sabor: ${params.profile.flavorPreferences.join(', ')}
- Orçamento: ${params.profile.budgetLevel}
- Treino: ${params.profile.trainingFrequency}

🇧🇷 INGREDIENTES BRASILEIROS OBRIGATÓRIOS (usar em 80%+ das receitas):
PROTEÍNAS BASE: Frango (peito, coxa), Ovo, Carne Moída, Peixe (Tilápia, Sardinha), Linguiça
${params.profile.budgetLevel === 'high' || params.profile.budgetLevel === 'moderate' ? 'PROTEÍNAS PREMIUM (permitidas): Salmão, Atum fresco, Camarão, Picanha' : ''}
CARBOIDRATOS: Arroz Branco/Integral, Feijão (preto, carioca), Batata, Batata Doce, Macarrão, Pão Francês, Aveia, Tapioca
VEGETAIS: Tomate, Alface, Cenoura, Cebola, Alho, Brócolis, Couve, Abobrinha, Chuchu, Abóbora
FRUTAS: Banana, Maçã, Laranja, Mamão, Melancia, Abacaxi, Manga${params.profile.budgetLevel === 'high' ? ', Abacate, Frutas Vermelhas' : ''}
LATICÍNIOS: Leite, Iogurte Natural, Queijo Minas, Requeijão
OUTROS: Azeite, Óleo, Manteiga, Sal, Temperos básicos

❌ INGREDIENTES PROIBIDOS (NÃO USAR):
- Quinoa, Aspargos, Kale, Couve de Bruxelas (não são comuns no Brasil)
- Tacos, Tortillas, Wraps (não é cultura brasileira)
- Ingredientes exóticos ou muito difíceis de encontrar
${params.profile.budgetLevel === 'low' ? '- Salmão, Atum fresco, Camarão, Abacate, Nozes importadas (muito caros para orçamento baixo)' : ''}

REGRAS CRÍTICAS:
1. Gere EXATAMENTE 4 refeições por dia: Café da Manhã (breakfast), Almoço (lunch), Lanche Tarde (snack), Jantar (dinner).
2. ORDEM DAS REFEIÇÕES: Café da Manhã → Almoço → Lanche Tarde (snack) → Jantar
3. O LANCHE TARDE deve ser ENTRE almoço e jantar (15h-17h).
4. TODAS as receitas devem ser preparáveis em até ${params.profile.cookingTime} minutos.
5. Use APENAS os equipamentos listados.
6. RESPEITE RIGOROSAMENTE alergias e restrições ${params.profile.dietaryRestrictions.join(', ') || 'Nenhuma'}, ${params.profile.allergies.join(', ') || 'Nenhuma'}.
7. O orçamento deve guiar a escolha dos ingredientes ${params.profile.budgetLevel}.
8. Receitas SIMPLES e PRÁTICAS do dia a dia brasileiro.
9. Retorne APENAS JSON válido.

🎯 DISTRIBUIÇÃO CALÓRICA OBRIGATÓRIA (total: ${params.profile.targetCalories} kcal/dia):
- Café da Manhã: ${Math.round(params.profile.targetCalories * 0.25)} kcal (25%)
- Almoço: ${Math.round(params.profile.targetCalories * 0.40)} kcal (40%)
- Lanche Tarde: ${Math.round(params.profile.targetCalories * 0.15)} kcal (15%)
- Jantar: ${Math.round(params.profile.targetCalories * 0.20)} kcal (20%)

📊 MACROS BASEADOS NO OBJETIVO "${params.profile.goal}":
${params.profile.goal === 'gain_muscle' ? `
- Proteína: 2g por kg de peso (prioridade ALTA)
- Carboidratos: Moderado a alto (energia para treino)
- Gorduras: Moderado (20-30% das calorias)
` : params.profile.goal === 'lose_weight' ? `
- Proteína: 1.8g por kg de peso (preservar massa muscular)
- Carboidratos: Moderado (controle de calorias)
- Gorduras: Baixo a moderado (20-25% das calorias)
` : `
- Proteína: 1.5g por kg de peso
- Carboidratos: Moderado
- Gorduras: Moderado (25-30% das calorias)
`}

FORMATO DE SAÍDA (JSON):
{
    "name": "Nome Criativo do Plano",
    "duration_days": ${params.durationDays},
    "meals": [
        {
            "day": 1,
            "type": "breakfast",
            "name": "Ovos Mexidos com Pão Francês",
            "calories": 500,
            "macros": { "protein": 30, "carbs": 40, "fat": 20 },
            "ingredients": ["2 ovos", "1 pão francês", "1 col manteiga"],
            "instructions": ["Bata os ovos", "Frite na manteiga", "Sirva com pão"],
            "cooking_time": 10,
            "difficulty": "easy"
        }
    ]
}`;

            const response = await retryWithBackoff(async () => {
                return await callOpenAI({
                    model: "gpt-4o",
                    messages: [
                        { role: "system", content: systemPrompt },
                        {
                            role: "user", content: `Gere o plano de dieta de ${params.durationDays} dias.
IMPORTANTE:
1. GERE 4 REFEIÇÕES POR DIA: Café da Manhã (breakfast), Almoço (lunch), Lanche Tarde (snack), Jantar (dinner).
2. O LANCHE TARDE é OBRIGATÓRIO e deve ser ENTRE almoço e jantar (15h-17h).
3. As calorias das refeições DEVEM SOMAR EXATAMENTE ${params.profile.targetCalories} kcal/dia.
4. Use a distribuição: Café ${Math.round(params.profile.targetCalories * 0.25)}kcal, Almoço ${Math.round(params.profile.targetCalories * 0.40)}kcal, Lanche Tarde ${Math.round(params.profile.targetCalories * 0.15)}kcal, Jantar ${Math.round(params.profile.targetCalories * 0.20)}kcal.
5. Use ingredientes TÍPICOS DO BRASIL e baratos (Arroz, Feijão, Frango, Ovos, Batata, Banana, Aveia, Pão Francês).
6. Evite ingredientes caros ou difíceis de achar (Quinoa, Tacos, Aspargos, Salmão, Mirtilos).
7. Receitas SIMPLES e RÁPIDAS.
8. Gere TODOS os ${params.durationDays} dias.
9. Seja conciso nas instruções para economizar tokens.` }
                    ],
                    temperature: 0.7,
                    max_tokens: 8000,
                    response_format: { type: "json_object" }
                });
            }, 3, 2000); // 3 retries, starting with 2 second delay

            try {
                console.log('Raw AI response length:', response.length);
                console.log('First 200 chars:', response.substring(0, 200));
                console.log('Last 200 chars:', response.substring(response.length - 200));

                // Try to parse directly first
                let parsed;
                try {
                    parsed = JSON.parse(response);
                } catch (directParseError) {
                    // If direct parse fails, try to extract JSON from response
                    const jsonMatch = response.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        console.log('Extracted JSON from response');
                        parsed = JSON.parse(jsonMatch[0]);
                    } else {
                        throw new Error('No JSON found in response');
                    }
                }

                // Validate the parsed data
                if (!parsed.meals || !Array.isArray(parsed.meals)) {
                    throw new Error('Invalid diet plan structure: missing meals array');
                }

                console.log(`Successfully parsed diet plan with ${parsed.meals.length} meals`);
                return parsed;
            } catch (error) {
                console.error('Erro ao parsear plano de dieta:', error);
                console.error('Response preview:', response.substring(0, 500));
                throw new Error('Erro ao processar plano de dieta');
            }
        },
        CACHE_TTL.DIET_PLAN,
        params.forceRefresh
    );

    return result.data;
}

/**
 * Gera uma receita alternativa similar (para botão "Trocar")
 */
export async function generateAlternativeRecipe(params: {
    userId: string;
    originalRecipe: {
        type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
        calories: number;
        macros: { protein: number; carbs: number; fat: number };
        cooking_time: number;
    };
    profile: {
        goal: string;
        cookingTime: number;
        availableEquipment: string[];
        dietaryRestrictions: string[];
        allergies: string[];
        budgetLevel: string;
    };
    swapReason?: string; // Optional reason for swapping
}): Promise<any> {
    const systemPrompt = `Você é um nutricionista brasileiro expert.
Gere UMA receita alternativa para ${params.originalRecipe.type === 'breakfast' ? 'café da manhã' : params.originalRecipe.type === 'lunch' ? 'almoço' : params.originalRecipe.type === 'dinner' ? 'jantar' : 'lanche'}.

PERFIL DO USUÁRIO:
- Objetivo: ${params.profile.goal}
- Tempo de Cozinha: ${params.profile.cookingTime} minutos
- Equipamentos: ${params.profile.availableEquipment.join(', ')}
- Restrições: ${params.profile.dietaryRestrictions.join(', ') || 'Nenhuma'}
- Alergias: ${params.profile.allergies.join(', ') || 'Nenhuma'}
- Orçamento: ${params.profile.budgetLevel}

${params.swapReason ? `MOTIVO DA TROCA: "${params.swapReason}"
IMPORTANTE: NÃO use os ingredientes mencionados pelo usuário. Gere uma receita SEM esses ingredientes.
` : ''}
INGREDIENTES BRASILEIROS (priorize):
PROTEÍNAS: Frango, Ovos, Carne Moída, Peixe branco${params.profile.budgetLevel !== 'low' ? ', Salmão, Camarão' : ''}
CARBOIDRATOS: Arroz, Feijão, Batata, Pão Francês, Tapioca, Aveia, Macarrão
VEGETAIS: Tomate, Alface, Cenoura, Brócolis, Couve, Abobrinha
FRUTAS: Banana, Maçã, Laranja, Mamão, Melancia${params.profile.budgetLevel === 'high' ? ', Abacate' : ''}

REGRAS:
1. Macros devem ser SIMILARES (±10% de variação)
2. Receita DIFERENTE da original
3. Tempo de preparo ≤ ${params.profile.cookingTime} minutos
4. Ingredientes BRASILEIROS e acessíveis
5. Retorne APENAS JSON válido

FORMATO:
{
    "name": "Nome da Receita",
    "type": "${params.originalRecipe.type}",
    "calories": ${params.originalRecipe.calories},
    "macros": { "protein": ${params.originalRecipe.macros.protein}, "carbs": ${params.originalRecipe.macros.carbs}, "fat": ${params.originalRecipe.macros.fat} },
    "ingredients": ["ingrediente 1", "ingrediente 2"],
    "instructions": ["passo 1", "passo 2"],
    "cooking_time": ${params.originalRecipe.cooking_time},
    "difficulty": "easy"
}`;

    const response = await retryWithBackoff(async () => {
        return await callOpenAI({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: "Gere UMA receita alternativa brasileira com macros similares." }
            ],
            temperature: 0.8,
            max_tokens: 1000,
            response_format: { type: "json_object" }
        });
    }, 3, 1000); // 3 retries, starting with 1 second delay

    try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        return JSON.parse(response);
    } catch (error) {
        console.error('Erro ao parsear receita alternativa:', error);
        throw new Error('Erro ao gerar receita alternativa');
    }
}

export interface IngredientParsed {
    name: string;
    quantity: string | null;
    unit: string | null;
    category: string;
}

/**
 * Normaliza e corrige lista de ingredientes (texto manual)
 */
export async function normalizeIngredients(text: string): Promise<IngredientParsed[]> {
    const systemPrompt = `
    Você é um assistente culinário especialista em identificar ingredientes.
    Sua tarefa é analisar o texto do usuário e extrair uma lista de ingredientes.
    
    REGRAS CRÍTICAS:
    1. Retorne APENAS um JSON válido.
    2. O JSON deve ser um array de objetos com a estrutura: { "ingredients": [{ "name": string, "quantity": string | null, "unit": string | null, "category": string }] }.
    3. As categorias permitidas são: "Proteína", "Carboidrato", "Vegetal", "Fruta", "Laticínio", "Tempero", "Outros".
    4. PADRONIZAÇÃO DE NOMES (MUITO IMPORTANTE):
       - Use SEMPRE o SINGULAR (ex: "Tomate" e não "Tomates", "Ovo" e não "Ovos").
       - Use nomes genéricos simples (ex: "Arroz" e não "Arroz Tio João", "Leite" e não "Caixa de leite").
       - Primeira letra maiúscula.
    5. Se a quantidade não for especificada, use null.
    6. Se a unidade não for especificada, use null.
    
    CATEGORIZAÇÃO CORRETA (IMPORTANTE):
    - CARBOIDRATO: Arroz, Macarrão, Pão, Batata, Mandioca, Aveia, Feijão, Lentilha, Grão-de-bico, Ervilha
    - PROTEÍNA: Frango, Carne, Peixe, Ovo, Camarão, Atum (apenas proteínas animais puras)
    - VEGETAL: Tomate, Alface, Cenoura, Brócolis, Couve, Cebola, Alho
    - FRUTA: Banana, Maçã, Laranja, Morango, Abacaxi
    - LATICÍNIO: Leite, Queijo, Iogurte, Requeijão
    - TEMPERO: Sal, Pimenta, Orégano, Cominho, Alho em pó
    
    ATENÇÃO: Feijão, Lentilha, Grão-de-bico e Ervilha são CARBOIDRATOS, não proteínas!
    `;

    try {
        const response = await retryWithBackoff(async () => {
            return await callOpenAI({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: `Analise e extraia ingredientes: "${text}"` }
                ],
                temperature: 0.3,
                max_tokens: 1000,
                response_format: { type: "json_object" }
            });
        }, 3, 1000);

        const parsed = JSON.parse(response);
        if (parsed.ingredients && Array.isArray(parsed.ingredients)) {
            return parsed.ingredients.map((i: any) => ({
                name: i.name || '',
                quantity: i.quantity || null,
                unit: i.unit || null,
                category: i.category || 'Outros'
            }));
        }

        return [];
    } catch (error) {
        console.error('Erro ao normalizar ingredientes:', error);
        // Fallback simples
        return text.split(/[,\n]/).map(i => ({
            name: i.trim(),
            quantity: null,
            unit: null,
            category: 'Outros'
        })).filter(i => i.name.length > 0);
    }
}

/**
 * Reconhece ingredientes de uma imagem usando GPT-4 Vision
 */
export async function recognizeIngredientsFromImage(params: {
    userId: string;
    imageBase64: string;
}): Promise<IngredientParsed[]> {
    const systemPrompt = `Você é um nutricionista expert. Analise a imagem e liste os ingredientes alimentares visíveis.
    Ignore itens não comestíveis.
    
    REGRAS CRÍTICAS:
    1. Para cada item, estime a categoria (Proteína, Carboidrato, Vegetal, Fruta, Laticínio, Tempero, Outros).
    2. PADRONIZAÇÃO DE NOMES (IMPORTANTE):
       - Use SEMPRE o SINGULAR (ex: "Banana" e não "Bananas").
       - Use nomes genéricos (ex: "Maçã" e não "Maçã Fuji").
    3. Se possível, estime quantidade visual grosseira, senão deixe null.
    
    CATEGORIZAÇÃO CORRETA:
    - CARBOIDRATO: Arroz, Macarrão, Pão, Batata, Mandioca, Aveia, Feijão, Lentilha, Grão-de-bico, Ervilha
    - PROTEÍNA: Frango, Carne, Peixe, Ovo, Camarão, Atum (apenas proteínas animais puras)
    - VEGETAL: Tomate, Alface, Cenoura, Brócolis, Couve, Cebola, Alho
    - FRUTA: Banana, Maçã, Laranja, Morango, Abacaxi
    - LATICÍNIO: Leite, Queijo, Iogurte, Requeijão
    
    ATENÇÃO: Feijão e leguminosas são CARBOIDRATOS, não proteínas!
    
    Retorne APENAS JSON:
    {
      "ingredients": [
        { "name": "Banana", "quantity": "6", "unit": "un", "category": "Fruta" }
      ]
    }`;
    try {
        const response = await retryWithBackoff(async () => {
            // OPENAI_API_KEY is assumed to be available in the scope or passed via process.env
            // The original code had a check, but the instruction removed it.
            // Assuming OPENAI_API_KEY is defined globally or via process.env.EXPO_PUBLIC_OPENAI_API_KEY
            const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY; // Ensure this is correctly sourced

            if (!OPENAI_API_KEY) throw new Error('API key not configured for image recognition');

            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${OPENAI_API_KEY}`,
                },
                body: JSON.stringify({
                    model: "gpt-4o",
                    messages: [
                        {
                            role: "user",
                            content: [
                                { type: "text", text: systemPrompt },
                                {
                                    type: "image_url",
                                    image_url: {
                                        url: `data:image/jpeg;base64,${params.imageBase64}`,
                                        detail: "low"
                                    }
                                }
                            ]
                        }
                    ],
                    max_tokens: 500,
                    response_format: { type: "json_object" }
                }),
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(`API error: ${res.status} - ${JSON.stringify(errorData)}`);
            }
            const data = await res.json();
            return data.choices[0].message.content;
        }, 3, 2000);

        const parsed = JSON.parse(response);
        if (parsed.ingredients && Array.isArray(parsed.ingredients)) {
            return parsed.ingredients;
        }
        return [];
    } catch (error) {
        console.error('Erro no reconhecimento de imagem:', error);
        throw error;
    }
}

/**
 * Transcreve áudio e extrai ingredientes
 */
export async function transcribeAudioToIngredients(params: {
    userId: string;
    audioUri: string;
}): Promise<IngredientParsed[]> {
    try {
        // First, transcribe audio using Whisper
        const formData = new FormData();
        formData.append('file', {
            uri: params.audioUri,
            name: 'audio.m4a',
            type: 'audio/m4a'
        } as any);
        formData.append('model', 'whisper-1');
        formData.append('language', 'pt');

        // Assuming OPENAI_API_KEY is defined globally or via process.env.EXPO_PUBLIC_OPENAI_API_KEY
        const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY; // Ensure this is correctly sourced
        if (!OPENAI_API_KEY) throw new Error('API key not configured for audio transcription');

        const transcriptionResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                // 'Content-Type': 'multipart/form-data' is automatically set by fetch when using FormData
            },
            body: formData
        });

        if (!transcriptionResponse.ok) {
            const errorData = await transcriptionResponse.json();
            throw new Error(`Erro ao transcrever áudio: ${transcriptionResponse.status} - ${JSON.stringify(errorData)}`);
        }

        const { text } = await transcriptionResponse.json();

        // Now extract ingredients from transcription
        const systemPrompt = `Você é um assistente que extrai ingredientes de texto em português.
Analise o texto e extraia TODOS os ingredientes mencionados.

REGRAS:
1. Ignore quantidades, foque apenas nos ingredientes
2. Use nomes padronizados em português brasileiro
3. Retorne um objeto JSON com array "ingredients"
4. Se não encontrar ingredientes, retorne array vazio

FORMATO DE SAÍDA:
{ "ingredients": ["ingrediente1", "ingrediente2"] }`;

        const response = await retryWithBackoff(async () => {
            return await callOpenAI({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: `Extraia os ingredientes deste texto: "${text}"` }
                ],
                temperature: 0.3,
                max_tokens: 300,
                response_format: { type: "json_object" }
            });
        }, 3, 1000);

        const parsed = JSON.parse(response);
        // Mapear para IngredientParsed
        if (parsed.ingredients && Array.isArray(parsed.ingredients)) {
            return await normalizeIngredients(parsed.ingredients.join(', '));
        }
        return [];
    } catch (error) {
        console.error('Erro ao processar áudio:', error);
        throw new Error('Erro ao processar áudio');
    }
}

/**
 * Gera receita brasileira com base nos ingredientes disponíveis
 */
export async function generateRecipeFromIngredients(params: {
    userId: string;
    ingredients: string[];
    profile: {
        goal: string;
        cookingTime: number;
        availableEquipment: string[];
        dietaryRestrictions: string[];
        allergies: string[];
    };
}): Promise<any> {
    const systemPrompt = `Você é um chef brasileiro criando receitas com ingredientes disponíveis.
Crie UMA receita deliciosa e saudável usando APENAS os ingredientes listados.

PERFIL DO USUÁRIO:
- Objetivo: ${params.profile.goal}
- Tempo máximo: ${params.profile.cookingTime} minutos
- Equipamentos: ${params.profile.availableEquipment.join(', ')}
- Restrições: ${params.profile.dietaryRestrictions.join(', ') || 'Nenhuma'}
- Alergias: ${params.profile.allergies.join(', ') || 'Nenhuma'}

INGREDIENTES DISPONÍVEIS:
${params.ingredients.map(ing => `- ${ing}`).join('\n')}

REGRAS CRÍTICAS:
1. Use APENAS os ingredientes listados acima
2. Receita SIMPLES e PRÁTICA do dia a dia brasileiro
3. Tempo de preparo ≤ ${params.profile.cookingTime} minutos
4. Respeite restrições e alergias
5. Calcule calorias e macros aproximados
6. Retorne APENAS JSON válido

FORMATO DE SAÍDA:
{
  "name": "Nome da Receita",
  "type": "lunch",
  "calories": 500,
  "macros": { "protein": 30, "carbs": 50, "fat": 15 },
  "ingredients": ["2 ovos", "1 tomate", "sal a gosto"],
  "instructions": ["Passo 1", "Passo 2", "Passo 3"],
  "cooking_time": 15,
  "difficulty": "easy",
  "servings": 1
}`;

    try {
        const response = await retryWithBackoff(async () => {
            return await callOpenAI({
                model: "gpt-4o",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: "Crie uma receita brasileira com os ingredientes disponíveis." }
                ],
                temperature: 0.8,
                max_tokens: 1500,
                response_format: { type: "json_object" }
            });
        }, 3, 2000);

        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        return JSON.parse(response);
    } catch (error) {
        console.error('Erro ao gerar receita:', error);
        throw new Error('Erro ao gerar receita');
    }
}

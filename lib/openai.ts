/**
 * OpenAI API Helper
 * Funções para integração com a API do OpenAI
 */


const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.EXPO_PUBLIC_OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// Cache TTL constants (in seconds)
const CACHE_TTL = {
    RECIPE: 30 * 24 * 60 * 60, // 30 days
    INSIGHT: 7 * 24 * 60 * 60, // 7 days
    MEAL_IMAGE: null, // Permanent (no expiration)
    MEAL_PLAN: 30 * 24 * 60 * 60, // 30 days
    PANTRY_IMAGE: null, // Permanent
};

// ... existing interfaces ...

/**
 * Gera insights de progresso de peso
 * Com cache de 7 dias (weight data changes frequently)
 */
export async function generateInsights(profile: any, weightHistory: any[], userId: string): Promise<any> {
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
            const systemPrompt = `Atue como um nutricionista e coach fitness especialista e motivador do app FitPantry.
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

interface OpenAIMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

interface OpenAIRequest {
    model?: string;
    messages: OpenAIMessage[];
    temperature?: number;
    max_tokens?: number;
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
        throw new Error('OPENAI_API_KEY não configurada no .env');
    }

    const response = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
            model: request.model || 'gpt-4o-mini',
            messages: request.messages,
            temperature: request.temperature ?? 0.7,
            max_tokens: request.max_tokens ?? 1000,
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`OpenAI API Error: ${error.error?.message || 'Unknown error'}`);
    }

    const data: OpenAIResponse = await response.json();
    return data.choices[0]?.message?.content || '';
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
        { imagePreview: base64Image.substring(0, 50) + '...' }, // Don't store full image in params
        async () => {
            const systemPrompt = `Você é um nutricionista especialista em análise visual de pratos.
Analise a imagem da refeição e forneça uma estimativa nutricional detalhada.
Sempre retorne um JSON válido.`;

            const userPrompt = `Analise esta foto de comida e retorne um JSON com:
    {
        "name": "Nome do prato (seja específico)",
        "description": "Breve descrição dos componentes visíveis",
        "calories": estimativa de calorias totais (inteiro),
        "protein": estimativa de proteína em g (número),
        "carbs": estimativa de carboidratos em g (número),
        "fat": estimativa de gorduras em g (número),
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
                max_tokens: 500,
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
 * Analisa uma imagem da despensa/geladeira para identificar ingredientes
 */
export async function analyzePantryImage(base64Image: string): Promise<string[]> {
    const systemPrompt = `Você é um assistente que identifica ingredientes alimentares em fotos.
Liste APENAS os ingredientes comestíveis visíveis. Ignorar embalagens não alimentícias.`;

    const userPrompt = `Liste os ingredientes nesta foto. Retorne apenas um array JSON de strings em português, ex: ["arroz", "feijão", "leite"].`;

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
        max_tokens: 500,
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

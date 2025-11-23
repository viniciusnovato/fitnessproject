/**
 * Nutrition Calculator
 * Cálculos de TMB, TDEE e macros baseados nas regras de negócio do FitBody AI
 */

export type Sex = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'intense' | 'very_intense';
export type Goal = 'lose_weight' | 'gain_muscle' | 'maintain' | 'bodybuilding' | 'health';

interface UserData {
    weight: number; // kg
    height: number; // cm
    age: number; // anos
    sex: Sex;
    activityLevel: ActivityLevel;
    goal: Goal;
}

interface NutritionResult {
    bmr: number; // Taxa Metabólica Basal
    tdee: number; // Total Daily Energy Expenditure
    targetCalories: number; // Calorias alvo baseado no objetivo
    macros: {
        protein: number; // gramas
        carbs: number; // gramas
        fat: number; // gramas
    };
    weeklyWeightChange: number; // kg/semana (positivo = ganho, negativo = perda)
}

/**
 * Calcula TMB usando a fórmula Mifflin-St Jeor
 * Homens: (10 × peso em kg) + (6,25 × altura em cm) - (5 × idade em anos) + 5
 * Mulheres: (10 × peso em kg) + (6,25 × altura em cm) - (5 × idade em anos) - 161
 */
export function calculateBMR(weight: number, height: number, age: number, sex: Sex): number {
    const base = (10 * weight) + (6.25 * height) - (5 * age);
    return sex === 'male' ? base + 5 : base - 161;
}

/**
 * Multiplica TMB pelo fator de atividade para obter TDEE
 */
export function calculateTDEE(bmr: number, activityLevel: ActivityLevel): number {
    const activityMultipliers: Record<ActivityLevel, number> = {
        sedentary: 1.2,      // Pouco ou nenhum exercício
        light: 1.375,        // Exercício leve 1-3 dias/semana
        moderate: 1.55,      // Exercício moderado 3-5 dias/semana
        intense: 1.725,      // Exercício intenso 6-7 dias/semana
        very_intense: 1.9,   // Exercício muito intenso, trabalho físico
    };

    return bmr * activityMultipliers[activityLevel];
}

/**
 * Calcula calorias alvo baseado no objetivo
 */
export function calculateTargetCalories(tdee: number, goal: Goal): number {
    switch (goal) {
        case 'lose_weight':
            // Déficit de 300-500 kcal para perda saudável (0.25-0.75 kg/semana)
            return tdee - 400;

        case 'gain_muscle':
            // Superávit de 250-350 kcal para ganho moderado (0.25-0.5 kg/semana)
            return tdee + 300;

        case 'bodybuilding':
            // Superávit mais agressivo para bodybuilding
            return tdee + 500;

        case 'maintain':
            // Manutenção
            return tdee;

        case 'health':
            // Leve déficit para saúde geral
            return tdee - 100;

        default:
            return tdee;
    }
}

/**
 * Calcula distribuição de macros baseado no objetivo
 */
export function calculateMacros(targetCalories: number, weight: number, goal: Goal) {
    let proteinGrams: number;
    let fatPercentage: number;
    let carbsPercentage: number;

    switch (goal) {
        case 'lose_weight':
            // Alta proteína para preservar massa muscular
            proteinGrams = weight * 2.2; // 2.2g/kg
            fatPercentage = 0.25; // 25% das calorias
            carbsPercentage = 0.35; // Resto vai para carbos
            break;

        case 'gain_muscle':
            // Proteína moderada-alta, carbos altos
            proteinGrams = weight * 2.0; // 2.0g/kg
            fatPercentage = 0.25;
            carbsPercentage = 0.45;
            break;

        case 'bodybuilding':
            // Proteína muito alta
            proteinGrams = weight * 2.5; // 2.5g/kg
            fatPercentage = 0.20;
            carbsPercentage = 0.50;
            break;

        case 'maintain':
            // Balanceado
            proteinGrams = weight * 1.8; // 1.8g/kg
            fatPercentage = 0.30;
            carbsPercentage = 0.40;
            break;

        case 'health':
            // Moderado
            proteinGrams = weight * 1.6; // 1.6g/kg
            fatPercentage = 0.30;
            carbsPercentage = 0.40;
            break;

        default:
            proteinGrams = weight * 1.8;
            fatPercentage = 0.30;
            carbsPercentage = 0.40;
    }

    // Calorias de proteína (4 kcal/g)
    const proteinCalories = proteinGrams * 4;

    // Calorias de gordura (9 kcal/g)
    const fatCalories = targetCalories * fatPercentage;
    const fatGrams = fatCalories / 9;

    // Resto vai para carboidratos (4 kcal/g)
    const carbsCalories = targetCalories - proteinCalories - fatCalories;
    const carbsGrams = carbsCalories / 4;

    return {
        protein: Math.round(proteinGrams),
        carbs: Math.round(Math.max(0, carbsGrams)), // Garante que não seja negativo
        fat: Math.round(fatGrams),
    };
}

/**
 * Estima mudança de peso semanal baseado no déficit/superávit calórico
 * 1 kg de gordura ≈ 7700 kcal
 */
export function estimateWeeklyWeightChange(targetCalories: number, tdee: number): number {
    const dailyDifference = targetCalories - tdee;
    const weeklyDifference = dailyDifference * 7;
    return Number((weeklyDifference / 7700).toFixed(2));
}

/**
 * Função principal que calcula tudo
 */
export function calculateNutrition(userData: UserData): NutritionResult {
    const bmr = calculateBMR(userData.weight, userData.height, userData.age, userData.sex);
    const tdee = calculateTDEE(bmr, userData.activityLevel);
    const targetCalories = calculateTargetCalories(tdee, userData.goal);
    const macros = calculateMacros(targetCalories, userData.weight, userData.goal);
    const weeklyWeightChange = estimateWeeklyWeightChange(targetCalories, tdee);

    return {
        bmr: Math.round(bmr),
        tdee: Math.round(tdee),
        targetCalories: Math.round(targetCalories),
        macros,
        weeklyWeightChange,
    };
}

/**
 * Converte string do banco para tipo Sex
 */
export function parseSex(sex: string | null): Sex {
    if (sex === 'female' || sex === 'feminino') return 'female';
    return 'male';
}

/**
 * Converte string do banco para tipo ActivityLevel
 */
export function parseActivityLevel(level: string | null): ActivityLevel {
    const mapping: Record<string, ActivityLevel> = {
        'sedentary': 'sedentary',
        'sedentário': 'sedentary',
        'light': 'light',
        'leve': 'light',
        'moderate': 'moderate',
        'moderado': 'moderate',
        'intense': 'intense',
        'intenso': 'intense',
        'very_intense': 'very_intense',
        'muito_intenso': 'very_intense',
    };

    return mapping[level?.toLowerCase() || ''] || 'moderate';
}

/**
 * Converte string do banco para tipo Goal
 */
export function parseGoal(goal: string | null): Goal {
    const mapping: Record<string, Goal> = {
        'lose_weight': 'lose_weight',
        'perder_peso': 'lose_weight',
        'gain_muscle': 'gain_muscle',
        'ganhar_massa': 'gain_muscle',
        'maintain': 'maintain',
        'manter': 'maintain',
        'bodybuilding': 'bodybuilding',
        'health': 'health',
        'saúde': 'health',
    };

    return mapping[goal?.toLowerCase() || ''] || 'health';
}

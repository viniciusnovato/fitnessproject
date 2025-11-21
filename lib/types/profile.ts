/**
 * TypeScript types for user profile and onboarding
 */

export type TrainingFrequency = 'none' | '1-2' | '3-4' | '5-6' | 'athlete';
export type BudgetLevel = 'low' | 'moderate' | 'high';
export type CookingTime = 10 | 20 | 40 | 60;

export interface UserProfile {
    id: string;

    // Etapa 1: Dados Corporais
    full_name: string;
    birth_date: string;
    weight: number;
    height: number;
    sex: 'male' | 'female' | 'prefer_not_to_say';
    target_weight: number;
    goal: string;
    activity_level: string;

    // Etapa 2: Estilo de Vida
    training_frequency: TrainingFrequency;
    cooking_time: CookingTime;
    available_equipment: string[];

    // Etapa 3: Nutrição e Preferências
    dietary_restrictions: string[];
    allergies: string[];
    flavor_preferences: string[];
    budget_level: BudgetLevel;

    // Tracking
    onboarding_completed: boolean;
    onboarding_step: number;
    created_at: string;
}

export interface OnboardingStep1Data {
    birth_date: string;
    weight: number;
    height: number;
    sex: 'male' | 'female' | 'prefer_not_to_say';
    target_weight: number;
    goal: string;
    activity_level: string;
}

export interface OnboardingStep2Data {
    training_frequency: TrainingFrequency;
    cooking_time: CookingTime;
    available_equipment: string[];
}

export interface OnboardingStep3Data {
    dietary_restrictions: string[];
    allergies: string[];
    flavor_preferences: string[];
    budget_level: BudgetLevel;
}

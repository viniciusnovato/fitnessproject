import { DietPlan } from './openai';
import { supabase } from './supabase';

export async function saveDietPlan(userId: string, plan: DietPlan, profileSnapshot: any) {
    try {
        // 1. Create Diet Plan
        const { data: dietPlanData, error: dietError } = await supabase
            .from('diet_plans')
            .insert({
                user_id: userId,
                name: plan.name,
                duration_days: plan.duration_days,
                profile_snapshot: profileSnapshot,
                is_active: true
            })
            .select()
            .single();

        if (dietError) throw dietError;

        // 2. Deactivate other plans
        await supabase
            .from('diet_plans')
            .update({ is_active: false })
            .eq('user_id', userId)
            .neq('id', dietPlanData.id);

        // 3. Insert Recipes
        const recipesToInsert = plan.meals.map(meal => ({
            user_id: userId,
            diet_plan_id: dietPlanData.id,
            name: meal.name,
            description: `Receita de ${meal.type} do plano ${plan.name}`,
            cooking_time: meal.cooking_time, // Use cooking_time instead of prep_time
            ingredients: meal.ingredients.map(i => ({ name: i, quantity: '1', unit: 'porção' })), // Simplified for now
            instructions: meal.instructions,
            macros: { // Use macros instead of nutrition
                calories: meal.calories,
                protein: meal.macros.protein,
                carbs: meal.macros.carbs,
                fat: meal.macros.fat
            },
            meal_type: meal.type,
            day_of_week: meal.day,
            is_diet_plan: true,
            difficulty: meal.difficulty
        }));

        const { error: recipesError } = await supabase
            .from('recipes')
            .insert(recipesToInsert);

        if (recipesError) throw recipesError;

        return dietPlanData;
    } catch (error) {
        console.error('Error saving diet plan:', error);
        throw error;
    }
}

export async function getActiveDietPlan(userId: string) {
    try {
        // Get active plan
        const { data: plan, error } = await supabase
            .from('diet_plans')
            .select('*')
            .eq('user_id', userId)
            .eq('is_active', true)
            .single();

        if (error || !plan) return null;

        // Get recipes for this plan
        const { data: recipes, error: recipesError } = await supabase
            .from('recipes')
            .select('*')
            .eq('diet_plan_id', plan.id)
            .order('day_of_week', { ascending: true });

        if (recipesError) return null;

        // Reconstruct DietPlan object
        return {
            id: plan.id,
            name: plan.name,
            duration_days: plan.duration_days,
            meals: recipes.map(r => ({
                day: r.day_of_week,
                type: r.meal_type,
                name: r.name,
                calories: r.macros?.calories || 0,
                macros: {
                    protein: r.macros?.protein || 0,
                    carbs: r.macros?.carbs || 0,
                    fat: r.macros?.fat || 0
                },
                ingredients: r.ingredients.map((i: any) => i.name), // Simplified
                instructions: r.instructions,
                cooking_time: r.cooking_time,
                difficulty: r.difficulty
            }))
        };
    } catch (error) {
        console.error('Error fetching diet plan:', error);
        return null;
    }
}

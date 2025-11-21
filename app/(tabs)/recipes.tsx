
import { DietPlanCard } from '@/components/diet/DietPlanCard';
import { RecipeCard } from '@/components/diet/RecipeCard';
import { WeeklyView } from '@/components/diet/WeeklyView';
import { getActiveDietPlan, saveDietPlan } from '@/lib/diet';
import { DietPlan, generatePersonalizedDiet } from '@/lib/openai';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function DietScreen() {
    const [loading, setLoading] = useState(false);
    const [dietPlan, setDietPlan] = useState<DietPlan | null>(null);
    const [currentDay, setCurrentDay] = useState(1);
    const [showRecipeModal, setShowRecipeModal] = useState(false);
    const [selectedRecipe, setSelectedRecipe] = useState<any>(null);
    const [userProfile, setUserProfile] = useState<any>(null);

    useFocusEffect(
        useCallback(() => {
            loadUserProfile();
        }, [])
    );

    const loadUserProfile = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (data) {
            setUserProfile(data);
            checkActiveDietPlan(user.id);
        }
    };

    const checkActiveDietPlan = async (userId: string) => {
        const activePlan = await getActiveDietPlan(userId);
        if (activePlan) {
            setDietPlan(activePlan as DietPlan);
        }
    };

    const handleGenerateDiet = async (forceRefresh = false) => {
        console.log('handleGenerateDiet called', { forceRefresh });
        console.log('UserProfile:', userProfile ? 'Loaded' : 'Missing');

        if (!userProfile) {
            console.log('Aborting: No user profile');
            Alert.alert('Erro', 'Perfil de usuário não carregado. Tente recarregar a tela.');
            return;
        }

        console.log('Setting loading to true');
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                console.log('Aborting: No auth user');
                return;
            }

            console.log('Calling generatePersonalizedDiet...');
            const plan = await generatePersonalizedDiet({
                userId: user.id,
                profile: {
                    goal: userProfile.goal,
                    targetCalories: userProfile.daily_calories || 2000,
                    cookingTime: userProfile.cooking_time || 30,
                    availableEquipment: userProfile.equipment || [],
                    dietaryRestrictions: userProfile.dietary_restrictions || [],
                    allergies: userProfile.allergies || [],
                    flavorPreferences: userProfile.flavor_preferences || [],
                    budgetLevel: userProfile.budget || 'moderate',
                    trainingFrequency: userProfile.activity_level || 'moderate'
                },
                durationDays: 7,
                forceRefresh
            });
            console.log('Diet plan generated successfully');

            setDietPlan(plan);
            setCurrentDay(1);

            // Save to database
            await saveDietPlan(user.id, plan, userProfile);
            console.log('Diet plan saved');

        } catch (error) {
            console.error('Error in handleGenerateDiet:', error);
            Alert.alert('Erro', 'Falha ao gerar plano de dieta. Tente novamente.');
        } finally {
            console.log('Setting loading to false');
            setLoading(false);
        }
    };

    const logMeal = async (recipe: any) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { error } = await supabase.from('meals_log').insert({
                user_id: user.id,
                name: recipe.name,
                calories: recipe.calories,
                protein: recipe.macros.protein,
                carbs: recipe.macros.carbs,
                fat: recipe.macros.fat,
                is_generated: true
            });

            if (error) throw error;

            Alert.alert('Delícia! 😋', 'Refeição registrada no seu diário.');
            setShowRecipeModal(false);
        } catch (error) {
            Alert.alert('Erro', 'Falha ao registrar refeição.');
        }
    };

    const handleResetPlan = () => {
        Alert.alert(
            'Novo Plano',
            'Deseja gerar um novo plano alimentar? O plano atual será substituído.',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Sim, Gerar Novo',
                    style: 'destructive',
                    onPress: () => handleGenerateDiet(true)
                }
            ]
        );
    };

    const currentMeals = dietPlan?.meals.filter(m => m.day === currentDay) || [];

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <Text style={styles.title}>Seu Plano Alimentar 🥗</Text>
                    <Text style={styles.subtitle}>Personalizado para seus objetivos</Text>
                </View>

                {!dietPlan ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="nutrition-outline" size={64} color="#cbd5e1" />
                        <Text style={styles.emptyStateText}>
                            Você ainda não tem um plano ativo.
                            Que tal criar um agora?
                        </Text>
                        <TouchableOpacity
                            onPress={handleGenerateDiet}
                            disabled={loading}
                            style={styles.generateButton}
                        >
                            {loading ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <Text style={styles.generateButtonText}>Gerar Plano Semanal ✨</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                ) : (
                    <>
                        <DietPlanCard
                            planName={dietPlan.name}
                            duration={dietPlan.duration_days}
                            calories={userProfile?.daily_calories || 2000}
                            goal={userProfile?.goal || 'health'}
                            onRegenerate={handleGenerateDiet}
                        />

                        <WeeklyView
                            days={dietPlan.duration_days}
                            currentDay={currentDay}
                            onDaySelect={setCurrentDay}
                        />

                        <Text style={styles.sectionTitle}>Refeições do Dia {currentDay}</Text>

                        {currentMeals.map((meal, index) => (
                            <RecipeCard
                                key={index}
                                type={meal.type}
                                name={meal.name}
                                calories={meal.calories}
                                macros={meal.macros}
                                cookingTime={meal.cooking_time}
                                difficulty={meal.difficulty}
                                onPress={() => {
                                    setSelectedRecipe(meal);
                                    setShowRecipeModal(true);
                                }}
                            />
                        ))}

                        <View style={styles.footerActions}>
                            <TouchableOpacity
                                style={styles.resetButton}
                                onPress={handleResetPlan}
                            >
                                <Ionicons name="refresh-circle" size={24} color="#16a34a" />
                                <Text style={styles.resetButtonText}>Gerar Novo Plano</Text>
                            </TouchableOpacity>
                        </View>
                    </>
                )}
            </ScrollView>

            {/* Recipe Detail Modal */}
            <Modal visible={showRecipeModal} animationType="slide" presentationStyle="pageSheet">
                {selectedRecipe && (
                    <View style={styles.modalContainer}>
                        <ScrollView style={styles.modalScroll}>
                            <View style={styles.modalContent}>
                                <View style={styles.modalHeader}>
                                    <Text style={styles.modalTitle}>{selectedRecipe.name}</Text>
                                    <TouchableOpacity onPress={() => setShowRecipeModal(false)} style={styles.closeButton}>
                                        <Ionicons name="close" size={24} color="black" />
                                    </TouchableOpacity>
                                </View>

                                {/* Macros Card */}
                                <View style={styles.macrosCard}>
                                    <View style={styles.macroItem}>
                                        <Text style={styles.macroValue}>{selectedRecipe.calories}</Text>
                                        <Text style={styles.macroLabel}>Calorias</Text>
                                    </View>
                                    <View style={styles.macroDivider} />
                                    <View style={styles.macroItem}>
                                        <Text style={styles.macroValue}>{selectedRecipe.macros.protein}g</Text>
                                        <Text style={styles.macroLabel}>Prot</Text>
                                    </View>
                                    <View style={styles.macroDivider} />
                                    <View style={styles.macroItem}>
                                        <Text style={styles.macroValue}>{selectedRecipe.macros.carbs}g</Text>
                                        <Text style={styles.macroLabel}>Carb</Text>
                                    </View>
                                    <View style={styles.macroDivider} />
                                    <View style={styles.macroItem}>
                                        <Text style={styles.macroValue}>{selectedRecipe.macros.fat}g</Text>
                                        <Text style={styles.macroLabel}>Gord</Text>
                                    </View>
                                </View>

                                <Text style={styles.sectionSubtitle}>Ingredientes</Text>
                                <View style={styles.ingredientsList}>
                                    {selectedRecipe.ingredients.map((ing: string, i: number) => (
                                        <Text key={i} style={styles.ingredientText}>• {ing}</Text>
                                    ))}
                                </View>

                                <Text style={styles.sectionSubtitle}>Modo de Preparo</Text>
                                <View style={styles.instructionsList}>
                                    {selectedRecipe.instructions.map((step: string, i: number) => (
                                        <View key={i} style={styles.instructionStep}>
                                            <View style={styles.stepNumber}>
                                                <Text style={styles.stepNumberText}>{i + 1}</Text>
                                            </View>
                                            <Text style={styles.instructionText}>{step}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <TouchableOpacity
                                onPress={() => logMeal(selectedRecipe)}
                                style={styles.logButton}
                            >
                                <Ionicons name="restaurant" size={24} color="white" style={{ marginRight: 8 }} />
                                <Text style={styles.logButtonText}>Comer e Registrar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    scrollContent: {
        padding: 24,
    },
    header: {
        marginBottom: 24,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#0f172a',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 16,
        color: '#64748b',
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
        backgroundColor: 'white',
        borderRadius: 24,
        marginTop: 20,
    },
    emptyStateText: {
        textAlign: 'center',
        color: '#64748b',
        fontSize: 16,
        marginTop: 16,
        marginBottom: 24,
        lineHeight: 24,
    },
    generateButton: {
        backgroundColor: '#16a34a',
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 16,
        alignItems: 'center',
        shadowColor: '#16a34a',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
        width: '100%',
    },
    generateButtonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#0f172a',
        marginBottom: 16,
    },
    modalContainer: {
        flex: 1,
        backgroundColor: 'white',
    },
    modalScroll: {
        flex: 1,
    },
    modalContent: {
        padding: 24,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    modalTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        flex: 1,
        marginRight: 16,
        color: '#0f172a',
    },
    closeButton: {
        backgroundColor: '#f1f5f9',
        padding: 8,
        borderRadius: 20,
    },
    macrosCard: {
        backgroundColor: '#f8fafc',
        padding: 16,
        borderRadius: 12,
        marginBottom: 24,
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    macroItem: {
        alignItems: 'center',
    },
    macroValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#0f172a',
    },
    macroLabel: {
        fontSize: 12,
        color: '#64748b',
    },
    macroDivider: {
        width: 1,
        backgroundColor: '#e2e8f0',
    },
    sectionSubtitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 12,
        color: '#1e293b',
    },
    ingredientsList: {
        backgroundColor: '#f8fafc',
        padding: 16,
        borderRadius: 12,
        marginBottom: 24,
    },
    ingredientText: {
        color: '#334155',
        marginBottom: 8,
        fontSize: 15,
    },
    instructionsList: {
        marginBottom: 32,
    },
    instructionStep: {
        flexDirection: 'row',
        marginBottom: 16,
    },
    stepNumber: {
        backgroundColor: '#dcfce7',
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
        marginTop: 2,
    },
    stepNumberText: {
        color: '#15803d',
        fontWeight: 'bold',
        fontSize: 12,
    },
    instructionText: {
        color: '#475569',
        flex: 1,
        lineHeight: 24,
        fontSize: 15,
    },
    modalFooter: {
        padding: 24,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    logButton: {
        backgroundColor: '#16a34a',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
    },
    logButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 18,
    },
    footerActions: {
        marginTop: 24,
        marginBottom: 40,
        alignItems: 'center',
    },
    resetButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#dcfce7',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#bbf7d0',
    },
    resetButtonText: {
        color: '#15803d',
        fontWeight: 'bold',
        fontSize: 16,
        marginLeft: 8,
    },
});

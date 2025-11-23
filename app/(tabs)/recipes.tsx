
import { DietPlanCard } from '@/components/diet/DietPlanCard';
import { RecipeCard } from '@/components/diet/RecipeCard';
import { WeeklyView } from '@/components/diet/WeeklyView';
import { getActiveDietPlan, saveDietPlan } from '@/lib/diet';
import { DietPlan, generateAlternativeRecipe, generatePersonalizedDiet } from '@/lib/openai';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const AI_LOADING_MESSAGES = [
    '🤖 IA analisando suas preferências...',
    '📊 Calculando macros personalizados...',
    '🍳 Selecionando receitas brasileiras...',
    '⚖️ Balanceando nutrientes...',
    '✨ Finalizando seu plano semanal...'
];

export default function DietScreen() {
    const [loading, setLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState(AI_LOADING_MESSAGES[0]);
    const [loadingProgress, setLoadingProgress] = useState(0);
    const [swappingRecipeIndex, setSwappingRecipeIndex] = useState<number | null>(null);
    const [showSwapModal, setShowSwapModal] = useState(false);
    const [swapReason, setSwapReason] = useState('');
    const [recipeToSwap, setRecipeToSwap] = useState<{ meal: any, index: number } | null>(null);
    const [dietPlan, setDietPlan] = useState<DietPlan | null>(null);
    const [currentDay, setCurrentDay] = useState(1);
    const [showRecipeModal, setShowRecipeModal] = useState(false);
    const [selectedRecipe, setSelectedRecipe] = useState<any>(null);
    const [userProfile, setUserProfile] = useState<any>(null);
    const pulseAnim = useState(new Animated.Value(1))[0];

    useFocusEffect(
        useCallback(() => {
            loadUserProfile();
        }, [])
    );

    // Rotate loading messages and simulate progress
    useEffect(() => {
        if (!loading) {
            setLoadingProgress(0);
            return;
        }

        let messageIndex = 0;
        let progress = 0;

        // Rotate messages every 2 seconds
        const messageInterval = setInterval(() => {
            messageIndex = (messageIndex + 1) % AI_LOADING_MESSAGES.length;
            setLoadingMessage(AI_LOADING_MESSAGES[messageIndex]);
        }, 2000);

        // Linear progress: 1% every 200ms = 20 seconds to reach 100%
        const progressInterval = setInterval(() => {
            progress += 1;
            if (progress <= 100) {
                setLoadingProgress(progress);
            }
        }, 200);

        return () => {
            clearInterval(messageInterval);
            clearInterval(progressInterval);
        };
    }, [loading]);

    // Pulse animation for AI icon
    useEffect(() => {
        if (!loading) return;

        const pulse = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.2,
                    duration: 1000,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 1000,
                    useNativeDriver: true,
                }),
            ])
        );
        pulse.start();

        return () => pulse.stop();
    }, [loading, pulseAnim]);

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
        setLoadingProgress(0);
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

            // Complete progress to 100%
            setLoadingProgress(100);
            await new Promise(resolve => setTimeout(resolve, 300)); // Brief pause at 100%

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

    const handleSwapRecipe = async (mealIndex: number) => {
        if (!dietPlan || !userProfile) return;

        const meal = currentMeals[mealIndex];

        // Show modal to ask for reason
        setRecipeToSwap({ meal, index: mealIndex });
        setSwapReason('');
        setShowSwapModal(true);
    };

    const confirmSwapRecipe = async () => {
        if (!recipeToSwap || !dietPlan || !userProfile) return;

        const { meal, index: mealIndex } = recipeToSwap;
        setShowSwapModal(false);
        setSwappingRecipeIndex(mealIndex); // Show loading on button

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Generate alternative recipe with same type and reason
            const alternativeRecipe = await generateAlternativeRecipe({
                userId: user.id,
                originalRecipe: {
                    type: meal.type, // Preserve meal type (breakfast, lunch, dinner, snack)
                    calories: meal.calories,
                    macros: meal.macros,
                    cooking_time: meal.cooking_time,
                },
                profile: {
                    goal: userProfile.goal,
                    cookingTime: userProfile.cooking_time || 30,
                    availableEquipment: userProfile.equipment || [],
                    dietaryRestrictions: userProfile.dietary_restrictions || [],
                    allergies: userProfile.allergies || [],
                    budgetLevel: userProfile.budget || 'moderate',
                },
                swapReason: swapReason.trim() || undefined, // Pass user's reason
            });

            // Update diet plan - replace the specific meal
            const updatedMeals = dietPlan.meals.map((m) => {
                // Match by day, type, and name to replace exact meal
                if (m.day === currentDay && m.type === meal.type && m.name === meal.name) {
                    return { ...alternativeRecipe, day: currentDay }; // Ensure day is preserved
                }
                return m;
            });

            const updatedPlan = { ...dietPlan, meals: updatedMeals };
            setDietPlan(updatedPlan);

            // Save updated plan
            await saveDietPlan(user.id, updatedPlan, userProfile);

            Alert.alert('✨ Receita Trocada!', `Nova receita: ${alternativeRecipe.name}`);
        } catch (error) {
            console.error('Error swapping recipe:', error);
            Alert.alert('Erro', 'Falha ao trocar receita. Tente novamente.');
        } finally {
            setSwappingRecipeIndex(null);
        }
    };

    // Order meals correctly: breakfast, snack_morning, lunch, snack (afternoon), dinner, snack_night
    const mealOrder: Record<string, number> = {
        breakfast: 1,
        snack_morning: 2,
        lunch: 3,
        snack: 4,  // Lanche tarde (entre almoço e jantar)
        dinner: 5,
        snack_night: 6
    };
    const currentMeals = (dietPlan?.meals.filter(m => m.day === currentDay) || [])
        .sort((a, b) => (mealOrder[a.type] || 99) - (mealOrder[b.type] || 99));

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
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
                            onPress={() => handleGenerateDiet()}
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

                        {/* Botão Gerar Novo Plano - MOVIDO PARA CIMA */}
                        <View style={styles.generateNewSection}>
                            <TouchableOpacity
                                style={styles.generateNewButton}
                                onPress={() => handleResetPlan()}
                                disabled={loading}
                            >
                                <Ionicons name="sparkles" size={20} color="#16a34a" />
                                <Text style={styles.generateNewButtonText}>Gerar Novo Plano com IA</Text>
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.sectionTitle}>Refeições do Dia {currentDay}</Text>

                        {currentMeals.map((meal, index) => (
                            <RecipeCard
                                key={`${meal.type}-${index}`}
                                type={meal.type}
                                name={swappingRecipeIndex === index ? '🔄 Trocando...' : meal.name}
                                calories={meal.calories}
                                macros={meal.macros}
                                cookingTime={meal.cooking_time}
                                difficulty={meal.difficulty}
                                onPress={() => {
                                    if (swappingRecipeIndex === index) return; // Prevent opening while swapping
                                    setSelectedRecipe(meal);
                                    setShowRecipeModal(true);
                                }}
                                onSwap={swappingRecipeIndex === index ? undefined : () => handleSwapRecipe(index)}
                            />
                        ))}
                    </>
                )}
            </ScrollView>

            {/* AI Loading Overlay */}
            {loading && (
                <View style={styles.loadingOverlay}>
                    <View style={styles.loadingCard}>
                        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                            <Text style={styles.loadingIcon}>🤖</Text>
                        </Animated.View>
                        <Text style={styles.loadingTitle}>Gerando seu plano...</Text>
                        <Text style={styles.loadingMessage}>{loadingMessage}</Text>

                        {/* Progress Bar */}
                        <View style={styles.progressContainer}>
                            <View style={styles.progressBarBackground}>
                                <View style={[styles.progressBarFill, { width: `${loadingProgress}%` }]} />
                            </View>
                            <Text style={styles.progressText}>{loadingProgress}%</Text>
                        </View>
                    </View>
                </View>
            )}

            {/* Swap Reason Modal */}
            <Modal visible={showSwapModal} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.swapModalCard}>
                        <Text style={styles.swapModalTitle}>Por que trocar?</Text>
                        <Text style={styles.swapModalSubtitle}>
                            Ex: "Não tenho aveia", "Não gosto de banana"
                        </Text>

                        <View style={styles.inputContainer}>
                            <Ionicons name="create-outline" size={20} color="#6b7280" style={styles.inputIcon} />
                            <TextInput
                                style={styles.swapInput}
                                placeholder="Digite o motivo (opcional)"
                                value={swapReason}
                                onChangeText={setSwapReason}
                                multiline
                                numberOfLines={3}
                                autoFocus
                            />
                        </View>

                        <View style={styles.swapModalButtons}>
                            <TouchableOpacity
                                style={styles.swapCancelButton}
                                onPress={() => {
                                    setShowSwapModal(false);
                                    setRecipeToSwap(null);
                                    setSwapReason('');
                                }}
                            >
                                <Text style={styles.swapCancelText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.swapConfirmButton}
                                onPress={confirmSwapRecipe}
                            >
                                <Ionicons name="swap-horizontal" size={20} color="white" />
                                <Text style={styles.swapConfirmText}>Trocar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

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
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
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
    generateNewSection: {
        marginVertical: 16,
        alignItems: 'center',
    },
    generateNewButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#dcfce7',
        paddingVertical: 14,
        paddingHorizontal: 28,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: '#16a34a',
        shadowColor: '#16a34a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    generateNewButtonText: {
        color: '#15803d',
        fontWeight: 'bold',
        fontSize: 16,
        marginLeft: 8,
    },
    loadingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    loadingCard: {
        backgroundColor: 'white',
        borderRadius: 24,
        padding: 32,
        alignItems: 'center',
        maxWidth: 320,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    loadingIcon: {
        fontSize: 64,
        marginBottom: 16,
    },
    loadingTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#0f172a',
        marginBottom: 8,
    },
    loadingMessage: {
        fontSize: 14,
        color: '#64748b',
        textAlign: 'center',
        lineHeight: 20,
    },
    progressContainer: {
        width: '100%',
        marginTop: 24,
        alignItems: 'center',
    },
    progressBarBackground: {
        width: '100%',
        height: 8,
        backgroundColor: '#e2e8f0',
        borderRadius: 4,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: '#16a34a',
        borderRadius: 4,
    },
    progressText: {
        marginTop: 8,
        fontSize: 16,
        fontWeight: 'bold',
        color: '#16a34a',
    },
    swapModalCard: {
        backgroundColor: 'white',
        borderRadius: 24,
        padding: 24,
        width: '90%',
        maxWidth: 400,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 8,
    },
    swapModalTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#1f2937',
        marginBottom: 8,
        textAlign: 'center',
    },
    swapModalSubtitle: {
        fontSize: 14,
        color: '#6b7280',
        marginBottom: 20,
        textAlign: 'center',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: '#f9fafb',
        borderRadius: 12,
        padding: 12,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    inputIcon: {
        marginRight: 8,
        marginTop: 2,
    },
    swapInput: {
        flex: 1,
        fontSize: 16,
        color: '#1f2937',
        minHeight: 60,
        textAlignVertical: 'top',
    },
    swapModalButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    swapCancelButton: {
        flex: 1,
        padding: 16,
        borderRadius: 12,
        backgroundColor: '#f3f4f6',
        alignItems: 'center',
    },
    swapCancelText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#6b7280',
    },
    swapConfirmButton: {
        flex: 1,
        padding: 16,
        borderRadius: 12,
        backgroundColor: '#16a34a',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    swapConfirmText: {
        fontSize: 16,
        fontWeight: '600',
        color: 'white',
    },
});

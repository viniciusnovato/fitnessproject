import { getActiveDietPlan } from '@/lib/diet';
import { calculateNutrition, parseActivityLevel, parseGoal, parseSex } from '@/lib/nutrition-calculator';
import { analyzeMealImage } from '@/lib/openai';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [nutrition, setNutrition] = useState<any>(null);

  const [weightHistory, setWeightHistory] = useState<any[]>([]);

  // Meal Logging State
  const [todaysMeals, setTodaysMeals] = useState<any[]>([]);
  const [todaysMacros, setTodaysMacros] = useState({ calories: 0, protein: 0, carbs: 0, fat: 0 });

  // Camera/AI State
  const [analyzing, setAnalyzing] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [scannedMeal, setScannedMeal] = useState<any>(null);

  // Plan/Recipe State
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [planRecipes, setPlanRecipes] = useState<any[]>([]);
  const [loadingPlan, setLoadingPlan] = useState(false);

  useFocusEffect(
    useCallback(() => {
      checkUser();
    }, [])
  );

  useEffect(() => {
    if (user) {
      loadTodaysMeals();
    }
  }, [user]);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);

    if (user) {
      // Fetch profile from database
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      setProfile(profileData);

      // Fetch weight history for starting weight
      const { data: historyData } = await supabase
        .from('weight_history')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: true }); // Oldest first

      setWeightHistory(historyData || []);

      // If no profile, redirect to onboarding
      if (!profileData) {
        router.replace('/onboarding');
        return;
      }

      // Note: We allow access to Home even if onboarding is not completed
      // User can complete it later from Profile screen

      // Calculate nutrition if we have all required data
      if (profileData.weight && profileData.height && profileData.birth_date && profileData.sex) {
        const birthDate = new Date(profileData.birth_date);
        const age = new Date().getFullYear() - birthDate.getFullYear();

        const nutritionData = calculateNutrition({
          weight: parseFloat(profileData.weight),
          height: parseFloat(profileData.height),
          age,
          sex: parseSex(profileData.sex),
          activityLevel: parseActivityLevel(profileData.activity_level),
          goal: parseGoal(profileData.goal),
        });

        setNutrition(nutritionData);
      }
    }

    setLoading(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace('/');
  };

  const calculateProgress = () => {
    if (!profile?.weight || !profile?.target_weight) return 0;

    const current = parseFloat(profile.weight);
    const target = parseFloat(profile.target_weight);
    // Use oldest history entry as start, or current if no history
    const start = weightHistory.length > 0 ? weightHistory[0].weight : current;

    if (current === target) return 100;
    if (start === target) return 100;

    const totalDiff = Math.abs(start - target);
    const currentDiff = Math.abs(current - target);

    // If moved away from target
    if (currentDiff > totalDiff) return 0;

    const progress = ((totalDiff - currentDiff) / totalDiff) * 100;
    return Math.min(Math.round(progress), 100);
  };

  const loadTodaysMeals = async () => {
    if (!user) return;

    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('meals_log')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', `${today}T00:00:00`)
      .lte('date', `${today}T23:59:59`)
      .order('date', { ascending: true });

    if (data) {
      setTodaysMeals(data);

      // Calculate totals
      const totals = data.reduce((acc, meal) => ({
        calories: acc.calories + (meal.calories || 0),
        protein: acc.protein + (meal.protein || 0),
        carbs: acc.carbs + (meal.carbs || 0),
        fat: acc.fat + (meal.fat || 0),
      }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

      setTodaysMacros(totals);
    }
  };

  const handleCameraCapture = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão necessária', 'Precisamos de acesso à câmera para analisar sua comida.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      analyzeImage(result.assets[0].base64);
    }
  };

  const analyzeImage = async (base64: string) => {
    setAnalyzing(true);
    try {
      const analysis = await analyzeMealImage(base64, user.id);
      if (analysis && !analysis.error) {
        setScannedMeal(analysis);
        setShowCameraModal(true);
      } else {
        Alert.alert('Erro', 'Não foi possível identificar comida na imagem.');
      }
    } catch (error) {
      Alert.alert('Erro', 'Falha na análise da imagem.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handlePlanSelection = async () => {
    setLoadingPlan(true);
    setShowPlanModal(true);
    try {
      const plan = await getActiveDietPlan(user.id);
      if (plan) {
        // Get today's day of week (1-7, Sunday is 1 in some systems but let's check logic)
        // Assuming plan logic uses 1=Monday or similar. Let's just get all recipes for now or filter by day index if possible.
        // For simplicity, showing all recipes in the plan to let user choose.
        // Or better: filter by current day index if we knew when the plan started.
        // Let's show all recipes from the plan grouped by day or just flat list.

        // Plan structure is flat meals array with 'day' property
        const allRecipes = plan.meals.map((meal: any) => ({
          ...meal,
          dayName: `Dia ${meal.day}`
        }));

        setPlanRecipes(allRecipes);
      } else {
        Alert.alert('Sem Plano', 'Você ainda não tem um plano alimentar ativo. Vá em Receitas para gerar um.');
        setShowPlanModal(false);
      }
    } catch (error) {
      Alert.alert('Erro', 'Falha ao carregar plano.');
    } finally {
      setLoadingPlan(false);
    }
  };

  const saveMeal = async (mealData: any) => {
    try {
      const { error } = await supabase.from('meals_log').insert({
        user_id: user.id,
        name: mealData.name,
        calories: mealData.calories,
        protein: mealData.protein,
        carbs: mealData.carbs,
        fat: mealData.fat,
        is_generated: true,
        date: new Date().toISOString() // Current time
      });

      if (error) throw error;

      Alert.alert('Sucesso', 'Refeição registrada!');
      setShowCameraModal(false);
      setShowPlanModal(false);
      setScannedMeal(null);
      loadTodaysMeals(); // Refresh data
    } catch (error) {
      Alert.alert('Erro', 'Falha ao salvar refeição.');
    }
  };

  const getStartingWeight = () => {
    if (weightHistory.length > 0) return weightHistory[0].weight;
    return profile?.weight || '—';
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Carregando...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Olá,</Text>
            <View style={styles.userNameContainer}>
              <Text style={styles.userName}>
                {profile?.full_name || 'Visitante'}
              </Text>
              {profile?.subscription_status?.includes('pro') && (
                <View style={styles.proBadge}>
                  <Text style={styles.proText}>PRO</Text>
                </View>
              )}
            </View>
          </View>
          <TouchableOpacity onPress={handleSignOut} style={styles.signOutButton}>
            <Text style={styles.signOutText}>Sair</Text>
          </TouchableOpacity>
        </View>

        {/* Meta Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sua Meta</Text>
          <View style={styles.goalContainer}>
            <View style={styles.goalItem}>
              <Text style={styles.goalValue}>{getStartingWeight()}kg</Text>
              <Text style={styles.goalLabel}>Inicial</Text>
            </View>
            <View style={styles.goalDivider} />
            <View style={styles.goalItem}>
              <Text style={styles.goalValue}>{profile?.weight || '—'}kg</Text>
              <Text style={styles.goalLabel}>Atual</Text>
            </View>
            <View style={styles.goalDivider} />
            <View style={styles.goalItem}>
              <Text style={styles.goalValue}>{profile?.target_weight || '—'}kg</Text>
              <Text style={styles.goalLabel}>Meta</Text>
            </View>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${calculateProgress()}%` }]} />
          </View>
          <Text style={styles.progressText}>{calculateProgress()}% concluído</Text>
        </View>

        {/* Macros do Dia */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Macros de Hoje</Text>
          {nutrition ? (
            <>
              <View style={styles.macrosGrid}>
                <View style={styles.macroCard}>
                  <Text style={styles.macroValue}>{todaysMacros.calories}</Text>
                  <Text style={styles.macroLabel}>Calorias</Text>
                  <Text style={styles.macroTarget}>de {nutrition.targetCalories}</Text>
                </View>
                <View style={styles.macroCard}>
                  <Text style={styles.macroValue}>{todaysMacros.protein}g</Text>
                  <Text style={styles.macroLabel}>Proteínas</Text>
                  <Text style={styles.macroTarget}>de {nutrition.macros.protein}g</Text>
                </View>
                <View style={styles.macroCard}>
                  <Text style={styles.macroValue}>{todaysMacros.carbs}g</Text>
                  <Text style={styles.macroLabel}>Carbos</Text>
                  <Text style={styles.macroTarget}>de {nutrition.macros.carbs}g</Text>
                </View>
                <View style={styles.macroCard}>
                  <Text style={styles.macroValue}>{todaysMacros.fat}g</Text>
                  <Text style={styles.macroLabel}>Gorduras</Text>
                  <Text style={styles.macroTarget}>de {nutrition.macros.fat}g</Text>
                </View>
              </View>

              {/* Informações Nutricionais Detalhadas */}
              <View style={styles.nutritionDetailsContainer}>
                <View style={styles.nutritionDetailCard}>
                  <View style={styles.nutritionDetailHeader}>
                    <Text style={styles.nutritionDetailIcon}>🔥</Text>
                    <View style={styles.nutritionDetailTextContainer}>
                      <Text style={styles.nutritionDetailTitle}>Metabolismo Basal</Text>
                      <Text style={styles.nutritionDetailSubtitle}>Calorias que você queima em repouso</Text>
                    </View>
                  </View>
                  <Text style={styles.nutritionDetailValue}>{nutrition.bmr} kcal/dia</Text>
                </View>

                <View style={styles.nutritionDetailCard}>
                  <View style={styles.nutritionDetailHeader}>
                    <Text style={styles.nutritionDetailIcon}>⚡</Text>
                    <View style={styles.nutritionDetailTextContainer}>
                      <Text style={styles.nutritionDetailTitle}>Gasto Diário Total</Text>
                      <Text style={styles.nutritionDetailSubtitle}>Com suas atividades do dia</Text>
                    </View>
                  </View>
                  <Text style={styles.nutritionDetailValue}>{nutrition.tdee} kcal/dia</Text>
                </View>

                <View style={styles.nutritionDetailCard}>
                  <View style={styles.nutritionDetailHeader}>
                    <Text style={styles.nutritionDetailIcon}>🎯</Text>
                    <View style={styles.nutritionDetailTextContainer}>
                      <Text style={styles.nutritionDetailTitle}>Sua Meta Diária</Text>
                      <Text style={styles.nutritionDetailSubtitle}>Para atingir seu objetivo</Text>
                    </View>
                  </View>
                  <Text style={styles.nutritionDetailValue}>{nutrition.dailyCalories} kcal/dia</Text>
                </View>
              </View>

              {nutrition.weeklyWeightChange !== 0 && (
                <View style={styles.predictionCard}>
                  <Text style={styles.predictionIcon}>📊</Text>
                  <Text style={styles.predictionText}>
                    Previsão: {nutrition.weeklyWeightChange > 0 ? '+' : ''}{nutrition.weeklyWeightChange}kg por semana
                  </Text>
                </View>
              )}
            </>
          ) : (
            <Text style={styles.noDataText}>Complete seu perfil para ver suas metas nutricionais</Text>
          )}
        </View>

        {/* Refeições */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Refeições de Hoje</Text>
          <View style={styles.mealsList}>
            <MealItem name="Café da Manhã" time="08:00" completed />
            <MealItem name="Almoço" time="12:30" completed />
            <MealItem name="Lanche" time="16:00" />
            <MealItem name="Jantar" time="19:30" />
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleCameraCapture}
            disabled={analyzing}
          >
            {analyzing ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.actionButtonText}>📸 Registrar por Foto</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#3b82f6' }]}
            onPress={handlePlanSelection}
            disabled={loadingPlan}
          >
            {loadingPlan ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.actionButtonText}>📅 Registrar do Plano</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Camera Confirmation Modal */}
      <Modal visible={showCameraModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Confirmar Refeição</Text>
              <TouchableOpacity onPress={() => setShowCameraModal(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            {scannedMeal && (
              <ScrollView>
                <View style={styles.aiResultBox}>
                  <Text style={styles.aiLabel}>IA Identificou:</Text>
                  <TextInput
                    style={styles.mealNameInput}
                    value={scannedMeal.name}
                    onChangeText={(t) => setScannedMeal({ ...scannedMeal, name: t })}
                  />
                </View>

                <View style={styles.macrosInputGrid}>
                  <View style={styles.macroInputItem}>
                    <Text style={styles.macroInputLabel}>Calorias</Text>
                    <TextInput
                      style={styles.macroInput}
                      value={scannedMeal.calories?.toString()}
                      onChangeText={(t) => setScannedMeal({ ...scannedMeal, calories: parseInt(t) || 0 })}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.macroInputItem}>
                    <Text style={styles.macroInputLabel}>Prot (g)</Text>
                    <TextInput
                      style={styles.macroInput}
                      value={scannedMeal.protein?.toString()}
                      onChangeText={(t) => setScannedMeal({ ...scannedMeal, protein: parseFloat(t) || 0 })}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.macroInputItem}>
                    <Text style={styles.macroInputLabel}>Carb (g)</Text>
                    <TextInput
                      style={styles.macroInput}
                      value={scannedMeal.carbs?.toString()}
                      onChangeText={(t) => setScannedMeal({ ...scannedMeal, carbs: parseFloat(t) || 0 })}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.macroInputItem}>
                    <Text style={styles.macroInputLabel}>Gord (g)</Text>
                    <TextInput
                      style={styles.macroInput}
                      value={scannedMeal.fat?.toString()}
                      onChangeText={(t) => setScannedMeal({ ...scannedMeal, fat: parseFloat(t) || 0 })}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.confirmButton}
                  onPress={() => saveMeal(scannedMeal)}
                >
                  <Text style={styles.confirmButtonText}>Confirmar e Salvar</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Plan Selection Modal */}
      <Modal visible={showPlanModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Selecionar do Plano</Text>
              <TouchableOpacity onPress={() => setShowPlanModal(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.planList}>
              {planRecipes.length > 0 ? (
                planRecipes.map((recipe, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.planRecipeItem}
                    onPress={() => saveMeal(recipe)}
                  >
                    <View>
                      <Text style={styles.planRecipeName}>{recipe.name}</Text>
                      <Text style={styles.planRecipeDay}>{recipe.dayName} - {recipe.type}</Text>
                    </View>
                    <View style={styles.planRecipeMacros}>
                      <Text style={styles.planRecipeCal}>{recipe.calories || recipe.macros?.calories || 0} kcal</Text>
                    </View>
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={styles.emptyText}>Nenhuma receita encontrada no plano.</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function MealItem({ name, time, completed = false }: { name: string; time: string; completed?: boolean }) {
  return (
    <View style={styles.mealItem}>
      <View style={[styles.mealCheckbox, completed && styles.mealCheckboxCompleted]}>
        {completed && <Text style={styles.checkmark}>✓</Text>}
      </View>
      <View style={styles.mealInfo}>
        <Text style={styles.mealName}>{name}</Text>
        <Text style={styles.mealTime}>{time}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
  },
  scrollContent: {
    padding: 20,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  greeting: {
    fontSize: 16,
    color: '#6b7280',
  },
  userName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  userNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  proBadge: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  proText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  signOutButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#fee2e2',
  },
  signOutText: {
    color: '#dc2626',
    fontWeight: '600',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
  },
  goalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  goalItem: {
    alignItems: 'center',
  },
  goalValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#22c55e',
  },
  goalLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  goalDivider: {
    width: 1,
    backgroundColor: '#e5e7eb',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#22c55e',
  },
  progressText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  macrosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  macroCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  macroValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  macroLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  macroTarget: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  mealsList: {
    gap: 12,
  },
  mealItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  mealCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#d1d5db',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mealCheckboxCompleted: {
    backgroundColor: '#22c55e',
    borderColor: '#22c55e',
  },
  checkmark: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  mealInfo: {
    flex: 1,
  },
  mealName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  mealTime: {
    fontSize: 14,
    color: '#6b7280',
  },
  actionsContainer: {
    gap: 12,
    marginTop: 8,
  },
  actionButton: {
    backgroundColor: '#22c55e',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  nutritionInfo: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  nutritionInfoText: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 4,
  },
  noDataText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 8,
  },
  // Nutrition Details
  nutritionDetailsContainer: {
    gap: 12,
    marginTop: 16,
  },
  nutritionDetailCard: {
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  nutritionDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  nutritionDetailIcon: {
    fontSize: 24,
  },
  nutritionDetailTextContainer: {
    flex: 1,
  },
  nutritionDetailTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  nutritionDetailSubtitle: {
    fontSize: 13,
    color: '#6b7280',
  },
  nutritionDetailValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#3b82f6',
    textAlign: 'right',
  },
  predictionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
    gap: 12,
  },
  predictionIcon: {
    fontSize: 24,
  },
  predictionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#92400e',
  },
  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    height: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  aiResultBox: {
    backgroundColor: '#f0fdf4',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dcfce7',
    marginBottom: 24,
  },
  aiLabel: {
    fontSize: 14,
    color: '#166534',
    marginBottom: 8,
    fontWeight: '600',
  },
  mealNameInput: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#14532d',
  },
  macrosInputGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  macroInputItem: {
    width: '48%',
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  macroInputLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  macroInput: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  confirmButton: {
    backgroundColor: '#22c55e',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  planList: {
    gap: 12,
    paddingBottom: 40,
  },
  planRecipeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  planRecipeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  planRecipeDay: {
    fontSize: 14,
    color: '#6b7280',
  },
  planRecipeMacros: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  planRecipeCal: {
    color: '#1e40af',
    fontWeight: 'bold',
    fontSize: 14,
  },
  emptyText: {
    textAlign: 'center',
    color: '#9ca3af',
    marginTop: 20,
    fontSize: 16,
  },
});

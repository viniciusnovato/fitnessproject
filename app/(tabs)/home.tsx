import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { calculateNutrition, parseSex, parseActivityLevel, parseGoal } from '@/lib/nutrition-calculator';

export default function HomeScreen() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [nutrition, setNutrition] = useState<any>(null);

  const [weightHistory, setWeightHistory] = useState<any[]>([]);

  useEffect(() => {
    checkUser();
  }, []);

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
                  <Text style={styles.macroValue}>0</Text>
                  <Text style={styles.macroLabel}>Calorias</Text>
                  <Text style={styles.macroTarget}>de {nutrition.targetCalories}</Text>
                </View>
                <View style={styles.macroCard}>
                  <Text style={styles.macroValue}>0g</Text>
                  <Text style={styles.macroLabel}>Proteínas</Text>
                  <Text style={styles.macroTarget}>de {nutrition.macros.protein}g</Text>
                </View>
                <View style={styles.macroCard}>
                  <Text style={styles.macroValue}>0g</Text>
                  <Text style={styles.macroLabel}>Carbos</Text>
                  <Text style={styles.macroTarget}>de {nutrition.macros.carbs}g</Text>
                </View>
                <View style={styles.macroCard}>
                  <Text style={styles.macroValue}>0g</Text>
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
          <TouchableOpacity style={styles.actionButton}>
            <Text style={styles.actionButtonText}>📸 Adicionar Ingredientes</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <Text style={styles.actionButtonText}>🍳 Gerar Receita</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
});

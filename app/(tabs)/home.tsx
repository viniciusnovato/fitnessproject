import { getActiveDietPlan } from '@/lib/diet';
import { calculateNutrition, parseActivityLevel, parseGoal, parseSex } from '@/lib/nutrition-calculator';
import { analyzeMealImage, analyzeMealWithContext, generateGoalInsights } from '@/lib/openai';
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
  const [goalInsights, setGoalInsights] = useState<any>(null);

  // Meal Logging State
  const [todaysMeals, setTodaysMeals] = useState<any[]>([]);
  const [todaysMacros, setTodaysMacros] = useState({ calories: 0, protein: 0, carbs: 0, fat: 0 });

  // Camera/AI State
  const [analyzing, setAnalyzing] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [scannedMeal, setScannedMeal] = useState<any>(null);

  // Enhanced Photo Capture State
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [userDescription, setUserDescription] = useState('');
  const [mealTypes, setMealTypes] = useState<Set<string>>(new Set(['meal']));
  const [showEnhancedModal, setShowEnhancedModal] = useState(false);
  const [showPhotoHelpModal, setShowPhotoHelpModal] = useState(false);
  const [dontShowPhotoHelp, setDontShowPhotoHelp] = useState(false);

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
        .order('date', { ascending: false }); // Newest first

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

  const fetchGoalInsights = async () => {
    if (!profile || !user || weightHistory.length === 0) return;

    try {
      const insights = await generateGoalInsights(profile, weightHistory, user.id);
      if (insights) {
        setGoalInsights(insights);
      }
    } catch (error) {
      console.error('Error fetching goal insights:', error);
    }
  };

  // Fetch insights when profile and weight history are available
  useEffect(() => {
    if (profile && weightHistory.length > 0) {
      fetchGoalInsights();
    }
  }, [profile, weightHistory]);

  const calculateProgress = () => {
    if (!profile?.weight || !profile?.target_weight) return 0;

    const current = parseFloat(profile.weight);
    const target = parseFloat(profile.target_weight);
    // Use oldest history entry as start (last item since we fetch descending), or current if no history
    const start = weightHistory.length > 0 ? weightHistory[weightHistory.length - 1].weight : current;

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
    // Show help modal first time (unless user opted out)
    if (!dontShowPhotoHelp) {
      setShowPhotoHelpModal(true);
      return;
    }

    // Proceed directly to camera
    await takePicture();
  };

  const takePicture = async () => {
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
      // Add first image and open enhanced modal
      setCapturedImages([result.assets[0].base64]);
      setShowEnhancedModal(true);
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

  // Enhanced photo capture functions
  const handleAddPhoto = async () => {
    if (capturedImages.length >= 3) {
      Alert.alert('Limite atingido', 'Você pode adicionar no máximo 3 fotos.');
      return;
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão necessária', 'Precisamos de acesso à câmera.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setCapturedImages([...capturedImages, result.assets[0].base64]);
    }
  };

  const handleRemovePhoto = (index: number) => {
    const newImages = capturedImages.filter((_, i) => i !== index);
    setCapturedImages(newImages);
    if (newImages.length === 0) {
      setShowEnhancedModal(false);
    }
  };

  const toggleMealType = (type: string) => {
    const newTypes = new Set(mealTypes);
    if (newTypes.has(type)) {
      newTypes.delete(type);
      if (newTypes.size === 0) newTypes.add('meal'); // Always have at least one type
    } else {
      newTypes.add(type);
    }
    setMealTypes(newTypes);
  };

  const analyzeWithContext = async () => {
    if (capturedImages.length === 0) {
      Alert.alert('Erro', 'Adicione pelo menos uma foto.');
      return;
    }

    setAnalyzing(true);
    try {
      const analysis = await analyzeMealWithContext({
        images: capturedImages,
        description: userDescription.trim() || undefined,
        mealTypes: Array.from(mealTypes),
        userId: user.id,
      });

      if (analysis && !analysis.error) {
        setScannedMeal(analysis);
        setShowEnhancedModal(false);
        setShowCameraModal(true);
        // Reset enhanced modal state
        setCapturedImages([]);
        setUserDescription('');
        setMealTypes(new Set(['meal']));
      } else {
        Alert.alert(
          'Não consegui identificar',
          analysis?.error || 'Tente tirar uma foto mais clara do prato ou adicione uma descrição do que você comeu.\n\nDica: Fotos da tabela nutricional ajudam muito na precisão!',
          [{ text: 'OK' }]
        );
      }
    } catch (error: any) {
      console.error('Erro na análise:', error);
      Alert.alert(
        'Erro na análise',
        'Houve um problema ao analisar a imagem. Verifique sua conexão e tente novamente.\n\nSe o problema persistir, tente adicionar uma descrição do que você comeu.',
        [{ text: 'OK' }]
      );
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

  const deleteMeal = async (mealId: string) => {
    Alert.alert(
      'Deletar Refeição',
      'Tem certeza que deseja deletar esta refeição?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Deletar',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('meals_log')
                .delete()
                .eq('id', mealId);

              if (error) throw error;

              Alert.alert('Sucesso', 'Refeição deletada!');
              loadTodaysMeals(); // Refresh data
            } catch (error) {
              Alert.alert('Erro', 'Falha ao deletar refeição.');
            }
          }
        }
      ]
    );
  };

  const getStartingWeight = () => {
    if (weightHistory.length > 0) return weightHistory[weightHistory.length - 1].weight;
    return profile?.weight || '—';
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Carregando...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
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

        {/* Meta com Insights de IA */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sua Meta</Text>

          {/* Goal Stats */}
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

          {/* AI Insights */}
          {goalInsights ? (
            <View style={[styles.goalInsightsCard, {
              backgroundColor: goalInsights.bgColor || '#eff6ff',
              borderColor: goalInsights.borderColor || '#bfdbfe'
            }]}>
              <View style={styles.goalInsightsHeader}>
                <Text style={styles.goalInsightsEmoji}>{goalInsights.emoji || '🤖'}</Text>
                <Text style={[styles.goalInsightsTitle, { color: goalInsights.color || '#3b82f6' }]}>
                  {goalInsights.title || 'Análise da Meta'}
                </Text>
              </View>
              <Text style={styles.goalInsightsMessage}>
                {goalInsights.message || 'Analisando seu progresso...'}
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${calculateProgress()}%` }]} />
              </View>
              <Text style={styles.progressText}>{calculateProgress()}% concluído</Text>
            </>
          )}
        </View>

        {/* Macros do Dia */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Macros de Hoje</Text>
          {nutrition ? (
            <>
              <View style={styles.macrosGrid}>
                <View style={styles.macroCard}>
                  <Text style={styles.macroValue}>{Math.round(todaysMacros.calories)}</Text>
                  <Text style={styles.macroLabel}>Calorias</Text>
                  <Text style={styles.macroTarget}>de {Math.round(nutrition.targetCalories)}</Text>
                </View>
                <View style={styles.macroCard}>
                  <Text style={styles.macroValue}>{Math.round(todaysMacros.protein)}g</Text>
                  <Text style={styles.macroLabel}>Proteínas</Text>
                  <Text style={styles.macroTarget}>de {Math.round(nutrition.macros.protein)}g</Text>
                </View>
                <View style={styles.macroCard}>
                  <Text style={styles.macroValue}>{Math.round(todaysMacros.carbs)}g</Text>
                  <Text style={styles.macroLabel}>Carbos</Text>
                  <Text style={styles.macroTarget}>de {Math.round(nutrition.macros.carbs)}g</Text>
                </View>
                <View style={styles.macroCard}>
                  <Text style={styles.macroValue}>{Math.round(todaysMacros.fat)}g</Text>
                  <Text style={styles.macroLabel}>Gorduras</Text>
                  <Text style={styles.macroTarget}>de {Math.round(nutrition.macros.fat)}g</Text>
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
                  <Text style={styles.nutritionDetailValue}>{nutrition.targetCalories} kcal/dia</Text>
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
          {todaysMeals.length > 0 ? (
            <View style={styles.mealsList}>
              {todaysMeals.map((meal, index) => (
                <MealLogItem
                  key={meal.id || index}
                  meal={meal}
                  onDelete={() => deleteMeal(meal.id)}
                />
              ))}
            </View>
          ) : (
            <Text style={styles.noMealsText}>Nenhuma refeição registrada hoje</Text>
          )}
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

      {/* Photo Help Modal */}
      <Modal visible={showPhotoHelpModal} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.helpModalContent}>
            <View style={styles.helpIconContainer}>
              <Ionicons name="camera" size={48} color="#22c55e" />
            </View>

            <Text style={styles.helpTitle}>Dicas para Melhor Precisão</Text>

            <View style={styles.helpTipsContainer}>
              <View style={styles.helpTip}>
                <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
                <View style={styles.helpTipText}>
                  <Text style={styles.helpTipTitle}>📸 Foto 1: Prato Principal</Text>
                  <Text style={styles.helpTipDescription}>Tire uma foto clara do seu prato completo</Text>
                </View>
              </View>

              <View style={styles.helpTip}>
                <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
                <View style={styles.helpTipText}>
                  <Text style={styles.helpTipTitle}>🏷️ Foto 2: Rótulo (opcional)</Text>
                  <Text style={styles.helpTipDescription}>Foto da tabela nutricional aumenta muito a precisão!</Text>
                </View>
              </View>

              <View style={styles.helpTip}>
                <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
                <View style={styles.helpTipText}>
                  <Text style={styles.helpTipTitle}>✍️ Descrição (opcional)</Text>
                  <Text style={styles.helpTipDescription}>Ex: "Frango 200g, arroz 150g, Whey 30g"</Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={styles.dontShowAgainButton}
              onPress={() => setDontShowPhotoHelp(!dontShowPhotoHelp)}
            >
              <View style={[styles.checkbox, dontShowPhotoHelp && styles.checkboxChecked]}>
                {dontShowPhotoHelp && <Ionicons name="checkmark" size={16} color="white" />}
              </View>
              <Text style={styles.dontShowAgainText}>Não mostrar novamente</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.helpOkButton}
              onPress={() => {
                setShowPhotoHelpModal(false);
                takePicture();
              }}
            >
              <Text style={styles.helpOkButtonText}>Entendi, vamos lá!</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.helpCancelButton}
              onPress={() => setShowPhotoHelpModal(false)}
            >
              <Text style={styles.helpCancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Enhanced Photo Capture Modal */}
      <Modal visible={showEnhancedModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.enhancedModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Registrar Refeição</Text>
              <TouchableOpacity onPress={() => {
                setShowEnhancedModal(false);
                setCapturedImages([]);
                setUserDescription('');
                setMealTypes(new Set(['meal']));
              }}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.enhancedModalScroll}>
              {/* Photos Section */}
              <Text style={styles.sectionLabel}>Fotos {capturedImages.length > 0 && `(${capturedImages.length}/3)`}</Text>
              <View style={styles.photosGrid}>
                {capturedImages.map((img, index) => (
                  <View key={index} style={styles.photoThumbnail}>
                    <View style={styles.photoPlaceholder}>
                      <Ionicons name="image" size={32} color="#22c55e" />
                      <Text style={styles.photoLabel}>
                        {index === 0 ? 'Prato Principal' : index === 1 ? 'Acompanhamentos/Rótulo' : 'Outro'}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.removePhotoButton}
                      onPress={() => handleRemovePhoto(index)}
                    >
                      <Ionicons name="close-circle" size={24} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                ))}

                {capturedImages.length < 3 && (
                  <TouchableOpacity
                    style={styles.addPhotoButton}
                    onPress={handleAddPhoto}
                  >
                    <Ionicons name="add-circle" size={32} color="#22c55e" />
                    <Text style={styles.addPhotoText}>Adicionar</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Description Section */}
              <Text style={styles.sectionLabel}>Descrição (opcional)</Text>
              <TextInput
                style={styles.descriptionInput}
                placeholder="Ex: Frango grelhado 200g, arroz integral 150g, Whey protein 30g..."
                placeholderTextColor="#9ca3af"
                value={userDescription}
                onChangeText={setUserDescription}
                multiline
                numberOfLines={3}
                maxLength={500}
              />
              <Text style={styles.charCounter}>{userDescription.length}/500</Text>

              {/* Meal Type Section */}
              <Text style={styles.sectionLabel}>Tipo</Text>
              <View style={styles.typeChipsContainer}>
                <TouchableOpacity
                  style={[
                    styles.typeChip,
                    mealTypes.has('meal') && styles.typeChipActive
                  ]}
                  onPress={() => toggleMealType('meal')}
                >
                  <Text style={[
                    styles.typeChipText,
                    mealTypes.has('meal') && styles.typeChipTextActive
                  ]}>
                    🍽️ Refeição
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.typeChip,
                    mealTypes.has('drink') && styles.typeChipActive
                  ]}
                  onPress={() => toggleMealType('drink')}
                >
                  <Text style={[
                    styles.typeChipText,
                    mealTypes.has('drink') && styles.typeChipTextActive
                  ]}>
                    🥤 Bebida
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.typeChip,
                    mealTypes.has('supplement') && styles.typeChipActive
                  ]}
                  onPress={() => toggleMealType('supplement')}
                >
                  <Text style={[
                    styles.typeChipText,
                    mealTypes.has('supplement') && styles.typeChipTextActive
                  ]}>
                    💊 Suplemento
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Analyze Button */}
              <TouchableOpacity
                style={[styles.analyzeButton, analyzing && styles.analyzeButtonDisabled]}
                onPress={analyzeWithContext}
                disabled={analyzing || capturedImages.length === 0}
              >
                {analyzing ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <>
                    <Ionicons name="sparkles" size={20} color="white" />
                    <Text style={styles.analyzeButtonText}>Analisar com IA</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

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

function MealLogItem({ meal, onDelete }: { meal: any; onDelete: () => void }) {
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <View style={styles.mealLogItem}>
      <View style={styles.mealLogInfo}>
        <Text style={styles.mealLogName}>{meal.name}</Text>
        <Text style={styles.mealLogTime}>{formatTime(meal.date)}</Text>
        <View style={styles.mealLogMacros}>
          <Text style={styles.mealLogMacroText}>{Math.round(meal.calories)} kcal</Text>
          <Text style={styles.mealLogMacroText}>•</Text>
          <Text style={styles.mealLogMacroText}>{Math.round(meal.protein)}g P</Text>
          <Text style={styles.mealLogMacroText}>•</Text>
          <Text style={styles.mealLogMacroText}>{Math.round(meal.carbs)}g C</Text>
          <Text style={styles.mealLogMacroText}>•</Text>
          <Text style={styles.mealLogMacroText}>{Math.round(meal.fat)}g G</Text>
        </View>
      </View>
      <TouchableOpacity onPress={onDelete} style={styles.deleteButton}>
        <Ionicons name="trash-outline" size={20} color="#ef4444" />
      </TouchableOpacity>
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
  // Meal Log Item Styles
  mealLogItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  mealLogInfo: {
    flex: 1,
  },
  mealLogName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  mealLogTime: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 6,
  },
  mealLogMacros: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  mealLogMacroText: {
    fontSize: 12,
    color: '#3b82f6',
    fontWeight: '500',
  },
  deleteButton: {
    padding: 8,
    marginLeft: 8,
  },
  noMealsText: {
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: 14,
    paddingVertical: 20,
  },
  // Enhanced Modal Styles
  enhancedModalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '90%',
  },
  enhancedModalScroll: {
    maxHeight: '100%',
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
    marginTop: 16,
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 8,
  },
  photoThumbnail: {
    width: 100,
    height: 100,
    position: 'relative',
  },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#22c55e',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoLabel: {
    fontSize: 12,
    color: '#16a34a',
    marginTop: 4,
    fontWeight: '500',
  },
  removePhotoButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: 'white',
    borderRadius: 12,
  },
  addPhotoButton: {
    width: 100,
    height: 100,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPhotoText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  descriptionInput: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 12,
    fontSize: 14,
    color: '#1f2937',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  charCounter: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'right',
    marginTop: 4,
  },
  typeChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  typeChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  typeChipActive: {
    backgroundColor: '#dcfce7',
    borderColor: '#22c55e',
  },
  typeChipText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  typeChipTextActive: {
    color: '#16a34a',
    fontWeight: '600',
  },
  analyzeButton: {
    backgroundColor: '#22c55e',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
    marginBottom: 16,
  },
  analyzeButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  analyzeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  // Help Modal Styles
  helpModalContent: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 24,
    margin: 20,
    maxWidth: 400,
    alignSelf: 'center',
  },
  helpIconContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  helpTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 20,
  },
  helpTipsContainer: {
    gap: 16,
    marginBottom: 20,
  },
  helpTip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  helpTipText: {
    flex: 1,
  },
  helpTipTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  helpTipDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  dontShowAgainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
    paddingVertical: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#d1d5db',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#22c55e',
    borderColor: '#22c55e',
  },
  dontShowAgainText: {
    fontSize: 14,
    color: '#6b7280',
  },
  helpOkButton: {
    backgroundColor: '#22c55e',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  helpOkButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  helpCancelButton: {
    padding: 12,
    alignItems: 'center',
  },
  helpCancelButtonText: {
    color: '#6b7280',
    fontSize: 14,
  },
  // Goal Insights Styles
  goalInsightsCard: {
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  goalInsightsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  goalInsightsEmoji: {
    fontSize: 24,
  },
  goalInsightsTitle: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  goalInsightsMessage: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20,
  },
});

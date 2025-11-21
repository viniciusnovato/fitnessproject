import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ProgressBar } from '@/components/onboarding/ProgressBar';
import { OptionCard } from '@/components/onboarding/OptionCard';
import { MultiSelect } from '@/components/onboarding/MultiSelect';
import type { OnboardingStep1Data, OnboardingStep2Data, OnboardingStep3Data } from '@/lib/types/profile';

export default function OnboardingScreen() {
    const [currentStep, setCurrentStep] = useState(1);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date());

    // Custom fields
    const [customRestriction, setCustomRestriction] = useState('');
    const [customAllergy, setCustomAllergy] = useState('');

    // Step 1: Dados Corporais
    const [step1, setStep1] = useState<Partial<OnboardingStep1Data>>({
        sex: undefined,
        goal: '',
        activity_level: '',
    });

    // Step 2: Estilo de Vida
    const [step2, setStep2] = useState<Partial<OnboardingStep2Data>>({
        training_frequency: undefined,
        cooking_time: undefined,
        available_equipment: [],
    });

    // Step 3: Nutrição e Preferências
    const [step3, setStep3] = useState<Partial<OnboardingStep3Data>>({
        dietary_restrictions: [],
        allergies: [],
        flavor_preferences: [],
        budget_level: undefined,
    });

    useEffect(() => {
        loadExistingProfile();
    }, []);

    const loadExistingProfile = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: profile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (profile) {
                // Pre-fill with existing data
                setStep1({
                    birth_date: profile.birth_date || '',
                    weight: profile.weight || 0,
                    height: profile.height || 0,
                    sex: profile.sex || undefined,
                    target_weight: profile.target_weight || 0,
                    goal: profile.goal || '',
                    activity_level: profile.activity_level || '',
                });

                setStep2({
                    training_frequency: profile.training_frequency || undefined,
                    cooking_time: profile.cooking_time || undefined,
                    available_equipment: profile.available_equipment || [],
                });

                setStep3({
                    dietary_restrictions: profile.dietary_restrictions || [],
                    allergies: profile.allergies || [],
                    flavor_preferences: profile.flavor_preferences || [],
                    budget_level: profile.budget_level || undefined,
                });
            }
        } catch (error) {
            console.error('Error loading profile:', error);
        } finally {
            setLoading(false);
        }
    };

    const validateStep1 = () => {
        console.log('=== VALIDATING STEP 1 ===');
        console.log('Full step1 object:', JSON.stringify(step1, null, 2));
        console.log('birth_date:', step1.birth_date, 'type:', typeof step1.birth_date);
        console.log('weight:', step1.weight, 'type:', typeof step1.weight);
        console.log('height:', step1.height, 'type:', typeof step1.height);
        console.log('sex:', step1.sex, 'type:', typeof step1.sex);
        console.log('target_weight:', step1.target_weight, 'type:', typeof step1.target_weight);
        console.log('goal:', step1.goal, 'type:', typeof step1.goal);
        console.log('activity_level:', step1.activity_level, 'type:', typeof step1.activity_level);

        const missingFields = [];
        if (!step1.birth_date || step1.birth_date.trim() === '') missingFields.push('Data de Nascimento');
        if (!step1.weight || step1.weight === 0) missingFields.push('Peso Atual');
        if (!step1.height || step1.height === 0) missingFields.push('Altura');
        if (!step1.sex) missingFields.push('Sexo Biológico');
        if (!step1.target_weight || step1.target_weight === 0) missingFields.push('Peso Meta');
        if (!step1.goal || step1.goal.trim() === '') missingFields.push('Objetivo Principal');
        if (!step1.activity_level || step1.activity_level.trim() === '') missingFields.push('Nível de Atividade Física');

        console.log('Missing fields:', missingFields);

        if (missingFields.length > 0) {
            Alert.alert(
                'Campos obrigatórios',
                `Por favor, preencha:\n${missingFields.join('\n')}`
            );
            return false;
        }

        console.log('✅ Step 1 validation passed!');
        return true;
    };

    const validateStep2 = () => {
        if (!step2.training_frequency || !step2.cooking_time || !step2.available_equipment?.length) {
            Alert.alert('Campos obrigatórios', 'Por favor, complete todas as seleções');
            return false;
        }
        return true;
    };

    const handleNext = () => {
        if (currentStep === 1 && !validateStep1()) return;
        if (currentStep === 2 && !validateStep2()) return;

        if (currentStep < 3) {
            setCurrentStep(currentStep + 1);
        } else {
            handleFinish();
        }
    };

    const handleBack = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        }
    };

    const handleFinish = async () => {
        setSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                Alert.alert('Erro', 'Sessão expirada');
                router.replace('/(auth)/sign-in');
                return;
            }

            const { error } = await supabase
                .from('profiles')
                .upsert({
                    id: user.id,
                    // Step 1
                    birth_date: step1.birth_date,
                    weight: step1.weight,
                    height: step1.height,
                    sex: step1.sex,
                    target_weight: step1.target_weight,
                    goal: step1.goal,
                    activity_level: step1.activity_level,
                    // Step 2
                    training_frequency: step2.training_frequency,
                    cooking_time: step2.cooking_time,
                    available_equipment: step2.available_equipment,
                    // Step 3
                    dietary_restrictions: step3.dietary_restrictions,
                    allergies: step3.allergies,
                    flavor_preferences: step3.flavor_preferences,
                    budget_level: step3.budget_level,
                    // Tracking
                    onboarding_completed: true,
                    onboarding_step: 3,
                });

            if (error) throw error;

            router.replace('/(tabs)/home');
        } catch (error: any) {
            Alert.alert('Erro', error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleGoBack = () => {
        Alert.alert(
            'Sair do Onboarding?',
            'Você pode completar o onboarding mais tarde através do seu perfil.',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Sair',
                    style: 'destructive',
                    onPress: () => router.replace('/(tabs)/home')
                }
            ]
        );
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
                {/* Header com botão voltar */}
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
                        <Text style={styles.backButtonText}>← Voltar</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Configuração Inicial</Text>
                    <View style={styles.backButton} />
                </View>

                <ProgressBar currentStep={currentStep} totalSteps={3} />

                {/* STEP 1: DADOS CORPORAIS */}
                {currentStep === 1 && (
                    <View style={styles.stepContainer}>
                        <Text style={styles.title}>Dados Corporais</Text>
                        <Text style={styles.subtitle}>Vamos calcular suas necessidades nutricionais</Text>

                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Data de Nascimento</Text>
                            <TouchableOpacity
                                style={styles.dateButton}
                                onPress={() => setShowDatePicker(true)}
                            >
                                <Text style={[styles.dateButtonText, !step1.birth_date && styles.placeholderText]}>
                                    {step1.birth_date
                                        ? new Date(step1.birth_date).toLocaleDateString('pt-BR')
                                        : 'Selecione sua data de nascimento'}
                                </Text>
                            </TouchableOpacity>
                            {showDatePicker && (
                                <View style={styles.datePickerContainer}>
                                    <DateTimePicker
                                        value={step1.birth_date ? new Date(step1.birth_date) : selectedDate}
                                        mode="date"
                                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                        onChange={(event, date) => {
                                            if (Platform.OS === 'android') {
                                                setShowDatePicker(false);
                                            }
                                            if (date) {
                                                setSelectedDate(date);
                                                setStep1({ ...step1, birth_date: date.toISOString().split('T')[0] });
                                            }
                                        }}
                                        maximumDate={new Date()}
                                        minimumDate={new Date(1920, 0, 1)}
                                    />
                                    {Platform.OS === 'ios' && (
                                        <TouchableOpacity
                                            style={styles.dateConfirmButton}
                                            onPress={() => setShowDatePicker(false)}
                                        >
                                            <Text style={styles.dateConfirmButtonText}>Confirmar</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            )}
                        </View>

                        <View style={styles.row}>
                            <View style={[styles.inputContainer, styles.halfWidth]}>
                                <Text style={styles.label}>Peso Atual (kg)</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="70"
                                    keyboardType="decimal-pad"
                                    value={step1.weight?.toString()}
                                    onChangeText={(text) => setStep1({ ...step1, weight: parseFloat(text) || 0 })}
                                />
                            </View>

                            <View style={[styles.inputContainer, styles.halfWidth]}>
                                <Text style={styles.label}>Altura (cm)</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="175"
                                    keyboardType="decimal-pad"
                                    value={step1.height?.toString()}
                                    onChangeText={(text) => setStep1({ ...step1, height: parseFloat(text) || 0 })}
                                />
                            </View>
                        </View>

                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Peso Meta (kg)</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="65"
                                keyboardType="decimal-pad"
                                value={step1.target_weight?.toString()}
                                onChangeText={(text) => setStep1({ ...step1, target_weight: parseFloat(text) || 0 })}
                            />
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.label}>Sexo Biológico</Text>
                            <Text style={styles.helperText}>Necessário para cálculos precisos de TMB</Text>
                            <View style={styles.optionsRow}>
                                <OptionCard
                                    emoji="♂️"
                                    title="Masculino"
                                    selected={step1.sex === 'male'}
                                    onPress={() => setStep1({ ...step1, sex: 'male' })}
                                />
                                <OptionCard
                                    emoji="♀️"
                                    title="Feminino"
                                    selected={step1.sex === 'female'}
                                    onPress={() => setStep1({ ...step1, sex: 'female' })}
                                />
                            </View>
                            <TouchableOpacity
                                style={[styles.preferNotToSayButton, step1.sex === 'prefer_not_to_say' && styles.preferNotToSayButtonActive]}
                                onPress={() => setStep1({ ...step1, sex: 'prefer_not_to_say' as any })}
                            >
                                <Text style={[styles.preferNotToSayText, step1.sex === 'prefer_not_to_say' && styles.preferNotToSayTextActive]}>
                                    Prefiro não responder
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.label}>Objetivo Principal</Text>
                            {[
                                { value: 'lose_weight', label: 'Perder Peso', emoji: '📉' },
                                { value: 'gain_muscle', label: 'Ganhar Massa', emoji: '💪' },
                                { value: 'maintain', label: 'Manter Peso', emoji: '⚖️' },
                                { value: 'bodybuilding', label: 'Bodybuilding', emoji: '🏋️' },
                                { value: 'health', label: 'Saúde Geral', emoji: '❤️' },
                            ].map((option) => (
                                <OptionCard
                                    key={option.value}
                                    emoji={option.emoji}
                                    title={option.label}
                                    selected={step1.goal === option.value}
                                    onPress={() => setStep1({ ...step1, goal: option.value })}
                                />
                            ))}
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.label}>Nível de Atividade Diária</Text>
                            <Text style={styles.helperText}>Quanto você se move no seu dia a dia (trabalho, casa, deslocamento)</Text>
                            {[
                                { value: 'sedentary', label: 'Sedentário', description: 'Trabalho sentado, pouco movimento', emoji: '🪑' },
                                { value: 'light', label: 'Levemente Ativo', description: 'Caminho um pouco, tarefas leves', emoji: '🚶' },
                                { value: 'moderate', label: 'Moderadamente Ativo', description: 'Trabalho em pé, movimento constante', emoji: '🏃' },
                                { value: 'intense', label: 'Muito Ativo', description: 'Trabalho físico, sempre em movimento', emoji: '💼' },
                                { value: 'very_intense', label: 'Extremamente Ativo', description: 'Trabalho pesado, esforço físico intenso', emoji: '🏗️' },
                            ].map((option) => (
                                <OptionCard
                                    key={option.value}
                                    emoji={option.emoji}
                                    title={option.label}
                                    description={option.description}
                                    selected={step1.activity_level === option.value}
                                    onPress={() => setStep1({ ...step1, activity_level: option.value })}
                                />
                            ))}
                        </View>
                    </View>
                )}

                {/* STEP 2: ESTILO DE VIDA */}
                {currentStep === 2 && (
                    <View style={styles.stepContainer}>
                        <Text style={styles.title}>Estilo de Vida</Text>
                        <Text style={styles.subtitle}>Vamos personalizar suas receitas</Text>

                        <View style={styles.section}>
                            <Text style={styles.label}>Frequência de Treino Estruturado</Text>
                            <Text style={styles.helperText}>Academia, musculação, esportes, corrida, etc.</Text>
                            {[
                                { value: 'none', label: 'Não treino', emoji: '🛋️' },
                                { value: '1-2', label: '1-2x por semana', emoji: '🏃' },
                                { value: '3-4', label: '3-4x por semana', emoji: '💪' },
                                { value: '5-6', label: '5-6x por semana', emoji: '🔥' },
                                { value: 'athlete', label: 'Atleta/Diário', emoji: '🏆' },
                            ].map((option) => (
                                <OptionCard
                                    key={option.value}
                                    emoji={option.emoji}
                                    title={option.label}
                                    selected={step2.training_frequency === option.value}
                                    onPress={() => setStep2({ ...step2, training_frequency: option.value as any })}
                                />
                            ))}
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.label}>Tempo Disponível para Cozinhar</Text>
                            {[
                                { value: 10, label: '10 minutos', emoji: '⚡' },
                                { value: 20, label: '20 minutos', emoji: '⏱️' },
                                { value: 40, label: '40 minutos', emoji: '🍳' },
                                { value: 60, label: '1 hora ou mais', emoji: '👨‍🍳' },
                            ].map((option) => (
                                <OptionCard
                                    key={option.value}
                                    emoji={option.emoji}
                                    title={option.label}
                                    selected={step2.cooking_time === option.value}
                                    onPress={() => setStep2({ ...step2, cooking_time: option.value as any })}
                                />
                            ))}
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.label}>Equipamentos Disponíveis</Text>
                            <Text style={styles.helperText}>Selecione todos que você tem</Text>
                            <MultiSelect
                                options={[
                                    { value: 'stove', label: 'Fogão', emoji: '🔥' },
                                    { value: 'oven', label: 'Forno', emoji: '🔥' },
                                    { value: 'airfryer', label: 'Airfryer', emoji: '💨' },
                                    { value: 'microwave', label: 'Micro-ondas', emoji: '📻' },
                                    { value: 'blender', label: 'Liquidificador', emoji: '🌀' },
                                    { value: 'mixer', label: 'Mixer/Batedeira', emoji: '🥄' },
                                    { value: 'grill', label: 'Churrasqueira', emoji: '🍖' },
                                    { value: 'basic_pans', label: 'Panelas Básicas', emoji: '🍳' },
                                ]}
                                selected={step2.available_equipment || []}
                                onChange={(selected) => setStep2({ ...step2, available_equipment: selected })}
                            />
                        </View>
                    </View>
                )}

                {/* STEP 3: NUTRIÇÃO E PREFERÊNCIAS */}
                {currentStep === 3 && (
                    <View style={styles.stepContainer}>
                        <Text style={styles.title}>Nutrição e Preferências</Text>
                        <Text style={styles.subtitle}>Últimos ajustes para receitas perfeitas</Text>

                        <View style={styles.section}>
                            <Text style={styles.label}>Restrições Alimentares</Text>
                            <Text style={styles.helperText}>Selecione todas que se aplicam</Text>

                            {/* Opção Nenhuma */}
                            <TouchableOpacity
                                style={[styles.noneOption, (step3.dietary_restrictions?.length === 0 || step3.dietary_restrictions?.includes('none')) && styles.noneOptionActive]}
                                onPress={() => setStep3({ ...step3, dietary_restrictions: ['none'] })}
                            >
                                <Text style={[styles.noneOptionText, (step3.dietary_restrictions?.length === 0 || step3.dietary_restrictions?.includes('none')) && styles.noneOptionTextActive]}>
                                    ✓ Nenhuma restrição
                                </Text>
                            </TouchableOpacity>

                            {/* Opções padrão */}
                            {!step3.dietary_restrictions?.includes('none') && (
                                <>
                                    <MultiSelect
                                        options={[
                                            { value: 'vegetarian', label: 'Vegetariano', emoji: '🥗' },
                                            { value: 'vegan', label: 'Vegano', emoji: '🌱' },
                                            { value: 'pescatarian', label: 'Pescetariano', emoji: '🐟' },
                                            { value: 'lactose_free', label: 'Sem Lactose', emoji: '🥛' },
                                            { value: 'gluten_free', label: 'Sem Glúten', emoji: '🌾' },
                                            { value: 'low_carb', label: 'Low Carb', emoji: '🥩' },
                                            { value: 'keto', label: 'Cetogênica', emoji: '🥑' },
                                            { value: 'halal', label: 'Halal', emoji: '☪️' },
                                            { value: 'kosher', label: 'Kosher', emoji: '✡️' },
                                        ]}
                                        selected={step3.dietary_restrictions?.filter(r => r !== 'none') || []}
                                        onChange={(selected) => setStep3({ ...step3, dietary_restrictions: selected })}
                                    />

                                    {/* Campo Outro */}
                                    <View style={styles.customFieldContainer}>
                                        <Text style={styles.customFieldLabel}>Outra restrição:</Text>
                                        <View style={styles.customFieldRow}>
                                            <TextInput
                                                style={styles.customInput}
                                                placeholder="Digite aqui..."
                                                value={customRestriction}
                                                onChangeText={setCustomRestriction}
                                            />
                                            <TouchableOpacity
                                                style={[styles.addButton, !customRestriction.trim() && styles.addButtonDisabled]}
                                                disabled={!customRestriction.trim()}
                                                onPress={() => {
                                                    if (customRestriction.trim()) {
                                                        const current = step3.dietary_restrictions || [];
                                                        setStep3({
                                                            ...step3,
                                                            dietary_restrictions: [...current, `custom:${customRestriction.trim()}`]
                                                        });
                                                        setCustomRestriction('');
                                                    }
                                                }}
                                            >
                                                <Text style={styles.addButtonText}>+</Text>
                                            </TouchableOpacity>
                                        </View>
                                        {/* Mostrar itens customizados */}
                                        {step3.dietary_restrictions?.filter(r => r.startsWith('custom:')).map((item, index) => (
                                            <View key={index} style={styles.customChip}>
                                                <Text style={styles.customChipText}>{item.replace('custom:', '')}</Text>
                                                <TouchableOpacity
                                                    onPress={() => {
                                                        const updated = step3.dietary_restrictions?.filter(r => r !== item) || [];
                                                        setStep3({ ...step3, dietary_restrictions: updated });
                                                    }}
                                                >
                                                    <Text style={styles.customChipRemove}>×</Text>
                                                </TouchableOpacity>
                                            </View>
                                        ))}
                                    </View>
                                </>
                            )}
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.label}>Alergias e Intolerâncias</Text>
                            <Text style={styles.helperText}>Importante para sua segurança</Text>

                            {/* Opção Nenhuma */}
                            <TouchableOpacity
                                style={[styles.noneOption, (step3.allergies?.length === 0 || step3.allergies?.includes('none')) && styles.noneOptionActive]}
                                onPress={() => setStep3({ ...step3, allergies: ['none'] })}
                            >
                                <Text style={[styles.noneOptionText, (step3.allergies?.length === 0 || step3.allergies?.includes('none')) && styles.noneOptionTextActive]}>
                                    ✓ Nenhuma alergia
                                </Text>
                            </TouchableOpacity>

                            {/* Opções padrão */}
                            {!step3.allergies?.includes('none') && (
                                <>
                                    <MultiSelect
                                        options={[
                                            { value: 'peanuts', label: 'Amendoim', emoji: '🥜' },
                                            { value: 'nuts', label: 'Castanhas', emoji: '🌰' },
                                            { value: 'lactose', label: 'Lactose', emoji: '🥛' },
                                            { value: 'seafood', label: 'Frutos do Mar', emoji: '🦐' },
                                            { value: 'eggs', label: 'Ovos', emoji: '🥚' },
                                            { value: 'wheat', label: 'Trigo', emoji: '🌾' },
                                            { value: 'soy', label: 'Soja', emoji: '🫘' },
                                        ]}
                                        selected={step3.allergies?.filter(a => a !== 'none') || []}
                                        onChange={(selected) => setStep3({ ...step3, allergies: selected })}
                                    />

                                    {/* Campo Outro */}
                                    <View style={styles.customFieldContainer}>
                                        <Text style={styles.customFieldLabel}>Outra alergia:</Text>
                                        <View style={styles.customFieldRow}>
                                            <TextInput
                                                style={styles.customInput}
                                                placeholder="Digite aqui..."
                                                value={customAllergy}
                                                onChangeText={setCustomAllergy}
                                            />
                                            <TouchableOpacity
                                                style={[styles.addButton, !customAllergy.trim() && styles.addButtonDisabled]}
                                                disabled={!customAllergy.trim()}
                                                onPress={() => {
                                                    if (customAllergy.trim()) {
                                                        const current = step3.allergies || [];
                                                        setStep3({
                                                            ...step3,
                                                            allergies: [...current, `custom:${customAllergy.trim()}`]
                                                        });
                                                        setCustomAllergy('');
                                                    }
                                                }}
                                            >
                                                <Text style={styles.addButtonText}>+</Text>
                                            </TouchableOpacity>
                                        </View>
                                        {/* Mostrar itens customizados */}
                                        {step3.allergies?.filter(a => a.startsWith('custom:')).map((item, index) => (
                                            <View key={index} style={styles.customChip}>
                                                <Text style={styles.customChipText}>{item.replace('custom:', '')}</Text>
                                                <TouchableOpacity
                                                    onPress={() => {
                                                        const updated = step3.allergies?.filter(a => a !== item) || [];
                                                        setStep3({ ...step3, allergies: updated });
                                                    }}
                                                >
                                                    <Text style={styles.customChipRemove}>×</Text>
                                                </TouchableOpacity>
                                            </View>
                                        ))}
                                    </View>
                                </>
                            )}
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.label}>Preferências de Sabor</Text>
                            <Text style={styles.helperText}>Ajuda a IA a recomendar melhor</Text>
                            <MultiSelect
                                options={[
                                    { value: 'salty', label: 'Salgado', emoji: '🧂' },
                                    { value: 'sweet', label: 'Doce', emoji: '🍯' },
                                    { value: 'spicy', label: 'Apimentado', emoji: '🌶️' },
                                    { value: 'simple', label: 'Simples', emoji: '🍚' },
                                    { value: 'elaborate', label: 'Elaborado', emoji: '👨‍🍳' },
                                ]}
                                selected={step3.flavor_preferences || []}
                                onChange={(selected) => setStep3({ ...step3, flavor_preferences: selected })}
                            />
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.label}>Orçamento Semanal/Mensal</Text>
                            {[
                                { value: 'low', label: 'Baixo', description: 'Receitas econômicas', emoji: '💰' },
                                { value: 'moderate', label: 'Moderado', description: 'Equilíbrio qualidade/preço', emoji: '💵' },
                                { value: 'high', label: 'Alto', description: 'Ingredientes premium', emoji: '💎' },
                            ].map((option) => (
                                <OptionCard
                                    key={option.value}
                                    emoji={option.emoji}
                                    title={option.label}
                                    description={option.description}
                                    selected={step3.budget_level === option.value}
                                    onPress={() => setStep3({ ...step3, budget_level: option.value as any })}
                                />
                            ))}
                        </View>
                    </View>
                )}

                {/* Navigation Buttons */}
                <View style={styles.buttonContainer}>
                    {currentStep > 1 && (
                        <TouchableOpacity style={styles.buttonSecondary} onPress={handleBack}>
                            <Text style={styles.buttonSecondaryText}>Voltar</Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity
                        style={[styles.buttonPrimary, currentStep === 1 && styles.buttonFull]}
                        onPress={handleNext}
                        disabled={saving}
                    >
                        <Text style={styles.buttonPrimaryText}>
                            {saving ? 'Salvando...' : currentStep === 3 ? 'Finalizar' : 'Próximo'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
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
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: 16,
        marginBottom: 8,
    },
    backButton: {
        width: 80,
    },
    backButtonText: {
        fontSize: 16,
        color: '#6b7280',
        fontWeight: '500',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1f2937',
    },
    scrollContent: {
        padding: 20,
    },
    stepContainer: {
        gap: 24,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#1f2937',
    },
    subtitle: {
        fontSize: 16,
        color: '#6b7280',
        marginTop: -16,
    },
    section: {
        gap: 12,
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1f2937',
    },
    helperText: {
        fontSize: 14,
        color: '#6b7280',
        marginTop: -8,
    },
    inputContainer: {
        gap: 8,
    },
    input: {
        backgroundColor: 'white',
        height: 48,
        borderRadius: 12,
        paddingHorizontal: 16,
        fontSize: 16,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    row: {
        flexDirection: 'row',
        gap: 12,
    },
    halfWidth: {
        flex: 1,
    },
    optionsRow: {
        flexDirection: 'row',
        gap: 12,
    },
    buttonContainer: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 32,
    },
    buttonPrimary: {
        flex: 1,
        backgroundColor: '#22c55e',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    buttonFull: {
        flex: 1,
    },
    buttonPrimaryText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 18,
    },
    buttonSecondary: {
        flex: 1,
        backgroundColor: 'white',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    buttonSecondaryText: {
        color: '#374151',
        fontWeight: '600',
        fontSize: 18,
    },
    dateButton: {
        backgroundColor: 'white',
        height: 48,
        borderRadius: 12,
        paddingHorizontal: 16,
        fontSize: 16,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        justifyContent: 'center',
    },
    dateButtonText: {
        fontSize: 16,
        color: '#1f2937',
    },
    placeholderText: {
        color: '#9ca3af',
    },
    datePickerContainer: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 16,
        marginTop: 8,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    dateConfirmButton: {
        backgroundColor: '#22c55e',
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 12,
    },
    dateConfirmButtonText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 16,
    },
    preferNotToSayButton: {
        backgroundColor: '#f3f4f6',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 8,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    preferNotToSayButtonActive: {
        backgroundColor: '#dcfce7',
        borderColor: '#22c55e',
    },
    preferNotToSayText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6b7280',
    },
    preferNotToSayTextActive: {
        color: '#16a34a',
    },
    // Opção "Nenhuma"
    noneOption: {
        backgroundColor: '#f3f4f6',
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    noneOptionActive: {
        backgroundColor: '#dbeafe',
        borderColor: '#3b82f6',
    },
    noneOptionText: {
        fontSize: 16,
        color: '#6b7280',
        fontWeight: '500',
    },
    noneOptionTextActive: {
        color: '#1e40af',
    },
    // Campos customizados
    customFieldContainer: {
        marginTop: 16,
        gap: 12,
    },
    customFieldLabel: {
        fontSize: 14,
        color: '#6b7280',
        fontWeight: '500',
    },
    customFieldRow: {
        flexDirection: 'row',
        gap: 8,
    },
    customInput: {
        flex: 1,
        backgroundColor: '#fff',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#d1d5db',
        fontSize: 16,
    },
    addButton: {
        backgroundColor: '#3b82f6',
        width: 48,
        height: 48,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    addButtonDisabled: {
        backgroundColor: '#d1d5db',
    },
    addButtonText: {
        color: '#fff',
        fontSize: 24,
        fontWeight: '600',
    },
    customChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#e0e7ff',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 20,
        alignSelf: 'flex-start',
        gap: 8,
    },
    customChipText: {
        color: '#3730a3',
        fontSize: 14,
        fontWeight: '500',
    },
    customChipRemove: {
        color: '#3730a3',
        fontSize: 20,
        fontWeight: '600',
    },
});

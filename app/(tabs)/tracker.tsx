import { analyzeMealImage } from '@/lib/openai';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function TrackerScreen() {
    const [meals, setMeals] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [analyzing, setAnalyzing] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [user, setUser] = useState<any>(null);

    // Modal States
    const [showModal, setShowModal] = useState(false);
    const [scannedMeal, setScannedMeal] = useState<any>(null);

    useFocusEffect(
        useCallback(() => {
            checkUser();
        }, [])
    );

    useFocusEffect(
        useCallback(() => {
            if (user) {
                loadMeals();
            }
        }, [selectedDate, user])
    );

    const checkUser = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);
        setLoading(false);
    };

    const loadMeals = async () => {
        if (!user) return;

        try {
            const startOfDay = new Date(selectedDate);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(selectedDate);
            endOfDay.setHours(23, 59, 59, 999);

            const { data, error } = await supabase
                .from('meals_log')
                .select('*')
                .eq('user_id', user.id)
                .gte('date', startOfDay.toISOString())
                .lte('date', endOfDay.toISOString())
                .order('date', { ascending: false });

            if (error) throw error;
            setMeals(data || []);
        } catch (error) {
            console.error(error);
        }
    };

    const pickImage = async () => {
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
            if (!user) return;

            const analysis = await analyzeMealImage(base64, user.id);
            if (analysis && !analysis.error) {
                setScannedMeal(analysis);
                setShowModal(true);
            } else {
                Alert.alert('Erro', 'Não foi possível identificar comida na imagem.');
            }
        } catch (error) {
            Alert.alert('Erro', 'Falha na análise da imagem.');
        } finally {
            setAnalyzing(false);
        }
    };

    const saveMeal = async () => {
        if (!scannedMeal || !user) return;

        try {
            const { error } = await supabase.from('meals_log').insert({
                user_id: user.id,
                name: scannedMeal.name,
                calories: scannedMeal.calories,
                protein: scannedMeal.protein,
                carbs: scannedMeal.carbs,
                fat: scannedMeal.fat,
                is_generated: true,
                date: new Date().toISOString()
            });

            if (error) throw error;

            Alert.alert('Sucesso', 'Refeição registrada!');
            setShowModal(false);
            setScannedMeal(null);
            loadMeals();
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
                            loadMeals();
                        } catch (error) {
                            Alert.alert('Erro', 'Falha ao deletar refeição.');
                        }
                    }
                }
            ]
        );
    };

    const getTotals = () => {
        return meals.reduce((acc, meal) => ({
            calories: acc.calories + (meal.calories || 0),
            protein: acc.protein + (meal.protein || 0),
            carbs: acc.carbs + (meal.carbs || 0),
            fat: acc.fat + (meal.fat || 0),
        }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
    };

    const changeDate = (days: number) => {
        const newDate = new Date(selectedDate);
        newDate.setDate(newDate.getDate() + days);
        setSelectedDate(newDate);
    };

    const isToday = () => {
        const today = new Date();
        return selectedDate.toDateString() === today.toDateString();
    };

    const formatDate = () => {
        if (isToday()) return 'Hoje';
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        if (selectedDate.toDateString() === yesterday.toDateString()) return 'Ontem';

        return selectedDate.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    };

    const totals = getTotals();

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>Diário Alimentar</Text>
                    <TouchableOpacity
                        onPress={pickImage}
                        disabled={analyzing}
                        style={styles.scanButton}
                    >
                        {analyzing ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <>
                                <Ionicons name="camera" size={20} color="white" />
                                <Text style={styles.scanButtonText}>Escanear</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Date Navigator */}
                <View style={styles.dateNavigator}>
                    <TouchableOpacity onPress={() => changeDate(-1)} style={styles.dateButton}>
                        <Ionicons name="chevron-back" size={24} color="#3b82f6" />
                    </TouchableOpacity>
                    <View style={styles.dateDisplay}>
                        <Text style={styles.dateText}>{formatDate()}</Text>
                        <Text style={styles.dateSubtext}>
                            {selectedDate.toLocaleDateString('pt-BR', { weekday: 'long' })}
                        </Text>
                    </View>
                    <TouchableOpacity
                        onPress={() => changeDate(1)}
                        style={styles.dateButton}
                        disabled={isToday()}
                    >
                        <Ionicons
                            name="chevron-forward"
                            size={24}
                            color={isToday() ? '#d1d5db' : '#3b82f6'}
                        />
                    </TouchableOpacity>
                </View>

                {/* Macros Summary */}
                <View style={styles.summaryCard}>
                    <Text style={styles.summaryTitle}>Resumo do Dia</Text>
                    <View style={styles.macrosGrid}>
                        <View style={styles.macroItem}>
                            <Text style={styles.macroValue}>{Math.round(totals.calories)}</Text>
                            <Text style={styles.macroLabel}>Calorias</Text>
                        </View>
                        <View style={styles.macroItem}>
                            <Text style={styles.macroValue}>{Math.round(totals.protein)}g</Text>
                            <Text style={styles.macroLabel}>Proteínas</Text>
                        </View>
                        <View style={styles.macroItem}>
                            <Text style={styles.macroValue}>{Math.round(totals.carbs)}g</Text>
                            <Text style={styles.macroLabel}>Carbos</Text>
                        </View>
                        <View style={styles.macroItem}>
                            <Text style={styles.macroValue}>{Math.round(totals.fat)}g</Text>
                            <Text style={styles.macroLabel}>Gorduras</Text>
                        </View>
                    </View>
                </View>

                {/* Meals List */}
                <View style={styles.mealsSection}>
                    <Text style={styles.sectionTitle}>Refeições ({meals.length})</Text>
                    {meals.length > 0 ? (
                        <View style={styles.mealsList}>
                            {meals.map((meal) => (
                                <View key={meal.id} style={styles.mealCard}>
                                    <View style={styles.mealInfo}>
                                        <Text style={styles.mealName}>{meal.name}</Text>
                                        <Text style={styles.mealTime}>
                                            {new Date(meal.date).toLocaleTimeString('pt-BR', {
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </Text>
                                        <View style={styles.mealMacros}>
                                            <Text style={styles.mealMacroText}>{Math.round(meal.calories)} kcal</Text>
                                            <Text style={styles.mealMacroText}>•</Text>
                                            <Text style={styles.mealMacroText}>{Math.round(meal.protein)}g P</Text>
                                            <Text style={styles.mealMacroText}>•</Text>
                                            <Text style={styles.mealMacroText}>{Math.round(meal.carbs)}g C</Text>
                                            <Text style={styles.mealMacroText}>•</Text>
                                            <Text style={styles.mealMacroText}>{Math.round(meal.fat)}g G</Text>
                                        </View>
                                    </View>
                                    <TouchableOpacity
                                        onPress={() => deleteMeal(meal.id)}
                                        style={styles.deleteButton}
                                    >
                                        <Ionicons name="trash-outline" size={20} color="#ef4444" />
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </View>
                    ) : (
                        <Text style={styles.emptyText}>Nenhuma refeição registrada neste dia</Text>
                    )}
                </View>
            </ScrollView>

            {/* Edit/Confirm Modal */}
            <Modal visible={showModal} animationType="slide" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Confirmar Refeição</Text>
                            <TouchableOpacity onPress={() => setShowModal(false)}>
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
                                    onPress={saveMeal}
                                >
                                    <Text style={styles.confirmButtonText}>Confirmar e Salvar</Text>
                                </TouchableOpacity>
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f9fafb',
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
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#1f2937',
    },
    scanButton: {
        backgroundColor: '#22c55e',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
    },
    scanButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 14,
    },
    dateNavigator: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'white',
        padding: 16,
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    dateButton: {
        padding: 8,
    },
    dateDisplay: {
        alignItems: 'center',
    },
    dateText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1f2937',
    },
    dateSubtext: {
        fontSize: 13,
        color: '#6b7280',
        textTransform: 'capitalize',
    },
    summaryCard: {
        backgroundColor: 'white',
        padding: 20,
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    summaryTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1f2937',
        marginBottom: 16,
    },
    macrosGrid: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    macroItem: {
        alignItems: 'center',
    },
    macroValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#3b82f6',
    },
    macroLabel: {
        fontSize: 12,
        color: '#6b7280',
        marginTop: 4,
    },
    mealsSection: {
        gap: 12,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1f2937',
    },
    mealsList: {
        gap: 12,
    },
    mealCard: {
        backgroundColor: 'white',
        padding: 16,
        borderRadius: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1,
    },
    mealInfo: {
        flex: 1,
    },
    mealName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1f2937',
        marginBottom: 4,
    },
    mealTime: {
        fontSize: 13,
        color: '#6b7280',
        marginBottom: 6,
    },
    mealMacros: {
        flexDirection: 'row',
        gap: 6,
        flexWrap: 'wrap',
    },
    mealMacroText: {
        fontSize: 12,
        color: '#3b82f6',
        fontWeight: '500',
    },
    deleteButton: {
        padding: 8,
        marginLeft: 8,
    },
    emptyText: {
        textAlign: 'center',
        color: '#9ca3af',
        fontSize: 14,
        paddingVertical: 40,
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalContent: {
        backgroundColor: 'white',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
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
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#bbf7d0',
    },
    aiLabel: {
        fontSize: 14,
        color: '#15803d',
        fontWeight: '600',
        marginBottom: 8,
    },
    mealNameInput: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#166534',
        padding: 0,
    },
    macrosInputGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 20,
    },
    macroInputItem: {
        width: '47%',
        backgroundColor: '#f9fafb',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    macroInputLabel: {
        fontSize: 11,
        color: '#6b7280',
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    macroInput: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1f2937',
        padding: 0,
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
});

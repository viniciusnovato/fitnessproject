import { analyzeMealImage } from '@/lib/openai';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function TrackerScreen() {
    const [meals, setMeals] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [analyzing, setAnalyzing] = useState(false);

    // Modal States
    const [showModal, setShowModal] = useState(false);
    const [scannedMeal, setScannedMeal] = useState<any>(null);

    useEffect(() => {
        loadMeals();
    }, []);

    const loadMeals = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('meals_log')
                .select('*')
                .eq('user_id', user.id)
                .order('date', { ascending: false })
                .limit(20);

            if (error) throw error;
            setMeals(data || []);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
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
            const { data: { user } } = await supabase.auth.getUser();
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
        if (!scannedMeal) return;

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { error } = await supabase.from('meals_log').insert({
                user_id: user.id,
                name: scannedMeal.name,
                calories: scannedMeal.calories,
                protein: scannedMeal.protein,
                carbs: scannedMeal.carbs,
                fat: scannedMeal.fat,
                is_generated: true
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

    const getTotalCalories = () => {
        // Filter for today's meals
        const today = new Date().toDateString();
        const todaysMeals = meals.filter(m => new Date(m.date).toDateString() === today);
        return todaysMeals.reduce((acc, curr) => acc + (curr.calories || 0), 0);
    };

    return (
        <SafeAreaView className="flex-1 bg-slate-50">
            <ScrollView className="p-6">
                <View className="flex-row justify-between items-center mb-6">
                    <View>
                        <Text className="text-2xl font-bold text-slate-900">Diário Alimentar</Text>
                        <Text className="text-slate-500">Hoje: {getTotalCalories()} kcal</Text>
                    </View>
                    <TouchableOpacity
                        onPress={pickImage}
                        disabled={analyzing}
                        className="bg-green-600 p-3 rounded-full flex-row items-center"
                    >
                        {analyzing ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <>
                                <Ionicons name="camera" size={24} color="white" />
                                <Text className="text-white font-bold ml-2">Escanear</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>

                <View className="space-y-4">
                    {meals.map((meal) => (
                        <View key={meal.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                            <View className="flex-row justify-between items-start">
                                <View className="flex-1">
                                    <Text className="font-bold text-lg text-slate-800">{meal.name}</Text>
                                    <Text className="text-slate-500 text-sm">
                                        {new Date(meal.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </Text>
                                </View>
                                <View className="bg-green-100 px-3 py-1 rounded-full">
                                    <Text className="text-green-700 font-bold">{meal.calories} kcal</Text>
                                </View>
                            </View>
                            <View className="flex-row mt-3 space-x-4">
                                <Text className="text-xs text-slate-500">🥩 {meal.protein}g Prot</Text>
                                <Text className="text-xs text-slate-500">🍞 {meal.carbs}g Carb</Text>
                                <Text className="text-xs text-slate-500">🥑 {meal.fat}g Gord</Text>
                            </View>
                        </View>
                    ))}
                </View>
            </ScrollView>

            {/* Edit/Confirm Modal */}
            <Modal visible={showModal} animationType="slide" transparent={true}>
                <View className="flex-1 justify-end bg-black/50">
                    <View className="bg-white rounded-t-3xl p-6 h-[70%]">
                        <View className="flex-row justify-between items-center mb-6">
                            <Text className="text-xl font-bold">Confirmar Refeição</Text>
                            <TouchableOpacity onPress={() => setShowModal(false)}>
                                <Ionicons name="close" size={24} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        {scannedMeal && (
                            <ScrollView>
                                <View className="bg-green-50 p-4 rounded-xl mb-6 border border-green-100">
                                    <Text className="text-green-800 font-medium mb-2">IA Identificou:</Text>
                                    <Text className="text-2xl font-bold text-green-900">{scannedMeal.name}</Text>
                                    <Text className="text-green-700 mt-1">{scannedMeal.description}</Text>
                                </View>

                                <View className="flex-row flex-wrap gap-4 mb-6">
                                    <View className="w-[45%] bg-slate-50 p-3 rounded-xl border border-slate-200">
                                        <Text className="text-slate-500 text-xs uppercase">Calorias</Text>
                                        <TextInput
                                            className="text-xl font-bold text-slate-900"
                                            value={scannedMeal.calories.toString()}
                                            onChangeText={(t) => setScannedMeal({ ...scannedMeal, calories: parseInt(t) || 0 })}
                                            keyboardType="numeric"
                                        />
                                    </View>
                                    <View className="w-[45%] bg-slate-50 p-3 rounded-xl border border-slate-200">
                                        <Text className="text-slate-500 text-xs uppercase">Proteína (g)</Text>
                                        <TextInput
                                            className="text-xl font-bold text-slate-900"
                                            value={scannedMeal.protein.toString()}
                                            onChangeText={(t) => setScannedMeal({ ...scannedMeal, protein: parseFloat(t) || 0 })}
                                            keyboardType="numeric"
                                        />
                                    </View>
                                    <View className="w-[45%] bg-slate-50 p-3 rounded-xl border border-slate-200">
                                        <Text className="text-slate-500 text-xs uppercase">Carboidratos (g)</Text>
                                        <TextInput
                                            className="text-xl font-bold text-slate-900"
                                            value={scannedMeal.carbs.toString()}
                                            onChangeText={(t) => setScannedMeal({ ...scannedMeal, carbs: parseFloat(t) || 0 })}
                                            keyboardType="numeric"
                                        />
                                    </View>
                                    <View className="w-[45%] bg-slate-50 p-3 rounded-xl border border-slate-200">
                                        <Text className="text-slate-500 text-xs uppercase">Gorduras (g)</Text>
                                        <TextInput
                                            className="text-xl font-bold text-slate-900"
                                            value={scannedMeal.fat.toString()}
                                            onChangeText={(t) => setScannedMeal({ ...scannedMeal, fat: parseFloat(t) || 0 })}
                                            keyboardType="numeric"
                                        />
                                    </View>
                                </View>

                                <TouchableOpacity
                                    className="bg-green-600 py-4 rounded-xl items-center mb-4"
                                    onPress={saveMeal}
                                >
                                    <Text className="text-white font-bold text-lg">Confirmar e Salvar</Text>
                                </TouchableOpacity>
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

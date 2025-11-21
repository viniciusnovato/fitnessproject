import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, Modal, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { generateRecipes, analyzePantryImage } from '@/lib/openai';

export default function RecipesScreen() {
    const [pantryItems, setPantryItems] = useState<any[]>([]);
    const [selectedItems, setSelectedItems] = useState<string[]>([]);
    const [extraIngredients, setExtraIngredients] = useState('');
    const [loading, setLoading] = useState(false);
    const [recipes, setRecipes] = useState<any[]>([]);
    const [showRecipeModal, setShowRecipeModal] = useState(false);
    const [selectedRecipe, setSelectedRecipe] = useState<any>(null);
    const [analyzingPhoto, setAnalyzingPhoto] = useState(false);

    useEffect(() => {
        loadPantryItems();
    }, []);

    const loadPantryItems = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
            .from('pantry_items')
            .select('*')
            .eq('user_id', user.id)
            .eq('status', 'available');

        if (data) setPantryItems(data);
    };

    const toggleItem = (name: string) => {
        if (selectedItems.includes(name)) {
            setSelectedItems(selectedItems.filter(i => i !== name));
        } else {
            setSelectedItems([...selectedItems, name]);
        }
    };

    const handleGenerate = async () => {
        const allIngredients = [
            ...selectedItems,
            ...extraIngredients.split(',').map(i => i.trim()).filter(i => i)
        ];

        if (allIngredients.length === 0) {
            Alert.alert('Erro', 'Selecione ou digite pelo menos um ingrediente');
            return;
        }

        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Get profile for goals
            const { data: profile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            const result = await generateRecipes({
                ingredients: allIngredients,
                goal: profile.goal,
                targetCalories: profile.daily_calories || 2000,
                macros: {
                    protein: 30, // Default split if not calculated
                    carbs: 40,
                    fat: 30
                },
                dietaryRestrictions: profile.dietary_restrictions,
                allergies: profile.allergies
            });

            if (result) {
                setRecipes(Array.isArray(result) ? result : [result]);
            }
        } catch (error) {
            Alert.alert('Erro', 'Falha ao gerar receitas. Tente novamente.');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const pickPantryPhoto = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permissão necessária', 'Precisamos da câmera para ver sua despensa.');
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.5,
            base64: true,
        });

        if (!result.canceled && result.assets[0].base64) {
            setAnalyzingPhoto(true);
            try {
                const ingredients = await analyzePantryImage(result.assets[0].base64);
                if (ingredients.length > 0) {
                    const currentExtra = extraIngredients ? extraIngredients + ', ' : '';
                    setExtraIngredients(currentExtra + ingredients.join(', '));
                    Alert.alert('Sucesso', `Identificamos: ${ingredients.join(', ')}`);
                } else {
                    Alert.alert('Ops', 'Não identifiquei ingredientes claros na foto.');
                }
            } catch (error) {
                Alert.alert('Erro', 'Falha na análise da imagem.');
            } finally {
                setAnalyzingPhoto(false);
            }
        }
    };

    const logMeal = async (recipe: any) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { error } = await supabase.from('meals_log').insert({
                user_id: user.id,
                name: recipe.name,
                calories: recipe.nutrition.calories,
                protein: recipe.nutrition.protein,
                carbs: recipe.nutrition.carbs,
                fat: recipe.nutrition.fat,
                is_generated: true
            });

            if (error) throw error;

            Alert.alert('Delícia! 😋', 'Refeição registrada no seu diário.');
            setShowRecipeModal(false);
        } catch (error) {
            Alert.alert('Erro', 'Falha ao registrar refeição.');
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <Text style={styles.title}>Gerador de Receitas 👨‍🍳</Text>
                <Text style={styles.subtitle}>O que você tem na despensa hoje?</Text>

                {/* Pantry Selection */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Sua Despensa:</Text>
                    <View style={styles.pantryList}>
                        {pantryItems.map(item => (
                            <TouchableOpacity
                                key={item.id}
                                onPress={() => toggleItem(item.name)}
                                style={[
                                    styles.pantryItem,
                                    selectedItems.includes(item.name) && styles.pantryItemActive
                                ]}
                            >
                                <Text style={[
                                    styles.pantryItemText,
                                    selectedItems.includes(item.name) && styles.pantryItemTextActive
                                ]}>
                                    {item.name}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Extra Ingredients & Photo */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Outros Ingredientes:</Text>
                    <View style={styles.inputRow}>
                        <TextInput
                            style={styles.input}
                            placeholder="Ex: tomate, cebola, frango..."
                            value={extraIngredients}
                            onChangeText={setExtraIngredients}
                        />
                        <TouchableOpacity
                            onPress={pickPantryPhoto}
                            disabled={analyzingPhoto}
                            style={styles.cameraButton}
                        >
                            {analyzingPhoto ? (
                                <ActivityIndicator color="#2563eb" />
                            ) : (
                                <Ionicons name="camera" size={24} color="#2563eb" />
                            )}
                        </TouchableOpacity>
                    </View>
                </View>

                <TouchableOpacity
                    onPress={handleGenerate}
                    disabled={loading}
                    style={styles.generateButton}
                >
                    {loading ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <Text style={styles.generateButtonText}>Gerar Receitas Mágicas ✨</Text>
                    )}
                </TouchableOpacity>

                {/* Results */}
                {recipes.length > 0 && (
                    <View style={styles.resultsContainer}>
                        <Text style={styles.sectionTitle}>Sugestões para você:</Text>
                        {recipes.map((recipe, index) => (
                            <TouchableOpacity
                                key={index}
                                onPress={() => {
                                    setSelectedRecipe(recipe);
                                    setShowRecipeModal(true);
                                }}
                                style={styles.recipeCard}
                            >
                                <View style={styles.recipeHeader}>
                                    <Text style={styles.recipeName}>{recipe.name}</Text>
                                    <View style={styles.timeBadge}>
                                        <Text style={styles.timeText}>{recipe.prepTime} min</Text>
                                    </View>
                                </View>
                                <Text style={styles.recipeDescription} numberOfLines={2}>{recipe.description}</Text>
                                <View style={styles.macrosRow}>
                                    <Text style={styles.macroText}>🔥 {recipe.nutrition.calories} kcal</Text>
                                    <Text style={styles.macroText}>🥩 {recipe.nutrition.protein}g P</Text>
                                    <Text style={styles.macroText}>🍞 {recipe.nutrition.carbs}g C</Text>
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>
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
                                        <Text style={styles.macroValue}>{selectedRecipe.nutrition.calories}</Text>
                                        <Text style={styles.macroLabel}>Calorias</Text>
                                    </View>
                                    <View style={styles.macroDivider} />
                                    <View style={styles.macroItem}>
                                        <Text style={styles.macroValue}>{selectedRecipe.nutrition.protein}g</Text>
                                        <Text style={styles.macroLabel}>Prot</Text>
                                    </View>
                                    <View style={styles.macroDivider} />
                                    <View style={styles.macroItem}>
                                        <Text style={styles.macroValue}>{selectedRecipe.nutrition.carbs}g</Text>
                                        <Text style={styles.macroLabel}>Carb</Text>
                                    </View>
                                    <View style={styles.macroDivider} />
                                    <View style={styles.macroItem}>
                                        <Text style={styles.macroValue}>{selectedRecipe.nutrition.fat}g</Text>
                                        <Text style={styles.macroLabel}>Gord</Text>
                                    </View>
                                </View>

                                <Text style={styles.sectionSubtitle}>Ingredientes</Text>
                                <View style={styles.ingredientsList}>
                                    {selectedRecipe.ingredients.map((ing: any, i: number) => (
                                        <Text key={i} style={styles.ingredientText}>• {ing.quantity} {ing.unit} {ing.name}</Text>
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
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#0f172a',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#64748b',
        marginBottom: 24,
    },
    card: {
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 16,
        marginBottom: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#334155',
        marginBottom: 12,
    },
    pantryList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    pantryItem: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        backgroundColor: '#f8fafc',
    },
    pantryItemActive: {
        backgroundColor: '#dcfce7',
        borderColor: '#22c55e',
    },
    pantryItemText: {
        color: '#475569',
        fontSize: 14,
    },
    pantryItemTextActive: {
        color: '#15803d',
        fontWeight: 'bold',
    },
    inputRow: {
        flexDirection: 'row',
        gap: 8,
    },
    input: {
        flex: 1,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 16,
    },
    cameraButton: {
        backgroundColor: '#dbeafe',
        width: 48,
        height: 48,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    generateButton: {
        backgroundColor: '#16a34a',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        shadowColor: '#16a34a',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
        marginBottom: 32,
    },
    generateButtonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
    resultsContainer: {
        marginBottom: 40,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#0f172a',
        marginBottom: 16,
    },
    recipeCard: {
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    recipeHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    recipeName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1e293b',
        flex: 1,
        marginRight: 8,
    },
    timeBadge: {
        backgroundColor: '#dcfce7',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    timeText: {
        color: '#15803d',
        fontSize: 12,
        fontWeight: 'bold',
    },
    recipeDescription: {
        color: '#64748b',
        marginBottom: 12,
        fontSize: 14,
        lineHeight: 20,
    },
    macrosRow: {
        flexDirection: 'row',
        gap: 12,
    },
    macroText: {
        fontSize: 12,
        color: '#94a3b8',
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
});

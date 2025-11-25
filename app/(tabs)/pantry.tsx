import { generateRecipeFromIngredients, IngredientParsed, normalizeIngredients, recognizeIngredientsFromImage } from '@/lib/openai';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';

import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface PantryItem {
    id: string;
    name: string;
    quantity: string | null;
    unit: string | null;
    category: string;
    status: 'in_stock' | 'running_low' | 'out_of_stock';
}

const CATEGORIES = ["Proteína", "Carboidrato", "Vegetal", "Fruta", "Laticínio", "Tempero", "Outros"];
const COMMON_UNITS = ["g", "kg", "ml", "l", "un", "colher", "xícara", "fatia"];

export default function PantryScreen() {
    const [items, setItems] = useState<PantryItem[]>([]);
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [showCaptureMenu, setShowCaptureMenu] = useState(false);

    // Filter and Search State
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Text Input State
    const [showTextModal, setShowTextModal] = useState(false);
    const [textInput, setTextInput] = useState('');

    // Edit Item State
    const [editingItem, setEditingItem] = useState<PantryItem | null>(null);
    const [editQuantity, setEditQuantity] = useState('');
    const [editUnit, setEditUnit] = useState('');
    const [editCategory, setEditCategory] = useState('');
    const [isCategorizing, setIsCategorizing] = useState(false);

    // Audio State


    const [processing, setProcessing] = useState(false);
    const [generatedRecipe, setGeneratedRecipe] = useState<any>(null);
    const [showRecipeModal, setShowRecipeModal] = useState(false);
    const [userProfile, setUserProfile] = useState<any>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        await Promise.all([loadPantryItems(), loadUserProfile()]);
    };

    const loadUserProfile = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            setUserProfile(data);
        } catch (error) {
            console.error('Erro ao carregar perfil:', error);
        }
    };

    const loadPantryItems = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                router.replace('/');
                return;
            }

            const { data, error } = await supabase
                .from('pantry_items')
                .select('*')
                .eq('user_id', user.id)
                .order('category', { ascending: true })
                .order('name', { ascending: true });

            if (error) {
                console.error('Erro ao carregar itens:', error);
            }
            setItems(data || []);
        } catch (error: any) {
            console.error('Erro ao carregar itens:', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleSelection = (id: string) => {
        const newSelected = new Set(selectedItems);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedItems(newSelected);
    };

    // --- PHOTO CAPTURE ---

    const handleCapturePhoto = async () => {
        setShowCaptureMenu(false);

        try {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permissão negada', 'Precisamos de acesso à câmera');
                return;
            }

            const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 0.7,
                base64: true,
            });

            if (!result.canceled && result.assets[0].base64) {
                await processImage(result.assets[0].base64);
            }
        } catch (error) {
            Alert.alert('Atenção', 'A câmera não está disponível neste dispositivo ou simulador. Tente usar a Galeria.');
        }
    };

    const handleChooseFromGallery = async () => {
        setShowCaptureMenu(false);

        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permissão negada', 'Precisamos de acesso à galeria');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.7,
            base64: true,
        });

        if (!result.canceled && result.assets[0].base64) {
            await processImage(result.assets[0].base64);
        }
    };

    const processImage = async (base64: string) => {
        setProcessing(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const ingredients = await recognizeIngredientsFromImage({
                userId: user.id,
                imageBase64: base64,
            });

            if (!ingredients || ingredients.length === 0) {
                Alert.alert('Ops!', 'Não consegui identificar nenhum ingrediente nesta imagem. Tente uma foto mais clara ou com menos objetos.');
                return;
            }

            await addIngredients(ingredients);
            Alert.alert('Sucesso!', `${ingredients.length} ingredientes reconhecidos e adicionados!`);
        } catch (error: any) {
            Alert.alert('Erro', error.message || 'Erro ao processar imagem');
        } finally {
            setProcessing(false);
        }
    };

    // --- MANUAL TEXT INPUT ---

    const handleManualInput = () => {
        setShowCaptureMenu(false);
        setShowTextModal(true);
    };

    const processTextInput = async () => {
        if (!textInput.trim()) return;

        setShowTextModal(false);
        setProcessing(true);

        try {
            // Normalizar e corrigir português com IA
            const ingredients = await normalizeIngredients(textInput);

            if (!ingredients || ingredients.length === 0) {
                Alert.alert('Atenção', 'Não entendi o que você escreveu. Tente listar os ingredientes.');
                setTextInput('');
                return;
            }

            await addIngredients(ingredients);
            setTextInput('');
            Alert.alert('Sucesso!', `${ingredients.length} ingredientes adicionados!`);
        } catch (error: any) {
            Alert.alert('Erro', error.message);
        } finally {
            setProcessing(false);
        }
    };

    // --- AUDIO RECORDING ---



    // --- COMMON ---

    const addIngredients = async (ingredients: IngredientParsed[]) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        for (const ingredient of ingredients) {
            const normalizedName = ingredient.name.toLowerCase().trim();

            // Verificar se já existe
            const { data: existing } = await supabase
                .from('pantry_items')
                .select('id')
                .eq('user_id', user.id)
                .eq('name', normalizedName)
                .single();

            if (existing) {
                // Se já existe, atualiza status e quantidade
                const updates: any = { status: 'in_stock' };
                if (ingredient.quantity) updates.quantity = ingredient.quantity;
                if (ingredient.unit) updates.unit = ingredient.unit;
                if (ingredient.category) updates.category = ingredient.category;

                const { error } = await supabase
                    .from('pantry_items')
                    .update(updates)
                    .eq('id', existing.id);

                if (error) console.error('Erro ao atualizar item:', error);
            } else {
                // Se não existe, insere
                const { error } = await supabase
                    .from('pantry_items')
                    .insert({
                        user_id: user.id,
                        name: normalizedName,
                        quantity: ingredient.quantity || null,
                        unit: ingredient.unit || null,
                        category: ingredient.category || 'Outros',
                        status: 'in_stock',
                    });

                if (error) {
                    console.error('Erro ao inserir item:', error);
                }
            }
        }

        await loadPantryItems();
    };

    const handleEditItem = (item: PantryItem) => {
        setEditingItem(item);
        setEditQuantity(item.quantity || '');
        setEditUnit(item.unit || '');
        setEditCategory(item.category || 'Outros');
    };

    const handleAutoCategorize = async () => {
        if (!editingItem) return;
        setIsCategorizing(true);
        try {
            const result = await normalizeIngredients(editingItem.name);
            if (result && result.length > 0) {
                setEditCategory(result[0].category);
            } else {
                Alert.alert('IA', 'Não consegui identificar a categoria automaticamente.');
            }
        } catch (error) {
            Alert.alert('Erro', 'Falha ao categorizar com IA.');
        } finally {
            setIsCategorizing(false);
        }
    };

    const saveItemChanges = async () => {
        if (!editingItem) return;

        let q = editQuantity.trim();
        let u = editUnit.trim();

        const { error } = await supabase
            .from('pantry_items')
            .update({
                quantity: q || null,
                unit: u || null,
                category: editCategory
            })
            .eq('id', editingItem.id);

        if (error) {
            Alert.alert('Erro', 'Falha ao atualizar item');
            console.error(error);
        } else {
            await loadPantryItems();
            setEditingItem(null);
        }
    };

    const deleteItem = async (itemId: string) => {
        try {
            const { error } = await supabase
                .from('pantry_items')
                .delete()
                .eq('id', itemId);

            if (error) throw error;
            loadPantryItems();
        } catch (error: any) {
            Alert.alert('Erro', error.message);
        }
    };

    const handleGenerateRecipe = async () => {
        const itemsToUse = selectedItems.size > 0
            ? items.filter(i => selectedItems.has(i.id))
            : items.filter(i => i.status === 'in_stock');

        if (itemsToUse.length === 0) {
            Alert.alert('Ops!', 'Selecione ou adicione ingredientes disponíveis');
            return;
        }

        setProcessing(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const ingredientNames = itemsToUse.map(i => i.name);

            const recipe = await generateRecipeFromIngredients({
                userId: user.id,
                ingredients: ingredientNames,
                profile: {
                    goal: userProfile?.goal || 'maintain',
                    cookingTime: userProfile?.cooking_time || 30,
                    availableEquipment: userProfile?.equipment || [],
                    dietaryRestrictions: userProfile?.dietary_restrictions || [],
                    allergies: userProfile?.allergies || [],
                },
            });

            setGeneratedRecipe(recipe);
            setShowRecipeModal(true);
        } catch (error: any) {
            Alert.alert('Erro', error.message || 'Erro ao gerar receita');
        } finally {
            setProcessing(false);
        }
    };

    // Filter and search items
    const filteredItems = items.filter(item => {
        // Filter by category
        if (selectedCategory && item.category !== selectedCategory) {
            return false;
        }
        // Filter by search query
        if (searchQuery && !item.name.toLowerCase().includes(searchQuery.toLowerCase())) {
            return false;
        }
        return true;
    });

    // Agrupar itens por categoria
    const groupedItems = filteredItems.reduce((acc, item) => {
        const cat = item.category || 'Outros';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(item);
        return acc;
    }, {} as Record<string, PantryItem[]>);

    const categories = Object.keys(groupedItems).sort();
    const allCategories = Array.from(new Set(items.map(i => i.category || 'Outros'))).sort();

    const availableCount = items.filter(i => i.status === 'in_stock').length;
    const runningLowCount = items.filter(i => i.status === 'running_low').length;
    const selectedCount = selectedItems.size;

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <Text style={styles.title}>Minha Despensa</Text>
                    <TouchableOpacity onPress={() => setShowCaptureMenu(true)}>
                        <Ionicons name="add-circle" size={32} color="#16a34a" />
                    </TouchableOpacity>
                </View>
                <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>{items.length}</Text>
                        <Text style={styles.statLabel}>Total</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <Text style={[styles.statValue, { color: '#22c55e' }]}>{availableCount}</Text>
                        <Text style={styles.statLabel}>Disponíveis</Text>
                    </View>
                    {runningLowCount > 0 && (
                        <>
                            <View style={styles.statDivider} />
                            <View style={styles.statItem}>
                                <Text style={[styles.statValue, { color: '#f59e0b' }]}>{runningLowCount}</Text>
                                <Text style={styles.statLabel}>Acabando</Text>
                            </View>
                        </>
                    )}
                </View>
            </View>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color="#9ca3af" style={styles.searchIcon} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Buscar ingredientes..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholderTextColor="#9ca3af"
                />
                {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                        <Ionicons name="close-circle" size={20} color="#9ca3af" />
                    </TouchableOpacity>
                )}
            </View>

            {/* Category Filters */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.filtersContainer}
                contentContainerStyle={styles.filtersContent}
            >
                <TouchableOpacity
                    style={[styles.filterChip, !selectedCategory && styles.filterChipActive]}
                    onPress={() => setSelectedCategory(null)}
                >
                    <Text style={[styles.filterChipText, !selectedCategory && styles.filterChipTextActive]}>
                        Todos
                    </Text>
                </TouchableOpacity>
                {allCategories.map(cat => (
                    <TouchableOpacity
                        key={cat}
                        style={[styles.filterChip, selectedCategory === cat && styles.filterChipActive]}
                        onPress={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                    >
                        <Text style={[styles.filterChipText, selectedCategory === cat && styles.filterChipTextActive]}>
                            {cat}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {filteredItems.length === 0 && items.length > 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyIcon}>🔍</Text>
                        <Text style={styles.emptyStateTitle}>Nenhum resultado</Text>
                        <Text style={styles.emptyStateText}>
                            Não encontramos ingredientes com esses filtros
                        </Text>
                    </View>
                ) : items.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyIcon}>🥘</Text>
                        <Text style={styles.emptyStateTitle}>Despensa vazia</Text>
                        <Text style={styles.emptyStateText}>
                            Adicione ingredientes que você tem em casa para receber receitas personalizadas
                        </Text>
                    </View>
                ) : (
                    <View style={styles.itemsList}>
                        {categories.map((category) => (
                            <View key={category} style={styles.categorySection}>
                                <Text style={styles.categoryTitle}>{category}</Text>
                                <View style={styles.categoryItems}>
                                    {groupedItems[category].map((item) => {
                                        const isSelected = selectedItems.has(item.id);
                                        return (
                                            <TouchableOpacity
                                                key={item.id}
                                                style={[styles.itemCard, isSelected && styles.itemCardSelected]}
                                                onPress={() => toggleSelection(item.id)}
                                            >
                                                <View style={styles.itemContent}>
                                                    <View style={styles.checkboxContainer}>
                                                        <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                                                            {isSelected && <Ionicons name="checkmark" size={14} color="white" />}
                                                        </View>
                                                    </View>

                                                    <View style={styles.itemInfo}>
                                                        <Text style={styles.itemName}>{item.name}</Text>
                                                        <TouchableOpacity onPress={() => handleEditItem(item)}>
                                                            {item.quantity ? (
                                                                <Text style={styles.itemQuantity}>
                                                                    {item.quantity} {item.unit}
                                                                </Text>
                                                            ) : (
                                                                <Text style={styles.addQuantityText}>+ editar</Text>
                                                            )}
                                                        </TouchableOpacity>
                                                    </View>

                                                    <TouchableOpacity
                                                        onPress={() => deleteItem(item.id)}
                                                        style={styles.deleteButton}
                                                    >
                                                        <Ionicons name="trash-outline" size={20} color="#ef4444" />
                                                    </TouchableOpacity>
                                                </View>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>
                        ))}
                    </View>
                )}
            </ScrollView>

            {/* Generate Recipe Button Bar */}
            <View style={styles.bottomBar}>
                <View style={styles.bottomBarContent}>
                    <View>
                        <Text style={styles.bottomBarTitle}>Gerar Receita</Text>
                        <Text style={styles.bottomBarSubtitle}>
                            {selectedCount > 0
                                ? `${selectedCount} itens selecionados`
                                : availableCount > 0
                                    ? 'Usar todos os itens'
                                    : 'Adicione itens'}
                        </Text>
                    </View>
                    <TouchableOpacity
                        style={[styles.generateButton, availableCount === 0 && styles.generateButtonDisabled]}
                        onPress={handleGenerateRecipe}
                        disabled={processing || availableCount === 0}
                    >
                        {processing ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Ionicons name="restaurant" size={24} color="white" />
                        )}
                    </TouchableOpacity>
                </View>
            </View>

            {/* Floating Action Button - REMOVED */}


            {/* Capture Menu Modal */}
            <Modal visible={showCaptureMenu} transparent animationType="fade">
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowCaptureMenu(false)}
                >
                    <View style={styles.captureMenu}>
                        <Text style={styles.menuHeader}>Adicionar Ingredientes</Text>
                        <View style={styles.menuGrid}>
                            <TouchableOpacity style={styles.menuGridItem} onPress={handleCapturePhoto}>
                                <View style={[styles.menuIconContainer, { backgroundColor: '#dcfce7' }]}>
                                    <Ionicons name="camera" size={28} color="#16a34a" />
                                </View>
                                <Text style={styles.menuGridText}>Foto</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.menuGridItem} onPress={handleChooseFromGallery}>
                                <View style={[styles.menuIconContainer, { backgroundColor: '#dbeafe' }]}>
                                    <Ionicons name="images" size={28} color="#2563eb" />
                                </View>
                                <Text style={styles.menuGridText}>Galeria</Text>
                            </TouchableOpacity>



                            <TouchableOpacity style={styles.menuGridItem} onPress={handleManualInput}>
                                <View style={[styles.menuIconContainer, { backgroundColor: '#f3e8ff' }]}>
                                    <Ionicons name="create" size={28} color="#9333ea" />
                                </View>
                                <Text style={styles.menuGridText}>Texto</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Edit Item Modal */}
            <Modal visible={!!editingItem} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.editQuantityCard}>
                        <Text style={styles.modalTitle}>Editar Item</Text>
                        <Text style={styles.modalSubtitle}>{editingItem?.name}</Text>

                        <View style={styles.quantityRow}>
                            <View style={styles.quantityInputContainer}>
                                <Text style={styles.label}>Quantidade</Text>
                                <TextInput
                                    style={styles.quantityInput}
                                    placeholder="Ex: 200"
                                    value={editQuantity}
                                    onChangeText={setEditQuantity}
                                    keyboardType="numeric"
                                />
                            </View>
                            <View style={styles.unitInputContainer}>
                                <Text style={styles.label}>Unidade</Text>
                                <TextInput
                                    style={styles.quantityInput}
                                    placeholder="Ex: g"
                                    value={editUnit}
                                    onChangeText={setEditUnit}
                                    autoCapitalize="none"
                                />
                            </View>
                        </View>

                        <View style={styles.unitsGrid}>
                            {COMMON_UNITS.map(u => (
                                <TouchableOpacity
                                    key={u}
                                    style={[
                                        styles.unitChip,
                                        editUnit === u && styles.unitChipSelected
                                    ]}
                                    onPress={() => setEditUnit(u)}
                                >
                                    <Text style={[
                                        styles.unitChipText,
                                        editUnit === u && styles.unitChipTextSelected
                                    ]}>{u}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <View style={styles.labelRow}>
                            <Text style={styles.label}>Categoria</Text>
                            <TouchableOpacity
                                style={styles.aiButton}
                                onPress={handleAutoCategorize}
                                disabled={isCategorizing}
                            >
                                {isCategorizing ? (
                                    <ActivityIndicator size="small" color="white" />
                                ) : (
                                    <>
                                        <Ionicons name="sparkles" size={12} color="white" />
                                        <Text style={styles.aiButtonText}>Auto IA</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>

                        <View style={styles.categoriesGrid}>
                            {CATEGORIES.map(cat => (
                                <TouchableOpacity
                                    key={cat}
                                    style={[
                                        styles.categoryChip,
                                        editCategory === cat && styles.categoryChipSelected
                                    ]}
                                    onPress={() => setEditCategory(cat)}
                                >
                                    <Text style={[
                                        styles.categoryChipText,
                                        editCategory === cat && styles.categoryChipTextSelected
                                    ]}>{cat}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={styles.cancelButton}
                                onPress={() => setEditingItem(null)}
                            >
                                <Text style={styles.cancelButtonText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.confirmButton}
                                onPress={saveItemChanges}
                            >
                                <Text style={styles.confirmButtonText}>Salvar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Text Input Modal */}
            <Modal visible={showTextModal} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.textModalCard}>
                        <Text style={styles.modalTitle}>Adicionar Ingredientes</Text>
                        <Text style={styles.modalSubtitle}>
                            Digite os ingredientes (ex: frango, arroz, tomate)
                        </Text>
                        <TextInput
                            style={styles.textArea}
                            placeholder="Digite aqui..."
                            value={textInput}
                            onChangeText={setTextInput}
                            multiline
                            numberOfLines={5}
                            autoFocus
                        />
                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={styles.cancelButton}
                                onPress={() => {
                                    setShowTextModal(false);
                                    setTextInput('');
                                }}
                            >
                                <Text style={styles.cancelButtonText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.confirmButton}
                                onPress={processTextInput}
                            >
                                <Text style={styles.confirmButtonText}>Adicionar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>



            {/* Recipe Modal */}
            <Modal visible={showRecipeModal} animationType="slide">
                {generatedRecipe && (
                    <SafeAreaView style={styles.recipeModalContainer}>
                        <View style={styles.recipeHeader}>
                            <Text style={styles.recipeTitle}>{generatedRecipe.name}</Text>
                            <TouchableOpacity onPress={() => setShowRecipeModal(false)}>
                                <Ionicons name="close" size={28} color="#1f2937" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.recipeContent}>
                            <View style={styles.recipeStats}>
                                <View style={styles.stat}>
                                    <Text style={styles.statValue}>{generatedRecipe.calories}</Text>
                                    <Text style={styles.statLabel}>kcal</Text>
                                </View>
                                <View style={styles.stat}>
                                    <Text style={styles.statValue}>{generatedRecipe.cooking_time}min</Text>
                                    <Text style={styles.statLabel}>tempo</Text>
                                </View>
                                <View style={styles.stat}>
                                    <Text style={styles.statValue}>{generatedRecipe.servings}</Text>
                                    <Text style={styles.statLabel}>porções</Text>
                                </View>
                            </View>

                            <Text style={styles.sectionTitle}>Ingredientes</Text>
                            {generatedRecipe.ingredients.map((ing: string, i: number) => (
                                <Text key={i} style={styles.ingredientText}>• {ing}</Text>
                            ))}

                            <Text style={styles.sectionTitle}>Modo de Preparo</Text>
                            {generatedRecipe.instructions.map((step: string, i: number) => (
                                <View key={i} style={styles.stepContainer}>
                                    <View style={styles.stepNumber}>
                                        <Text style={styles.stepNumberText}>{i + 1}</Text>
                                    </View>
                                    <Text style={styles.stepText}>{step}</Text>
                                </View>
                            ))}
                        </ScrollView>
                    </SafeAreaView>
                )}
            </Modal>

            {/* Processing Overlay */}
            {processing && (
                <View style={styles.processingOverlay}>
                    <View style={styles.processingCard}>
                        <ActivityIndicator size="large" color="#22c55e" />
                        <Text style={styles.processingText}>Processando...</Text>
                    </View>
                </View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f9fafb',
    },
    header: {
        padding: 20,
        paddingBottom: 16,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#1f2937',
    },
    subtitle: {
        fontSize: 14,
        color: '#6b7280',
        marginTop: 4,
    },
    scrollContent: {
        padding: 20,
        paddingTop: 0,
        paddingBottom: 100,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyIcon: {
        fontSize: 64,
        marginBottom: 16,
    },
    emptyStateTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1f2937',
        marginBottom: 8,
    },
    emptyStateText: {
        fontSize: 16,
        color: '#6b7280',
        textAlign: 'center',
        paddingHorizontal: 40,
    },
    itemsList: {
        gap: 12,
    },
    itemCard: {
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    itemCardSelected: {
        borderColor: '#22c55e',
        backgroundColor: '#f0fdf4',
    },
    itemContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    checkboxContainer: {
        marginRight: 12,
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#d1d5db',
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkboxSelected: {
        backgroundColor: '#22c55e',
        borderColor: '#22c55e',
    },
    itemName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1f2937',
        textTransform: 'capitalize',
    },
    generateContainer: {
        position: 'absolute',
        bottom: 90,
        left: 20,
        right: 20,
    },
    generateButton: {
        backgroundColor: '#22c55e',
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#22c55e',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    generateButtonDisabled: {
        backgroundColor: '#9ca3af',
        shadowOpacity: 0,
    },
    generateButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    fab: {
        position: 'absolute',
        right: 20,
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#16a34a',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
        zIndex: 50,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    captureMenu: {
        backgroundColor: 'white',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 20,
        paddingBottom: 40,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        gap: 16,
    },
    menuText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1f2937',
    },
    textModalCard: {
        backgroundColor: 'white',
        borderRadius: 24,
        padding: 24,
        margin: 20,
        marginTop: 'auto',
        marginBottom: 'auto',
    },
    audioModalCard: {
        backgroundColor: 'white',
        borderRadius: 24,
        padding: 24,
        margin: 20,
        marginTop: 'auto',
        marginBottom: 'auto',
        alignItems: 'center',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1f2937',
        marginBottom: 8,
        textAlign: 'center',
    },
    modalSubtitle: {
        fontSize: 16,
        color: '#6b7280',
        marginBottom: 20,
        textAlign: 'center',
    },
    textArea: {
        backgroundColor: '#f3f4f6',
        borderRadius: 12,
        padding: 16,
        height: 120,
        textAlignVertical: 'top',
        fontSize: 16,
        marginBottom: 20,
    },
    modalButtons: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 24,
    },
    cancelButton: {
        flex: 1,
        padding: 16,
        borderRadius: 12,
        backgroundColor: '#f3f4f6',
        alignItems: 'center',
    },
    confirmButton: {
        flex: 1,
        padding: 16,
        borderRadius: 12,
        backgroundColor: '#22c55e',
        alignItems: 'center',
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#4b5563',
    },
    confirmButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: 'white',
    },
    micContainer: {
        alignItems: 'center',
        marginVertical: 32,
    },
    micButton: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#ef4444',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    micButtonRecording: {
        backgroundColor: '#dc2626',
        transform: [{ scale: 1.1 }],
    },
    recordingStatus: {
        fontSize: 16,
        color: '#ef4444',
        fontWeight: '600',
    },
    recipeModalContainer: {
        flex: 1,
        backgroundColor: 'white',
    },
    recipeHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },
    recipeTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1f2937',
        flex: 1,
        marginRight: 16,
    },
    recipeContent: {
        padding: 20,
    },
    recipeStats: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        backgroundColor: '#f3f4f6',
        padding: 16,
        borderRadius: 16,
        marginBottom: 24,
    },
    stat: {
        alignItems: 'center',
    },
    statValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1f2937',
    },
    statLabel: {
        fontSize: 14,
        color: '#6b7280',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1f2937',
        marginBottom: 12,
        marginTop: 12,
    },
    ingredientText: {
        fontSize: 16,
        color: '#4b5563',
        marginBottom: 8,
        lineHeight: 24,
    },
    stepContainer: {
        flexDirection: 'row',
        marginBottom: 16,
    },
    stepNumber: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#22c55e',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        marginTop: 2,
    },
    stepNumberText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 14,
    },
    stepText: {
        flex: 1,
        fontSize: 16,
        color: '#4b5563',
        lineHeight: 24,
    },
    processingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    processingCard: {
        backgroundColor: 'white',
        padding: 24,
        borderRadius: 16,
        alignItems: 'center',
        gap: 12,
    },
    processingText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1f2937',
    },
    categorySection: {
        marginBottom: 24,
    },
    categoryTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1f2937',
        marginBottom: 12,
        marginLeft: 4,
    },
    categoryItems: {
        gap: 12,
    },
    itemInfo: {
        flex: 1,
    },
    itemQuantity: {
        fontSize: 14,
        color: '#6b7280',
        marginTop: 2,
    },
    addQuantityText: {
        fontSize: 12,
        color: '#3b82f6',
        marginTop: 2,
        fontWeight: '500',
    },
    deleteButton: {
        padding: 8,
    },
    bottomBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'white',
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
        paddingTop: 16,
        paddingHorizontal: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 5,
    },
    bottomBarContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    bottomBarTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1f2937',
    },
    bottomBarSubtitle: {
        fontSize: 14,
        color: '#6b7280',
    },
    menuHeader: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1f2937',
        marginBottom: 24,
        textAlign: 'center',
    },
    menuGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
        justifyContent: 'center',
    },
    menuGridItem: {
        width: '45%',
        backgroundColor: '#f9fafb',
        padding: 16,
        borderRadius: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    menuIconContainer: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    menuGridText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
    },
    editQuantityCard: {
        backgroundColor: 'white',
        width: '90%',
        borderRadius: 24,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 5,
    },
    quantityRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16,
    },
    quantityInputContainer: {
        flex: 1,
    },
    unitInputContainer: {
        flex: 1,
    },
    quantityInput: {
        width: '100%',
        backgroundColor: '#f3f4f6',
        padding: 16,
        borderRadius: 12,
        fontSize: 16,
        color: '#1f2937',
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#4b5563',
        marginBottom: 8,
    },
    labelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
        marginTop: 16,
    },
    aiButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#8b5cf6',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },
    aiButtonText: {
        color: 'white',
        fontSize: 12,
        fontWeight: '600',
    },
    categoriesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    categoryChip: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#f3f4f6',
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    categoryChipSelected: {
        backgroundColor: '#f0fdf4',
        borderColor: '#22c55e',
    },
    categoryChipText: {
        fontSize: 14,
        color: '#4b5563',
    },
    categoryChipTextSelected: {
        color: '#16a34a',
        fontWeight: '600',
    },
    unitsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 8,
    },
    unitChip: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 16,
        backgroundColor: '#f3f4f6',
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    unitChipSelected: {
        backgroundColor: '#eff6ff',
        borderColor: '#3b82f6',
    },
    unitChipText: {
        fontSize: 12,
        color: '#4b5563',
    },
    unitChipTextSelected: {
        color: '#2563eb',
        fontWeight: '600',
    },
    // Stats Row Styles
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        gap: 16,
    },
    statItem: {
        alignItems: 'center',
    },
    statDivider: {
        width: 1,
        height: 24,
        backgroundColor: '#e5e7eb',
    },
    // Search Styles
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'white',
        marginHorizontal: 20,
        marginBottom: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: '#1f2937',
    },
    // Filter Styles
    filtersContainer: {
        marginBottom: 16,
        height: 50, // Fixed height for scroll container
    },
    filtersContent: {
        paddingHorizontal: 20,
        paddingRight: 60,
        alignItems: 'center', // Center items vertically
    },
    filterChip: {
        paddingHorizontal: 16,
        height: 36, // Fixed height for chips
        borderRadius: 18,
        backgroundColor: '#f3f4f6',
        borderWidth: 1,
        borderColor: '#e5e7eb',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
    },
    filterChipActive: {
        backgroundColor: '#22c55e',
        borderColor: '#22c55e',
    },
    filterChipText: {
        fontSize: 14,
        color: '#4b5563', // Darker gray for better contrast
        fontWeight: '600',
    },
    filterChipTextActive: {
        color: 'white',
        fontWeight: '700',
    },
});

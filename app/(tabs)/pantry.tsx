import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface PantryItem {
    id: string;
    name: string;
    category: string;
    quantity: number | null;
    unit: string | null;
    status: 'available' | 'running_low' | 'out';
}

export default function PantryScreen() {
    const [items, setItems] = useState<PantryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [newItemName, setNewItemName] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);

    useEffect(() => {
        loadPantryItems();
    }, []);

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
                .order('name');

            if (error) throw error;
            setItems(data || []);
        } catch (error: any) {
            Alert.alert('Erro', error.message);
        } finally {
            setLoading(false);
        }
    };

    const addItem = async () => {
        if (!newItemName.trim()) {
            Alert.alert('Erro', 'Digite o nome do ingrediente');
            return;
        }

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { error } = await supabase
                .from('pantry_items')
                .insert({
                    user_id: user.id,
                    name: newItemName.trim(),
                    category: 'outros',
                    status: 'available',
                });

            if (error) throw error;

            setNewItemName('');
            setShowAddForm(false);
            loadPantryItems();
        } catch (error: any) {
            Alert.alert('Erro', error.message);
        }
    };

    const updateItemStatus = async (itemId: string, newStatus: 'available' | 'running_low' | 'out') => {
        try {
            const { error } = await supabase
                .from('pantry_items')
                .update({ status: newStatus })
                .eq('id', itemId);

            if (error) throw error;
            loadPantryItems();
        } catch (error: any) {
            Alert.alert('Erro', error.message);
        }
    };

    const deleteItem = async (itemId: string) => {
        Alert.alert(
            'Confirmar',
            'Deseja remover este item?',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Remover',
                    style: 'destructive',
                    onPress: async () => {
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
                    },
                },
            ]
        );
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'available':
                return '#22c55e';
            case 'running_low':
                return '#f59e0b';
            case 'out':
                return '#ef4444';
            default:
                return '#6b7280';
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'available':
                return 'Disponível';
            case 'running_low':
                return 'Acabando';
            case 'out':
                return 'Acabou';
            default:
                return status;
        }
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
            <View style={styles.header}>
                <Text style={styles.title}>Minha Despensa</Text>
                <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => setShowAddForm(!showAddForm)}
                >
                    <Text style={styles.addButtonText}>{showAddForm ? '✕' : '+'}</Text>
                </TouchableOpacity>
            </View>

            {showAddForm && (
                <View style={styles.addForm}>
                    <TextInput
                        style={styles.input}
                        placeholder="Nome do ingrediente"
                        value={newItemName}
                        onChangeText={setNewItemName}
                        autoFocus
                    />
                    <TouchableOpacity style={styles.submitButton} onPress={addItem}>
                        <Text style={styles.submitButtonText}>Adicionar</Text>
                    </TouchableOpacity>
                </View>
            )}

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {items.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyStateTitle}>Despensa vazia</Text>
                        <Text style={styles.emptyStateText}>
                            Adicione ingredientes que você tem em casa para receber receitas personalizadas
                        </Text>
                    </View>
                ) : (
                    <View style={styles.itemsList}>
                        {items.map((item) => (
                            <View key={item.id} style={styles.itemCard}>
                                <View style={styles.itemHeader}>
                                    <Text style={styles.itemName}>{item.name}</Text>
                                    <TouchableOpacity onPress={() => deleteItem(item.id)}>
                                        <Text style={styles.deleteButton}>🗑️</Text>
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.statusButtons}>
                                    <TouchableOpacity
                                        style={[
                                            styles.statusButton,
                                            item.status === 'available' && { backgroundColor: '#22c55e' },
                                        ]}
                                        onPress={() => updateItemStatus(item.id, 'available')}
                                    >
                                        <Text
                                            style={[
                                                styles.statusButtonText,
                                                item.status === 'available' && styles.statusButtonTextActive,
                                            ]}
                                        >
                                            Tenho
                                        </Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[
                                            styles.statusButton,
                                            item.status === 'running_low' && { backgroundColor: '#f59e0b' },
                                        ]}
                                        onPress={() => updateItemStatus(item.id, 'running_low')}
                                    >
                                        <Text
                                            style={[
                                                styles.statusButtonText,
                                                item.status === 'running_low' && styles.statusButtonTextActive,
                                            ]}
                                        >
                                            Acabando
                                        </Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[
                                            styles.statusButton,
                                            item.status === 'out' && { backgroundColor: '#ef4444' },
                                        ]}
                                        onPress={() => updateItemStatus(item.id, 'out')}
                                    >
                                        <Text
                                            style={[
                                                styles.statusButtonText,
                                                item.status === 'out' && styles.statusButtonTextActive,
                                            ]}
                                        >
                                            Acabou
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}
                    </View>
                )}
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
        padding: 20,
        paddingBottom: 16,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#1f2937',
    },
    addButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#22c55e',
        justifyContent: 'center',
        alignItems: 'center',
    },
    addButtonText: {
        color: 'white',
        fontSize: 24,
        fontWeight: 'bold',
    },
    addForm: {
        flexDirection: 'row',
        gap: 12,
        paddingHorizontal: 20,
        paddingBottom: 16,
    },
    input: {
        flex: 1,
        backgroundColor: 'white',
        height: 48,
        borderRadius: 12,
        paddingHorizontal: 16,
        fontSize: 16,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    submitButton: {
        backgroundColor: '#22c55e',
        paddingHorizontal: 24,
        borderRadius: 12,
        justifyContent: 'center',
    },
    submitButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
    scrollContent: {
        padding: 20,
        paddingTop: 0,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
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
    },
    itemHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    itemName: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1f2937',
        textTransform: 'capitalize',
    },
    deleteButton: {
        fontSize: 20,
        padding: 4,
    },
    statusButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    statusButton: {
        flex: 1,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        backgroundColor: '#f3f4f6',
        alignItems: 'center',
    },
    statusButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6b7280',
    },
    statusButtonTextActive: {
        color: 'white',
    },
});

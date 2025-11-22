import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface RecipeCardProps {
    type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    name: string;
    calories: number;
    macros: { protein: number; carbs: number; fat: number };
    cookingTime: number;
    difficulty: 'easy' | 'medium' | 'hard';
    onPress: () => void;
    onSwap?: () => void; // New: callback to swap recipe
}

export function RecipeCard({ type, name, calories, macros, cookingTime, difficulty, onPress, onSwap }: RecipeCardProps) {
    const getTypeInfo = (type: string) => {
        switch (type) {
            case 'breakfast': return { label: 'Café da Manhã', icon: 'sunny-outline', color: '#f59e0b', bg: '#fef3c7' };
            case 'snack_morning': return { label: 'Lanche Manhã', icon: 'cafe-outline', color: '#ec4899', bg: '#fce7f3' };
            case 'lunch': return { label: 'Almoço', icon: 'restaurant-outline', color: '#22c55e', bg: '#dcfce7' };
            case 'snack': return { label: 'Lanche Tarde', icon: 'cafe-outline', color: '#8b5cf6', bg: '#ede9fe' };
            case 'dinner': return { label: 'Jantar', icon: 'moon-outline', color: '#3b82f6', bg: '#dbeafe' };
            case 'snack_night': return { label: 'Ceia', icon: 'moon-sharp', color: '#6366f1', bg: '#e0e7ff' };
            default: return { label: 'Refeição', icon: 'restaurant-outline', color: '#6b7280', bg: '#f3f4f6' };
        }
    };

    const typeInfo = getTypeInfo(type);

    return (
        <TouchableOpacity style={styles.card} onPress={onPress}>
            <View style={[styles.iconContainer, { backgroundColor: typeInfo.bg }]}>
                <Ionicons name={typeInfo.icon as any} size={24} color={typeInfo.color} />
            </View>

            <View style={styles.content}>
                <View style={styles.header}>
                    <Text style={[styles.typeLabel, { color: typeInfo.color }]}>{typeInfo.label}</Text>
                    <View style={styles.metaRow}>
                        <Text style={styles.metaText}>⏱️ {cookingTime}min</Text>
                        <Text style={styles.metaText}>🔥 {calories}kcal</Text>
                    </View>
                </View>

                <Text style={styles.name} numberOfLines={2}>{name}</Text>

                <View style={styles.macrosRow}>
                    <Text style={styles.macroText}>🥩 {macros.protein}g</Text>
                    <Text style={styles.macroText}>🍞 {macros.carbs}g</Text>
                    <Text style={styles.macroText}>🥑 {macros.fat}g</Text>
                </View>
            </View>

            {/* Swap Button */}
            {onSwap && (
                <TouchableOpacity
                    style={styles.swapButton}
                    onPress={(e) => {
                        e.stopPropagation();
                        onSwap();
                    }}
                >
                    <Ionicons name="swap-horizontal" size={18} color="#16a34a" />
                    <Text style={styles.swapText}>Trocar</Text>
                </TouchableOpacity>
            )}

            <Ionicons name="chevron-forward" size={20} color="#d1d5db" />
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 16,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    typeLabel: {
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    metaRow: {
        flexDirection: 'row',
        gap: 8,
    },
    metaText: {
        fontSize: 12,
        color: '#6b7280',
        fontWeight: '500',
    },
    name: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1f2937',
        marginBottom: 8,
    },
    macrosRow: {
        flexDirection: 'row',
        gap: 12,
    },
    macroText: {
        fontSize: 12,
        color: '#6b7280',
    },
    swapButton: {
        backgroundColor: '#dcfce7',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginRight: 8,
        borderWidth: 1,
        borderColor: '#bbf7d0',
    },
    swapText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#15803d',
    },
});

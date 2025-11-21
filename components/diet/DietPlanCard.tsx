import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface DietPlanCardProps {
    planName: string;
    duration: number;
    calories: number;
    goal: string;
    onRegenerate: () => void;
}

export function DietPlanCard({ planName, duration, calories, goal, onRegenerate }: DietPlanCardProps) {
    const getGoalEmoji = (goal: string) => {
        if (goal.includes('lose')) return '📉';
        if (goal.includes('muscle')) return '💪';
        return '⚖️';
    };

    const getGoalLabel = (goal: string) => {
        if (goal === 'lose_weight') return 'Perda de Peso';
        if (goal === 'gain_muscle') return 'Ganho de Massa';
        if (goal === 'maintain') return 'Manutenção';
        return 'Saúde Geral';
    };

    return (
        <View style={styles.card}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.title}>{planName}</Text>
                    <Text style={styles.subtitle}>{duration} dias • Personalizado para você</Text>
                </View>
                <TouchableOpacity onPress={onRegenerate} style={styles.regenerateButton}>
                    <Ionicons name="refresh" size={20} color="#22c55e" />
                </TouchableOpacity>
            </View>

            <View style={styles.statsRow}>
                <View style={styles.stat}>
                    <Text style={styles.statEmoji}>{getGoalEmoji(goal)}</Text>
                    <Text style={styles.statLabel}>{getGoalLabel(goal)}</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.stat}>
                    <Text style={styles.statEmoji}>🔥</Text>
                    <Text style={styles.statLabel}>{calories} kcal/dia</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.stat}>
                    <Text style={styles.statEmoji}>📅</Text>
                    <Text style={styles.statLabel}>{duration} dias</Text>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: 'white',
        borderRadius: 24,
        padding: 20,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 4,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 20,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1f2937',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 14,
        color: '#6b7280',
    },
    regenerateButton: {
        padding: 8,
        backgroundColor: '#f0fdf4',
        borderRadius: 12,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#f9fafb',
        borderRadius: 16,
        padding: 16,
    },
    stat: {
        alignItems: 'center',
        flex: 1,
    },
    statEmoji: {
        fontSize: 20,
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#4b5563',
        textAlign: 'center',
    },
    divider: {
        width: 1,
        height: 24,
        backgroundColor: '#e5e7eb',
    },
});

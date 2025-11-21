import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface UserProfile {
    id: string;
    full_name: string;
    weight: number;
    height: number;
    target_weight: number;
    activity_level: string;
    goal: string;
    created_at: string;
    birth_date?: string; // Optional, as it's used with a check
    training_frequency?: string;
    cooking_time?: number;
}

export default function ProfileScreen() {
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const router = useRouter();

    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) return;

            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (error) throw error;
            setProfile(data);
        } catch (error: any) {
            Alert.alert('Erro', error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.replace('/');
    };

    const getGoalLabel = (value: string) => {
        const goals: Record<string, string> = {
            'lose_weight': 'Perder Peso 📉',
            'gain_muscle': 'Ganhar Massa 💪',
            'maintain': 'Manter Peso ⚖️',
            'bodybuilding': 'Bodybuilding 🏋️',
            'health': 'Saúde Geral ❤️'
        };
        return goals[value] || value;
    };

    const getActivityLabel = (value: string) => {
        const activities: Record<string, string> = {
            'sedentary': 'Sedentário 🪑',
            'light': 'Levemente Ativo 🚶',
            'moderate': 'Moderadamente Ativo 🏃',
            'intense': 'Muito Ativo 💼',
            'very_intense': 'Extremamente Ativo 🏗️'
        };
        return activities[value] || value;
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#22c55e" />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <Text style={styles.title}>Meu Perfil</Text>

                {/* Cartão de Resumo */}
                <View style={styles.summaryCard}>
                    <View style={styles.avatarContainer}>
                        <Text style={styles.avatarText}>
                            {profile?.full_name?.charAt(0).toUpperCase() || 'U'}
                        </Text>
                    </View>
                    <Text style={styles.userName}>{profile?.full_name || 'Usuário'}</Text>
                    <Text style={styles.userEmail}>Membro desde {new Date(profile?.created_at || '').toLocaleDateString('pt-BR')}</Text>
                </View>

                {/* Dados Corporais */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Dados Corporais</Text>
                    <View style={styles.infoGrid}>
                        <View style={styles.infoItem}>
                            <Text style={styles.infoLabel}>Peso Atual</Text>
                            <Text style={styles.infoValue}>{profile?.weight || '-'} kg</Text>
                        </View>
                        <View style={styles.infoItem}>
                            <Text style={styles.infoLabel}>Altura</Text>
                            <Text style={styles.infoValue}>{profile?.height || '-'} cm</Text>
                        </View>
                        <View style={styles.infoItem}>
                            <Text style={styles.infoLabel}>Peso Meta</Text>
                            <Text style={styles.infoValue}>{profile?.target_weight || '-'} kg</Text>
                        </View>
                        <View style={styles.infoItem}>
                            <Text style={styles.infoLabel}>Idade</Text>
                            <Text style={styles.infoValue}>
                                {profile?.birth_date ?
                                    `${new Date().getFullYear() - new Date(profile.birth_date).getFullYear()} anos`
                                    : '-'}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Objetivos e Atividade */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Estilo de Vida</Text>

                    <View style={styles.infoRow}>
                        <View style={styles.infoRowIcon}>
                            <Text style={{ fontSize: 24 }}>🎯</Text>
                        </View>
                        <View style={styles.infoRowContent}>
                            <Text style={styles.infoLabel}>Objetivo Principal</Text>
                            <Text style={styles.infoValue}>{getGoalLabel(profile?.goal || '')}</Text>
                        </View>
                    </View>

                    <View style={styles.infoRow}>
                        <View style={styles.infoRowIcon}>
                            <Text style={{ fontSize: 24 }}>⚡</Text>
                        </View>
                        <View style={styles.infoRowContent}>
                            <Text style={styles.infoLabel}>Nível de Atividade</Text>
                            <Text style={styles.infoValue}>{getActivityLabel(profile?.activity_level || '')}</Text>
                        </View>
                    </View>
                </View>

                {/* Preferências (Resumo) */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Preferências</Text>
                    <Text style={styles.summaryText}>
                        Treino: {profile?.training_frequency === 'none' ? 'Não treina' : `${profile?.training_frequency}x/semana`}
                        {'\n'}
                        Cozinha: {profile?.cooking_time} min disponíveis
                    </Text>
                </View>

                <TouchableOpacity
                    style={styles.onboardingButton}
                    onPress={() => router.push('/onboarding')}
                >
                    <Text style={styles.onboardingButtonText}>🔄 Refazer Onboarding Completo</Text>
                    <Text style={styles.onboardingButtonSubtext}>
                        Atualizar medidas, objetivos e preferências
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
                    <Text style={styles.signOutText}>Sair da Conta</Text>
                </TouchableOpacity>
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
    scrollContent: {
        padding: 20,
        gap: 24,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#111827',
    },
    summaryCard: {
        backgroundColor: 'white',
        padding: 24,
        borderRadius: 20,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    avatarContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#dcfce7',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        borderWidth: 4,
        borderColor: '#f0fdf4',
    },
    avatarText: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#16a34a',
    },
    userName: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 4,
    },
    userEmail: {
        fontSize: 14,
        color: '#6b7280',
    },
    section: {
        gap: 12,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#374151',
    },
    infoGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    infoItem: {
        flex: 1,
        minWidth: '45%',
        backgroundColor: 'white',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    infoLabel: {
        fontSize: 13,
        color: '#6b7280',
        marginBottom: 4,
    },
    infoValue: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'white',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        gap: 16,
    },
    infoRowIcon: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: '#f3f4f6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    infoRowContent: {
        flex: 1,
    },
    summaryText: {
        fontSize: 15,
        color: '#4b5563',
        lineHeight: 24,
        backgroundColor: 'white',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    onboardingButton: {
        backgroundColor: '#eff6ff',
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderRadius: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#bfdbfe',
        marginTop: 8,
    },
    onboardingButtonText: {
        color: '#1e40af',
        fontWeight: '600',
        fontSize: 16,
        marginBottom: 4,
    },
    onboardingButtonSubtext: {
        color: '#3b82f6',
        fontSize: 13,
        textAlign: 'center',
    },
    signOutButton: {
        backgroundColor: '#fee2e2',
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: 'center',
        marginBottom: 20,
    },
    signOutText: {
        color: '#dc2626',
        fontWeight: '600',
        fontSize: 16,
    },
});

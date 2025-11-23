import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PlansScreen() {
    const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual'>('annual');

    const plans = [
        {
            id: 'monthly',
            name: 'Mensal',
            price: '9,99€',
            period: '/mês',
            features: [
                'Receitas personalizadas ilimitadas',
                'Planos alimentares com IA',
                'Gestão de despensa',
                'Listas de compras inteligentes',
                'Suporte prioritário',
            ],
        },
        {
            id: 'annual',
            name: 'Anual',
            price: '99,99€',
            period: '/ano',
            savings: 'Economize 16€',
            features: [
                'Tudo do plano mensal',
                '2 meses grátis',
                'Acesso antecipado a novos recursos',
                'Consultoria nutricional mensal',
            ],
        },
    ];

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <Text style={styles.title}>Escolha seu Plano</Text>
                <Text style={styles.subtitle}>
                    Desbloqueie todo o potencial do FitBody AI
                </Text>

                {plans.map((plan) => (
                    <TouchableOpacity
                        key={plan.id}
                        style={[
                            styles.planCard,
                            selectedPlan === plan.id && styles.planCardSelected,
                        ]}
                        onPress={() => setSelectedPlan(plan.id as 'monthly' | 'annual')}
                    >
                        {plan.savings && (
                            <View style={styles.savingsBadge}>
                                <Text style={styles.savingsText}>{plan.savings}</Text>
                            </View>
                        )}

                        <View style={styles.planHeader}>
                            <Text style={styles.planName}>{plan.name}</Text>
                            <View style={styles.priceContainer}>
                                <Text style={styles.price}>{plan.price}</Text>
                                <Text style={styles.period}>{plan.period}</Text>
                            </View>
                        </View>

                        <View style={styles.featuresContainer}>
                            {plan.features.map((feature, index) => (
                                <View key={index} style={styles.featureRow}>
                                    <Text style={styles.checkmark}>✓</Text>
                                    <Text style={styles.featureText}>{feature}</Text>
                                </View>
                            ))}
                        </View>
                    </TouchableOpacity>
                ))}

                <TouchableOpacity style={styles.subscribeButton}>
                    <Text style={styles.subscribeButtonText}>
                        Assinar {selectedPlan === 'monthly' ? 'Mensal' : 'Anual'}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Text style={styles.backText}>Voltar</Text>
                </TouchableOpacity>

                <Text style={styles.disclaimer}>
                    * Pagamento será configurado em breve. Primeiros usuários ganham 1 ano grátis!
                </Text>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'white',
    },
    scrollContent: {
        padding: 24,
        gap: 16,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#1f2937',
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: '#6b7280',
        textAlign: 'center',
        marginBottom: 16,
    },
    planCard: {
        backgroundColor: '#f9fafb',
        borderRadius: 16,
        padding: 24,
        borderWidth: 2,
        borderColor: 'transparent',
        position: 'relative',
    },
    planCardSelected: {
        backgroundColor: '#dcfce7',
        borderColor: '#22c55e',
    },
    savingsBadge: {
        position: 'absolute',
        top: -10,
        right: 20,
        backgroundColor: '#f59e0b',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    savingsText: {
        color: 'white',
        fontSize: 12,
        fontWeight: 'bold',
    },
    planHeader: {
        marginBottom: 20,
    },
    planName: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1f2937',
        marginBottom: 8,
    },
    priceContainer: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    price: {
        fontSize: 36,
        fontWeight: 'bold',
        color: '#22c55e',
    },
    period: {
        fontSize: 16,
        color: '#6b7280',
        marginLeft: 4,
    },
    featuresContainer: {
        gap: 12,
    },
    featureRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    checkmark: {
        fontSize: 18,
        color: '#22c55e',
        fontWeight: 'bold',
    },
    featureText: {
        fontSize: 16,
        color: '#374151',
        flex: 1,
    },
    subscribeButton: {
        backgroundColor: '#22c55e',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 8,
    },
    subscribeButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 18,
    },
    backButton: {
        marginTop: 8,
        alignItems: 'center',
    },
    backText: {
        color: '#6b7280',
        fontSize: 16,
    },
    disclaimer: {
        fontSize: 12,
        color: '#9ca3af',
        textAlign: 'center',
        marginTop: 16,
        fontStyle: 'italic',
    },
});

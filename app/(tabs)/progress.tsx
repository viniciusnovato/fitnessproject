import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Alert, Platform, Modal, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LineChart } from 'react-native-chart-kit';
import { Text as SvgText } from 'react-native-svg';
import { generateInsights } from '@/lib/openai';

interface WeightEntry {
    id: string;
    weight: number;
    date: string;
    notes?: string;
}

export default function ProgressScreen() {
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<any>(null);
    const [weightHistory, setWeightHistory] = useState<WeightEntry[]>([]);
    const [showAddWeight, setShowAddWeight] = useState(false);

    // Form states
    const [newWeight, setNewWeight] = useState('');
    const [newNotes, setNewNotes] = useState('');
    const [date, setDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);

    // AI Insights state
    const [insights, setInsights] = useState<any>(null);
    const [loadingInsights, setLoadingInsights] = useState(false);

    useEffect(() => {
        if (profile && weightHistory.length > 0) {
            fetchInsights();
        } else {
            setInsights({
                emoji: '👋',
                title: 'Bem-vindo ao seu Progresso!',
                message: 'Estou ansiosa para acompanhar sua jornada. Registre seu peso hoje para eu começar a analisar sua evolução!',
                color: '#3b82f6',
                bgColor: '#eff6ff',
                borderColor: '#bfdbfe'
            });
        }
    }, [profile, weightHistory]);

    const fetchInsights = async () => {
        setLoadingInsights(true);
        const result = await generateInsights(profile, weightHistory);
        if (result) {
            setInsights(result);
        }
        setLoadingInsights(false);
    };

    const router = useRouter();

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                router.replace('/');
                return;
            }

            // Load profile
            const { data: profileData } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            setProfile(profileData);

            // Load weight history
            const { data: historyData, error: historyError } = await supabase
                .from('weight_history')
                .select('*')
                .eq('user_id', user.id)
                .order('date', { ascending: false });

            if (historyError) throw historyError;

            setWeightHistory(historyData || []);
        } catch (error: any) {
            console.error('Error loading data:', error);
            // Don't show alert on initial load to avoid spam if table doesn't exist yet
        } finally {
            setLoading(false);
        }
    };

    const addWeightEntry = async () => {
        if (!newWeight.trim()) {
            Alert.alert('Erro', 'Digite o peso');
            return;
        }

        const weight = parseFloat(newWeight);
        if (isNaN(weight) || weight <= 0) {
            Alert.alert('Erro', 'Peso inválido');
            return;
        }

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // 1. Add to history
            const { error: historyError } = await supabase
                .from('weight_history')
                .insert({
                    user_id: user.id,
                    weight,
                    notes: newNotes.trim() || null,
                    date: date.toISOString(),
                });

            if (historyError) throw historyError;

            // 2. Update current weight in profile if this is the most recent entry
            // Simple check: if the new date is today or after the latest entry
            const isLatest = weightHistory.length === 0 || new Date(date) >= new Date(weightHistory[0].date);

            if (isLatest) {
                const { error: profileError } = await supabase
                    .from('profiles')
                    .update({ weight })
                    .eq('id', user.id);

                if (profileError) throw profileError;
            }

            setNewWeight('');
            setNewNotes('');
            setDate(new Date());
            setShowAddWeight(false);

            Alert.alert('Sucesso', 'Peso registrado!');
            loadData();
        } catch (error: any) {
            Alert.alert('Erro', 'Falha ao salvar. Verifique se a tabela weight_history foi criada no Supabase.');
            console.error(error);
        }
    };



    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    };

    const [tempDate, setTempDate] = useState<Date | null>(null);

    const openDatePicker = () => {
        // Se a data estiver estranha (ex: 1970), reseta para hoje
        if (date.getFullYear() < 2024) {
            const today = new Date();
            setDate(today);
            setTempDate(today);
        } else {
            setTempDate(date);
        }
        setShowDatePicker(true);
    };

    const handleDateCancel = () => {
        if (tempDate) {
            setDate(tempDate);
        }
        setShowDatePicker(false);
    };

    const handleDateConfirm = () => {
        setShowDatePicker(false);
        setTempDate(null);
    };

    const calculateProgress = () => {
        // Se não tiver meta ou tiver apenas 1 (ou 0) registro, não há progresso calculável
        if (!profile?.target_weight || weightHistory.length <= 1) return 0;

        const current = weightHistory[0].weight;
        const start = weightHistory[weightHistory.length - 1].weight;
        const target = parseFloat(profile.target_weight);

        if (start === target) return 100;

        const totalToLose = Math.abs(start - target);
        const lostSoFar = Math.abs(start - current);

        const isWeightLoss = start > target;
        const isMovingAway = isWeightLoss ? current > start : current < start;

        if (isMovingAway) return 0;

        const progress = (lostSoFar / totalToLose) * 100;
        return Math.min(Math.round(progress), 100);
    };

    const getWeightChange = () => {
        if (weightHistory.length < 2) return null;
        const latest = weightHistory[0].weight;
        const oldest = weightHistory[weightHistory.length - 1].weight;
        const change = latest - oldest;
        return {
            value: Math.abs(change),
            isGain: change > 0,
        };
    };

    const weightChange = getWeightChange();

    // Chart Data Preparation
    const chartData = {
        labels: weightHistory
            .slice(0, 10) // Show last 10 points for better trend
            .reverse()
            .map(entry => entry.weight.toString()),
        datasets: [
            {
                data: weightHistory
                    .slice(0, 10)
                    .reverse()
                    .map(entry => entry.weight),
                color: (opacity = 1) => `rgba(34, 197, 94, ${opacity})`, // Green line
                strokeWidth: 2
            }
        ]
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <Text style={styles.title}>Dashboard</Text>
                    <TouchableOpacity
                        style={styles.addButton}
                        onPress={() => setShowAddWeight(!showAddWeight)}
                    >
                        <Text style={styles.addButtonText}>{showAddWeight ? '✕' : '+'}</Text>
                    </TouchableOpacity>
                </View>

                {/* AI Insights Card */}
                <View style={[styles.aiCard, {
                    backgroundColor: insights?.bgColor || '#eff6ff',
                    borderColor: insights?.borderColor || '#bfdbfe'
                }]}>
                    <View style={styles.aiHeader}>
                        <Text style={styles.aiEmoji}>{insights?.emoji || '🤖'}</Text>
                        <Text style={[styles.aiTitle, { color: insights?.color || '#3b82f6' }]}>
                            {loadingInsights ? 'Analisando...' : (insights?.title || 'FitPantry IA')}
                        </Text>
                    </View>
                    <Text style={styles.aiMessage}>
                        {loadingInsights ? 'Estou analisando seus dados para gerar um insight personalizado...' : (insights?.message || 'Aguardando dados...')}
                    </Text>
                    <View style={styles.aiBadge}>
                        <Text style={styles.aiBadgeText}>✨ FitPantry IA</Text>
                    </View>
                </View>

                {showAddWeight && (
                    <View style={styles.addForm}>
                        <Text style={styles.formTitle}>Novo Registro</Text>

                        <View style={styles.inputRow}>
                            <TextInput
                                style={[styles.input, { flex: 1 }]}
                                placeholder="Peso (kg)"
                                value={newWeight}
                                onChangeText={setNewWeight}
                                keyboardType="decimal-pad"
                                autoFocus
                            />
                            <TouchableOpacity
                                style={styles.dateButton}
                                onPress={openDatePicker}
                            >
                                <Text style={styles.dateButtonText}>
                                    {date.toLocaleDateString('pt-BR')}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {showDatePicker && (
                            Platform.OS === 'ios' ? (
                                <Modal
                                    transparent={true}
                                    animationType="slide"
                                    visible={showDatePicker}
                                    onRequestClose={handleDateCancel}
                                >
                                    <View style={styles.modalOverlay}>
                                        <View style={styles.modalContent}>
                                            <View style={styles.modalHeader}>
                                                <TouchableOpacity onPress={handleDateCancel} style={styles.modalButton}>
                                                    <Text style={styles.modalButtonText}>Cancelar</Text>
                                                </TouchableOpacity>
                                                <Text style={styles.modalTitle}>Selecionar Data</Text>
                                                <TouchableOpacity onPress={handleDateConfirm} style={styles.modalButton}>
                                                    <Text style={[styles.modalButtonText, styles.modalButtonBold]}>OK</Text>
                                                </TouchableOpacity>
                                            </View>
                                            <DateTimePicker
                                                value={date}
                                                mode="date"
                                                display="spinner"
                                                onChange={(event, selectedDate) => {
                                                    if (selectedDate) setDate(selectedDate);
                                                }}
                                                maximumDate={new Date()}
                                                style={styles.datePicker}
                                                locale="pt-BR"
                                            />
                                        </View>
                                    </View>
                                </Modal>
                            ) : (
                                <DateTimePicker
                                    value={date}
                                    mode="date"
                                    display="default"
                                    onChange={(event, selectedDate) => {
                                        setShowDatePicker(false);
                                        if (selectedDate) setDate(selectedDate);
                                    }}
                                    maximumDate={new Date()}
                                />
                            )
                        )}

                        <TextInput
                            style={[styles.input, styles.notesInput]}
                            placeholder="Notas (ex: Jantar pesado, pós-treino...)"
                            value={newNotes}
                            onChangeText={setNewNotes}
                            multiline
                        />

                        <TouchableOpacity style={styles.submitButton} onPress={addWeightEntry}>
                            <Text style={styles.submitButtonText}>Salvar Registro</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Chart Section */}
                {weightHistory.length > 1 && (
                    <View style={styles.chartCard}>
                        <View style={styles.chartHeader}>
                            <Text style={styles.chartTitle}>Evolução</Text>
                            <View style={styles.chartBadge}>
                                <Text style={styles.chartBadgeText}>
                                    {weightHistory[0].weight < weightHistory[weightHistory.length - 1].weight ? '📉 Queda' : '📈 Alta'}
                                </Text>
                            </View>
                        </View>
                        <LineChart
                            data={chartData}
                            width={Dimensions.get('window').width - 80} // Exact fit: Screen - 40 (outer) - 40 (inner)
                            height={220}
                            withDots={true}
                            withShadow={false}
                            withInnerLines={true}
                            withOuterLines={false}
                            withVerticalLines={false}
                            withHorizontalLabels={false}
                            yAxisSuffix="kg"
                            renderDotContent={({ x, y, index, indexData }) => (
                                <SvgText
                                    key={index}
                                    x={x}
                                    y={y - 10}
                                    fontSize="10"
                                    fill="#6b7280"
                                    textAnchor="middle"
                                >
                                    {indexData.toFixed(1)}
                                </SvgText>
                            )}
                            chartConfig={{
                                backgroundColor: "#ffffff",
                                backgroundGradientFrom: "#ffffff",
                                backgroundGradientTo: "#ffffff",
                                decimalPlaces: 1,
                                color: (opacity = 1) => `rgba(34, 197, 94, ${opacity})`,
                                labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
                                propsForDots: {
                                    r: "4",
                                    strokeWidth: "2",
                                    stroke: "#22c55e"
                                },
                                propsForBackgroundLines: {
                                    strokeDasharray: "", // Solid lines
                                    stroke: "#f3f4f6"
                                },
                                propsForLabels: {
                                    fontSize: 10,
                                }
                            }}
                            style={{
                                marginVertical: 8,
                                borderRadius: 16,
                                paddingRight: 40,
                                paddingLeft: 0,
                                paddingTop: 24 // Space for top labels
                            }}
                        />
                    </View>
                )}

                {/* Stats Grid */}
                <View style={styles.statsGrid}>
                    <View style={styles.statCard}>
                        <View style={[styles.iconContainer, { backgroundColor: '#dcfce7' }]}>
                            <Text style={{ fontSize: 20 }}>⚖️</Text>
                        </View>
                        <Text style={styles.statValue}>{profile?.weight || '—'}kg</Text>
                        <Text style={styles.statLabel}>Atual</Text>
                    </View>

                    <View style={styles.statCard}>
                        <View style={[styles.iconContainer, { backgroundColor: '#dbeafe' }]}>
                            <Text style={{ fontSize: 20 }}>🎯</Text>
                        </View>
                        <Text style={styles.statValue}>{profile?.target_weight || '—'}kg</Text>
                        <Text style={styles.statLabel}>Meta</Text>
                    </View>

                    <View style={styles.statCard}>
                        <View style={[styles.iconContainer, { backgroundColor: '#fef3c7' }]}>
                            <Text style={{ fontSize: 20 }}>🔥</Text>
                        </View>
                        <Text style={styles.statValue}>{calculateProgress()}%</Text>
                        <Text style={styles.statLabel}>Progresso</Text>
                    </View>
                </View>

                {/* Weight History List */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Histórico Detalhado</Text>

                    {weightHistory.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyStateText}>
                                Seu histórico está vazio.
                            </Text>
                        </View>
                    ) : (
                        <View style={styles.historyList}>
                            {weightHistory.map((entry, index) => {
                                const prevEntry = weightHistory[index + 1];
                                const change = prevEntry ? entry.weight - prevEntry.weight : 0;
                                const isGain = change > 0;
                                const isLoss = change < 0;

                                // Check if user wants to gain weight
                                const isGainGoal = profile?.goal === 'gain_weight' || profile?.goal === 'gain_muscle';

                                // Determine colors based on goal
                                // If gain goal: Gain is Good (Green), Loss is Bad (Red)
                                // If loss goal: Gain is Bad (Red), Loss is Good (Green)
                                const gainColor = isGainGoal ? '#dcfce7' : '#fee2e2'; // Green if good, Red if bad
                                const lossColor = isGainGoal ? '#fee2e2' : '#dcfce7'; // Red if bad, Green if good
                                const gainTextColor = isGainGoal ? '#16a34a' : '#dc2626';
                                const lossTextColor = isGainGoal ? '#dc2626' : '#16a34a';

                                return (
                                    <View key={entry.id} style={styles.historyItem}>
                                        <View style={styles.historyLeft}>
                                            <Text style={styles.historyWeight}>{entry.weight}kg</Text>
                                            <Text style={styles.historyDate}>{formatDate(entry.date)}</Text>
                                            {entry.notes && (
                                                <Text style={styles.historyNotes} numberOfLines={1}>
                                                    {entry.notes}
                                                </Text>
                                            )}
                                        </View>

                                        {index < weightHistory.length - 1 && (
                                            <View style={[
                                                styles.changeBadge,
                                                { backgroundColor: isGain ? gainColor : isLoss ? lossColor : '#f3f4f6' }
                                            ]}>
                                                <Text style={[
                                                    styles.changeText,
                                                    { color: isGain ? gainTextColor : isLoss ? lossTextColor : '#6b7280' }
                                                ]}>
                                                    {isGain ? '+' : ''}{change.toFixed(1)}
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                );
                            })}
                        </View>
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f3f4f6',
    },
    scrollContent: {
        padding: 20,
        gap: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    title: {
        fontSize: 32,
        fontWeight: '800',
        color: '#111827',
    },
    addButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#22c55e',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#22c55e',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    addButtonText: {
        color: 'white',
        fontSize: 28,
        fontWeight: 'bold',
        marginTop: -2,
    },
    aiCard: {
        padding: 20,
        borderRadius: 24,
        borderWidth: 1,
        gap: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 2,
    },
    aiHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    aiEmoji: {
        fontSize: 32,
    },
    aiTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        flex: 1,
    },
    aiMessage: {
        fontSize: 15,
        color: '#4b5563',
        lineHeight: 22,
    },
    aiBadge: {
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(255,255,255,0.5)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        marginTop: 4,
    },
    aiBadgeText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#6b7280',
    },
    motivationText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#16a34a',
        textAlign: 'center',
    },
    modalOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalContent: {
        backgroundColor: 'white',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingBottom: 32,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
    },
    modalButton: {
        padding: 8,
    },
    modalButtonText: {
        fontSize: 16,
        color: '#3b82f6',
    },
    modalButtonBold: {
        fontWeight: '600',
    },
    datePicker: {
        height: 200,
    },
    addForm: {
        backgroundColor: 'white',
        borderRadius: 24,
        padding: 20,
        gap: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 4,
    },
    formTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    inputRow: {
        flexDirection: 'row',
        gap: 12,
    },
    input: {
        backgroundColor: '#f9fafb',
        borderRadius: 16,
        padding: 16,
        fontSize: 16,
        color: '#1f2937',
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    notesInput: {
        height: 100,
        textAlignVertical: 'top',
    },
    dateButton: {
        backgroundColor: '#f9fafb',
        borderRadius: 16,
        padding: 16,
        justifyContent: 'center',
        minWidth: 120,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    dateButtonText: {
        fontSize: 16,
        color: '#374151',
        fontWeight: '600',
    },
    submitButton: {
        backgroundColor: '#22c55e',
        padding: 18,
        borderRadius: 16,
        alignItems: 'center',
        shadowColor: '#22c55e',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    submitButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    chartCard: {
        backgroundColor: 'white',
        borderRadius: 24,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 2,
        alignItems: 'center',
    },
    chartHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        marginBottom: 8,
    },
    chartTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    chartBadge: {
        backgroundColor: '#f3f4f6',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    chartBadgeText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#4b5563',
    },
    statsGrid: {
        flexDirection: 'row',
        gap: 12,
    },
    statCard: {
        flex: 1,
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 16,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    statValue: {
        fontSize: 20,
        fontWeight: '800',
        color: '#111827',
        marginBottom: 2,
    },
    statLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6b7280',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    section: {
        gap: 16,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
    },
    emptyState: {
        padding: 40,
        alignItems: 'center',
        backgroundColor: 'white',
        borderRadius: 24,
        borderStyle: 'dashed',
        borderWidth: 2,
        borderColor: '#e5e7eb',
    },
    emptyStateText: {
        color: '#9ca3af',
        fontSize: 16,
        fontWeight: '500',
    },
    historyList: {
        backgroundColor: 'white',
        borderRadius: 24,
        padding: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 2,
    },
    historyItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    historyLeft: {
        gap: 4,
    },
    historyWeight: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    historyDate: {
        fontSize: 13,
        fontWeight: '500',
        color: '#6b7280',
    },
    historyNotes: {
        fontSize: 12,
        color: '#9ca3af',
        fontStyle: 'italic',
        marginTop: 2,
    },
    changeBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    changeText: {
        fontSize: 14,
        fontWeight: '600',
    },
});

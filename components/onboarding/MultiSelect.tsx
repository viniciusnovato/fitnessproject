import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';

interface MultiSelectProps {
    options: Array<{ value: string; label: string; emoji?: string }>;
    selected: string[];
    onChange: (selected: string[]) => void;
    columns?: number;
}

export function MultiSelect({ options, selected, onChange, columns = 2 }: MultiSelectProps) {
    const toggleOption = (value: string) => {
        if (selected.includes(value)) {
            onChange(selected.filter(v => v !== value));
        } else {
            onChange([...selected, value]);
        }
    };

    return (
        <View style={styles.container}>
            <View style={[styles.grid, { gap: 8 }]}>
                {options.map((option) => {
                    const isSelected = selected.includes(option.value);
                    return (
                        <TouchableOpacity
                            key={option.value}
                            style={[
                                styles.chip,
                                { width: columns === 2 ? '48%' : '100%' },
                                isSelected && styles.chipSelected,
                            ]}
                            onPress={() => toggleOption(option.value)}
                            activeOpacity={0.7}
                        >
                            {option.emoji && <Text style={styles.chipEmoji}>{option.emoji}</Text>}
                            <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                                {option.label}
                            </Text>
                            {isSelected && (
                                <View style={styles.chipCheck}>
                                    <Text style={styles.chipCheckText}>✓</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 16,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    chip: {
        backgroundColor: 'white',
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 16,
        marginBottom: 8,
        borderWidth: 2,
        borderColor: '#e5e7eb',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    chipSelected: {
        borderColor: '#22c55e',
        backgroundColor: '#f0fdf4',
    },
    chipEmoji: {
        fontSize: 18,
        marginRight: 8,
    },
    chipText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1f2937',
        flex: 1,
        textAlign: 'center',
    },
    chipTextSelected: {
        color: '#16a34a',
    },
    chipCheck: {
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: '#22c55e',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
    },
    chipCheckText: {
        color: 'white',
        fontSize: 12,
        fontWeight: 'bold',
    },
});

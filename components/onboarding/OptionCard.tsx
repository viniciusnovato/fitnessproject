import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';

interface OptionCardProps {
    emoji?: string;
    title: string;
    description?: string;
    selected: boolean;
    onPress: () => void;
}

export function OptionCard({ emoji, title, description, selected, onPress }: OptionCardProps) {
    return (
        <TouchableOpacity
            style={[styles.card, selected && styles.cardSelected]}
            onPress={onPress}
            activeOpacity={0.7}
        >
            {emoji && <Text style={styles.emoji}>{emoji}</Text>}
            <View style={styles.content}>
                <Text style={[styles.title, selected && styles.titleSelected]}>{title}</Text>
                {description && (
                    <Text style={[styles.description, selected && styles.descriptionSelected]}>
                        {description}
                    </Text>
                )}
            </View>
            {selected && (
                <View style={styles.checkmark}>
                    <Text style={styles.checkmarkText}>✓</Text>
                </View>
            )}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 2,
        borderColor: '#e5e7eb',
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    cardSelected: {
        borderColor: '#22c55e',
        backgroundColor: '#f0fdf4',
    },
    emoji: {
        fontSize: 32,
        marginRight: 16,
    },
    content: {
        flex: 1,
    },
    title: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1f2937',
        marginBottom: 2,
    },
    titleSelected: {
        color: '#16a34a',
    },
    description: {
        fontSize: 13,
        color: '#6b7280',
    },
    descriptionSelected: {
        color: '#15803d',
    },
    checkmark: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#22c55e',
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkmarkText: {
        color: 'white',
        fontSize: 14,
        fontWeight: 'bold',
    },
});

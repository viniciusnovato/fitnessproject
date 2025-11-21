import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface WeeklyViewProps {
    days: number;
    currentDay: number;
    onDaySelect: (day: number) => void;
}

export function WeeklyView({ days, currentDay, onDaySelect }: WeeklyViewProps) {
    const renderDay = (day: number) => {
        const isSelected = day === currentDay;
        return (
            <TouchableOpacity
                key={day}
                style={[styles.dayButton, isSelected && styles.selectedDay]}
                onPress={() => onDaySelect(day)}
            >
                <Text style={[styles.dayLabel, isSelected && styles.selectedDayText]}>DIA</Text>
                <Text style={[styles.dayNumber, isSelected && styles.selectedDayText]}>{day}</Text>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {Array.from({ length: days }, (_, i) => i + 1).map(renderDay)}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 20,
    },
    scrollContent: {
        paddingHorizontal: 4,
        gap: 12,
    },
    dayButton: {
        width: 60,
        height: 70,
        borderRadius: 16,
        backgroundColor: '#f3f4f6',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'transparent',
    },
    selectedDay: {
        backgroundColor: '#22c55e',
        borderColor: '#16a34a',
        shadowColor: '#22c55e',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    dayLabel: {
        fontSize: 10,
        fontWeight: '600',
        color: '#6b7280',
        marginBottom: 2,
    },
    dayNumber: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1f2937',
    },
    selectedDayText: {
        color: 'white',
    },
});

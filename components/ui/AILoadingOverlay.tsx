import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Modal, StyleSheet, Text, View } from 'react-native';

interface AILoadingOverlayProps {
    visible: boolean;
    message?: string;
}

export function AILoadingOverlay({ visible, message = "Gerando seu plano..." }: AILoadingOverlayProps) {
    const [currentStep, setCurrentStep] = useState(0);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.9)).current;

    const steps = [
        { text: "Analisando seu perfil...", icon: "scan-outline" },
        { text: "Calculando necessidades calóricas...", icon: "calculator-outline" },
        { text: "Selecionando ingredientes brasileiros...", icon: "basket-outline" },
        { text: "Criando receitas personalizadas...", icon: "restaurant-outline" },
        { text: "Finalizando seu plano...", icon: "checkmark-circle-outline" }
    ];

    useEffect(() => {
        if (visible) {
            // Reset animations
            fadeAnim.setValue(0);
            scaleAnim.setValue(0.9);
            setCurrentStep(0);

            // Entrance animation
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    friction: 8,
                    useNativeDriver: true,
                })
            ]).start();

            // Cycle through steps
            const interval = setInterval(() => {
                setCurrentStep((prev) => {
                    if (prev < steps.length - 1) return prev + 1;
                    return prev;
                });
            }, 2500); // Change text every 2.5s

            return () => clearInterval(interval);
        }
    }, [visible]);

    if (!visible) return null;

    const activeStep = steps[currentStep];

    return (
        <Modal transparent visible={visible} animationType="fade">
            <View style={styles.container}>
                <View style={styles.backdrop} />

                <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
                    <View style={styles.iconContainer}>
                        <Ionicons name="sparkles" size={48} color="#22c55e" />
                        <View style={styles.pulseRing} />
                    </View>

                    <Text style={styles.title}>FitBody AI</Text>

                    <View style={styles.stepContainer}>
                        <ActivityIndicator size="small" color="#22c55e" style={styles.spinner} />
                        <Text style={styles.stepText}>{activeStep.text}</Text>
                    </View>

                    <View style={styles.progressBar}>
                        <Animated.View
                            style={[
                                styles.progressFill,
                                {
                                    width: `${((currentStep + 1) / steps.length) * 100}%`
                                }
                            ]}
                        />
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.7)',
    },
    content: {
        backgroundColor: '#1f2937',
        padding: 32,
        borderRadius: 24,
        alignItems: 'center',
        width: '85%',
        maxWidth: 340,
        borderWidth: 1,
        borderColor: '#374151',
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 10,
        },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 10,
    },
    iconContainer: {
        marginBottom: 20,
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
    },
    pulseRing: {
        position: 'absolute',
        width: 70,
        height: 70,
        borderRadius: 35,
        borderWidth: 2,
        borderColor: '#22c55e',
        opacity: 0.3,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 24,
        letterSpacing: 0.5,
    },
    stepContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
        backgroundColor: '#111827',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 12,
        width: '100%',
    },
    spinner: {
        marginRight: 12,
    },
    stepText: {
        color: '#e5e7eb',
        fontSize: 14,
        fontWeight: '500',
        flex: 1,
    },
    progressBar: {
        height: 4,
        backgroundColor: '#374151',
        width: '100%',
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#22c55e',
        borderRadius: 2,
    }
});

import { chatWithAssistant } from '@/lib/openai';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';

import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Dimensions,
    KeyboardAvoidingView,
    Modal,
    PanResponder,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const FAB_SIZE = 56;
const MARGIN = 20;

export function AIAssistant() {
    const insets = useSafeAreaInsets();
    const [user, setUser] = useState<any>(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            role: 'assistant',
            content: 'Olá! Sou sua assistente pessoal. Como posso ajudar você hoje com sua dieta ou treino?',
            timestamp: new Date(),
        },
    ]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);




    const scrollViewRef = useRef<ScrollView>(null);
    const fadeAnim = useRef(new Animated.Value(0)).current;

    // FAB Animation & PanResponder
    const pan = useRef(new Animated.ValueXY({ x: MARGIN, y: SCREEN_HEIGHT - 150 })).current;
    const opacityAnim = useRef(new Animated.Value(0.3)).current;

    // Check Auth
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            setAuthLoading(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
            setAuthLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);



    const panResponder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (_, gestureState) => {
                return Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5;
            },
            onPanResponderGrant: () => {
                pan.setOffset({
                    x: (pan.x as any)._value,
                    y: (pan.y as any)._value
                });
                pan.setValue({ x: 0, y: 0 });
                Animated.spring(opacityAnim, {
                    toValue: 1,
                    useNativeDriver: false,
                }).start();
            },
            onPanResponderMove: Animated.event(
                [null, { dx: pan.x, dy: pan.y }],
                { useNativeDriver: false }
            ),
            onPanResponderRelease: (_, gestureState) => {
                pan.flattenOffset();
                const currentX = (pan.x as any)._value;
                const currentY = (pan.y as any)._value;

                const targetX = currentX + FAB_SIZE / 2 > SCREEN_WIDTH / 2
                    ? SCREEN_WIDTH - FAB_SIZE - MARGIN
                    : MARGIN;

                let targetY = currentY;
                const minY = insets.top + MARGIN;
                const maxY = SCREEN_HEIGHT - FAB_SIZE - MARGIN - insets.bottom;

                if (targetY < minY) targetY = minY;
                if (targetY > maxY) targetY = maxY;

                Animated.spring(pan, {
                    toValue: { x: targetX, y: targetY },
                    useNativeDriver: false,
                    friction: 5
                }).start();

                if (!isOpen) {
                    setTimeout(() => {
                        Animated.timing(opacityAnim, {
                            toValue: 0.3,
                            duration: 500,
                            useNativeDriver: false,
                        }).start();
                    }, 2000);
                }
            }
        })
    ).current;

    useEffect(() => {
        if (isOpen) {
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }).start();
            opacityAnim.setValue(1);
        } else {
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }).start();
            Animated.timing(opacityAnim, {
                toValue: 0.3,
                duration: 500,
                useNativeDriver: false,
            }).start();
        }
    }, [isOpen]);





    const handleSend = async (textOverride?: string) => {
        const textToSend = textOverride || inputText;
        if (!textToSend.trim()) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: textToSend.trim(),
            timestamp: new Date(),
        };

        setMessages(prev => [...prev, userMsg]);
        setInputText('');
        setIsLoading(true);

        try {
            const history = messages.map(m => ({
                role: m.role,
                content: m.content
            }));

            const responseText = await chatWithAssistant([...history, { role: 'user', content: userMsg.content }]);

            const assistantMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: responseText,
                timestamp: new Date(),
            };

            setMessages(prev => [...prev, assistantMsg]);
        } catch (error) {
            console.error('Error chatting with assistant:', error);
            const errorMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: 'Desculpe, tive um problema ao processar sua mensagem. Tente novamente.',
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsLoading(false);
        }
    };



    // Don't render anything while checking auth or if user is not logged in
    if (authLoading || !user) return null;

    return (
        <>
            {/* Draggable FAB */}
            {!isOpen && (
                <Animated.View
                    style={[
                        styles.fabContainer,
                        {
                            transform: [{ translateX: pan.x }, { translateY: pan.y }],
                            opacity: opacityAnim
                        }
                    ]}
                    {...panResponder.panHandlers}
                >
                    <TouchableOpacity
                        style={styles.fab}
                        onPress={() => setIsOpen(true)}
                        activeOpacity={0.8}
                    >
                        <View style={styles.fabGradient}>
                            <Ionicons name="sparkles" size={24} color="white" />
                        </View>
                    </TouchableOpacity>
                </Animated.View>
            )}

            {/* Chat Modal */}
            <Modal
                visible={isOpen}
                transparent
                animationType="fade"
                onRequestClose={() => setIsOpen(false)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.modalContainer}
                >
                    <Animated.View style={[styles.modalContent, { opacity: fadeAnim }]}>
                        {/* Header */}
                        <View style={styles.header}>
                            <View style={styles.headerTitleContainer}>
                                <View style={styles.avatarContainer}>
                                    <Ionicons name="sparkles" size={20} color="white" />
                                </View>
                                <View>
                                    <Text style={styles.headerTitle}>FitBody AI</Text>
                                    <Text style={styles.headerSubtitle}>Sua assistente pessoal</Text>
                                </View>
                            </View>
                            <TouchableOpacity
                                style={styles.closeButton}
                                onPress={() => setIsOpen(false)}
                            >
                                <Ionicons name="close" size={24} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        {/* Standard Chat UI */}
                        <ScrollView
                            ref={scrollViewRef}
                            style={styles.messagesList}
                            contentContainerStyle={styles.messagesContent}
                            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
                        >
                            {messages.map((msg) => (
                                <View
                                    key={msg.id}
                                    style={[
                                        styles.messageBubble,
                                        msg.role === 'user' ? styles.userBubble : styles.assistantBubble,
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.messageText,
                                            msg.role === 'user' ? styles.userText : styles.assistantText,
                                        ]}
                                    >
                                        {msg.content}
                                    </Text>
                                </View>
                            ))}
                            {isLoading && (
                                <View style={styles.loadingBubble}>
                                    <ActivityIndicator size="small" color="#22c55e" />
                                </View>
                            )}
                        </ScrollView>

                        <View style={[styles.inputContainer, { paddingBottom: insets.bottom > 0 ? insets.bottom : 16 }]}>


                            <TextInput
                                style={styles.input}
                                placeholder="Digite ou segure para falar..."
                                value={inputText}
                                onChangeText={setInputText}
                                multiline
                                maxLength={500}
                            />

                            <TouchableOpacity
                                style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
                                onPress={() => handleSend()}
                                disabled={!inputText.trim() || isLoading}
                            >
                                <Ionicons name="send" size={20} color="white" />
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                </KeyboardAvoidingView>
            </Modal >
        </>
    );
}

const styles = StyleSheet.create({
    fabContainer: {
        position: 'absolute',
        zIndex: 1000,
    },
    fab: {
        width: FAB_SIZE,
        height: FAB_SIZE,
        borderRadius: FAB_SIZE / 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 8,
    },
    fabGradient: {
        width: '100%',
        height: '100%',
        borderRadius: FAB_SIZE / 2,
        backgroundColor: '#22c55e',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'white',
    },
    modalContainer: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: 'white',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        height: '85%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 10,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    headerTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    avatarContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#22c55e',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#0f172a',
    },
    headerSubtitle: {
        fontSize: 12,
        color: '#64748b',
    },
    closeButton: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: '#f1f5f9',
    },
    iconButton: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: '#f1f5f9',
    },
    iconButtonActive: {
        backgroundColor: '#22c55e',
    },
    messagesList: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    messagesContent: {
        padding: 20,
        gap: 16,
    },
    messageBubble: {
        maxWidth: '80%',
        padding: 16,
        borderRadius: 20,
        position: 'relative',
    },
    userBubble: {
        alignSelf: 'flex-end',
        backgroundColor: '#22c55e',
        borderBottomRightRadius: 4,
    },
    assistantBubble: {
        alignSelf: 'flex-start',
        backgroundColor: 'white',
        borderBottomLeftRadius: 4,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    messageText: {
        fontSize: 15,
        lineHeight: 22,
    },
    userText: {
        color: 'white',
    },
    assistantText: {
        color: '#334155',
    },
    speakButton: {
        position: 'absolute',
        bottom: -24,
        left: 0,
        padding: 4,
    },
    loadingBubble: {
        alignSelf: 'flex-start',
        backgroundColor: 'white',
        padding: 16,
        borderRadius: 20,
        borderBottomLeftRadius: 4,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        backgroundColor: 'white',
        gap: 12,
    },
    input: {
        flex: 1,
        backgroundColor: '#f1f5f9',
        borderRadius: 24,
        paddingHorizontal: 20,
        paddingVertical: 12,
        maxHeight: 100,
        fontSize: 15,
        color: '#0f172a',
    },
    sendButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#22c55e',
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendButtonDisabled: {
        backgroundColor: '#cbd5e1',
    },
    micButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#f1f5f9',
        justifyContent: 'center',
        alignItems: 'center',
    },
    micButtonRecording: {
        backgroundColor: '#ef4444',
    },
    voiceModeContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#111827', // Dark background for voice mode
    },
    voicePulse: {
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: 'rgba(34, 197, 94, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 40,
    },
    voiceCircle: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: '#22c55e',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#22c55e',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 10,
    },
    voiceStatusText: {
        fontSize: 24,
        fontWeight: 'bold',
        color: 'white',
        marginBottom: 8,
    },
    voiceHintText: {
        fontSize: 14,
        color: '#94a3b8',
        marginBottom: 40,
    },
    voiceStopButton: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#ef4444',
        justifyContent: 'center',
        alignItems: 'center',
    },
});

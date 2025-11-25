import { supabase } from '@/lib/supabase';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    // Listen for OAuth callback
    useEffect(() => {
        const handleUrl = async (event: { url: string }) => {
            const url = event.url;

            // Check if this is an OAuth callback
            if (url.includes('#access_token=')) {
                const { data: { session }, error } = await supabase.auth.getSession();

                if (session) {
                    router.replace('/(tabs)/home');
                }
            }
        };

        // Add listener
        const subscription = Linking.addEventListener('url', handleUrl);

        // Check if app was opened with a URL
        Linking.getInitialURL().then((url) => {
            if (url) {
                handleUrl({ url });
            }
        });

        return () => {
            subscription.remove();
        };
    }, []);

    const handleSignIn = async () => {
        if (!email || !password) {
            Alert.alert('Erro', 'Por favor, preencha todos os campos');
            return;
        }

        setLoading(true);
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;

            router.replace('/(tabs)/home');
        } catch (error: any) {
            Alert.alert('Erro', error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        try {
            // Dismiss any existing browser session first (ignore error if none exists)
            try {
                await WebBrowser.dismissBrowser();
            } catch (e) {
                // No browser to dismiss, that's fine
            }

            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: Linking.createURL('/'),
                }
            });

            if (error) throw error;

            if (data?.url) {
                await WebBrowser.openAuthSessionAsync(data.url, Linking.createURL('/'));
            }
        } catch (error: any) {
            console.error('Google sign-in error:', error);
            Alert.alert('Erro', error.message || 'Erro ao conectar com Google');
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <Text style={styles.title}>Bem-vindo de volta</Text>
                    <Text style={styles.subtitle}>Entre para continuar</Text>

                    <View style={styles.form}>
                        {/* Google Sign In Button */}
                        <TouchableOpacity
                            style={styles.googleButton}
                            onPress={handleGoogleSignIn}
                        >
                            <View style={styles.googleButtonContent}>
                                <Text style={styles.googleIcon}>G</Text>
                                <Text style={styles.googleButtonText}>Continuar com Google</Text>
                            </View>
                        </TouchableOpacity>

                        {/* Divider */}
                        <View style={styles.divider}>
                            <View style={styles.dividerLine} />
                            <Text style={styles.dividerText}>OU</Text>
                            <View style={styles.dividerLine} />
                        </View>

                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Email</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="seu@email.com"
                                value={email}
                                onChangeText={setEmail}
                                keyboardType="email-address"
                                autoCapitalize="none"
                            />
                        </View>

                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Senha</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Sua senha"
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry
                            />
                        </View>

                        <TouchableOpacity
                            style={[styles.button, loading && styles.buttonDisabled]}
                            onPress={handleSignIn}
                            disabled={loading}
                        >
                            <Text style={styles.buttonText}>
                                {loading ? 'Entrando...' : 'Entrar'}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                            <Text style={styles.backText}>Voltar</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'white',
    },
    keyboardView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        padding: 24,
        justifyContent: 'center',
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#1f2937',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#6b7280',
        marginBottom: 32,
    },
    form: {
        gap: 16,
    },
    inputContainer: {
        gap: 8,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
    },
    input: {
        backgroundColor: '#f3f4f6',
        height: 48,
        borderRadius: 12,
        paddingHorizontal: 16,
        fontSize: 16,
    },
    button: {
        backgroundColor: '#22c55e',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 8,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    buttonText: {
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
    googleButton: {
        backgroundColor: 'white',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#dadce0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    googleButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    googleIcon: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#4285f4',
        backgroundColor: 'white',
        width: 24,
        height: 24,
        textAlign: 'center',
        lineHeight: 24,
        borderRadius: 4,
    },
    googleButtonText: {
        color: '#3c4043',
        fontWeight: '500',
        fontSize: 16,
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 8,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#e5e7eb',
    },
    dividerText: {
        marginHorizontal: 16,
        color: '#9ca3af',
        fontSize: 14,
        fontWeight: '500',
    },
});

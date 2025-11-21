import { View, Text, ImageBackground, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Link, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

export default function WelcomeScreen() {
    return (
        <ImageBackground
            source={{ uri: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?q=80&w=2053&auto=format&fit=crop' }}
            style={styles.background}
            resizeMode="cover"
        >
            <LinearGradient
                colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.8)']}
                style={styles.gradient}
            >
                <StatusBar style="light" />

                <View style={styles.titleContainer}>
                    <Text style={styles.title}>
                        Fit<Text style={styles.titleAccent}>Pantry</Text>
                    </Text>
                    <Text style={styles.subtitle}>
                        Sua dieta e despensa em perfeita sintonia.
                    </Text>
                </View>

                <View style={styles.buttonContainer}>
                    <TouchableOpacity
                        style={styles.primaryButton}
                        onPress={() => router.push('/(auth)/sign-up')}
                    >
                        <Text style={styles.primaryButtonText}>Começar Agora</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.secondaryButton}
                        onPress={() => router.push('/(auth)/sign-in')}
                    >
                        <Text style={styles.secondaryButtonText}>Já tenho conta</Text>
                    </TouchableOpacity>

                    <Link href="/(tabs)/home" asChild>
                        <TouchableOpacity style={styles.devLink}>
                            <Text style={styles.devLinkText}>Entrar como visitante (Dev)</Text>
                        </TouchableOpacity>
                    </Link>
                </View>
            </LinearGradient>
        </ImageBackground>
    );
}

const styles = StyleSheet.create({
    background: {
        flex: 1,
    },
    gradient: {
        flex: 1,
        justifyContent: 'flex-end',
        paddingBottom: 48,
        paddingHorizontal: 24,
    },
    titleContainer: {
        marginBottom: 32,
    },
    title: {
        color: 'white',
        fontSize: 48,
        fontWeight: 'bold',
        letterSpacing: -1,
    },
    titleAccent: {
        color: '#4ade80',
    },
    subtitle: {
        color: '#e5e7eb',
        fontSize: 18,
        marginTop: 8,
        fontWeight: '500',
    },
    buttonContainer: {
        gap: 16,
    },
    primaryButton: {
        backgroundColor: '#22c55e',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    primaryButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 18,
    },
    secondaryButton: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    secondaryButtonText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 18,
    },
    devLink: {
        marginTop: 16,
        alignItems: 'center',
    },
    devLinkText: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 14,
    },
});

import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Keyboard, KeyboardAvoidingView, Platform, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { supabase } from '../lib/supabase';

export default function LoginScreen() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Please enter both email and password.');
            return;
        }

        setLoading(true);
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            Alert.alert('Error', error.message);
        }
        setLoading(false);
    };

    return (
        <SafeAreaView style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <KeyboardAvoidingView
                    style={styles.content}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                >
                    {/* Header */}
                    <View style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color="#000" />
                    </View>

                    {/* Titles */}
                    <Text style={styles.title}>What's your email?</Text>
                    <Text style={styles.subtitle}>Enter your email to log in</Text>

                    {/* Inputs */}
                    <View style={styles.inputContainer}>
                        <TextInput
                            style={styles.input}
                            placeholder="name@example.com"
                            placeholderTextColor="#999"
                            keyboardType="email-address"
                            autoCapitalize="none"
                            value={email}
                            onChangeText={setEmail}
                        />
                        <TextInput
                            style={styles.input}
                            placeholder="Password"
                            placeholderTextColor="#999"
                            secureTextEntry
                            value={password}
                            onChangeText={setPassword}
                        />
                    </View>

                    {/* Primary Button */}
                    <TouchableOpacity
                        style={styles.primaryButton}
                        onPress={handleLogin}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <>
                                <Text style={styles.primaryButtonText}>Continue</Text>
                                <Ionicons name="arrow-forward" size={20} color="#fff" />
                            </>
                        )}
                    </TouchableOpacity>

                    {/* Divider */}
                    <View style={styles.dividerContainer}>
                        <View style={styles.dividerLine} />
                        <Text style={styles.dividerText}>or</Text>
                        <View style={styles.dividerLine} />
                    </View>

                    {/* Secondary Button */}
                    <TouchableOpacity
                        style={styles.secondaryButton}
                        onPress={() => router.push('/signup')}
                        disabled={loading}
                    >
                        <Text style={styles.secondaryButtonText}>Create an account</Text>
                    </TouchableOpacity>
                </KeyboardAvoidingView>
            </TouchableWithoutFeedback>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    content: {
        flex: 1,
        paddingHorizontal: 24,
        paddingTop: 20,
    },
    backButton: {
        marginBottom: 32,
        alignSelf: 'flex-start',
        width: 24,
        height: 24,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#000',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        marginBottom: 32,
    },
    inputContainer: {
        gap: 16,
        marginBottom: 24,
    },
    input: {
        backgroundColor: '#f5f5f5',
        paddingHorizontal: 16,
        paddingVertical: 18,
        borderRadius: 8,
        fontSize: 16,
        color: '#000',
    },
    primaryButton: {
        backgroundColor: '#000',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 18,
        borderRadius: 8,
        marginBottom: 32,
        height: 56,
    },
    primaryButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        marginRight: 8,
    },
    dividerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 32,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#eaeaea',
    },
    dividerText: {
        color: '#666',
        paddingHorizontal: 16,
        fontSize: 14,
    },
    secondaryButton: {
        backgroundColor: '#f5f5f5',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 18,
        borderRadius: 8,
    },
    secondaryButtonText: {
        color: '#000',
        fontSize: 16,
        fontWeight: '600',
    },
});

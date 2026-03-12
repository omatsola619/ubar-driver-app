import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Keyboard, KeyboardAvoidingView, Platform, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { supabase } from '../lib/supabase';

export default function SignupScreen() {
    const router = useRouter();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSignup = async () => {
        if (!name || !email || !password) {
            Alert.alert('Error', 'Please enter your name, email and password.');
            return;
        }

        setLoading(true);
        const { data: { session }, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    name,
                    user_type: 'driver'
                }
            }
        });

        if (error) {
            Alert.alert('Error', error.message);
        } else {
            if (!session) {
                Alert.alert('Success', 'Please check your inbox for email verification!');
                router.replace('/login');
            }
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
                    <TouchableOpacity style={styles.backButton} onPress={() => {
                        if (router.canGoBack()) {
                            router.back();
                        } else {
                            router.replace('/');
                        }
                    }}>
                        <Ionicons name="arrow-back" size={24} color="#000" />
                    </TouchableOpacity>

                    {/* Titles */}
                    <Text style={styles.title}>Create an account</Text>
                    <Text style={styles.subtitle}>Signup to become an Ubar driver</Text>

                    {/* Inputs */}
                    <View style={styles.inputContainer}>
                        <TextInput
                            style={styles.input}
                            placeholder="Full Name"
                            placeholderTextColor="#999"
                            autoCapitalize="words"
                            value={name}
                            onChangeText={setName}
                        />
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
                        onPress={handleSignup}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <>
                                <Text style={styles.primaryButtonText}>Sign up</Text>
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
                        onPress={() => router.replace('/login')}
                        disabled={loading}
                    >
                        <Text style={styles.secondaryButtonText}>Log in instead</Text>
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

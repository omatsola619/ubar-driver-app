import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function SettingsScreen() {
    const { user } = useAuth();
    const router = useRouter();

    const handleLogout = async () => {
        await supabase.auth.signOut();
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Account Settings</Text>
                <View style={{ width: 24 }} />
            </View>

            <View style={styles.content}>
                <View style={styles.userInfoCard}>
                    <Text style={styles.label}>Name</Text>
                    <Text style={styles.value}>{user?.user_metadata?.name || 'Driver Name'}</Text>

                    <Text style={[styles.label, { marginTop: 16 }]}>Email</Text>
                    <Text style={styles.value}>{user?.email || 'driver@example.com'}</Text>
                </View>

                <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                    <Text style={styles.logoutText}>Log Out</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
        paddingTop: 50,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    backButton: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
    },
    content: {
        flex: 1,
        padding: 16,
    },
    userInfoCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    label: {
        fontSize: 14,
        color: '#666',
        marginBottom: 4,
    },
    value: {
        fontSize: 18,
        fontWeight: '500',
        color: '#000',
    },
    logoutButton: {
        backgroundColor: '#ff3b30',
        paddingVertical: 16,
        borderRadius: 8,
        alignItems: 'center',
    },
    logoutText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});

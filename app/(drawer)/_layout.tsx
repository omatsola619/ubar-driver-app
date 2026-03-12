import { useAuth } from '@/context/AuthContext';
import { DrawerContentScrollView, DrawerItemList } from '@react-navigation/drawer';
import { Drawer } from 'expo-router/drawer';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

function CustomDrawerContent(props: any) {
    const { user } = useAuth();

    return (
        <DrawerContentScrollView {...props} contentContainerStyle={{ flex: 1 }}>
            <View style={styles.drawerHeader}>
                <View style={styles.profileImagePlaceholder}>
                    <Text style={styles.profileInitial}>
                        {user?.user_metadata?.name?.[0]?.toUpperCase() || 'D'}
                    </Text>
                </View>
                <Text style={styles.userName}>{user?.user_metadata?.name || 'Driver'}</Text>
                <Text style={styles.userEmail}>{user?.email}</Text>
            </View>
            <View style={styles.drawerListContainer}>
                <DrawerItemList {...props} />
            </View>
        </DrawerContentScrollView>
    );
}

export default function DrawerLayout() {
    return (
        <Drawer
            drawerContent={(props) => <CustomDrawerContent {...props} />}
            screenOptions={{
                headerShown: false,
                drawerActiveBackgroundColor: '#f0f0f0',
                drawerActiveTintColor: '#000',
                drawerInactiveTintColor: '#666',
                drawerLabelStyle: {
                    fontSize: 16,
                    fontWeight: '500',
                },
            }}
        >
            <Drawer.Screen
                name="home"
                options={{
                    drawerLabel: 'Home',
                    title: 'Home',
                }}
            />
            <Drawer.Screen
                name="settings"
                options={{
                    drawerLabel: 'Account Settings',
                    title: 'Account Settings',
                }}
            />
        </Drawer>
    );
}

const styles = StyleSheet.create({
    drawerHeader: {
        padding: 24,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
        marginBottom: 8,
    },
    profileImagePlaceholder: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    profileInitial: {
        color: '#fff',
        fontSize: 24,
        fontWeight: 'bold',
    },
    userName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#000',
    },
    userEmail: {
        fontSize: 14,
        color: '#666',
        marginTop: 2,
    },
    drawerListContainer: {
        flex: 1,
    },
});

import { Session, User } from '@supabase/supabase-js';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

type AuthContextType = {
    session: Session | null;
    user: User | null;
    isLoading: boolean;
};

const AuthContext = createContext<AuthContextType>({
    session: null,
    user: null,
    isLoading: true,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            setIsLoading(false);
        }).catch((err) => {
            console.error("Auth session error", err);
            setIsLoading(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            setIsLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    return (
        <AuthContext.Provider value={{ session, user, isLoading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);

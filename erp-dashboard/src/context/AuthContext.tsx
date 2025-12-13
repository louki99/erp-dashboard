import React, { createContext, useContext, useState, useEffect } from 'react';
import apiClient from '@/services/api/client';

interface User {
    id: number;
    name: string;
    email: string;
    phone?: string;
    gender?: string;
    date_of_birth?: string;
    branch_code?: string;
    roles: Array<{
        id: number;
        name: string;
    }>;
    permissions: any[];
    media?: {
        id: number;
        type: string;
        src: string;
    };
}

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
    logout: () => void;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check for persisted user session
        const storedUser = localStorage.getItem('erp_user');

        if (storedUser) {
            try {
                setUser(JSON.parse(storedUser));
            } catch (e) {
                console.error("Failed to parse user session", e);
                localStorage.removeItem('erp_user');
            }
        }

        // Token is automatically added by apiClient interceptor from localStorage
        // No need to set it manually here

        setLoading(false);
    }, []);

    const login = async (email: string, password: string) => {
        try {
            const response = await apiClient.post('/api/backend/login', {
                email,
                password
            });

            if (response.data.success) {
                const userData = response.data.user;
                const token = response.data.token || response.data.access_token; // Support both common patterns

                setUser(userData);
                localStorage.setItem('erp_user', JSON.stringify(userData));

                if (token) {
                    localStorage.setItem('erp_token', token);
                    // Token is automatically added by apiClient interceptor on next request
                }

                return { success: true };
            } else {
                return { success: false, message: response.data.message || 'Login failed' };
            }
        } catch (error: any) {
            console.error("Login error", error);
            return {
                success: false,
                message: error.response?.data?.message || 'Connection failed or Invalid credentials'
            };
        }
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('erp_user');
        localStorage.removeItem('erp_token');
        // Token removal is handled by apiClient interceptor on next request
        // Optional: Call API to invalidate token if backend requires it
    };

    return (
        <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

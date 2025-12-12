import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Loader2, Lock, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Login = () => {
    const { register, handleSubmit, formState: { errors } } = useForm();
    const { login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [isLoading, setIsLoading] = useState(false);
    const [loginError, setLoginError] = useState<string | null>(null);

    const from = (location.state as any)?.from?.pathname || "/dashboard";

    const onSubmit = async (data: any) => {
        setIsLoading(true);
        setLoginError(null);

        const result = await login(data.email, data.password);

        if (result.success) {
            navigate(from, { replace: true });
        } else {
            setLoginError(result.message || "Login failed");
        }
        setIsLoading(false);
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#f0f2f5] p-4 font-sans">
            <div className="w-full max-w-md bg-white rounded-lg shadow-sm border border-gray-200 p-8">
                {/* Sage Logo Area */}
                <div className="flex justify-center mb-8">
                    <div className="flex flex-col items-center">
                        <div className="flex items-center gap-1">
                            <div className="w-8 h-8 bg-sage-600 rounded-sm flex items-center justify-center text-white font-bold text-lg">S</div>
                            <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-sage-700 to-gray-800">
                                Sage X3
                            </span>
                        </div>
                        <span className="text-xs text-gray-400 mt-1 uppercase tracking-widest font-semibold">Web Interface</span>
                    </div>
                </div>

                {/* Login Form */}
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    {loginError && (
                        <div className="p-3 rounded-md bg-red-50 text-red-600 text-sm border border-red-100 flex items-center gap-2">
                            <span>!</span> {loginError}
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Email Address</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                {...register('email', { required: 'Email is required' })}
                                type="email"
                                className={cn(
                                    "w-full pl-9 pr-3 py-2 border rounded-md focus:outline-none focus:ring-1 transition-all text-sm",
                                    errors.email ? "border-red-300 focus:ring-red-200" : "border-gray-300 focus:border-sage-500 focus:ring-sage-200"
                                )}
                                placeholder="name@company.com"
                                defaultValue="admin@foodsolutions.ma"
                            />
                        </div>
                        {errors.email && <span className="text-xs text-red-500">{errors.email.message as string}</span>}
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <label className="text-sm font-medium text-gray-700">Password</label>
                            <a href="#" className="text-xs text-sage-600 hover:text-sage-700 font-medium">Forgot password?</a>
                        </div>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                {...register('password', { required: 'Password is required' })}
                                type="password"
                                className={cn(
                                    "w-full pl-9 pr-3 py-2 border rounded-md focus:outline-none focus:ring-1 transition-all text-sm",
                                    errors.password ? "border-red-300 focus:ring-red-200" : "border-gray-300 focus:border-sage-500 focus:ring-sage-200"
                                )}
                                placeholder="••••••••"
                                defaultValue="secret"
                            />
                        </div>
                        {errors.password && <span className="text-xs text-red-500">{errors.password.message as string}</span>}
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-sage-600 hover:bg-sage-700 text-white font-medium py-2 px-4 rounded-md transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        {isLoading ? 'Signing in...' : 'Sign in'}
                    </button>
                </form>

                <div className="mt-6 text-center text-xs text-gray-400">
                    &copy; 2024 Sage Global Services Ltd. All rights reserved.
                </div>
            </div>
        </div>
    );
};

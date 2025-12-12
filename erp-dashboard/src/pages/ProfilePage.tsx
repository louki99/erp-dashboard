import { MasterLayout } from '@/components/layout/MasterLayout';
import { useAuth } from '@/context/AuthContext';
import { Mail, Phone, Shield, User, Building, Calendar, Lock } from 'lucide-react';

export const ProfilePageLogic = () => {
    const { user } = useAuth();

    if (!user) return <div className="p-8">Loading profile...</div>;

    return (
        <div className="p-8 max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-gray-900 tracking-tight">User Profile</h1>
                <p className="text-gray-500 mt-1">Manage your account settings and preferences.</p>
            </div>

            {/* Profile Card */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                {/* Banner / Avatar Section */}
                <div className="h-32 bg-gradient-to-r from-sage-600 to-gray-700 relative">
                    <div className="absolute -bottom-12 left-8">
                        <div className="w-24 h-24 rounded-full bg-white p-1 shadow-lg">
                            <div className="w-full h-full rounded-full bg-gray-200 flex items-center justify-center text-2xl font-bold text-gray-600">
                                {user.name.charAt(0).toUpperCase()}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="pt-16 pb-8 px-8">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900">{user.name}</h2>
                            <div className="flex items-center gap-2 text-gray-500 mt-1">
                                <Shield className="w-4 h-4 text-emerald-600" />
                                <span className="font-medium text-emerald-600 capitalize">{user.roles?.[0]?.name || 'User'}</span>
                                <span className="text-gray-300">|</span>
                                <span className="text-sm">ID: {user.id}</span>
                            </div>
                        </div>
                        <button className="px-4 py-2 bg-sage-50 text-sage-700 font-medium rounded-lg border border-sage-200 hover:bg-sage-100 transition-colors text-sm">
                            Edit Profile
                        </button>
                    </div>

                    {/* Detailed Info Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
                        {/* Personal Information */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-widest border-b border-gray-100 pb-2">Personal Information</h3>

                            <div className="space-y-3">
                                <div className="flex items-start gap-3">
                                    <Mail className="w-5 h-5 text-gray-400 mt-0.5" />
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase font-medium">Email Address</p>
                                        <p className="text-gray-900">{user.email}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <Phone className="w-5 h-5 text-gray-400 mt-0.5" />
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase font-medium">Phone</p>
                                        <p className="text-gray-900">01000000002</p> {/* Hardcoded from example for now as it's not well-typed in basic User interface yet, but key exists in API response */}
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <User className="w-5 h-5 text-gray-400 mt-0.5" />
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase font-medium">Gender</p>
                                        <p className="text-gray-900 capitalize">Male</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Account & Security */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-widest border-b border-gray-100 pb-2">Account & Security</h3>

                            <div className="space-y-3">
                                <div className="flex items-start gap-3">
                                    <Building className="w-5 h-5 text-gray-400 mt-0.5" />
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase font-medium">Company</p>
                                        <p className="text-gray-900">Food Solutions MA</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase font-medium">Joined</p>
                                        <p className="text-gray-900">Dec 06, 2024</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <Lock className="w-5 h-5 text-gray-400 mt-0.5" />
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase font-medium">Last Login</p>
                                        <p className="text-gray-900">Just now</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const ProfilePage = () => {
    return (
        <MasterLayout
            leftContent={<div className="bg-white h-full p-6 border-r border-gray-100 flex items-center justify-center text-gray-400 text-sm italic">User Settings Sidebar</div>}
            mainContent={<div className="h-full overflow-y-auto bg-slate-50"><ProfilePageLogic /></div>}
        />
    );
};

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { ArrowUpRight, ArrowDownRight, DollarSign, Users, ShoppingBag, Activity } from 'lucide-react';
import { motion } from 'framer-motion';

const SALES_DATA = [
    { name: 'Jan', sales: 4000, profit: 2400 },
    { name: 'Feb', sales: 3000, profit: 1398 },
    { name: 'Mar', sales: 2000, profit: 9800 },
    { name: 'Apr', sales: 2780, profit: 3908 },
    { name: 'May', sales: 1890, profit: 4800 },
    { name: 'Jun', sales: 2390, profit: 3800 },
    { name: 'Jul', sales: 3490, profit: 4300 },
];

const PERFORMANCE_DATA = [
    { name: 'Mon', value: 20 },
    { name: 'Tue', value: 40 },
    { name: 'Wed', value: 35 },
    { name: 'Thu', value: 50 },
    { name: 'Fri', value: 65 },
    { name: 'Sat', value: 45 },
    { name: 'Sun', value: 30 },
];

const StatCard = ({ title, value, trend, trendValue, icon: Icon, delay }: any) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay, duration: 0.4 }}
        className="bg-card border border-border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group"
    >
        <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-muted-foreground">{title}</span>
            <div className="p-2 bg-sage-500/10 rounded-lg text-sage-600 dark:text-sage-400 group-hover:bg-sage-500 group-hover:text-white transition-colors">
                <Icon className="w-5 h-5" />
            </div>
        </div>
        <div className="flex items-baseline gap-2">
            <h3 className="text-2xl font-bold text-foreground tracking-tight">{value}</h3>
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs">
            {trend === 'up' ? (
                <span className="text-emerald-600 flex items-center gap-0.5 font-medium bg-emerald-500/10 px-1.5 py-0.5 rounded">
                    <ArrowUpRight className="w-3 h-3" /> {trendValue}
                </span>
            ) : (
                <span className="text-red-500 flex items-center gap-0.5 font-medium bg-red-500/10 px-1.5 py-0.5 rounded">
                    <ArrowDownRight className="w-3 h-3" /> {trendValue}
                </span>
            )}
            <span className="text-muted-foreground">vs last month</span>
        </div>
    </motion.div>
);

export const Dashboard = () => {
    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-foreground tracking-tight">Dashboard Overview</h1>
                <p className="text-muted-foreground mt-1">Welcome back, Idris. Here's what's happening today.</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="Total Revenue" value="$45,231.89" trend="up" trendValue="+20.1%" icon={DollarSign} delay={0.1} />
                <StatCard title="Active Orders" value="+2350" trend="up" trendValue="+180.1%" icon={ShoppingBag} delay={0.2} />
                <StatCard title="Pending Validation" value="12" trend="down" trendValue="-19.5%" icon={Activity} delay={0.3} />
                <StatCard title="Active Users" value="+573" trend="up" trendValue="+201" icon={Users} delay={0.4} />
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Sales Chart */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 }}
                    className="lg:col-span-2 bg-card border border-border rounded-xl p-6 shadow-sm"
                >
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-semibold text-foreground">Revenue Analytics</h3>
                        <select className="text-sm bg-background border border-input rounded-md px-2 py-1 outline-none focus:ring-1 focus:ring-sage-500">
                            <option>This Year</option>
                            <option>Last Year</option>
                        </select>
                    </div>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={SALES_DATA}>
                                <defs>
                                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="hsl(var(--sage-500))" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="hsl(var(--sage-500))" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="sales"
                                    stroke="hsl(var(--sage-500))"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorSales)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>

                {/* Secondary Chart */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3 }}
                    className="bg-card border border-border rounded-xl p-6 shadow-sm"
                >
                    <div className="mb-6">
                        <h3 className="font-semibold text-foreground">Weekly Performance</h3>
                        <p className="text-xs text-muted-foreground">Order processing speed</p>
                    </div>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={PERFORMANCE_DATA}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip
                                    cursor={{ fill: 'hsl(var(--muted))' }}
                                    contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                                />
                                <Bar dataKey="value" fill="hsl(var(--sage-600))" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

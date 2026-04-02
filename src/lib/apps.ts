import { 
    LayoutDashboard, Car, Wrench, CircleDot, FileCheck2, 
    TrendingUp, Receipt, Users, CalendarClock, BarChart3,
    Wallet, Home, ShoppingCart, CreditCard
} from 'lucide-react';

export interface NavItem {
    to: string;
    icon: any; // Lucide icon component
    label: string;
}

export interface AppModule {
    id: string;
    name: string;
    description: string;
    icon: any;
    color: string;
    navItems: NavItem[];
}

export const APPS: Record<string, AppModule> = {
    transport: {
        id: 'transport',
        name: 'Transport Business',
        description: 'Manage fleet operations, maintenance, licensing, and drivers.',
        icon: Car,
        color: '#3b82f6', // blue
        navItems: [
            { to: '/transport/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
            { to: '/transport/vehicles', icon: Car, label: 'Vehicles' },
            { to: '/transport/service-history', icon: Wrench, label: 'Service History' },
            { to: '/transport/tyre-changes', icon: CircleDot, label: 'Tyre Changes' },
            { to: '/transport/licensing', icon: FileCheck2, label: 'Licensing' },
            { to: '/transport/income', icon: TrendingUp, label: 'Income' },
            { to: '/transport/expenses', icon: Receipt, label: 'Expenses' },
            { to: '/transport/drivers', icon: Users, label: 'Drivers' },
            { to: '/transport/cashing-schedules', icon: CalendarClock, label: 'Schedules' },
            { to: '/transport/reports', icon: BarChart3, label: 'Reports' },
        ],
    },
    budget: {
        id: 'budget',
        name: 'Home Budgeting',
        description: 'Track household expenses, personal wealth, and budgeting.',
        icon: Home,
        color: '#10b981', // emerald
        navItems: [
            { to: '/budget/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
            { to: '/budget/income', icon: Wallet, label: 'Income & Funding' },
            { to: '/budget/expenses', icon: ShoppingCart, label: 'Expenses' },
            { to: '/budget/reports', icon: BarChart3, label: 'Reports' },
        ],
    },
    personal: {
        id: 'personal',
        name: 'Personal Expenses',
        description: 'Track personal spending — fuel, food, clothing, and more.',
        icon: CreditCard,
        color: '#8b5cf6', // violet
        navItems: [
            { to: '/personal/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
            { to: '/personal/expenses', icon: Receipt, label: 'Expenses' },
            { to: '/personal/subscriptions', icon: CalendarClock, label: 'Subscriptions' },
            { to: '/personal/reports', icon: BarChart3, label: 'Reports' },
        ],
    },
};

export const getAppByPath = (pathname: string): AppModule | undefined => {
    const appId = pathname.split('/')[1]; // e.g. "/transport/vehicles" -> "transport"
    return APPS[appId];
};

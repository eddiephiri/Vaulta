import { BrowserRouter, Routes, Route, Navigate, useNavigate, Outlet } from 'react-router-dom';
import { useEffect } from 'react';
import { Layout } from './components/Layout';
import { WorkspaceProvider } from './contexts/WorkspaceContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { AppLauncher } from './pages/AppLauncher';
import { Dashboard } from './pages/Dashboard';
import { Vehicles } from './pages/Vehicles';
import { ServiceHistory } from './pages/ServiceHistory';
import { TyreChanges } from './pages/TyreChanges';
import { Licensing } from './pages/Licensing';
import { Income } from './pages/Income';
import { Expenses } from './pages/Expenses';
import { Reports } from './pages/Reports';
import { Drivers } from './pages/Drivers';
import { CashingSchedules } from './pages/CashingSchedules';
import { Login } from './pages/Login';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { Settings } from './pages/Settings';
import { useAuth } from './hooks/useAuth';
import { useSessionSecurity } from './hooks/useSessionSecurity';
import { BudgetDashboard } from './pages/budget/BudgetDashboard';
import { BudgetIncome } from './pages/budget/BudgetIncome';
import { BudgetExpenses } from './pages/budget/BudgetExpenses';
import { BudgetReports } from './pages/budget/BudgetReports';
import { BudgetSheets } from './pages/budget/BudgetSheets';
import { BudgetSettings } from './pages/budget/BudgetSettings';
import { PersonalDashboard } from './pages/personal/PersonalDashboard';
import { PersonalExpenses } from './pages/personal/PersonalExpenses';
import { PersonalReports } from './pages/personal/PersonalReports';
import { PersonalSubscriptions } from './pages/personal/PersonalSubscriptions';
import { Wishlist } from './pages/Wishlist';
import { JoinWorkspace } from './pages/JoinWorkspace';
import { DriverProvider } from './contexts/DriverContext';
import { DriverLayout } from './components/DriverLayout';
import { DriverLogin } from './pages/driver/DriverLogin';
import { DriverHome } from './pages/driver/DriverHome';
import { DriverProfile } from './pages/driver/DriverProfile';
import { DriverChangePassword } from './pages/driver/DriverChangePassword';

function AuthEventHandler() {
  const { authEvent } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (authEvent === 'PASSWORD_RECOVERY') {
      navigate('/reset-password');
    }
  }, [authEvent, navigate]);

  return null;
}

export default function App() {
  const { session, loading } = useAuth();

  // Enforce single session and idle timeout (15 mins)
  useSessionSecurity(session);

  // Drivers are a distinct, phone-first audience routed into their own portal.
  // role lives in app_metadata (service-role-only); RLS is the real gate, this
  // only drives UX routing. must_change_password is a benign self-editable flag.
  const isDriver = session?.user?.app_metadata?.role === 'driver';
  const mustChangePassword = session?.user?.user_metadata?.must_change_password === true;

  // While checking session, show a minimal loader so there's no flash
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'var(--ff-bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <p style={{ color: 'var(--ff-text-muted)', fontSize: 14 }}>Loading…</p>
      </div>
    );
  }

  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthEventHandler />
        <Routes>
          {!session ? (
            <>
              <Route path="/driver/*" element={<DriverLogin />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="*" element={<Login />} />
            </>
          ) : isDriver ? (
            mustChangePassword ? (
              <Route path="*" element={<DriverChangePassword onDone={() => { /* session refresh clears the flag */ }} />} />
            ) : (
              <Route element={
                <DriverProvider>
                  <Outlet />
                </DriverProvider>
              }>
                <Route path="driver" element={<DriverLayout />}>
                  <Route index element={<DriverHome />} />
                  <Route path="profile" element={<DriverProfile />} />
                </Route>
                <Route path="*" element={<Navigate to="/driver" replace />} />
              </Route>
            )
          ) : (
            <>
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route element={
                <WorkspaceProvider>
                  <Outlet />
                </WorkspaceProvider>
              }>
                <Route index element={<AppLauncher />} />
                <Route path="join" element={<JoinWorkspace />} />
                
                <Route path="transport" element={<Layout />}>
                  <Route index element={<Navigate to="dashboard" replace />} />
                  <Route path="dashboard" element={<Dashboard />} />
                  <Route path="vehicles" element={<Vehicles />} />
                  <Route path="service-history" element={<ServiceHistory />} />
                  <Route path="tyre-changes" element={<TyreChanges />} />
                  <Route path="licensing" element={<Licensing />} />
                  <Route path="income" element={<Income />} />
                  <Route path="expenses" element={<Expenses />} />
                  <Route path="drivers" element={<Drivers />} />
                  <Route path="cashing-schedules" element={<CashingSchedules />} />
                  <Route path="reports" element={<Reports />} />
                  <Route path="settings" element={<Settings />} />
                  <Route path="wishlist" element={<Wishlist />} />
                </Route>

                <Route path="budget" element={<Layout />}>
                  <Route index element={<Navigate to="dashboard" replace />} />
                  <Route path="dashboard" element={<BudgetDashboard />} />
                  <Route path="budget-sheets" element={<BudgetSheets />} />
                  <Route path="income" element={<BudgetIncome />} />
                  <Route path="expenses" element={<BudgetExpenses />} />
                  <Route path="reports" element={<BudgetReports />} />
                  <Route path="settings" element={<BudgetSettings />} />
                  <Route path="wishlist" element={<Wishlist />} />
                </Route>

                <Route path="personal" element={<Layout />}>
                  <Route index element={<Navigate to="dashboard" replace />} />
                  <Route path="dashboard" element={<PersonalDashboard />} />
                  <Route path="expenses" element={<PersonalExpenses />} />
                  <Route path="subscriptions" element={<PersonalSubscriptions />} />
                  <Route path="reports" element={<PersonalReports />} />
                  <Route path="wishlist" element={<Wishlist />} />
                </Route>

                {/* Catch-all for unknown routes inside the authenticated area */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </>
          )}
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}


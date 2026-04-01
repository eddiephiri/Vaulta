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
import { useIdleTimeout } from './hooks/useIdleTimeout';
import { BudgetDashboard } from './pages/budget/BudgetDashboard';
import { BudgetIncome } from './pages/budget/BudgetIncome';
import { BudgetExpenses } from './pages/budget/BudgetExpenses';
import { BudgetReports } from './pages/budget/BudgetReports';
import { PersonalDashboard } from './pages/personal/PersonalDashboard';
import { PersonalExpenses } from './pages/personal/PersonalExpenses';
import { PersonalReports } from './pages/personal/PersonalReports';
import { JoinWorkspace } from './pages/JoinWorkspace';

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

  // Enable idle timeout (30 minutes)
  useIdleTimeout();

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
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="*" element={<Login />} />
            </>
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
                </Route>

                <Route path="budget" element={<Layout />}>
                  <Route index element={<Navigate to="dashboard" replace />} />
                  <Route path="dashboard" element={<BudgetDashboard />} />
                  <Route path="income" element={<BudgetIncome />} />
                  <Route path="expenses" element={<BudgetExpenses />} />
                  <Route path="reports" element={<BudgetReports />} />
                </Route>

                <Route path="personal" element={<Layout />}>
                  <Route index element={<Navigate to="dashboard" replace />} />
                  <Route path="dashboard" element={<PersonalDashboard />} />
                  <Route path="expenses" element={<PersonalExpenses />} />
                  <Route path="reports" element={<PersonalReports />} />
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


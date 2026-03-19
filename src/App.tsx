import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { Layout } from './components/Layout';
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

  // While checking session, show a minimal loader so there's no flash
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'var(--ff-navy)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <p style={{ color: 'var(--ff-text-muted)', fontSize: 14 }}>Loading…</p>
      </div>
    );
  }

  return (
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
            <Route element={<Layout />}>
              <Route index element={<Dashboard />} />
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
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </>
        )}
      </Routes>
    </BrowserRouter>
  );
}

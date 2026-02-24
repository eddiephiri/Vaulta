import { BrowserRouter, Routes, Route } from 'react-router-dom';
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
import { useAuth } from './hooks/useAuth';

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

  // Not signed in → show Login page (no routes exposed)
  if (!session) {
    return <Login />;
  }

  // Signed in → render full app
  return (
    <BrowserRouter>
      <Routes>
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
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

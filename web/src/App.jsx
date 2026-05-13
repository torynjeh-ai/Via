import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import VerifyOtp from './pages/VerifyOtp';
import Dashboard from './pages/Dashboard';
import Groups from './pages/Groups';
import GroupDetail from './pages/GroupDetail';
import CreateGroup from './pages/CreateGroup';
import Contribute from './pages/Contribute';
import Payouts from './pages/Payouts';
import Notifications from './pages/Notifications';
import Profile from './pages/Profile';
import SetupProfile from './pages/SetupProfile';
import JoinByInvite from './pages/JoinByInvite';
import Settings from './pages/Settings';
import Receipts from './pages/Receipts';
import Wallet from './pages/Wallet';
import TopUp from './pages/TopUp';
import Withdraw from './pages/Withdraw';
import Transfer from './pages/Transfer';
import TransactionHistory from './pages/TransactionHistory';
import Admin from './pages/Admin';
import Savings from './pages/Savings';
import CreateSavingsGoal from './pages/CreateSavingsGoal';
import FlexibleGroupDetail from './pages/FlexibleGroupDetail';
import CreateFlexibleGroup from './pages/CreateFlexibleGroup';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontSize: 18 }}>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  return <Layout>{children}</Layout>;
}

// Routes that require identity verification (create/join/contribute)
function VerifiedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontSize: 18 }}>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (!user.profile_complete) return <Navigate to="/setup-profile" />;
  return <Layout>{children}</Layout>;
}

function SetupRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" />;
  if (user.profile_complete) return <Navigate to="/" />;
  return children;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/" /> : children;
}

function AdminRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontSize: 18 }}>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (user.role !== 'admin' && user.role !== 'superadmin') return <Navigate to="/" />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <Routes>
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
          <Route path="/verify-otp" element={<PublicRoute><VerifyOtp /></PublicRoute>} />
          <Route path="/setup-profile" element={<SetupRoute><SetupProfile /></SetupRoute>} />
          <Route path="/join/:token" element={<JoinByInvite />} />
          <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/groups" element={<PrivateRoute><Groups /></PrivateRoute>} />
          <Route path="/groups/create" element={<VerifiedRoute><CreateGroup /></VerifiedRoute>} />
          <Route path="/groups/create-flexible" element={<VerifiedRoute><CreateFlexibleGroup /></VerifiedRoute>} />
          <Route path="/groups/:id/flexible" element={<PrivateRoute><FlexibleGroupDetail /></PrivateRoute>} />
          <Route path="/groups/:id" element={<PrivateRoute><GroupDetail /></PrivateRoute>} />
          <Route path="/groups/:id/contribute" element={<VerifiedRoute><Contribute /></VerifiedRoute>} />
          <Route path="/groups/:id/payouts" element={<PrivateRoute><Payouts /></PrivateRoute>} />
          <Route path="/notifications" element={<PrivateRoute><Notifications /></PrivateRoute>} />
          <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
          <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
          <Route path="/receipts" element={<PrivateRoute><Receipts /></PrivateRoute>} />
          <Route path="/wallet" element={<PrivateRoute><Wallet /></PrivateRoute>} />
          <Route path="/wallet/topup" element={<PrivateRoute><TopUp /></PrivateRoute>} />
          <Route path="/wallet/withdraw" element={<PrivateRoute><Withdraw /></PrivateRoute>} />
          <Route path="/wallet/transfer" element={<PrivateRoute><Transfer /></PrivateRoute>} />
          <Route path="/wallet/transactions" element={<PrivateRoute><TransactionHistory /></PrivateRoute>} />
          <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
          <Route path="/savings" element={<PrivateRoute><Savings /></PrivateRoute>} />
          <Route path="/savings/new" element={<PrivateRoute><CreateSavingsGoal /></PrivateRoute>} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

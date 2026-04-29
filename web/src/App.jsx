import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
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

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontSize: 18 }}>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
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

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
          <Route path="/verify-otp" element={<PublicRoute><VerifyOtp /></PublicRoute>} />
          <Route path="/setup-profile" element={<SetupRoute><SetupProfile /></SetupRoute>} />
          <Route path="/join/:token" element={<JoinByInvite />} />
          <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/groups" element={<PrivateRoute><Groups /></PrivateRoute>} />
          <Route path="/groups/create" element={<PrivateRoute><CreateGroup /></PrivateRoute>} />
          <Route path="/groups/:id" element={<PrivateRoute><GroupDetail /></PrivateRoute>} />
          <Route path="/groups/:id/contribute" element={<PrivateRoute><Contribute /></PrivateRoute>} />
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
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

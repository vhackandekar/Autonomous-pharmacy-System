import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './Component/Layout';
import Login from './Pages/Login';
import Register from './Pages/Register';
import OTPVerification from './Pages/OTPVerification';
import ForgotPassword from './Pages/ForgotPassword';
import UserDashboard from './Pages/UserDashboard';
import AdminDashboard from './Pages/AdminDashboard';
import MyOrders from './Pages/MyOrders';
import ChatPage from './Pages/ChatPage';
import CartPage from './Pages/CartPage';
import SettingsPage from './Pages/Settings';
import HistoryPage from './Pages/History';
import PrescriptionsPage from './Pages/Prescriptions';
import DeliveryProfilePage from './Pages/DeliveryProfilePage';
import OrderDetails from './pages/OrderDetails';



import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './Component/PrivateRoute';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Auth Routes */}
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-otp" element={<OTPVerification />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        {/* Dashboard Routes wrapped in Layout and PrivateRoute */}
        <Route path="/dashboard" element={<Navigate to="/chat" replace />} />
        <Route path="/chat" element={<PrivateRoute><Layout><ChatPage /></Layout></PrivateRoute>} />
        <Route path="/orders" element={<PrivateRoute><Layout><MyOrders /></Layout></PrivateRoute>} />
        <Route path="/orders/:orderId" element={<PrivateRoute><Layout><OrderDetails /></Layout></PrivateRoute>} />
        <Route path="/cart" element={<PrivateRoute><Layout><CartPage /></Layout></PrivateRoute>} />

        <Route path="/history" element={<PrivateRoute><Layout><HistoryPage /></Layout></PrivateRoute>} />
        <Route path="/prescriptions" element={<PrivateRoute><Layout><PrescriptionsPage /></Layout></PrivateRoute>} />
        <Route path="/profile" element={<PrivateRoute><Layout><DeliveryProfilePage /></Layout></PrivateRoute>} />
        <Route path="/settings" element={<PrivateRoute><Layout><SettingsPage /></Layout></PrivateRoute>} />

        {/* Admin Routes */}
        <Route path="/admin-panel" element={<PrivateRoute><Layout><AdminDashboard /></Layout></PrivateRoute>} />

      </Routes>
    </BrowserRouter>
  );
}

export default App;

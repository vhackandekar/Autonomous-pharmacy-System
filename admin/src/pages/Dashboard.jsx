import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  IndianRupee, AlertTriangle, ShoppingCart, Truck,
  Bell, MoreHorizontal, TrendingUp
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar
} from 'recharts';
import { getDashboardStats, getAllOrders, getMedicines } from '../utils/api';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';


const statusClass = (s) => {
  const m = {
    PENDING: 'confirmed',
    REJECTED: 'rejected',
    PROCESSING: 'processing',
    SHIPPED: 'shipped',
    DELIVERED: 'delivered'
  };
  return m[s] || 'pending';
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>{label}</p>
        <p style={{ color: 'var(--accent-green)', fontWeight: 700 }}>
          ₹{payload[0]?.value?.toLocaleString()}
        </p>
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const { theme } = useTheme();
  const { token } = useAuth();
  const [stats, setStats] = useState(null);
  const [orders, setOrders] = useState([]);
  const [lowStockMedicines, setLowStockMedicines] = useState([]);
  const [salesData, setSalesData] = useState([]);
  const [loading, setLoading] = useState(true);

  // Chart colors based on theme
  const chartColors = {
    dark: {
      stroke: '#22c55e',
      fill: 'rgba(34,197,94,0.2)',
      grid: '#2a3448',
      text: '#8b95a8'
    },
    light: {
      stroke: '#16a34a',
      fill: 'rgba(22,163,74,0.15)',
      grid: '#e0e0e0',
      text: '#4a4a4a'
    }
  };

  const currentChartColors = chartColors[theme];


  useEffect(() => {
    if (!token) {
      console.warn('⚠️ Token not available yet, waiting...');
      return;
    }

    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        console.log('🔄 Fetching dashboard data with token:', token?.slice(0, 20) + '...');

        const [statsRes, ordersRes, medicinesRes] = await Promise.all([
          getDashboardStats(),
          getAllOrders(),
          getMedicines(),
        ]);

        console.log('✅ Dashboard data fetched successfully');
        setStats(statsRes.data);

        const sortedOrders = ordersRes.data
          ?.sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate))
          ?.slice(0, 6);

        setOrders(sortedOrders || []);

        const lowStock = medicinesRes.data.filter(m => m.stock < 20);
        setLowStockMedicines(lowStock);

        const weeklyMap = {};

        ordersRes.data.forEach(order => {
          const day = new Date(order.orderDate)
            .toLocaleDateString('en-IN', { weekday: 'short' });

          if (!weeklyMap[day]) {
            weeklyMap[day] = { day, sales: 0, orders: 0 };
          }

          weeklyMap[day].sales += order.totalAmount || 0;
          weeklyMap[day].orders += 1;
        });

        setSalesData(Object.values(weeklyMap));

      } catch (error) {
        console.error("Dashboard fetch error:", error);
        toast.error("Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [token]); // Re-run when token becomes available

  // Socket: refresh dashboard when orders change elsewhere
  useEffect(() => {
    const socket = io(import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000');
    socket.emit('join', { role: 'ADMIN' });

    const refresh = async () => {
      try {
        const [statsRes, ordersRes, medicinesRes] = await Promise.all([
          getDashboardStats(),
          getAllOrders(),
          getMedicines(),
        ]);
        setStats(statsRes.data);
        const sortedOrders = ordersRes.data
          ?.sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate))
          ?.slice(0, 6);
        setOrders(sortedOrders || []);
        const lowStock = medicinesRes.data.filter(m => m.stock < 20);
        setLowStockMedicines(lowStock);
      } catch (err) {
        console.error('Socket refresh failed', err);
      }
    };

    socket.on('order_created', refresh);
    socket.on('order_updated_admin', refresh);
    socket.on('order_updated', refresh);
    socket.on('stock_alert', refresh);
    socket.on('refill_alert_admin', refresh);

    return () => { socket.disconnect(); };
  }, []);

  if (loading) return (
    <div className="loading-state">
      <div className="spinner" />
      <p>Loading dashboard...</p>
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Welcome back! Here's what's happening at your pharmacy today.</p>
      </div>

      {/* Stats */}
      <div className="stats-grid">

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-icon green"><IndianRupee size={20} /></div>
          </div>
          <div className="stat-value">₹{(stats?.totalRevenue || 0).toLocaleString()}</div>
          <div className="stat-label">Total Sales</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-icon orange"><AlertTriangle size={20} /></div>
          </div>
          <div className="stat-value">{lowStockMedicines.length}</div>
          <div className="stat-label">Low Stock Items</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-icon blue"><ShoppingCart size={20} /></div>
          </div>
          <div className="stat-value">{stats?.processingCount ?? stats?.pendingOrders ?? 0}</div>
          <div className="stat-label">Orders Processing</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-icon purple"><Truck size={20} /></div>
          </div>
          <div className="stat-value">
            {stats?.shippedCount ?? orders.filter(o => o.status === "SHIPPED").length}
          </div>
          <div className="stat-label">Active Shipments (Shipped)</div>
        </div>
      </div >

      <div className="content-grid">

        {/* Chart */}
        <div className="card">
          <div className="card-header">
            <h3><TrendingUp size={16} /> Weekly Revenue</h3>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" stroke={currentChartColors.grid} />
                <XAxis
                  dataKey="day"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: currentChartColors.text, fontSize: 12 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: currentChartColors.text, fontSize: 12 }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke={currentChartColors.stroke}
                  fillOpacity={0.2}
                  fill={currentChartColors.fill}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Orders */}
        <div className="card">
          <div className="card-header">
            <h3><ShoppingCart size={16} /> Recent Orders</h3>
            <Link to="/orders" className="btn btn-secondary btn-sm">View All Orders</Link>
          </div>
          <div className="card-body">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Customer</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order, i) => (
                  <tr key={order._id || i}>
                    <td>#{order._id?.slice(-6).toUpperCase()}</td>
                    <td>{order.userId?.name || "Unknown User"}</td>
                    <td>{order.items?.length || 1}</td>
                    <td>₹{order.totalAmount?.toLocaleString()}</td>
                    <td>
                      <span className={`status-badge ${statusClass(order.status)}`}>
                        {order.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Refill Section */}
        <div className="card">
          <div className="card-header">
            <h3><Bell size={16} /> Refill Needed ({lowStockMedicines.length})</h3>
          </div>
          <div className="card-body">
            {lowStockMedicines.map((item, i) => (
              <div className="refill-item" key={i}>
                <h4>{item.name}</h4>
                <div>Stock: {item.stock}</div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div >
  );
}
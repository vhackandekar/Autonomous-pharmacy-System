import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  IndianRupee, AlertTriangle, ShoppingCart, Truck,
  Bell, MoreHorizontal, TrendingUp
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { getDashboardStats, getAllOrders, getMedicines } from '../utils/api';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';


const statusClass = (s) => {
  const m = {
    PENDING: 'pending',
    CANCELLED: 'rejected',
    CONFIRMED: 'confirmed',
    OUT_FOR_DELIVERY: 'shipped',
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
  const [lowStockMedicines, setLowStockMedicines] = useState([]);
  const [salesData, setSalesData] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  const [statusData, setStatusData] = useState([]);
  const [monthlyProfitData, setMonthlyProfitData] = useState([]);
  const [loading, setLoading] = useState(true);

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

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



  const fetchDashboardData = async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      const [statsRes, ordersRes, medicinesRes] = await Promise.all([
        getDashboardStats(),
        getAllOrders(),
        getMedicines(),
      ]);

      setStats(statsRes.data);
      const allOrders = ordersRes.data || [];
      const medicines = medicinesRes.data || [];
      setLowStockMedicines(medicines.filter(m => m.stock < 20));

      const weeklyMap = {};
      const last7Days = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dayName = d.toLocaleDateString('en-IN', { weekday: 'short' });
        last7Days.push(dayName);
        weeklyMap[dayName] = { day: dayName, sales: 0, orders: 0 };
      }

      allOrders.forEach(order => {
        const oDate = order.orderDate || order.createdAt;
        if (!oDate) return;
        const dateObj = new Date(oDate);
        if (isNaN(dateObj.getTime())) return;
        const day = dateObj.toLocaleDateString('en-IN', { weekday: 'short' });
        if (weeklyMap[day]) {
          weeklyMap[day].sales += order.totalAmount || 0;
          weeklyMap[day].orders += 1;
        }
      });
      setSalesData(last7Days.map(d => weeklyMap[d]));

      const catMap = {};
      medicines.forEach(med => {
        const cat = med.prescriptionRequired ? 'Prescription' : 'OTC';
        catMap[cat] = (catMap[cat] || 0) + 1;
      });
      setCategoryData(Object.keys(catMap).map(name => ({ name, value: catMap[name] })));

      const allowedStatuses = ['PENDING', 'CONFIRMED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];
      const statusMap = allowedStatuses.reduce((acc, status) => ({ ...acc, [status]: 0 }), {});

      allOrders.forEach(order => {
        let status = order.status || 'PENDING';
        if (status === 'PROCESSING') status = 'CONFIRMED';
        if (status === 'SHIPPED') status = 'OUT_FOR_DELIVERY';
        if (status === 'REJECTED') status = 'CANCELLED';

        if (allowedStatuses.includes(status)) {
          statusMap[status]++;
        }
      });

      const filteredStatusData = allowedStatuses
        .filter(status => statusMap[status] > 0)
        .map(name => ({ name, value: statusMap[name] }));

      setStatusData(filteredStatusData);

      const profitMonthlyMap = {};
      const monthsToShow = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const monthDisplay = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
        monthsToShow.push(monthKey);
        profitMonthlyMap[monthKey] = { month: monthDisplay, profit: 0 };
      }

      allOrders.forEach(order => {
        const date = new Date(order.orderDate || order.createdAt);
        if (isNaN(date.getTime())) return;
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (profitMonthlyMap[monthKey]) {
          order.items?.forEach(item => {
            const price = item.medicineId?.price || 0;
            const cost = item.medicineId?.costPrice || 0;
            profitMonthlyMap[monthKey].profit += (price - cost) * (item.quantity || 0);
          });
        }
      });
      setMonthlyProfitData(monthsToShow.map(key => profitMonthlyMap[key]));

      const activeOrders = allOrders.filter(o => o.status !== 'CANCELLED' && o.status !== 'REJECTED');
      const revenue = activeOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
      const profit = activeOrders.reduce((sum, order) => {
        return sum + (order.items?.reduce((pSum, item) => {
          const price = item.medicineId?.price || 0;
          const cost = item.medicineId?.costPrice || 0;
          return pSum + ((price - cost) * (item.quantity || 0));
        }, 0) || 0);
      }, 0);
      setStats(prev => ({ ...prev, totalSales: revenue, totalProfit: profit }));
    } catch (error) {
      console.error("Dashboard fetch error:", error);
    } finally {
      if (!isRefresh) setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchDashboardData();
  }, [token]);


  // Socket: refresh dashboard charts in real-time
  useEffect(() => {
    const socket = io(import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000');
    socket.emit('join', { role: 'ADMIN' });

    const refresh = () => fetchDashboardData(true);

    socket.on('order_created', refresh);
    socket.on('order_updated_admin', refresh);
    socket.on('order_updated', refresh);
    socket.on('stock_alert', refresh);

    return () => { socket.disconnect(); };
  }, []);

  const totalSales = stats?.totalSales || 0;
  const totalProfit = stats?.totalProfit || 0;
  const profitMargin = totalSales > 0 ? ((totalProfit / totalSales) * 100).toFixed(1) : 0;

  if (loading) return (
    <div className="loading-state">
      <div className="spinner" />
      <p>Loading dashboard...</p>
    </div>
  );

  const quickActions = [
    { label: 'Add Medicine', icon: '💊', link: '/inventory' },
    { label: 'View Orders', icon: '📦', link: '/orders' },
    { label: 'AI Admin Chat', icon: '🤖', link: '/ai-intelligence' },
  ];

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
          <div className="stat-value">₹{totalSales.toLocaleString()}</div>
          <div className="stat-label">Total Revenue</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-icon purple"><TrendingUp size={20} /></div>
          </div>
          <div className="stat-value">₹{totalProfit.toLocaleString()}</div>
          <div className="stat-label">Net Profit (Est.)</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-icon blue"><span>%</span></div>
          </div>
          <div className="stat-value">{profitMargin}%</div>
          <div className="stat-label">Avg. Margin</div>
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
          <div className="stat-value">{stats?.confirmedCount ?? 0}</div>
          <div className="stat-label">Confirmed & Packing</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-icon purple"><Truck size={20} /></div>
          </div>
          <div className="stat-value">
            {stats?.outForDeliveryCount ?? 0}
          </div>
          <div className="stat-label">Out For Delivery</div>
        </div>
      </div >

      <div className="content-grid">

        {/* Chart */}
        <div className="card" style={{ gridColumn: '1 / span 2' }}>
          <div className="card-header">
            <h3><TrendingUp size={16} /> Weekly Revenue</h3>
          </div>
          <div className="chart-container" style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
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

        {/* NEW Visual Reports Grid - Grouping all 4 analytical charts */}
        <div className="analytics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px', gridColumn: '1 / span 2', marginBottom: '20px' }}>

          {/* Chart 1: Inventory Distribution */}
          <div className="card">
            <div className="card-header">
              <h3>Inventory Distribution</h3>
            </div>
            <div className="chart-container" style={{ height: '300px', padding: '10px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="45%"
                    innerRadius={70}
                    outerRadius={95}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px' }}
                    itemStyle={{ color: 'var(--text-primary)' }}
                  />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Order Status Breakdown */}
          <div className="card">
            <div className="card-header">
              <h3>Order Status Breakdown</h3>
            </div>
            <div className="chart-container" style={{ height: '300px', padding: '10px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={currentChartColors.grid} vertical={false} />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: currentChartColors.text, fontSize: 11 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: currentChartColors.text, fontSize: 11 }}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px' }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 3: Monthly Profit Trend (Full Width) */}
          <div className="card" style={{ gridColumn: 'span 2' }}>
            <div className="card-header">
              <h3>Monthly Profit Trend</h3>
            </div>
            <div className="chart-container" style={{ height: '300px', padding: '10px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyProfitData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={currentChartColors.grid} vertical={false} />
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: currentChartColors.text, fontSize: 11 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: currentChartColors.text, fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px' }}
                    formatter={(value) => [`₹${value.toLocaleString()}`, 'Profit']}
                  />
                  <Area
                    type="monotone"
                    dataKey="profit"
                    stroke="#10b981"
                    fillOpacity={0.3}
                    fill="#10b981"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

      </div>
    </div >
  );
}
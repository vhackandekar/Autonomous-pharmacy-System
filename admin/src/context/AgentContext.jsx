import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getMedicines, getAllOrders, getVendors } from '../utils/api';
import {
  calculateDepletionDate,
  calculateDailyConsumption,
  calculateOptimalReorderQty,
  calculateStockoutRisk,
  getAlertPriority,
  getExpiringMedicines,
  getSlowMovingMedicines,
  generatePurchaseSummary,
  calculateSystemHealth,
  detectAdherenceAnomalies,
  ALERT_PRIORITY,
  SYSTEM_HEALTH,
} from '../utils/agentEngine';

const AgentContext = createContext(null);

// Mock historical data for demo (replace with API in production)
const MOCK_DAILY_DOSAGE = {
  default: 2, // tablets/capsules per day per patient
};

export function AgentProvider({ children }) {
  const [medicines, setMedicines] = useState([]);
  const [orders, setOrders] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [batchedAlerts, setBatchedAlerts] = useState([]);
  const [insights, setInsights] = useState({
    demandTrends: [],
    refillRisks: [],
    adherenceInsights: [],
    expiringSoon: [],
    slowMoving: [],
    systemHealth: null,
  });
  const [lastReportTime, setLastReportTime] = useState(null);
  const [isMonitoring, setIsMonitoring] = useState(true);

  const MOCK_MEDS = [
    { _id: '1', name: 'Dolo 650', dosage: '650mg', stock: 100, price: 2550, expiryDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString() },
    { _id: '2', name: 'Metformin', dosage: '500mg', stock: 50, price: 15000, expiryDate: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString() },
    { _id: '3', name: 'Amoxicillin 500mg', dosage: '500mg', stock: 0, price: 8500, expiryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString() },
    { _id: '4', name: 'Lisinopril 10mg', dosage: '10mg', stock: 15, price: 12000, expiryDate: new Date(Date.now() + 200 * 24 * 60 * 60 * 1000).toISOString() },
    { _id: '5', name: 'Paracetamol', dosage: '500mg', stock: 500, price: 1500, expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() },
    { _id: '6', name: 'Omeprazole', dosage: '20mg', stock: 8, price: 3200, expiryDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString() },
  ];

  const MOCK_VENDORS = [
    { _id: 'v1', name: 'MedSupply Co.', email: 'contact@medsupply.com' },
    { _id: 'v2', name: 'Pharma Distributors', email: 'info@pharmadist.com' },
  ];

  const MOCK_ORDERS = [
    { _id: 'ord001abc', userId: { name: 'Jessica Brown' }, totalAmount: 6520, status: 'PENDING', orderDate: new Date() },
    { _id: 'ord002def', userId: { name: 'David Wilson' }, totalAmount: 875, status: 'DELIVERED', orderDate: new Date(Date.now() - 86400000) },
    { _id: 'ord003ghi', userId: { name: 'Emily Davis' }, totalAmount: 12000, status: 'SHIPPED', orderDate: new Date(Date.now() - 172800000) },
    { _id: 'ord004jkl', userId: { name: 'Michael Chen' }, totalAmount: 2500, status: 'CONFIRMED', orderDate: new Date(Date.now() - 259200000) },
  ];

  const fetchData = useCallback(async () => {
    try {
      const [medsRes, ordersRes, vendorsRes] = await Promise.all([
        getMedicines().catch(() => ({ data: null })),
        getAllOrders().catch(() => ({ data: null })),
        getVendors().catch(() => ({ data: null })),
      ]);

      const meds = medsRes?.data?.success ? medsRes.data.medicines : MOCK_MEDS;
      const ords = ordersRes?.data?.success ? ordersRes.data.history || ordersRes.data.orders : MOCK_ORDERS;
      const vends = vendorsRes?.data?.success ? vendorsRes.data.vendors : MOCK_VENDORS;

      setMedicines(meds);
      setOrders(ords);
      setVendors(vends);
      return { meds, ords, vends };
    } catch (e) {
      setMedicines(MOCK_MEDS);
      setOrders(MOCK_ORDERS);
      setVendors(MOCK_VENDORS);
      return { meds: MOCK_MEDS, ords: MOCK_ORDERS, vends: MOCK_VENDORS };
    }
  }, []);

  const runAgentAnalysis = useCallback(async () => {
    const { meds, ords, vends } = await fetchData();
    const newAlerts = [];
    const demandTrends = [];
    const refillRisks = [];

    meds.forEach(med => {
      const dailyDemand = calculateDailyConsumption(ords, med._id, 30) || MOCK_DAILY_DOSAGE.default;
      const depletionDate = calculateDepletionDate(med.stock, dailyDemand);
      const daysUntilDepletion = depletionDate
        ? Math.ceil((depletionDate - new Date()) / (1000 * 60 * 60 * 24))
        : med.stock === 0 ? 0 : 999;
      const riskScore = calculateStockoutRisk(med.stock, dailyDemand, daysUntilDepletion);
      const priority = getAlertPriority(riskScore, daysUntilDepletion, med.stock);
      const reorderQty = calculateOptimalReorderQty(dailyDemand, 7, 1.5);

      demandTrends.push({
        medicineId: med._id,
        name: med.name,
        dailyDemand: Math.round(dailyDemand * 10) / 10,
        trend: 'stable',
      });

      if (med.stock < (med.lowStockThreshold || 20) || riskScore >= 50) {
        refillRisks.push({
          medicineId: med._id,
          name: med.name,
          currentStock: med.stock,
          riskScore,
          daysUntilDepletion,
          reorderQty,
          priority,
        });

        const alert = {
          id: `alert-${med._id}-${Date.now()}`,
          type: 'REFILL',
          priority,
          medicineId: med._id,
          medicineName: med.name,
          message: med.stock === 0
            ? `${med.name} is OUT OF STOCK`
            : `${med.name}: ${med.stock} units left, ~${daysUntilDepletion} days until depletion`,
          currentStock: med.stock,
          daysUntilDepletion,
          riskScore,
          reorderQty,
          timestamp: new Date(),
        };
        newAlerts.push(alert);
      }
    });

    const expiring = getExpiringMedicines(meds, 90);
    const slowMoving = getSlowMovingMedicines(meds, ords, 60);
    const health = calculateSystemHealth(meds, newAlerts, expiring.length);

    const adherenceInsights = [];
    meds.slice(0, 5).forEach(med => {
      const anomalies = detectAdherenceAnomalies(ords, 2, med._id);
      if (anomalies.length) adherenceInsights.push({ medicine: med.name, ...anomalies[0] });
    });

    setInsights(prev => ({
      ...prev,
      demandTrends,
      refillRisks,
      expiringSoon: expiring,
      slowMoving,
      adherenceInsights,
      systemHealth: health,
    }));

    const criticalHigh = newAlerts.filter(a =>
      a.priority === ALERT_PRIORITY.CRITICAL || a.priority === ALERT_PRIORITY.HIGH
    );
    const moderateLow = newAlerts.filter(a =>
      a.priority === ALERT_PRIORITY.MODERATE || a.priority === ALERT_PRIORITY.LOW
    );

    setAlerts(criticalHigh);
    setBatchedAlerts(prev => [...prev, ...moderateLow].slice(-20));
  }, [fetchData]);

  useEffect(() => {
    if (!isMonitoring) return;
    runAgentAnalysis();
    const interval = setInterval(runAgentAnalysis, 60000);
    return () => clearInterval(interval);
  }, [isMonitoring, runAgentAnalysis]);

  const getRefillNeededItems = useCallback(() => {
    return insights.refillRisks.map(r => {
      const med = medicines.find(m => m._id === r.medicineId);
      return {
        ...med,
        ...r,
        reorderQty: r.reorderQty || 100,
      };
    });
  }, [insights.refillRisks, medicines]);

  const getPurchaseSummary = useCallback(() => {
    const items = getRefillNeededItems();
    return generatePurchaseSummary(items, vendors);
  }, [getRefillNeededItems, vendors]);

  const value = {
    medicines,
    orders,
    vendors,
    alerts,
    batchedAlerts,
    insights,
    lastReportTime,
    isMonitoring,
    fetchData,
    runAgentAnalysis,
    getRefillNeededItems,
    getPurchaseSummary,
    setLastReportTime,
    setIsMonitoring,
    ALERT_PRIORITY,
    SYSTEM_HEALTH,
  };

  return (
    <AgentContext.Provider value={value}>
      {children}
    </AgentContext.Provider>
  );
}

export const useAgent = () => useContext(AgentContext);

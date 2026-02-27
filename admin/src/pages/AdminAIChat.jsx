import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, BarChart, Calendar, Package, AlertTriangle, TrendingUp, RefreshCw, FileText, ChevronRight, ShoppingBag, Download, Volume2, ArrowRight, PieChart } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { LineChart, Line, BarChart as ReBarChart, Bar, PieChart as RePieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const quickActions = [
    { label: 'Monthly Report', icon: FileText, color: '#3b82f6' },
    { label: 'Yearly Report', icon: Calendar, color: '#8b5cf6' },
    { label: 'Recent Orders', icon: ShoppingBag, color: '#10b981' },
    { label: 'Profit Analysis', icon: TrendingUp, color: '#f59e0b' },
    { label: 'Low Stock', icon: AlertTriangle, color: '#ef4444' },
    { label: 'Top Selling Medicines', icon: BarChart, color: '#3b82f6' },
    { label: 'Order Low Stock Medicines', icon: ShoppingBag, color: '#10b981' },
];

export default function AdminAIChat() {
    const navigate = useNavigate();
    const [messages, setMessages] = useState([
        {
            role: 'agent',
            content: "Hello Admin! I am AI Chat – Pharmacy Admin Intelligence. I'm here to analyze your pharmacy data and provide business-focused insights.\n\nHow can I help you today? You can ask for reports, analyze profits, or check inventory status.",
            time: new Date(),
            type: 'text'
        }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const messagesEndRef = useRef(null);
    const reportRefs = useRef({});

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async (text) => {
        const messageText = text || input;
        if (!messageText.trim() || loading) return;

        const userMessage = {
            role: 'user',
            content: messageText,
            time: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setLoading(true);

        try {
            const token = localStorage.getItem('token');
            const res = await axios.post(`${API_URL}/admin/ai-chat`,
                { message: messageText },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            const agentMessage = {
                role: 'agent',
                content: res.data.content || '',
                data: res.data.data || null,
                time: new Date(),
                type: res.data.type || 'text'
            };

            setMessages(prev => [...prev, agentMessage]);
        } catch (error) {
            console.error('AI Chat Error:', error);
            toast.error('Failed to get response from AI');
            setMessages(prev => [...prev, {
                role: 'agent',
                content: "I'm sorry, I encountered an error while processing your request. Please try again or check your connection.",
                time: new Date(),
                type: 'text'
            }]);
        } finally {
            setLoading(false);
        }
    };

    const downloadAsPDF = async (messageId) => {
        const element = reportRefs.current[messageId];
        if (!element) return;

        try {
            // Apply a temporary white background class for the snapshot
            element.classList.add('pdf-render-mode');

            const canvas = await html2canvas(element, {
                scale: 3,
                backgroundColor: '#ffffff',
                logging: false,
                useCORS: true
            });

            element.classList.remove('pdf-render-mode');

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const imgProps = pdf.getImageProperties(imgData);
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`Pharmacy_Report_${new Date().getTime()}.pdf`);
            toast.success('Report downloaded successfully!');
        } catch (error) {
            console.error('PDF Error:', error);
            toast.error('Failed to generate PDF');
        }
    };

    // speak functionality removed per USER_REQUEST

    const renderChart = (data) => {
        if (!data) return null;

        const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
        const chartData = data.labels.map((label, index) => ({
            name: label,
            value: data.datasets[0].data[index]
        }));

        return (
            <div className="ai-chart-wrapper">
                <h4>{data.chartTitle}</h4>
                <div style={{ width: '100%', height: 250 }}>
                    <ResponsiveContainer>
                        {data.chartType === 'Bar Chart' ? (
                            <ReBarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#2a3448" />
                                <XAxis dataKey="name" stroke="#8b95a8" fontSize={12} />
                                <YAxis stroke="#8b95a8" fontSize={12} />
                                <Tooltip contentStyle={{ background: '#1c2333', border: '1px solid #2a3448' }} />
                                <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} />
                            </ReBarChart>
                        ) : data.chartType === 'Line Chart' ? (
                            <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#2a3448" />
                                <XAxis dataKey="name" stroke="#8b95a8" fontSize={12} />
                                <YAxis stroke="#8b95a8" fontSize={12} />
                                <Tooltip contentStyle={{ background: '#1c2333', border: '1px solid #2a3448' }} />
                                <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} />
                            </LineChart>
                        ) : data.chartType === 'Area Chart' ? (
                            <AreaChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#2a3448" />
                                <XAxis dataKey="name" stroke="#8b95a8" fontSize={12} />
                                <YAxis stroke="#8b95a8" fontSize={12} />
                                <Tooltip contentStyle={{ background: '#1c2333', border: '1px solid #2a3448' }} />
                                <Area type="monotone" dataKey="value" stroke="#8b5cf6" fill="#8b5cf620" />
                            </AreaChart>
                        ) : (
                            <RePieChart>
                                <Pie
                                    data={chartData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ background: '#1c2333', border: '1px solid #2a3448' }} />
                            </RePieChart>
                        )}
                    </ResponsiveContainer>
                </div>
                {data.insights && (
                    <div className="chart-insights">
                        <h5>AI Analytics:</h5>
                        {renderContent(data.insights)}
                    </div>
                )}
            </div>
        );
    };

    const renderContent = (content) => {
        if (!content) return null;

        return content.split('\n').map((line, i) => {
            let styledLine = line;

            // Header 1 (#)
            if (line.startsWith('# ')) {
                return <h1 key={i} className="ai-report-h1">{line.replace('# ', '')}</h1>;
            }

            // Header 2 (##)
            if (line.startsWith('## ')) {
                return <h2 key={i} className="ai-report-h2">{line.replace('## ', '')}</h2>;
            }

            // Header 3 (###)
            if (line.startsWith('### ')) {
                return <h3 key={i} className="ai-report-h3">{line.replace('### ', '')}</h3>;
            }

            // Bullet points (• or -)
            if (line.startsWith('• ') || line.startsWith('- ')) {
                const text = line.replace(/^[•-]\s+/, '');
                const boldRegex = /\*\*(.*?)\*\*/g;
                const parts = text.split(boldRegex);

                return (
                    <div key={i} className="ai-list-item">
                        <span className="ai-bullet">•</span>
                        <p className="ai-p">
                            {parts.map((part, index) => (
                                index % 2 === 1 ? <strong key={index}>{part}</strong> : part
                            ))}
                        </p>
                    </div>
                );
            }

            // Bold
            const boldRegex = /\*\*(.*?)\*\*/g;
            const parts = line.split(boldRegex);

            return (
                <p key={i} className="ai-p">
                    {parts.map((part, index) => (
                        index % 2 === 1 ? <strong key={index}>{part}</strong> : part
                    ))}
                </p>
            );
        });
    };

    return (
        <div className={`ai-chat-page ${isFullScreen ? 'full-screen-mode' : ''}`}>
            {!isFullScreen && (
                <div className="page-header">
                    <div className="header-info">
                        <h1>Pharmacy Admin Intelligence</h1>
                        <p>Real-time data analysis and business-focused decision support</p>
                    </div>
                    <div className="header-status">
                        <div className="status-dot online"></div>
                        <span>AI Assistant Online</span>
                    </div>
                </div>
            )}

            <div className="ai-chat-layout full-width">
                <div className="ai-chat-main">
                    <div className="chat-toggle-bar" onClick={() => setIsFullScreen(!isFullScreen)}>
                        <Bot size={18} />
                        <span>{isFullScreen ? "Exit Full Screen" : "Click here for Full Screen AI Chat"}</span>
                        <div className="toggle-indicator">
                            {isFullScreen ? "Minimize" : "Maximize"}
                        </div>
                    </div>
                    <div className="chat-messages-container">
                        {messages.map((msg, i) => (
                            <div key={i} className={`ai-message-wrapper ${msg.role}`}>
                                <div className={`ai-avatar ${msg.role}`}>
                                    {msg.role === 'agent' ? <Bot size={20} /> : <User size={20} />}
                                </div>
                                <div className="ai-message-container">
                                    <div
                                        className="ai-message-bubble"
                                        ref={el => reportRefs.current[i] = el}
                                    >
                                        <div className="ai-message-content">
                                            {msg.type === 'chart' ? renderChart(msg.data) : renderContent(msg.content)}
                                        </div>
                                        <div className="ai-message-time">
                                            {msg.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>

                                    {msg.role === 'agent' && ['report', 'chart', 'prediction', 'analysis', 'list', 'restock'].includes(msg.type) && (
                                        <div className="message-actions">
                                            {msg.type !== 'restock' && (
                                                <button onClick={() => downloadAsPDF(i)} title="Download Report">
                                                    <Download size={14} /> <span>PDF Download</span>
                                                </button>
                                            )}
                                            {msg.type === 'restock' && (
                                                <button onClick={() => navigate('/manage-vendors', { state: { tab: 'ai-restock' } })} className="action-link">
                                                    <span>Go to Smart Restock</span> <ArrowRight size={14} />
                                                </button>
                                            )}
                                            {msg.content?.toLowerCase().includes('low stock') && msg.type !== 'restock' && (
                                                <button onClick={() => navigate('/inventory')} className="action-link">
                                                    <span>View Inventory</span> <ArrowRight size={14} />
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div className="ai-message-wrapper agent">
                                <div className="ai-avatar agent"><Bot size={20} /></div>
                                <div className="ai-message-bubble loading">
                                    <div className="typing-dots">
                                        <span></span><span></span><span></span>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <div className="ai-input-wrapper">
                        <div className="quick-actions-bar">
                            {quickActions.map((action, i) => (
                                <button
                                    key={i}
                                    className="quick-action-btn"
                                    onClick={() => {
                                        if (action.label === 'Order Low Stock Medicines') {
                                            navigate('/manage-vendors', { state: { tab: 'ai-restock' } });
                                        } else {
                                            handleSend(action.label);
                                        }
                                    }}
                                    style={{ '--btn-color': action.color }}
                                >
                                    <action.icon size={14} />
                                    <span>{action.label}</span>
                                </button>
                            ))}
                        </div>
                        <div className="input-field-container">
                            <input
                                type="text"
                                placeholder="Ask for monthly report, profit analysis, or low stock..."
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                disabled={loading}
                            />
                            <button
                                className="ai-send-btn"
                                onClick={() => handleSend()}
                                disabled={!input.trim() || loading}
                            >
                                {loading ? <RefreshCw className="spin" size={20} /> : <Send size={20} />}
                            </button>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}

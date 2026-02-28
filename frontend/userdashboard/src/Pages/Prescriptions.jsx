import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Upload, FileText, CheckCircle2, AlertCircle,
    Loader2, Sparkles, Clock, History, Search,
    Eye, Calendar, ArrowRight, ShieldCheck, Trash2,
    FileSearch, AlertTriangle, RefreshCw, X
} from 'lucide-react';
import { Card, Button, Badge, Toast } from '../Component/UI';
import { medicineAPI, prescriptionAPI, stockAlertAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const PrescriptionsPage = () => {
    const { user } = useAuth();
    const { theme } = useTheme();

    const [prescriptions, setPrescriptions] = useState([]);
    const [medicines, setMedicines] = useState([]);
    const [selectedMedicine, setSelectedMedicine] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [file, setFile] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const [showToast, setShowToast] = useState(false);
    const [toastMsg, setToastMsg] = useState('');
    const [toastType, setToastType] = useState('success');

    const fetchPrescriptions = async () => {
        try {
            const { data } = await prescriptionAPI.getMy();
            setPrescriptions(data);
        } catch (err) {
            console.error("Failed to fetch prescriptions:", err);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchMedicines = async () => {
        try {
            const { data } = await medicineAPI.getAll();
            setMedicines(data);
        } catch (err) {
            console.error("Failed to fetch medicines:", err);
        }
    };

    useEffect(() => {
        fetchPrescriptions();
        fetchMedicines();
    }, []);

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!selectedMedicine || !file) {
            setToastMsg("Please search/select a medicine and attach a file.");
            setToastType('error');
            setShowToast(true);
            return;
        }

        setIsUploading(true);
        const formData = new FormData();
        formData.append('userId', user.id);
        formData.append('medicineId', selectedMedicine._id);
        formData.append('prescription', file);

        try {
            await prescriptionAPI.upload(formData);
            setToastMsg("Upload successful. Clinical verification started.");
            setToastType('success');
            setShowToast(true);
            setFile(null);
            setSelectedMedicine(null);
            setSearchTerm('');
            fetchPrescriptions();
        } catch (err) {
            setToastMsg(err.response?.data?.error || "Upload failed");
            setToastType('error');
            setShowToast(true);
        } finally {
            setIsUploading(false);
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'VERIFIED': return <Badge variant="success">Verified</Badge>;
            case 'REJECTED': return <Badge variant="error">Rejected</Badge>;
            case 'PENDING_ADMIN_REVIEW': return <Badge variant="warning">Reviewing</Badge>;
            case 'UPLOADED': return <Badge variant="info">Scanning...</Badge>;
            default: return <Badge variant="info">Processing</Badge>;
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Remove this prescription record?")) return;
        try {
            await prescriptionAPI.delete(id);
            setToastMsg("Record removed");
            setToastType('success');
            setShowToast(true);
            fetchPrescriptions();
        } catch (err) {
            setToastMsg(err.response?.data?.error || "Delete failed");
            setToastType('error');
            setShowToast(true);
        }
    };

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-10">
            {/* Minimal Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-black tracking-tight text-brand-text-primary">Clinical Verification</h2>
                    <p className="text-sm font-medium opacity-40 text-brand-text-secondary uppercase tracking-widest mt-1">AI-Powered Prescription Portal</p>
                </div>
                <button
                    onClick={fetchPrescriptions}
                    className="p-3 bg-brand-card border border-brand-border-color rounded-xl text-brand-text-secondary hover:text-brand-primary transition-all active:scale-95 shadow-sm"
                >
                    <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
                </button>
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
                {/* 1. Upload Portal */}
                <div className="lg:col-span-1">
                    <Card className="sticky top-28 overflow-hidden bg-brand-card/50 backdrop-blur-md border hover:border-brand-primary/20 transition-all duration-500 shadow-xl shadow-brand-primary/5">
                        <div className="flex items-center space-x-3 mb-6">
                            <div className="p-2.5 bg-brand-primary/10 rounded-xl text-brand-primary">
                                <Upload size={18} />
                            </div>
                            <h3 className="font-black text-[10px] uppercase tracking-[0.2em] opacity-60">Rapid Upload Portal</h3>
                        </div>

                        <form onSubmit={handleUpload} className="space-y-6">
                            <div className="space-y-2 relative">
                                <label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-1">Search Medication</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="Type medicine name..."
                                        value={selectedMedicine ? selectedMedicine.name : searchTerm}
                                        onChange={(e) => {
                                            setSearchTerm(e.target.value);
                                            setSelectedMedicine(null);
                                            setIsDropdownOpen(true);
                                        }}
                                        onFocus={() => setIsDropdownOpen(true)}
                                        className="w-full bg-brand-background border border-brand-border-color rounded-xl px-4 py-3.5 text-sm font-bold text-brand-text-primary outline-none focus:border-brand-primary/50 transition-all shadow-inner"
                                    />
                                    {selectedMedicine && (
                                        <button
                                            type="button"
                                            onClick={() => { setSelectedMedicine(null); setSearchTerm(''); }}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-brand-hover-tint rounded-lg text-rose-500"
                                        >
                                            <X size={14} />
                                        </button>
                                    )}
                                </div>

                                {/* Custom Autocomplete Dropdown */}
                                <AnimatePresence>
                                    {isDropdownOpen && !selectedMedicine && searchTerm.length > 0 && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            className="absolute z-50 w-full mt-2 bg-brand-card border border-brand-border-color rounded-2xl shadow-2xl max-h-60 overflow-y-auto backdrop-blur-xl"
                                        >
                                            {medicines.filter(m => m.name.toLowerCase().includes(searchTerm.toLowerCase())).length > 0 ? (
                                                medicines
                                                    .filter(m => m.name.toLowerCase().includes(searchTerm.toLowerCase()))
                                                    .map(m => (
                                                        <button
                                                            key={m._id}
                                                            type="button"
                                                            onClick={() => {
                                                                if (m.stock > 0) {
                                                                    setSelectedMedicine(m);
                                                                    setIsDropdownOpen(false);
                                                                }
                                                            }}
                                                            className={`w-full text-left px-4 py-3 hover:bg-brand-primary/10 transition-colors flex items-center justify-between group ${m.stock === 0 ? 'cursor-default opacity-80' : ''}`}
                                                        >
                                                            <div className="flex flex-col">
                                                                <span className="text-sm font-bold text-brand-text-primary">{m.name}</span>
                                                                <div className="flex items-center space-x-2">
                                                                    <span className="text-[10px] opacity-40 uppercase font-black">{m.category || m.unitType}</span>
                                                                    {m.stock === 0 && (
                                                                        <span className="text-[9px] font-black text-rose-500 uppercase tracking-tighter bg-rose-500/10 px-1.5 py-0.5 rounded">Out of Stock</span>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {m.stock > 0 ? (
                                                                <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all text-brand-primary" />
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    onClick={async (e) => {
                                                                        e.stopPropagation();
                                                                        try {
                                                                            const { data } = await stockAlertAPI.subscribe(m._id);
                                                                            setToastMsg(data.message);
                                                                            setToastType('success');
                                                                            setShowToast(true);
                                                                        } catch (err) {
                                                                            setToastMsg(err.response?.data?.error || "Subscription failed");
                                                                            setToastType('error');
                                                                            setShowToast(true);
                                                                        }
                                                                    }}
                                                                    className="px-3 py-1.5 bg-brand-primary text-white text-[9px] font-black uppercase tracking-widest rounded-lg hover:bg-brand-secondary transition-all shadow-sm shadow-brand-primary/20"
                                                                >
                                                                    Notify Me
                                                                </button>
                                                            )}
                                                        </button>
                                                    ))
                                            ) : (
                                                <div className="p-4 text-center text-[10px] font-black uppercase opacity-20 tracking-widest">
                                                    No medicines matched
                                                </div>
                                            )}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-1">Document Source</label>
                                <label className="group block cursor-pointer">
                                    <input type="file" onChange={(e) => setFile(e.target.files[0])} className="hidden" accept="image/*,.pdf" />
                                    <div className={`
                                        w-full h-32 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center p-4 transition-all duration-300
                                        ${file ? 'border-brand-primary bg-brand-primary/5 shadow-inner' : 'border-brand-border-color hover:border-brand-primary/30'}
                                    `}>
                                        <FileText size={20} className={file ? 'text-brand-primary animate-bounce' : 'opacity-20'} />
                                        <span className="text-[10px] font-black uppercase tracking-widest mt-2 truncate w-full text-center">
                                            {file ? file.name : 'Attach Prescription'}
                                        </span>
                                    </div>
                                </label>
                            </div>

                            <Button
                                type="submit"
                                className="w-full py-4 uppercase tracking-[0.2em] text-[10px] shadow-lg shadow-brand-primary/20"
                                disabled={isUploading || !file}
                                loading={isUploading}
                            >
                                Start Autonomous Scan
                            </Button>
                        </form>
                    </Card>
                </div>

                {/* 2. Verification History */}
                <div className="lg:col-span-2 space-y-4">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 space-y-4">
                            <Loader2 className="animate-spin text-brand-primary opacity-20" size={32} />
                            <p className="text-[10px] font-black uppercase tracking-widest opacity-20 italic">Synchronizing clinical data...</p>
                        </div>
                    ) : prescriptions.length === 0 ? (
                        <Card className="flex flex-col items-center justify-center py-24 text-center border-dashed bg-brand-hover-tint/10">
                            <div className="w-16 h-16 bg-brand-hover-tint rounded-2xl flex items-center justify-center mb-4 opacity-30">
                                <FileSearch size={32} />
                            </div>
                            <h4 className="font-bold text-lg mb-1 opacity-60">No Clinical Records Found</h4>
                            <p className="text-sm opacity-30 max-w-xs mx-auto">Upload your document to the left to begin autonomous safety verification.</p>
                        </Card>
                    ) : (
                        <div className="space-y-4">
                            <AnimatePresence mode="popLayout">
                                {prescriptions.map((presc) => (
                                    <motion.div
                                        key={presc._id}
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        layout
                                    >
                                        <Card className="p-5 flex items-center gap-6 relative overflow-hidden group hover:border-brand-primary/30 transition-all duration-300 shadow-sm hover:shadow-xl">
                                            {/* Media Preview */}
                                            <div className="w-16 h-16 rounded-2xl overflow-hidden bg-brand-background flex-shrink-0 border border-brand-border-color p-1">
                                                <img
                                                    src={`http://localhost:5000${presc.imageUrl}`}
                                                    className="w-full h-full object-cover rounded-xl opacity-80 group-hover:opacity-100 transition-opacity"
                                                />
                                            </div>

                                            {/* Identity & Status */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex flex-col">
                                                        <h4 className="font-black text-base truncate flex items-center">
                                                            {presc.medicineId?.name || 'Medication'}
                                                            {presc.status === 'VERIFIED' && <CheckCircle2 size={14} className="ml-2 text-emerald-500" />}
                                                        </h4>
                                                        <span className="text-[10px] font-bold opacity-30 uppercase flex items-center mt-0.5">
                                                            Uploaded {new Date(presc.createdAt).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                    {getStatusBadge(presc.status)}
                                                </div>

                                                {/* LIVE ANALYTICS SUITE */}
                                                <div className="flex flex-wrap items-center gap-2 mt-4">
                                                    <div className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-tighter border transition-all ${presc.extractedData?.confidence > 0 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-brand-hover-tint border-brand-border-color opacity-30'}`}>
                                                        <Sparkles size={10} /> <span>Extraction</span>
                                                    </div>
                                                    <div className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-tighter border transition-all ${presc.extractedData?.detectedMedicines?.length > 0 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-brand-hover-tint border-brand-border-color opacity-30'}`}>
                                                        <Search size={10} /> <span>Match</span>
                                                    </div>
                                                    <div className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-tighter border transition-all ${presc.extractedData?.validationNotes?.includes('out of stock') ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' : (presc.extractedData?.confidence > 0 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-brand-hover-tint border-brand-border-color opacity-30')}`}>
                                                        <CheckCircle2 size={10} /> <span>Stock Check</span>
                                                    </div>
                                                    <div className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-tighter border transition-all ${presc.extractedData?.validationNotes?.includes('OTC') ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' : (presc.extractedData?.confidence > 0 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-brand-hover-tint border-brand-border-color opacity-30')}`}>
                                                        <ShieldCheck size={10} /> <span>Tag Verify</span>
                                                    </div>
                                                </div>

                                                {/* CLINICAL NOTES */}
                                                {presc.extractedData?.validationNotes && presc.status !== 'VERIFIED' && (
                                                    <p className="text-[9px] font-bold text-amber-500 mt-3 italic leading-tight flex items-center bg-amber-500/5 p-2 rounded-lg border border-amber-500/10">
                                                        <AlertTriangle size={12} className="mr-2 flex-shrink-0" />
                                                        {presc.extractedData.validationNotes}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Actions */}
                                            <div className="flex flex-col gap-2">
                                                <a
                                                    href={`http://localhost:5000${presc.imageUrl}`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="p-3 bg-brand-hover-tint text-brand-text-secondary rounded-xl hover:text-brand-primary transition-all hover:bg-brand-primary/10"
                                                    title="View Original"
                                                >
                                                    <Eye size={16} />
                                                </a>
                                                <button
                                                    onClick={() => handleDelete(presc._id)}
                                                    className="p-3 bg-brand-hover-tint text-rose-500 rounded-xl hover:bg-rose-500/10 transition-all"
                                                    title="Delete Record"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </Card>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    )}
                </div>
            </div>

            <Toast
                message={toastMsg}
                visible={showToast}
                type={toastType}
                onClose={() => setShowToast(false)}
            />
        </div>
    );
};

export default PrescriptionsPage;

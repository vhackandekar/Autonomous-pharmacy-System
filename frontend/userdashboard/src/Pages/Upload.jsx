import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Card, Button, Badge } from '../Component/UI';
import { medicineAPI, prescriptionAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const UploadPage = () => {
  const { user } = useAuth();
  const [medicines, setMedicines] = useState([]);
  const [selectedMedicine, setSelectedMedicine] = useState('');
  const [issuedBy, setIssuedBy] = useState('');
  const [validTill, setValidTill] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null); // 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const fetchMedicines = async () => {
      try {
        const { data } = await medicineAPI.getAll();
        setMedicines(data);
      } catch (err) {
        console.error("Failed to fetch medicines:", err);
      }
    };
    fetchMedicines();
  }, []);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedMedicine || !file || !issuedBy || !validTill) {
      setErrorMsg("Please fill all fields and select a file.");
      setStatus('error');
      return;
    }

    // Issued By: min 3 chars
    if (issuedBy.trim().length < 3) {
      setErrorMsg("Issued By (Doctor/Hospital) must be at least 3 characters long.");
      setStatus('error');
      return;
    }

    // Date check: must be in the future
    const pickedDate = new Date(validTill);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (pickedDate <= today) {
      setErrorMsg("Prescription validity must be a future date.");
      setStatus('error');
      return;
    }

    // File type check
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setErrorMsg("Invalid file type. Please upload a JPG, PNG, WEBP image or a PDF document.");
      setStatus('error');
      return;
    }

    setLoading(true);
    setStatus(null);

    const formData = new FormData();
    formData.append('userId', user.id);
    formData.append('medicineId', selectedMedicine);
    formData.append('issuedBy', issuedBy);
    formData.append('validTill', validTill);
    formData.append('prescription', file);

    try {
      await prescriptionAPI.upload(formData);
      setStatus('success');
      // Reset form
      setSelectedMedicine('');
      setIssuedBy('');
      setValidTill('');
      setFile(null);
    } catch (err) {
      console.error("Upload failed:", err);
      setErrorMsg(err.response?.data?.error || "Upload failed. Please try again.");
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-10">
        <h2 className="text-3xl font-black tracking-tight mb-2">Prescription Portal</h2>
        <p className="text-sm opacity-60 font-medium">Verify your medical documents for AI-assisted pharmaceutical care.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Helper Column */}
        <div className="hidden lg:block space-y-6">
          <Card className="bg-brand-primary/5 border-brand-primary/20">
            <Sparkles className="text-brand-primary mb-3" size={24} />
            <h4 className="font-bold text-sm mb-2">AI Document Analysis</h4>
            <p className="text-[11px] opacity-60 leading-relaxed">Our AI models will scan your prescription for authenticity and dosage accuracy before processing any orders.</p>
          </Card>
          <Card className="bg-slate-900/50 border-white/5">
            <FileText className="text-slate-400 mb-3" size={24} />
            <h4 className="font-bold text-sm mb-2">Data Privacy</h4>
            <p className="text-[11px] opacity-60 leading-relaxed">Medical documents are encrypted and stored securely according to healthcare regulations.</p>
          </Card>
        </div>

        {/* Upload Form Column */}
        <div className="lg:col-span-2">
          <Card className="p-8 border-white/5 shadow-2xl relative overflow-hidden">
            {/* Success/Error Notifications */}
            {status && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex items-center space-x-3 p-4 rounded-xl mb-6 ${status === 'success' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                  }`}
              >
                {status === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                <p className="text-xs font-bold">{status === 'success' ? 'Prescription uploaded successfully!' : errorMsg}</p>
              </motion.div>
            )}

            <form onSubmit={handleUpload} className="space-y-6">
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Medicine Select */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-brand-text-secondary/60 ml-1">Relates to Medicine</label>
                    <select
                      value={selectedMedicine}
                      onChange={(e) => setSelectedMedicine(e.target.value)}
                      className="w-full bg-brand-background border border-white/5 rounded-xl px-4 py-3 text-sm text-brand-text-primary focus:border-brand-primary/50 outline-none transition-all appearance-none cursor-pointer"
                    >
                      <option value="">Select Medicine...</option>
                      {medicines.map(m => (
                        <option key={m._id} value={m._id}>{m.name} ({m.dosage})</option>
                      ))}
                    </select>
                  </div>

                  {/* Issued By */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-brand-text-secondary/60 ml-1">Issued By (Doctor/Hospital)</label>
                    <input
                      type="text"
                      value={issuedBy}
                      onChange={(e) => setIssuedBy(e.target.value)}
                      placeholder="Dr. Smith / Apollo Clinic"
                      className="w-full bg-brand-background border border-white/5 rounded-xl px-4 py-3 text-sm text-brand-text-primary focus:border-brand-primary/50 outline-none transition-all placeholder:text-brand-text-secondary/10"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Validity Date */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-brand-text-secondary/60 ml-1">Valid Until</label>
                    <input
                      type="date"
                      value={validTill}
                      onChange={(e) => setValidTill(e.target.value)}
                      className="w-full bg-brand-background border border-white/5 rounded-xl px-4 py-3 text-sm text-brand-text-primary focus:border-brand-primary/50 outline-none transition-all [color-scheme:dark]"
                    />
                  </div>
                </div>

                {/* File Upload Dropzone */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-brand-text-secondary/60 ml-1">Medical Document (Image/PDF)</label>
                  <label className="relative group block">
                    <input
                      type="file"
                      onChange={handleFileChange}
                      className="hidden"
                      accept="image/*,.pdf"
                    />
                    <div className="w-full h-32 bg-brand-background border-2 border-dashed border-white/5 group-hover:border-brand-primary/30 rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer">
                      <div className="p-3 bg-brand-primary/5 rounded-full text-brand-primary group-hover:scale-110 transition-transform mb-2">
                        <Upload size={20} />
                      </div>
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-40">
                        {file ? file.name : 'Click or drag files to upload'}
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                disabled={loading}
                type="submit"
                className="w-full bg-brand-primary hover:bg-brand-secondary text-white font-black py-4 rounded-xl flex items-center justify-center space-x-2 shadow-xl shadow-brand-primary/20 transition-all disabled:opacity-50"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : <span>Start AI Verification</span>}
              </motion.button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
};

// Import Sparkles from lucide-react (missing in current imports)
import { Sparkles } from 'lucide-react';

export default UploadPage;


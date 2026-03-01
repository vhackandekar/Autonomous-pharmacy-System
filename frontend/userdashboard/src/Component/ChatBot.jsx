import React, { useState, useEffect, useRef } from 'react';
import { Send, Mic, Globe, User, Bot, Loader2, MoreVertical, X, Paperclip, FileText, Trash2 } from 'lucide-react';
import { useChat } from '../context/ChatContext';
import api from '../services/api';

const ChatBot = ({ theme = 'dark' }) => {
    const { currentMessages: messages, addMessageToActive, isTyping, uploadFile } = useChat();
    const [inputValue, setInputValue] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [selectedLanguage, setSelectedLanguage] = useState('English');
    const [attachedFile, setAttachedFile] = useState(null);
    const [filePreview, setFilePreview] = useState(null);
    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const mediaRecorder = useRef(null);
    const audioChunks = useRef([]);

    // Auto-scroll to bottom of messages
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isTyping]);

    /**
     * SPEECH-TO-TEXT (STT) INTEGRATION POINT
     * This function serves as the hook for Speech-to-Text API integration.
     * In a production environment, this would initialize the Web Speech API 
     * or a third-party service like Google Cloud Speech-to-Text.
     */
    const startSpeechToText = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder.current = new MediaRecorder(stream);
            audioChunks.current = [];

            mediaRecorder.current.ondataavailable = (event) => {
                audioChunks.current.push(event.data);
            };

            mediaRecorder.current.onstop = async () => {
                const audioBlob = new Blob(audioChunks.current, { type: 'audio/wav' });
                await uploadAudio(audioBlob);
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.current.start();
            setIsListening(true);
        } catch (error) {
            console.error("Microphone access denied:", error);
            alert("Please allow microphone access to use Speech-to-Text.");
        }
    };

    const stopSpeechToText = () => {
        if (mediaRecorder.current && isListening) {
            mediaRecorder.current.stop();
            setIsListening(false);
        }
    };

    const uploadAudio = async (blob) => {
        const formData = new FormData();
        formData.append('language', selectedLanguage);
        formData.append('audio', blob, 'voice.wav');

        try {
            const { data } = await api.post('/agent/stt', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (data.transcript) {
                setInputValue(prev => prev + (prev ? " " : "") + data.transcript);
            }
        } catch (error) {
            console.error("STT Upload Error:", error);
        }
    };

    /**
     * MULTILINGUAL API INTEGRATION POINT
     * This function handles message translation logic.
     * Integration with APIs like Microsoft Translator or Google Translate 
     * should happen here.
     */
    const handleTranslation = (text, targetLang) => {
        console.log(`Translating: "${text}" to ${targetLang}`);
        // Integration point for translation logic
        return text; // Currently returns original text
    };

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            setAttachedFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setFilePreview(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const clearAttachment = () => {
        setAttachedFile(null);
        setFilePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!inputValue.trim() && !attachedFile) return;

        const userText = inputValue;
        const file = attachedFile;

        // Reset inputs immediately for responsive feel
        setInputValue('');
        clearAttachment();

        if (file) {
            // If there's a file, we use the specialized upload logic
            await uploadFile(file, userText);
        } else {
            // Standard text message
            const userMessage = {
                id: Date.now(),
                role: 'user',
                content: userText,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
            addMessageToActive(userMessage, false, selectedLanguage);
        }
    };

    return (
        <div className={`flex flex-col h-full w-full overflow-hidden transition-all duration-500 font-sans relative ${theme === 'dark' ? 'bg-[#0B0A14] text-gray-100' : 'bg-gray-50 text-slate-800'}`}>
            {/* Gradient Background Grids (Dark only) */}
            {theme === 'dark' && (
                <div className="absolute inset-0 z-0">
                    <div className="absolute top-[-10%] left-[-10%] w-[400px] h-[400px] bg-purple-600/10 blur-[120px] rounded-full"></div>
                    <div className="absolute bottom-[-10%] right-[-10%] w-[300px] h-[300px] bg-purple-900/10 blur-[100px] rounded-full"></div>
                </div>
            )}
            {/* Main Chat Container */}
            <div className="flex-1 flex flex-col relative h-full">

                {/* Header Section */}
                <header className={`z-10 px-6 py-4 ${theme === 'dark' ? 'bg-[#141225]/80 backdrop-blur-md border-b border-purple-500/20 shadow-lg shadow-purple-500/5' : 'bg-white border-b border-gray-200 shadow-sm'} flex items-center justify-between`}>
                    <div className="flex items-center space-x-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg ${theme === 'dark' ? 'bg-gradient-to-tr from-purple-600 to-purple-400 shadow-purple-500/20' : 'bg-gradient-to-tr from-[#16A34A] to-[#2563EB] shadow-green-500/10'
                            }`}>
                            <Bot className="text-white" size={24} />
                        </div>
                        <div>
                            <h1 className={`text-xl font-bold bg-clip-text text-transparent ${theme === 'dark'
                                ? 'bg-gradient-to-r from-purple-300 via-purple-100 to-purple-400'
                                : 'bg-gradient-to-r from-green-600 to-blue-600'
                                }`}>
                                AI Pharmacy Assistant
                            </h1>
                            <p className={`text-xs font-medium tracking-wide ${theme === 'dark' ? 'text-purple-400/80' : 'text-gray-400'}`}>
                                Your Intelligent Healthcare Companion
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center space-x-3">
                        <div className={`hidden md:flex items-center space-x-2 px-3 py-1.5 rounded-lg border ${theme === 'dark' ? 'bg-[#1B1730] border-purple-500/10' : 'bg-blue-50/50 border-blue-100/50'
                            }`}>
                            <div className={`w-2 h-2 rounded-full animate-pulse ${theme === 'dark' ? 'bg-green-500' : 'bg-blue-500'}`}></div>
                            <span className={`text-[10px] uppercase font-bold tracking-widest ${theme === 'dark' ? 'text-purple-300/60' : 'text-blue-600/60'}`}>Secure Core Active</span>
                            <span className="mx-2 opacity-20 text-white">|</span>
                            <span className={`text-[10px] uppercase font-black tracking-tighter ${theme === 'dark' ? 'text-brand-primary' : 'text-blue-600'}`}>{selectedLanguage}</span>
                        </div>
                        <button className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-purple-500/10 text-purple-400' : 'hover:bg-gray-100 text-gray-400'}`}>
                            <MoreVertical size={20} />
                        </button>
                    </div>
                </header>

                {/* Chat Messages Area */}
                <main className={`flex-1 overflow-y-auto p-4 md:p-6 space-y-6 ${theme === 'dark' ? 'scrollbar-thin scrollbar-thumb-purple-500/20' : 'scrollbar-thin scrollbar-thumb-gray-200'} scrollbar-track-transparent`}>
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-500`}>
                            <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] rounded-2xl p-4 transition-all duration-300 ${msg.role === 'user'
                                    ? 'bg-gradient-to-br from-[#2563EB] to-[#16A34A] text-white ml-auto shadow-lg shadow-blue-500/10'
                                    : theme === 'dark'
                                        ? 'bg-[#1C1A2E] border border-purple-500/10 text-purple-50'
                                        : 'bg-white border border-purple-100 text-slate-800 shadow-md shadow-gray-100'
                                    }`}>
                                    <div className="flex items-center space-x-2 mb-2">
                                        <div className={`p-1 rounded-lg ${msg.role === 'user' ? 'bg-white/20' : theme === 'dark' ? 'bg-purple-500/20' : 'bg-green-50'}`}>
                                            {msg.role === 'user' ? <User size={12} /> : <Bot className={theme === 'dark' ? 'text-purple-400' : 'text-green-600'} size={12} />}
                                        </div>
                                        <span className={`text-[10px] font-black uppercase tracking-widest ${msg.role === 'user' ? 'text-white/60' : theme === 'dark' ? 'text-purple-400/60' : 'text-green-600/60'}`}>
                                            {msg.role === 'user' ? 'User' : 'Pharmacy Core'}
                                        </span>
                                    </div>
                                    <p className="text-sm font-medium leading-relaxed">{msg.content}</p>
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* Typing Indicator */}
                    {isTyping && (
                        <div className="flex justify-start animate-in fade-in duration-300">
                            <div className={`rounded-2xl p-4 flex items-center space-x-3 shadow-sm ${theme === 'dark' ? 'bg-[#1C1A2E] border border-purple-500/10' : 'bg-white border border-blue-50'}`}>
                                <Loader2 className={`w-4 h-4 animate-spin ${theme === 'dark' ? 'text-purple-400' : 'text-blue-500'}`} />
                                <span className={`text-[10px] font-bold uppercase tracking-widest ${theme === 'dark' ? 'text-purple-400/40' : 'text-blue-500/40'}`}>Core Processing...</span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </main>

                {/* Input Section */}
                <footer className={`z-10 p-4 md:p-6 transition-all duration-500 ${theme === 'dark' ? 'bg-[#141225] border-t border-purple-500/20' : 'bg-white border-t border-gray-200'}`}>
                    <div className="max-w-4xl mx-auto">

                        {/* File Preview Area */}
                        {filePreview && (
                            <div className="mb-4 animate-in slide-in-from-bottom-2 duration-300">
                                <div className={`relative inline-block p-2 rounded-2xl border ${theme === 'dark' ? 'bg-[#1B1730] border-purple-500/30' : 'bg-blue-50 border-blue-100'}`}>
                                    <div className="flex items-center space-x-3">
                                        <div className="w-12 h-12 rounded-xl overflow-hidden border border-white/10">
                                            {attachedFile?.type.startsWith('image/') ? (
                                                <img src={filePreview} alt="Preview" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-purple-500/20">
                                                    <FileText className="text-purple-400" size={20} />
                                                </div>
                                            )}
                                        </div>
                                        <div className="pr-8">
                                            <p className={`text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-purple-300/60' : 'text-blue-600/60'}`}>Prescription Attached</p>
                                            <p className="text-xs font-bold truncate max-w-[150px]">{attachedFile?.name}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={clearAttachment}
                                        className="absolute top-1 right-1 p-1 bg-rose-500 text-white rounded-lg shadow-lg hover:scale-110 transition-all"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            </div>
                        )}

                        <form onSubmit={handleSendMessage} className="relative flex items-center space-x-3">
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileSelect}
                                className="hidden"
                                accept="image/*,.pdf"
                            />

                            {/* Multilingual Selector */}
                            <div className="relative group">
                                <button
                                    type="button"
                                    className={`p-3 rounded-xl transition-all flex items-center border ${theme === 'dark' ? 'bg-[#1B1730] border border-purple-500/10 text-purple-400 hover:text-purple-300 hover:border-purple-500/30' : 'bg-gray-50 border-gray-200 text-gray-400 hover:text-blue-600 hover:border-blue-200'}`}
                                    title="Switch Language"
                                >
                                    <Globe size={20} />
                                </button>
                                <div className={`absolute bottom-full left-0 mb-2 invisible group-hover:visible transition-all rounded-lg p-2 min-w-[140px] shadow-2xl z-50 ${theme === 'dark' ? 'bg-[#1B1730] border border-purple-500/20' : 'bg-white border border-gray-200'}`}>
                                    {['English', 'Hindi', 'Marathi', 'Bengali', 'Tamil', 'Telugu', 'Kannada', 'Gujarati', 'Malayalam', 'Punjabi', 'Odia'].map(lang => (
                                        <button
                                            key={lang}
                                            type="button"
                                            onClick={() => setSelectedLanguage(lang)}
                                            className={`w-full text-left px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-colors ${selectedLanguage === lang ? (theme === 'dark' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-blue-100 text-blue-600') : (theme === 'dark' ? 'text-purple-300 hover:bg-purple-500/10' : 'text-slate-700 hover:bg-blue-50')}`}
                                        >
                                            {lang}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Attachment Button */}
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className={`p-3 rounded-xl transition-all flex items-center border ${theme === 'dark' ? 'bg-[#1B1730] border-purple-500/10 text-purple-400 hover:text-purple-300 hover:border-purple-500/30' : 'bg-gray-50 border-gray-200 text-gray-400 hover:text-blue-600 hover:border-blue-200'}`}
                                title="Attach Prescription"
                            >
                                <Paperclip size={20} />
                            </button>

                            {/* Speech-to-Text Button */}
                            <button
                                type="button"
                                onClick={isListening ? stopSpeechToText : startSpeechToText}
                                className={`p-3 border rounded-xl transition-all shadow-sm ${isListening
                                    ? 'bg-red-500/20 border-red-500 text-red-500 animate-pulse outline-double outline-red-500/20'
                                    : theme === 'dark' ? 'bg-[#1B1730] border-purple-500/10 text-purple-400 hover:text-purple-300 hover:border-purple-500/30' : 'bg-white border-blue-50 text-blue-400 hover:text-blue-600 hover:border-blue-200'
                                    }`}
                                title="Speech to Text"
                            >
                                <Mic size={20} />
                            </button>

                            {/* Main Input Container */}
                            <div className="flex-1 relative group">
                                {isListening && (
                                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                                        <span className="text-xs text-red-400/80 font-bold animate-pulse">LISTENING...</span>
                                    </div>
                                )}
                                <input
                                    type="text"
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    placeholder={isListening ? "" : "Ask your healthcare assistant..."}
                                    className={`w-full rounded-xl py-3.5 pl-4 pr-12 border focus:outline-none focus:ring-1 transition-all shadow-inner ${theme === 'dark'
                                        ? 'bg-[#1B1730] text-gray-100 placeholder-purple-400/40 border-purple-500/10 focus:border-purple-500/40 focus:ring-purple-500/20'
                                        : 'bg-gray-100 text-slate-800 placeholder-gray-400 border-gray-200 focus:border-blue-500/40 focus:ring-blue-500/10'
                                        }`}
                                />
                                <button
                                    type="submit"
                                    disabled={!inputValue.trim()}
                                    className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 text-white rounded-lg hover:scale-110 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 transition-all shadow-lg ${theme === 'dark' ? 'bg-gradient-to-tr from-[#7C3AED] to-[#A78BFA] shadow-purple-500/20' : 'bg-gradient-to-tr from-green-500 to-blue-600 shadow-blue-500/20'
                                        }`}
                                >
                                    <Send size={18} />
                                </button>
                            </div>
                        </form>
                    </div>
                </footer>
            </div>

            {/* Global Scrollbar Styles (Inline as requested) */}
            <style dangerouslySetInnerHTML={{
                __html: `
                .scrollbar-thin::-webkit-scrollbar { width: 4px; }
                .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
                .scrollbar-thin::-webkit-scrollbar-thumb { 
                    background: ${theme === 'dark' ? 'rgba(124, 58, 237, 0.1)' : 'rgba(0, 0, 0, 0.05)'}; 
                    border-radius: 20px; 
                }
                .scrollbar-thin::-webkit-scrollbar-thumb:hover { 
                    background: ${theme === 'dark' ? 'rgba(124, 58, 237, 0.3)' : 'rgba(0, 0, 0, 0.1)'}; 
                }
            `}} />
        </div>
    );
};

export default ChatBot;

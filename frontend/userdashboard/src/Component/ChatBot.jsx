import React, { useState, useEffect, useRef } from 'react';
import { Send, Mic, Globe, User, Bot, Loader2, MoreVertical, X, Paperclip, FileText, Trash2, Plus, Image, Lightbulb, Telescope, ShoppingBag, ChevronRight } from 'lucide-react';
import { useChat } from '../context/ChatContext';
import { useTheme } from '../context/ThemeContext';
import api from '../services/api';

const ChatBot = ({ theme: propTheme = 'dark' }) => {
    const { currentMessages: messages, addMessageToActive, isTyping, uploadFile } = useChat();
    const { theme: contextTheme, language, setLanguage } = useTheme();
    const theme = contextTheme || propTheme;

    const translations = {
        'English': { placeholder: 'Ask anything...', analyzing: 'Analyzing Voice...' },
        'Hindi': { placeholder: 'कुछ भी पूछें...', analyzing: 'आवाज़ का विश्लेषण...' },
        'Marathi': { placeholder: 'काहीही विचारा...', analyzing: 'आवाजाचे विश्लेषण सुरू आहे...' }
    };
    const t = translations[language] || translations['English'];

    const [inputValue, setInputValue] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [showUploadMenu, setShowUploadMenu] = useState(false);
    const uploadMenuRef = useRef(null);
    // Removed local selectedLanguage state
    const [attachedFile, setAttachedFile] = useState(null);
    const [filePreview, setFilePreview] = useState(null);
    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const mediaRecorder = useRef(null);
    const audioChunks = useRef([]);

    // Click outside to close menu
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (uploadMenuRef.current && !uploadMenuRef.current.contains(event.target)) {
                setShowUploadMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

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
                const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
                await uploadAudio(audioBlob);
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.current.start();
            setIsListening(true);
        } catch (error) {
            console.error("Microphone access denied:", error);
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
        formData.append('language', language);
        formData.append('audio', blob, 'voice.webm');

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
            addMessageToActive(userMessage, false, language);
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
                <main className={`flex-1 overflow-y-auto p-4 md:p-6 space-y-6 z-0 ${theme === 'dark' ? 'scrollbar-thin scrollbar-thumb-purple-500/20' : 'scrollbar-thin scrollbar-thumb-gray-200'} scrollbar-track-transparent`}>
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

                                    {/* Attachment Rendering */}
                                    {msg.attachment && (
                                        <div className="mb-2">
                                            <div className="flex items-center space-x-2 text-[13px] font-bold text-white/90 mb-2">
                                                <span>{msg.attachment.type?.startsWith('image/') ? '[Uploaded Image:' : '[Uploaded File:'} {msg.attachment.name}]</span>
                                            </div>

                                            <div className={`rounded-xl overflow-hidden border ${msg.role === 'user' ? 'bg-white/10 border-white/20' : 'bg-[#0B0A14] border-purple-500/20'}`}>
                                                {msg.attachment.type?.startsWith('image/') ? (
                                                    <div className="relative group/msgimg">
                                                        <img src={msg.attachment.preview} alt="Attachment" className="max-w-full max-h-[300px] object-contain transition-transform group-hover/msgimg:scale-[1.02]" />
                                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/msgimg:opacity-100 transition-opacity flex items-center justify-center">
                                                            <Paperclip size={24} className="text-white" />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center p-3 space-x-3">
                                                        <div className="p-2 rounded-lg bg-purple-500/20">
                                                            <FileText size={20} className="text-purple-400" />
                                                        </div>
                                                        <div className="flex-1 min-w-0 text-white">
                                                            <p className="text-sm font-semibold truncate">{msg.attachment.name}</p>
                                                            <p className="text-[10px] opacity-60">{(msg.attachment.size / 1024).toFixed(1)} KB • Document</p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Divider like in the image */}
                                            <div className="w-full h-[1px] bg-white/10 my-3"></div>
                                        </div>
                                    )}

                                    {msg.content && <p className="text-sm font-medium leading-relaxed">{msg.content}</p>}
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
                <footer className={`z-50 relative p-4 md:p-6 transition-all duration-500 ${theme === 'dark' ? 'bg-[#141225] border-t border-purple-500/20' : 'bg-white border-t border-gray-200'}`}>
                    <div className="max-w-4xl mx-auto">

                        {/* File Preview Area (Drafting) */}
                        {filePreview && (
                            <div className="mb-4 animate-in slide-in-from-bottom-2 duration-300 flex">
                                <div className={`relative flex items-center p-2.5 rounded-2xl border backdrop-blur-xl ${theme === 'dark' ? 'bg-purple-500/10 border-purple-500/20 text-purple-100' : 'bg-blue-50/80 border-blue-200 text-blue-900'}`}>
                                    <div className="w-10 h-10 rounded-xl overflow-hidden shadow-inner flex-shrink-0">
                                        {attachedFile?.type.startsWith('image/') ? (
                                            <img src={filePreview} alt="Preview" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className={`w-full h-full flex items-center justify-center ${theme === 'dark' ? 'bg-purple-500/20' : 'bg-blue-100'}`}>
                                                <FileText className={theme === 'dark' ? 'text-purple-400' : 'text-blue-500'} size={18} />
                                            </div>
                                        )}
                                    </div>
                                    <div className="mx-3 pr-6 min-w-0">
                                        <p className="text-[10px] font-bold uppercase tracking-tight opacity-50">Attachment Ready</p>
                                        <p className="text-xs font-semibold truncate max-w-[180px]">{attachedFile?.name}</p>
                                    </div>
                                    <button
                                        onClick={clearAttachment}
                                        className="absolute -top-1.5 -right-1.5 p-1 bg-red-500 text-white rounded-full shadow-lg hover:scale-110 active:scale-95 transition-all border-2 border-white/20"
                                    >
                                        <X size={10} />
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

                            {/* New Professional Upload & Action Menu */}
                            <div className="relative" ref={uploadMenuRef}>
                                <button
                                    type="button"
                                    onClick={() => setShowUploadMenu(!showUploadMenu)}
                                    className={`w-11 h-11 rounded-full transition-all flex items-center justify-center border ${theme === 'dark'
                                        ? 'bg-transparent border-purple-500/20 text-purple-400 hover:bg-purple-500/10'
                                        : 'bg-transparent border-gray-200 text-gray-500 hover:bg-gray-50'} active:scale-90`}
                                    title="Add content"
                                >
                                    {showUploadMenu ? <X size={20} /> : <Plus size={26} strokeWidth={2.5} />}
                                </button>

                                {showUploadMenu && (
                                    <div className={`absolute bottom-full left-0 mb-4 animate-in fade-in slide-in-from-bottom-4 duration-300 rounded-[28px] p-2 min-w-[280px] shadow-[0_10px_40px_rgba(0,0,0,0.5)] z-[100] border ${theme === 'dark'
                                        ? 'bg-[#1E1E1E] border-white/5 backdrop-blur-3xl'
                                        : 'bg-white border-gray-100 shadow-2xl'}`}>

                                        <div className="flex flex-col py-1">
                                            {/* Primary Action: File Upload */}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    fileInputRef.current?.click();
                                                    setShowUploadMenu(false);
                                                }}
                                                className={`w-full flex items-center space-x-3.5 px-4 py-3.5 rounded-2xl transition-all ${theme === 'dark' ? 'hover:bg-white/5 text-[#E3E3E3]' : 'hover:bg-gray-50 text-slate-700'}`}
                                            >
                                                <Paperclip size={20} className={theme === 'dark' ? 'text-[#C4C7C5]' : 'text-gray-500'} />
                                                <span className="text-[15px] font-medium font-sans">Add photos & files</span>
                                            </button>

                                            <div className={`h-[1px] my-1 mx-2 ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-100'}`}></div>

                                            {/* AI Tools */}
                                            {[
                                                { icon: <Image size={20} />, label: 'Create image' },
                                                { icon: <Lightbulb size={20} />, label: 'Thinking' },
                                                { icon: <Telescope size={20} />, label: 'Deep research' },
                                                { icon: <ShoppingBag size={20} />, label: 'Shopping research' }
                                            ].map((item, idx) => (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    className={`w-full flex items-center space-x-3.5 px-4 py-2.5 rounded-2xl transition-all ${theme === 'dark' ? 'hover:bg-white/5 text-[#E3E3E3]' : 'hover:bg-gray-50 text-slate-700'}`}
                                                >
                                                    <span className={theme === 'dark' ? 'text-[#C4C7C5]' : 'text-gray-500'}>{item.icon}</span>
                                                    <span className="text-[15px] font-medium font-sans">{item.label}</span>
                                                </button>
                                            ))}

                                            <div className={`h-[1px] my-1 mx-2 ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-100'}`}></div>

                                            {/* Footer Actions */}
                                            <div className="relative group/more">
                                                <button
                                                    type="button"
                                                    className={`w-full flex items-center justify-between px-4 py-2.5 rounded-2xl transition-all ${theme === 'dark' ? 'hover:bg-white/5 text-[#E3E3E3]' : 'hover:bg-gray-50 text-slate-700'}`}
                                                >
                                                    <div className="flex items-center space-x-3.5">
                                                        <MoreVertical size={20} className={theme === 'dark' ? 'text-[#C4C7C5]' : 'text-gray-400'} />
                                                        <span className="text-[15px] font-medium font-sans">More</span>
                                                    </div>
                                                    <ChevronRight size={18} className={theme === 'dark' ? 'text-[#C4C7C5]' : 'text-gray-400'} />
                                                </button>

                                                {/* More Submenu (Language) */}
                                                <div className={`absolute left-full bottom-0 ml-4 invisible group-hover/more:visible opacity-0 group-hover/more:opacity-100 transition-all duration-300 rounded-[20px] p-2 min-w-[180px] shadow-2xl border ${theme === 'dark' ? 'bg-[#1E1E1E] border-white/5 backdrop-blur-3xl' : 'bg-white border-gray-200'}`}>
                                                    <div className="px-3 py-1.5 mb-1">
                                                        <p className={`text-[10px] font-bold uppercase tracking-wider text-gray-500`}>Voice Language</p>
                                                    </div>
                                                    {['English', 'Hindi', 'Marathi'].map(lang => (
                                                        <button
                                                            key={lang}
                                                            type="button"
                                                            onClick={() => {
                                                                setLanguage(lang);
                                                                setShowUploadMenu(false);
                                                            }}
                                                            className={`w-full text-left px-3 py-2 text-sm rounded-xl transition-all ${language === lang ? (theme === 'dark' ? 'bg-white/10 text-white' : 'bg-blue-100 text-blue-600') : (theme === 'dark' ? 'text-[#C4C7C5] hover:bg-white/5' : 'text-slate-700 hover:bg-gray-100')}`}
                                                        >
                                                            {lang}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Speech-to-Text Button (Keep separate for accessibility if needed, or integrate) */}
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
                                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none space-x-1">
                                        {[1, 2, 3, 4, 5].map(i => (
                                            <div
                                                key={i}
                                                className="w-1 bg-red-500 rounded-full animate-pulse"
                                                style={{
                                                    height: `${Math.random() * 15 + 5}px`,
                                                    animationDelay: `${i * 0.1}s`,
                                                    animationDuration: '0.6s'
                                                }}
                                            />
                                        ))}
                                        <span className="ml-2 text-[10px] text-red-500 font-black uppercase tracking-widest animate-pulse">{t.analyzing}</span>
                                    </div>
                                )}
                                <input
                                    type="text"
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    placeholder={isListening ? "" : t.placeholder}
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

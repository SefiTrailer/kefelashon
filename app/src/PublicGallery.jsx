import { useState, useEffect, useMemo } from 'react';
import { ChevronRight, ChevronLeft, Search, X, MessageCircle, Info, Palette } from 'lucide-react';
import QRCodeDisplay from './components/QRCodeDisplay';

// ── Themes ────────────────────────────────────────────────────────────────────
const THEMES = [
    {
        id: 'dark-purple',
        label: '🌌 נוגה',
        className: 'theme-dark-purple',
        textClass: 'text-purple-200',
        bgStyle: 'bg-[radial-gradient(ellipse_at_top,_#1a0533_0%,_#0f172a_50%,_#000000_100%)]',
        frameGrad: 'from-rose-500 via-purple-600 to-cyan-500',
        innerBg: 'bg-slate-900',
        titleGrad: 'from-cyan-300 via-purple-300 to-rose-300',
        headerBtnSearchCls: 'bg-cyan-500/20 hover:bg-cyan-500/40 border-cyan-400/50 text-cyan-50 shadow-[0_0_15px_rgba(6,182,212,0.3)] hover:shadow-[0_0_25px_rgba(6,182,212,0.6)]',
        headerBtnAboutCls: 'bg-rose-500/20 hover:bg-rose-500/40 border-rose-400/50 text-rose-50 shadow-[0_0_15px_rgba(244,63,94,0.3)] hover:shadow-[0_0_25px_rgba(244,63,94,0.6)]',
        navBtnCls: 'bg-white/90 text-purple-600 border-purple-200',
        explainBtnCls: 'text-slate-300 hover:text-white hover:bg-slate-800',
        explainTextCls: 'text-cyan-50',
        glowClass: 'from-purple-500/20',
        topicBadgeCls: 'bg-rose-500 border-rose-400',
        themeBtnCls: 'bg-purple-900/80 border-purple-500/50 text-purple-200 hover:bg-purple-800/90',
    },
    {
        id: 'neon',
        label: '⚡ סייבר',
        className: 'theme-neon',
        textClass: 'text-green-300',
        bgStyle: 'bg-[radial-gradient(ellipse_at_top,_#001a00_0%,_#000a1a_50%,_#000000_100%)]',
        frameGrad: 'from-[#39ff14] via-[#00f5ff] to-[#ff073a]',
        innerBg: 'bg-black',
        titleGrad: 'from-[#39ff14] via-[#00f5ff] to-[#ff073a]',
        headerBtnSearchCls: 'bg-[#39ff14]/10 hover:bg-[#39ff14]/25 border-[#39ff14]/50 text-[#39ff14] shadow-[0_0_15px_rgba(57,255,20,0.3)] hover:shadow-[0_0_25px_rgba(57,255,20,0.6)]',
        headerBtnAboutCls: 'bg-[#ff073a]/10 hover:bg-[#ff073a]/25 border-[#ff073a]/50 text-[#ff073a] shadow-[0_0_15px_rgba(255,7,58,0.3)] hover:shadow-[0_0_25px_rgba(255,7,58,0.6)]',
        navBtnCls: 'bg-black text-[#39ff14] border-[#39ff14]/60 shadow-[0_0_12px_rgba(57,255,20,0.4)]',
        explainBtnCls: 'text-[#39ff14]/70 hover:text-[#39ff14] hover:bg-[#39ff14]/10',
        explainTextCls: 'text-[#e0ffe0]',
        glowClass: 'from-[#39ff14]/10',
        topicBadgeCls: 'bg-[#ff073a] border-red-400',
        themeBtnCls: 'bg-black/80 border-[#39ff14]/50 text-[#39ff14] hover:bg-[#001a00]',
    },
    {
        id: 'pastel',
        label: '🌸 ענן',
        className: 'theme-pastel',
        textClass: 'text-purple-700',
        bgStyle: 'bg-[radial-gradient(ellipse_at_top,_#fdf2f8_0%,_#ede9fe_50%,_#e0f2fe_100%)]',
        frameGrad: 'from-pink-400 via-violet-400 to-sky-400',
        innerBg: 'bg-white/90',
        titleGrad: 'from-pink-500 via-violet-500 to-sky-500',
        headerBtnSearchCls: 'bg-sky-100 hover:bg-sky-200 border-sky-300 text-sky-700 shadow-[0_4px_15px_rgba(56,189,248,0.2)] hover:shadow-[0_4px_20px_rgba(56,189,248,0.4)]',
        headerBtnAboutCls: 'bg-pink-100 hover:bg-pink-200 border-pink-300 text-pink-700 shadow-[0_4px_15px_rgba(244,114,182,0.2)] hover:shadow-[0_4px_20px_rgba(244,114,182,0.4)]',
        navBtnCls: 'bg-white text-violet-600 border-violet-200 shadow-lg',
        explainBtnCls: 'text-violet-500 hover:text-violet-700 hover:bg-violet-50',
        explainTextCls: 'text-indigo-900',
        glowClass: 'from-pink-300/20',
        topicBadgeCls: 'bg-orange-400 border-orange-300',
        themeBtnCls: 'bg-white/80 border-pink-300 text-pink-600 hover:bg-pink-50',
    },
    {
        id: 'sunset',
        label: '🌅 שקיעה',
        className: 'theme-sunset',
        textClass: 'text-amber-300',
        bgStyle: 'bg-[radial-gradient(ellipse_at_top,_#1c0a00_0%,_#2d1b00_50%,_#1a0a2e_100%)]',
        frameGrad: 'from-amber-400 via-orange-500 to-fuchsia-600',
        innerBg: 'bg-[#1c0a00]',
        titleGrad: 'from-amber-300 via-orange-300 to-fuchsia-300',
        headerBtnSearchCls: 'bg-amber-500/20 hover:bg-amber-500/40 border-amber-400/50 text-amber-100 shadow-[0_0_15px_rgba(251,191,36,0.3)] hover:shadow-[0_0_25px_rgba(251,191,36,0.6)]',
        headerBtnAboutCls: 'bg-fuchsia-500/20 hover:bg-fuchsia-500/40 border-fuchsia-400/50 text-fuchsia-100 shadow-[0_0_15px_rgba(217,70,239,0.3)] hover:shadow-[0_0_25px_rgba(217,70,239,0.6)]',
        navBtnCls: 'bg-amber-50/90 text-orange-600 border-amber-300',
        explainBtnCls: 'text-amber-300/70 hover:text-amber-200 hover:bg-amber-900/30',
        explainTextCls: 'text-amber-50',
        glowClass: 'from-orange-500/20',
        topicBadgeCls: 'bg-fuchsia-600 border-fuchsia-400',
        themeBtnCls: 'bg-[#1c0a00]/80 border-amber-500/50 text-amber-300 hover:bg-amber-900/40',
    },
];

export default function PublicGallery({ images, metadata }) {
    const [shuffledImages, setShuffledImages] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isAboutOpen, setIsAboutOpen] = useState(() => {
        try {
            const visited = localStorage.getItem('kefel-visited');
            if (!visited) { localStorage.setItem('kefel-visited', '1'); return true; }
            return false;
        } catch { return false; }
    });
    const [showExplanation, setShowExplanation] = useState(false);
    const [themeIndex, setThemeIndex] = useState(() => {
        try {
            const saved = localStorage.getItem('kefel-theme');
            const idx = THEMES.findIndex(t => t.id === saved);
            return idx >= 0 ? idx : 0;
        } catch { return 0; }
    });
    const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const theme = THEMES[themeIndex];

    const setTheme = (idx) => {
        setThemeIndex(idx);
        setIsThemeMenuOpen(false);
        try { localStorage.setItem('kefel-theme', THEMES[idx].id); } catch { }
    };

    useEffect(() => {
        const tagged = images.filter(img => metadata[img]?.title && metadata[img]?.explanation);
        const shuffled = [...tagged].sort(() => Math.random() - 0.5);
        setShuffledImages(shuffled);
    }, [images, metadata]);

    const filteredImages = useMemo(() => {
        if (!searchQuery) return shuffledImages;
        const query = searchQuery.toLowerCase();
        return shuffledImages.filter(file => {
            const data = metadata[file];
            if (!data) return false;
            return (data.title && data.title.toLowerCase().includes(query)) ||
                (data.topic && data.topic.toLowerCase().includes(query));
        });
    }, [searchQuery, shuffledImages, metadata]);

    const displayImages = searchQuery ? filteredImages : shuffledImages;
    const currentFile = displayImages[currentIndex];
    const fileMetadata = currentFile ? metadata[currentFile] : null;

    const nextImage = () => { if (currentIndex < displayImages.length - 1) setCurrentIndex(p => p + 1); };
    const prevImage = () => { if (currentIndex > 0) setCurrentIndex(p => p - 1); };

    useEffect(() => { setShowExplanation(false); }, [currentIndex]);
    useEffect(() => { setCurrentIndex(0); }, [searchQuery]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (isSearchOpen || isAboutOpen) return;
            if (e.key === 'ArrowLeft') nextImage();
            if (e.key === 'ArrowRight') prevImage();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentIndex, displayImages.length, isSearchOpen, isAboutOpen]);

    if (shuffledImages.length === 0) {
        return (
            <div className={`min-h-screen flex items-center justify-center ${theme.bgStyle}`}>
                <div className={`text-2xl font-bold ${theme.textClass} animate-pulse font-['Fredoka',sans-serif]`}>
                    טוען את הגלריה... 🎨
                </div>
            </div>
        );
    }

    return (
        <div
            className={`min-h-screen ${theme.bgStyle} text-white font-['Fredoka',sans-serif] flex flex-col items-center pt-4 pb-8 overflow-x-hidden relative ${theme.className}`}
            style={{ letterSpacing: '0.01em' }}
        >
            {/* ── Single unified container: logo + buttons + frame ── */}
            <div className="relative w-full max-w-2xl md:max-w-4xl px-3 sm:px-4 mx-auto flex flex-col">
                {/* Logo — floats above frame at top-center, z-50 */}
                <div className="relative z-50 flex justify-center pointer-events-none" style={{ height: 0 }}>
                    <div
                        className="absolute pointer-events-auto"
                        style={{ top: '-4px', transform: 'translateX(0)' }}
                    >
                        <img
                            src="./logo.png"
                            alt="כפל לשון"
                            className="h-28 sm:h-32 md:h-40 object-contain drop-shadow-[0_0_20px_rgba(236,72,153,0.5)] hover:scale-105 transition-transform cursor-pointer"
                            style={{ transform: 'scaleX(1.15)' }}
                            onClick={() => setIsAboutOpen(true)}
                        />
                    </div>
                </div>

                {/* Buttons pinned to frame edges — same container as frame */}
                <div className="flex items-end justify-between relative z-10 pt-1" style={{ minHeight: '5.5rem' }}>
                    {/* חיפוש — aligns with RIGHT edge of frame */}
                    <button
                        onClick={() => setIsSearchOpen(true)}
                        className={`border ${theme.headerBtnSearchCls} px-3 sm:px-4 py-2 rounded-full backdrop-blur-md flex items-center gap-1.5 sm:gap-2 transition-all font-semibold text-sm sm:text-base`}
                    >
                        <Search size={16} />
                        <span className="hidden xs:inline sm:inline">חיפוש</span>
                    </button>

                    {/* אודות — aligns with LEFT edge of frame */}
                    <button
                        onClick={() => setIsAboutOpen(true)}
                        className={`border ${theme.headerBtnAboutCls} px-3 sm:px-4 py-2 rounded-full backdrop-blur-md flex items-center gap-1.5 sm:gap-2 transition-all font-semibold text-sm sm:text-base`}
                    >
                        <Info size={16} />
                        <span className="hidden xs:inline sm:inline">אודות</span>
                    </button>
                </div>
                {/* gap between buttons row and frame */}
                <div className="h-10" />
                {displayImages.length === 0 ? (
                    <div className="text-center bg-white/10 backdrop-blur-lg p-12 rounded-3xl border border-white/20">
                        <span className="text-6xl mb-4 block">😢</span>
                        <h2 className="text-2xl font-bold text-white mb-2">לא מצאנו מה שחיפשת...</h2>
                        <p className={theme.textClass}>נסה מילת חיפוש אחרת!</p>
                    </div>
                ) : (
                    <div className="w-full relative">
                        {/* Frame */}
                        <div
                            className={`relative bg-gradient-to-br ${theme.frameGrad} p-[3px] sm:p-1.5 md:p-[10px] rounded-[2rem] sm:rounded-[2.5rem] shadow-[0_20px_60px_rgba(0,0,0,0.55)] w-full`}
                            style={{ willChange: 'transform' }}
                        >
                            {/* Inner card */}
                            <div className={`${theme.innerBg} rounded-[1.8rem] sm:rounded-[2.2rem] flex flex-col overflow-hidden`}>

                                {/* Title */}
                                <div className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3 sm:pb-4 text-center relative flex-shrink-0 z-20">
                                    <div className={`absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r ${theme.frameGrad} opacity-60`} />
                                    <h2
                                        className={`text-2xl sm:text-3xl md:text-5xl font-['Varela_Round',sans-serif] text-transparent bg-clip-text bg-gradient-to-r ${theme.titleGrad}`}
                                        style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.3))' }}
                                    >
                                        {fileMetadata?.title}
                                    </h2>
                                </div>

                                {/* Image + nav arrows wrapper (no overflow-hidden so arrows aren't clipped) */}
                                <div className="relative w-full">
                                    {/* Image area — click to fullscreen */}
                                    <div className={`relative flex items-center justify-center bg-black/40 w-full overflow-hidden cursor-zoom-in`}
                                        style={{ aspectRatio: '1/1', maxHeight: '55vh', padding: '16px' }}
                                        onClick={() => setIsFullscreen(true)}>

                                        {/* Glow behind image */}
                                        <div className={`absolute inset-0 bg-gradient-to-t ${theme.glowClass} to-transparent opacity-50 mix-blend-screen pointer-events-none`} />

                                        <img
                                            key={currentFile}
                                            src={`./images/${encodeURIComponent(currentFile)}`}
                                            alt={fileMetadata?.title || 'תמונה'}
                                            className="w-full h-full object-contain filter drop-shadow-[0_10px_25px_rgba(0,0,0,0.7)] relative z-10 animate-in zoom-in-95 duration-500"
                                            style={{ borderRadius: '12px' }}
                                            loading="lazy"
                                        />

                                        {/* Topic badge */}
                                        {fileMetadata?.topic && (
                                            <div className={`absolute top-4 right-4 z-20 ${theme.topicBadgeCls} text-white px-4 py-1.5 rounded-full font-bold text-sm shadow-lg border backdrop-blur-md -rotate-1`}>
                                                📌 {fileMetadata.topic}
                                            </div>
                                        )}

                                    </div>

                                    {/* Nav arrows — siblings of image div, so not clipped */}
                                    <button
                                        onClick={nextImage}
                                        disabled={currentIndex === displayImages.length - 1}
                                        className={`absolute top-1/2 -translate-y-1/2 right-3 z-30 ${theme.navBtnCls} backdrop-blur-sm p-2 sm:p-3 rounded-full shadow-[0_0_16px_rgba(0,0,0,0.4)] disabled:opacity-0 disabled:pointer-events-none hover:scale-110 hover:brightness-110 transition-all font-bold group border`}
                                    >
                                        <ChevronRight size={28} className="group-hover:translate-x-0.5 transition-transform" />
                                    </button>
                                    <button
                                        onClick={prevImage}
                                        disabled={currentIndex === 0}
                                        className={`absolute top-1/2 -translate-y-1/2 left-3 z-30 ${theme.navBtnCls} backdrop-blur-sm p-2 sm:p-3 rounded-full shadow-[0_0_16px_rgba(0,0,0,0.4)] disabled:opacity-0 disabled:pointer-events-none hover:scale-110 hover:brightness-110 transition-all font-bold group border`}
                                    >
                                        <ChevronLeft size={28} className="group-hover:-translate-x-0.5 transition-transform" />
                                    </button>
                                </div>

                                {/* Explanation toggle */}
                                <div className={`${theme.innerBg} border-t border-white/10 flex flex-col items-center justify-center relative z-20`}>
                                    {!showExplanation ? (
                                        <button
                                            onClick={() => setShowExplanation(true)}
                                            className={`w-full py-4 ${theme.explainBtnCls} font-semibold transition-colors flex items-center justify-center gap-2 group text-base tracking-wide`}
                                        >
                                            <span className="border-b border-dashed border-current opacity-70 group-hover:opacity-100">
                                                למי שצריך הסבר בהרחבה ⬇️
                                            </span>
                                        </button>
                                    ) : (
                                        <div className="p-6 md:p-8 text-center animate-in fade-in slide-in-from-top-2 w-full">
                                            <p className={`text-lg md:text-xl ${theme.explainTextCls} leading-relaxed mx-auto font-medium`}>
                                                {fileMetadata?.explanation}
                                            </p>
                                        </div>
                                    )}
                                </div>

                            </div>
                        </div>

                    </div>
                )}

            </div>
            {/* end unified container */}

            {/* ── Theme Switcher (bottom-right floating) ──────────────────────── */}
            <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2">
                {isThemeMenuOpen && (
                    <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
                        {THEMES.map((t, idx) => (
                            <button
                                key={t.id}
                                onClick={() => setTheme(idx)}
                                className={`px-4 py-2 rounded-full text-sm font-semibold border backdrop-blur-md transition-all shadow-lg
                  ${idx === themeIndex
                                        ? 'ring-2 ring-white/60 scale-105'
                                        : 'opacity-80 hover:opacity-100 hover:scale-105'
                                    } ${theme.themeBtnCls}`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                )}
                <button
                    onClick={() => setIsThemeMenuOpen(p => !p)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-full border backdrop-blur-md font-semibold shadow-xl transition-all hover:scale-105 ${theme.themeBtnCls}`}
                    title="החלף ערכת עיצוב"
                >
                    <Palette size={18} />
                    <span className="text-sm">{theme.label}</span>
                </button>
            </div>

            {/* ── About Modal ──────────────────────────────────────────────────────── */}
            {isAboutOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsAboutOpen(false)} />
                    <div className="relative w-full max-w-xl bg-gradient-to-b from-slate-800 to-slate-900 rounded-[2rem] p-5 border border-slate-700 shadow-2xl animate-in fade-in zoom-in-95 duration-300 text-center">
                        <button onClick={() => setIsAboutOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white bg-slate-800 rounded-full p-2 transition-colors z-10">
                            <X size={20} />
                        </button>

                        {/* Logo + Title */}
                        <img src="./logo.png" alt="לוגו" className="h-16 mx-auto mb-2 drop-shadow-[0_0_15px_rgba(236,72,153,0.3)]" style={{ transform: 'scaleX(1.15)' }} />
                        <h3 className="text-2xl font-['Secular_One',sans-serif] text-white mb-1 tracking-wide">ברוכים הבאים לכפל לשון!</h3>
                        <p className="text-purple-300 text-sm mb-3">פרויקט משחקי מילים משוגע ומצחיק מאת ספי.</p>

                        {/* Description */}
                        <div className="bg-slate-800/50 px-4 py-3 rounded-2xl border border-slate-700 mb-4 text-slate-300 text-sm leading-relaxed">
                            מאות איורים דיגיטליים הממחישים ביטויים ומשחקי מילים בעברית — להעלות חיוך ולחגוג את השפה בצורתה הכיפית ביותר.
                            <br />
                            <span className="text-purple-400 font-semibold">יצירה ועריכה: ספי רייכקינד</span>
                        </div>

                        {/* QR + WhatsApp side by side */}
                        <div className="flex items-center gap-3">
                            {/* QR code */}
                            <div className="flex-shrink-0">
                                <QRCodeDisplay url="https://sefitrailer.github.io/kefel-lashon/" />
                            </div>

                            {/* WhatsApp buttons stacked on the left of QR */}
                            <div className="flex flex-col gap-2 flex-1">
                                <a
                                    href="https://whatsapp.com/channel/0029VajNwaPL2AU0jdlgxa20"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center justify-center gap-2 bg-[#25D366] text-white px-3 py-2.5 rounded-2xl font-bold hover:bg-[#20ba56] transition-colors shadow-lg text-sm"
                                >
                                    <MessageCircle size={18} />
                                    📢 ערוץ וואטסאפ
                                </a>
                                <a
                                    href="https://chat.whatsapp.com/LN6nwJ8cYiLHaj5uhTum9P"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center justify-center gap-2 bg-emerald-700 text-white px-3 py-2.5 rounded-2xl font-bold hover:bg-emerald-800 transition-colors shadow-lg text-sm"
                                >
                                    <MessageCircle size={18} />
                                    👥 קבוצת וואטסאפ
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Fullscreen Lightbox ────────────────────────────────────────── */}
            {isFullscreen && (
                <div
                    className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 backdrop-blur-sm cursor-zoom-out animate-in fade-in duration-200"
                    onClick={() => setIsFullscreen(false)}
                >
                    <button
                        className="absolute top-4 right-4 text-white bg-white/10 hover:bg-white/20 rounded-full p-3 transition-colors z-10"
                        onClick={() => setIsFullscreen(false)}
                    >
                        <X size={28} />
                    </button>
                    <img
                        src={`./images/${encodeURIComponent(currentFile)}`}
                        alt={fileMetadata?.title || 'תמונה'}
                        className="max-w-[95vw] max-h-[95vh] object-contain drop-shadow-[0_0_60px_rgba(0,0,0,0.9)] rounded-2xl"
                        onClick={(e) => e.stopPropagation()}
                    />
                    {fileMetadata?.title && (
                        <div className="absolute bottom-4 right-6 max-w-[220px] bg-black/70 backdrop-blur-md text-white px-4 py-3 rounded-2xl text-base font-['Varela_Round',sans-serif] border border-white/20 text-right leading-snug">
                            {fileMetadata.title}
                        </div>
                    )}
                </div>
            )}

            {/* ── Search Modal ─────────────────────────────────────────────────── */}
            {isSearchOpen && (
                <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-20">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => { setIsSearchOpen(false); setSearchQuery(''); }} />
                    <div className={`relative w-full max-w-2xl bg-slate-900 rounded-[2rem] border border-cyan-500/30 p-2 shadow-[0_0_50px_rgba(6,182,212,0.15)] animate-in fade-in slide-in-from-top-4`}>
                        <div className="flex items-center bg-slate-800 rounded-[1.8rem] px-6 py-4">
                            <Search size={24} className="text-cyan-400 mr-4" />
                            <input
                                type="text"
                                autoFocus
                                placeholder="חפש תמונה, כותרת, או נושא..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-transparent text-white text-xl md:text-2xl font-bold placeholder-slate-500 focus:outline-none focus:ring-0 outline-none border-none pr-4"
                            />
                            <button onClick={() => { setIsSearchOpen(false); setSearchQuery(''); }} className="ml-2 text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-700 p-2 rounded-full transition-all shrink-0">
                                <X size={24} />
                            </button>
                        </div>
                        {searchQuery && (
                            <div className="p-4 text-center text-cyan-200 mt-2 font-medium bg-slate-800/50 rounded-2xl border border-slate-800">
                                נמצאו {filteredImages.length} תוצאות. לחץ על ה-X בתיבה לביטול חיפוש, או סגור את החלון לצפייה.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

import { useState, useEffect, useMemo } from 'react';
import { ChevronRight, ChevronLeft, Search, X, MessageCircle, Info, Palette, Linkedin, Share2 } from 'lucide-react';
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
        explainBtnCls: 'text-slate-300 hover:text-white',
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
        explainBtnCls: 'text-[#39ff14]/70 hover:text-[#39ff14]',
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
        explainBtnCls: 'text-violet-500 hover:text-violet-700',
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
        explainBtnCls: 'text-amber-300/70 hover:text-amber-200',
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
    const [showExplanation, setShowExplanation] = useState(false);
    const [hasSeenTooltip, setHasSeenTooltip] = useState(() => localStorage.getItem('kefel-tooltip') === 'true');
    const [showTooltip, setShowTooltip] = useState(false);
    const [showFullscreenInfo, setShowFullscreenInfo] = useState(true);
    const [sortOrder, setSortOrder] = useState('newest'); // 'newest' or 'random'
    const [viewMode, setViewMode] = useState('single'); // 'single', 'grid-2x3', 'grid-3x4'
    const [themeIndex, setThemeIndex] = useState(() => {
        try {
            const saved = localStorage.getItem('kefel-theme');
            const idx = THEMES.findIndex(t => t.id === saved);
            return idx >= 0 ? idx : 0;
        } catch { return 0; }
    });
    const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
    const [isSortOpen, setIsSortOpen] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const theme = THEMES[themeIndex];

    const setTheme = (idx) => {
        setThemeIndex(idx);
        setIsThemeMenuOpen(false);
        try { localStorage.setItem('kefel-theme', THEMES[idx].id); } catch { }
    };

    useEffect(() => {
        // Sort tagged images first, untagged images after. Inside groups, sort by file timestamp (newest first).
        const sorted = [...images].sort((a, b) => {
            const aTagged = metadata[a]?.title && metadata[a]?.explanation;
            const bTagged = metadata[b]?.title && metadata[b]?.explanation;

            if (aTagged && !bTagged) return -1;
            if (!aTagged && bTagged) return 1;

            if (sortOrder === 'newest') {
                const dateA = metadata[a]?.dateMillis || 0;
                const dateB = metadata[b]?.dateMillis || 0;

                if (dateA !== dateB) return dateB - dateA; // Newest first

                // Fallback to older logic if dateMillis not present (i.e. user didn't run updated prepare script)
                const extractDate = (filename) => {
                    const match = filename.match(/_(\d{8})_(\d{6})_/);
                    return match ? parseInt(match[1] + match[2], 10) : 0;
                };
                const fbA = extractDate(a);
                const fbB = extractDate(b);
                if (fbA && fbB) return fbB - fbA;
                if (fbA) return -1;
                if (fbB) return 1;
            }

            return Math.random() - 0.5; // Randomize the rest
        });

        setShuffledImages(sorted);
    }, [images, metadata, sortOrder]);

    const filteredImages = useMemo(() => {
        if (!searchQuery) return shuffledImages;
        const query = searchQuery.toLowerCase();
        return shuffledImages.filter(file => {
            const data = metadata[file];
            if (!data) return false;

            const rawTags = data.tags || data.topic || '';
            const tagsList = Array.isArray(rawTags) ? rawTags : rawTags.split(',').map(t => t.trim()).filter(Boolean);
            const matchesTag = tagsList.some(tag => tag.toLowerCase().includes(query));

            return (data.title && data.title.toLowerCase().includes(query)) || matchesTag;
        });
    }, [searchQuery, shuffledImages, metadata]);

    const displayImages = searchQuery ? filteredImages : shuffledImages;

    const openFullscreen = () => {
        setIsFullscreen(true);
        if (!hasSeenTooltip) {
            setShowTooltip(true);
            setTimeout(() => {
                setShowTooltip(false);
                setHasSeenTooltip(true);
                localStorage.setItem('kefel-tooltip', 'true');
            }, 3000);
        }
    };

    const currentFile = displayImages[currentIndex];
    const fileMetadata = currentFile ? metadata[currentFile] : null;

    const getGridSize = () => viewMode === 'grid-3x4' ? 12 : (viewMode === 'grid-2x3' ? 6 : 1);

    const nextImage = () => {
        const step = getGridSize();
        if (currentIndex + step < displayImages.length) {
            setCurrentIndex(p => p + step);
            setShowExplanation(false);
        } else if (currentIndex < displayImages.length - 1) {
            // If near the end, just go to the very last available chunk
            setCurrentIndex(displayImages.length - 1);
            setShowExplanation(false);
        }
    };

    const prevImage = () => {
        const step = getGridSize();
        if (currentIndex - step >= 0) {
            setCurrentIndex(p => p - step);
            setShowExplanation(false);
        } else if (currentIndex > 0) {
            setCurrentIndex(0);
            setIsFullscreen(false);
            setShowExplanation(false);
        }
    };

    useEffect(() => { setCurrentIndex(0); }, [searchQuery, viewMode]);

    // Force single view mode on small screens (mobile)
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 640 && viewMode !== 'single') {
                setViewMode('single');
            }
        };
        handleResize(); // trigger on mount
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [viewMode]);

    // ── Touch Handling (Swipe) ───────────────────────────────────────────────────
    const [touchStartX, setTouchStartX] = useState(0);
    const [touchEndX, setTouchEndX] = useState(0);
    const minSwipeDistance = 50;

    const onTouchStart = (e) => {
        setTouchEndX(0);
        setTouchStartX(e.targetTouches[0].clientX);
    };

    const onTouchMove = (e) => setTouchEndX(e.targetTouches[0].clientX);

    const onTouchEnd = () => {
        if (!touchStartX || !touchEndX) return;
        const distance = touchStartX - touchEndX;
        if (distance > minSwipeDistance) nextImage(); // Swiped left -> Next
        if (distance < -minSwipeDistance) prevImage(); // Swiped right -> Prev
    };

    // ── Wheel Handling (Fullscreen) ───────────────────────────────────────────────
    useEffect(() => {
        const handleWheel = (e) => {
            if (!isFullscreen) return;
            if (e.deltaY > 0) nextImage(); // Scroll down -> Next
            else if (e.deltaY < 0) prevImage(); // Scroll up -> Prev
        };
        window.addEventListener('wheel', handleWheel);
        return () => window.removeEventListener('wheel', handleWheel);
    }, [isFullscreen, currentIndex, displayImages.length]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (isSearchOpen) return;
            if (e.key === 'ArrowLeft') nextImage();
            if (e.key === 'ArrowRight') prevImage();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentIndex, displayImages.length, isSearchOpen]);

    useEffect(() => {
        const handleClickOutside = () => setIsSortOpen(false);
        if (isSortOpen) window.addEventListener('click', handleClickOutside);
        return () => window.removeEventListener('click', handleClickOutside);
    }, [isSortOpen]);

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
            className={`min-h-screen lg:h-screen lg:overflow-hidden ${theme.bgStyle} text-white font-['Fredoka',sans-serif] flex flex-col items-center pt-4 pb-8 lg:pb-4 relative ${theme.className}`}
            style={{ letterSpacing: '0.01em' }}
        >
            {/* ── Main Layout Container ── */}
            <div className="relative w-full max-w-[1400px] px-3 sm:px-4 mx-auto flex flex-col lg:flex-row gap-8 lg:gap-12 items-stretch justify-center flex-1 min-h-0">

                {/* ── Left/Main: Search + Image Frame ── */}
                <div className="w-full max-w-2xl md:max-w-4xl flex flex-col items-center flex-1 relative shrink-0 mx-auto min-h-0">

                    {/* Removed top spacer so both panels align at the top */}
                    {displayImages.length === 0 ? (
                        <div className="text-center bg-white/10 backdrop-blur-lg p-12 rounded-3xl border border-white/20 mt-8">
                            <span className="text-6xl mb-4 block">😢</span>
                            <h2 className="text-2xl font-bold text-white mb-2">לא מצאנו מה שחיפשת...</h2>
                            <p className={theme.textClass}>נסה מילת חיפוש אחרת!</p>
                        </div>
                    ) : (
                        <div className="w-full relative flex-1 flex flex-col min-h-0">

                            {/* ── Mobile-Only Header Block (Hidden on Desktop) ── */}
                            <div className="flex lg:hidden flex-col items-center shrink-0 mb-6 bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-6 shadow-xl w-full">
                                <img src="./logo.png" alt="כפלשון" className="h-20 sm:h-24 md:h-28 object-contain drop-shadow-[0_0_20px_rgba(236,72,153,0.5)]" />
                                <div className="text-center font-medium mt-4 text-sm sm:text-base text-slate-300">
                                    ברוכים הבאים ל<strong className="text-white mx-1 drop-shadow-md">'כפלשון'</strong>!
                                    <br />
                                    <span>
                                        {images.length} איורים דיגיטליים ויצירות AI הממחישים ביטויים, כפל לשון ומשחקי מילים בעברית — להעלות חיוך ולחגוג את השפה בצורתה הכיפית ביותר.
                                    </span>
                                </div>
                                <div className="flex items-center justify-center gap-3 mt-4">
                                    <span className="text-indigo-300 font-bold block text-lg drop-shadow-md">ספי רייכקינד</span>
                                    <a href="https://www.linkedin.com/in/sefi-riechkind-679b67136" target="_blank" rel="noreferrer" className="text-[#0077b5] hover:text-white hover:bg-[#0077b5] transition-all hover:scale-110 drop-shadow-md border border-[#0077b5] rounded-lg p-1 w-8 h-8 flex items-center justify-center bg-white/5" title="לינקדאין">
                                        <Linkedin size={18} fill="currentColor" strokeWidth={1} className="shrink-0" />
                                    </a>
                                </div>
                            </div>

                            {/* Frame */}
                            <div
                                className={`relative bg-gradient-to-br ${theme.frameGrad} p-[3px] sm:p-1.5 md:p-[10px] rounded-[2rem] sm:rounded-[2.5rem] shadow-[0_20px_60px_rgba(0,0,0,0.55)] w-full flex-1 flex flex-col min-h-0`}
                                style={{ willChange: 'transform' }}
                            >
                                {/* Inner card */}
                                <div className={`${theme.innerBg} rounded-[1.8rem] sm:rounded-[2.2rem] flex flex-col flex-1 min-h-0`}>

                                    {/* Title Bar with inline Search and About - Completely hidden in Grid mode */}
                                    {viewMode === 'single' && (
                                        <div className="px-3 sm:px-6 py-4 grid grid-cols-[auto_1fr_auto] gap-3 items-center justify-between relative flex-shrink-0 z-20 w-full min-h-[5rem]">
                                            <div className={`absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r ${theme.frameGrad} opacity-60`} />

                                            {/* Right: Search button (only single mode) - Width matches left side for perfect title centering */}
                                            <div className="relative z-10 flex-shrink-0 flex items-center justify-end w-24 sm:w-28">
                                                <button
                                                    onClick={() => setIsSearchOpen(true)}
                                                    className={`w-10 h-10 lg:w-11 lg:h-11 rounded-full backdrop-blur-md flex items-center justify-center transition-all ${theme.headerBtnSearchCls} animate-in fade-in duration-300 ml-auto`}
                                                    title="חיפוש"
                                                >
                                                    <Search size={20} />
                                                </button>
                                            </div>

                                            {/* Center: Title absolutely centered within the bar (only single mode) */}
                                            <div className="flex-1 w-full flex items-center justify-center px-1 overflow-hidden">
                                                <h2
                                                    className={`text-[clamp(1.3rem,4vw,2.5rem)] font-['Varela_Round',sans-serif] text-transparent bg-clip-text bg-gradient-to-r ${theme.titleGrad} text-center leading-tight transition-opacity duration-300 break-words line-clamp-2`}
                                                    style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.3))' }}
                                                >
                                                    {fileMetadata?.title || ''}
                                                </h2>
                                            </div>

                                            {/* Left: Explain button overlay trigger (only single mode) */}
                                            <div className="relative z-10 w-24 sm:w-28 flex items-center justify-start flex-shrink-0">
                                                {fileMetadata?.explanation ? (
                                                    <button
                                                        onClick={() => setShowExplanation(!showExplanation)}
                                                        className={`flex items-center gap-1.5 p-1.5 sm:p-2 px-2.5 sm:px-3 rounded-2xl backdrop-blur-md transition-all ${theme.headerBtnAboutCls} whitespace-nowrap text-xs sm:text-sm font-bold animate-in fade-in duration-300`}
                                                    >
                                                        <div className="flex flex-col items-end leading-snug text-right pointer-events-none">
                                                            <span>להסבר</span>
                                                            <span>לחץ כאן</span>
                                                        </div>
                                                        <ChevronLeft size={18} sm={{ size: 22 }} strokeWidth={2.5} className={`transition-transform duration-300 shrink-0 ${showExplanation ? '-rotate-90' : 'rotate-0'}`} />
                                                    </button>
                                                ) : <div className="invisible w-full h-10"></div>}
                                            </div>
                                        </div>
                                    )}

                                    {/* Image + nav arrows wrapper (no overflow-hidden so arrows aren't clipped) */}
                                    <div className="relative w-full flex-1 flex flex-col min-h-0"
                                        onTouchStart={onTouchStart}
                                        onTouchMove={onTouchMove}
                                        onTouchEnd={onTouchEnd}
                                    >
                                        {/* Image area — click to fullscreen */}
                                        <div className={`relative flex-1 flex flex-col items-center justify-center bg-black/40 w-full overflow-hidden cursor-zoom-in min-h-0 rounded-t-[1.8rem] sm:rounded-t-[2.2rem] ${viewMode !== 'single' ? 'rounded-b-none' : ''}`}
                                            style={{ padding: viewMode === 'single' ? '8px' : '0px' }}
                                            onClick={() => viewMode === 'single' ? openFullscreen() : null}>

                                            {/* Glow behind image */}
                                            <div className={`absolute inset-0 bg-gradient-to-t ${theme.glowClass} to-transparent opacity-50 mix-blend-screen pointer-events-none`} />

                                            {viewMode === 'single' ? (
                                                <>
                                                    <img
                                                        key={currentFile}
                                                        src={`./images/${encodeURIComponent(currentFile)}`}
                                                        alt={fileMetadata?.title || 'תמונה'}
                                                        className="w-full h-full object-contain filter drop-shadow-[0_10px_25px_rgba(0,0,0,0.7)] relative z-10 animate-in zoom-in-95 duration-500"
                                                        style={{ borderRadius: '12px' }}
                                                        loading="lazy"
                                                    />
                                                    {fileMetadata?.topic && (
                                                        <div className={`absolute top-4 right-4 z-20 ${theme.topicBadgeCls} text-white px-4 py-1.5 rounded-full font-bold text-sm shadow-lg border backdrop-blur-md -rotate-1`}>
                                                            📌 {fileMetadata.topic}
                                                        </div>
                                                    )}
                                                </>
                                            ) : (
                                                <div className={`grid gap-2 sm:gap-4 p-2 w-full h-full relative z-10 items-center justify-items-center ${viewMode === 'grid-3x4' ? 'grid-cols-4 grid-rows-3' : 'grid-cols-3 grid-rows-2'}`}>
                                                    {displayImages.slice(currentIndex, currentIndex + getGridSize()).map((file, idx) => (
                                                        <div key={file} className="relative aspect-square w-full h-full max-h-full max-w-full flex items-center justify-center cursor-zoom-in group" onClick={(e) => { e.stopPropagation(); setCurrentIndex(currentIndex + idx); setViewMode('single'); openFullscreen(); }}>
                                                            <img
                                                                src={`./images/${encodeURIComponent(file)}`}
                                                                alt={metadata[file]?.title || 'תמונה'}
                                                                className="w-full h-full object-contain filter drop-shadow-md rounded-xl transition-transform group-hover:scale-105"
                                                                loading="lazy"
                                                            />
                                                            {metadata[file]?.title && (
                                                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent text-white text-xs sm:text-[13px] text-center pt-6 pb-2 rounded-b-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap overflow-hidden text-ellipsis px-2 font-bold z-20 pointer-events-none">
                                                                    {metadata[file].title}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Nav arrows — positioned absolutely centered vertically to the IMAGE CONTAINER */}
                                            <button
                                                onClick={(e) => { e.stopPropagation(); nextImage(); }}
                                                disabled={currentIndex + getGridSize() >= displayImages.length && currentIndex !== displayImages.length - 1}
                                                className={`absolute top-1/2 -translate-y-1/2 right-2 md:-right-6 z-30 bg-black/50 md:${theme.navBtnCls} backdrop-blur-md p-2 sm:p-3 md:shadow-[0_0_16px_rgba(0,0,0,0.4)] rounded-full text-white md:text-purple-600 border border-white/10 md:border-purple-200 disabled:opacity-0 disabled:pointer-events-none hover:scale-110 hover:brightness-110 transition-all font-bold group`}
                                            >
                                                <ChevronRight className="w-6 h-6 sm:w-7 sm:h-7 group-hover:translate-x-0.5 transition-transform" />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); prevImage(); }}
                                                disabled={currentIndex === 0}
                                                className={`absolute top-1/2 -translate-y-1/2 left-2 md:-left-6 z-30 bg-black/50 md:${theme.navBtnCls} backdrop-blur-md p-2 sm:p-3 md:shadow-[0_0_16px_rgba(0,0,0,0.4)] rounded-full text-white md:text-purple-600 border border-white/10 md:border-purple-200 disabled:opacity-0 disabled:pointer-events-none hover:scale-110 hover:brightness-110 transition-all font-bold group`}
                                            >
                                                <ChevronLeft className="w-6 h-6 sm:w-7 sm:h-7 group-hover:-translate-x-0.5 transition-transform" />
                                            </button>

                                        </div>

                                        {/* Tagging and Sorting Footer */}
                                        <div className="bg-black/50 backdrop-blur-md border-t border-white/10 p-3 sm:p-4 rounded-b-[1.8rem] sm:rounded-b-[2.2rem] flex flex-col sm:flex-row items-center justify-between gap-4 relative z-30 shrink-0">
                                            <div className="flex flex-wrap gap-2 items-center justify-center flex-1">
                                                <span className="text-white/60 text-sm font-bold">תיוגים:</span>
                                                {(() => {
                                                    const rawTags = fileMetadata?.tags || fileMetadata?.topic || '';
                                                    const tagsList = Array.isArray(rawTags) ? rawTags : rawTags.split(',').map(t => t.trim()).filter(Boolean);
                                                    if (tagsList.length === 0 || viewMode !== 'single') return <span className="text-white/30 text-sm italic">אין תיוגים</span>;
                                                    return tagsList.map(tag => (
                                                        <button
                                                            key={tag}
                                                            onClick={(e) => { e.stopPropagation(); setSearchQuery(tag); }}
                                                            className="px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-all hover:scale-105 border border-white/10 shadow-sm z-40 relative"
                                                        >
                                                            {tag}
                                                        </button>
                                                    ));
                                                })()}
                                            </div>

                                            <div className="hidden sm:flex items-center gap-4 shrink-0 bg-white/5 px-2 py-1.5 rounded-xl border border-white/5 z-40 relative">
                                                {/* View Mode Icons */}
                                                {/* Search Icon visible in Grid mode */}
                                                {viewMode !== 'single' && (
                                                    <button
                                                        onClick={() => setIsSearchOpen(true)}
                                                        className={`p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors duration-300 mr-2`}
                                                        title="חיפוש"
                                                    >
                                                        <Search size={18} />
                                                    </button>
                                                )}

                                                <div className="flex items-center gap-1 border-l border-white/20 pl-3">
                                                    <button onClick={() => setViewMode('single')} className={`p-1 rounded transition-colors ${viewMode === 'single' ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white'}`} title="תמונה אחת">
                                                        <div className="w-5 h-5 border-[2px] border-current rounded-sm"></div>
                                                    </button>
                                                    <button onClick={() => setViewMode('grid-2x3')} className={`p-1 rounded transition-colors ${viewMode === 'grid-2x3' ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white'}`} title="רשת 2x3">
                                                        <div className="w-5 h-5 grid grid-cols-3 grid-rows-2 gap-[2px]">
                                                            <div className="bg-current rounded-[1px] aspect-square"></div><div className="bg-current rounded-[1px] aspect-square"></div><div className="bg-current rounded-[1px] aspect-square"></div>
                                                            <div className="bg-current rounded-[1px] aspect-square"></div><div className="bg-current rounded-[1px] aspect-square"></div><div className="bg-current rounded-[1px] aspect-square"></div>
                                                        </div>
                                                    </button>
                                                    <button onClick={() => setViewMode('grid-3x4')} className={`p-1 rounded transition-colors ${viewMode === 'grid-3x4' ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white'}`} title="רשת 3x4">
                                                        <div className="w-5 h-5 grid grid-cols-4 grid-rows-3 gap-[1px]">
                                                            <div className="bg-current rounded-[1px] aspect-square"></div><div className="bg-current rounded-[1px] aspect-square"></div><div className="bg-current rounded-[1px] aspect-square"></div><div className="bg-current rounded-[1px] aspect-square"></div>
                                                            <div className="bg-current rounded-[1px] aspect-square"></div><div className="bg-current rounded-[1px] aspect-square"></div><div className="bg-current rounded-[1px] aspect-square"></div><div className="bg-current rounded-[1px] aspect-square"></div>
                                                            <div className="bg-current rounded-[1px] aspect-square"></div><div className="bg-current rounded-[1px] aspect-square"></div><div className="bg-current rounded-[1px] aspect-square"></div><div className="bg-current rounded-[1px] aspect-square"></div>
                                                        </div>
                                                    </button>
                                                </div>

                                                <div
                                                    className="flex items-center gap-2 relative cursor-pointer"
                                                    onWheel={(e) => {
                                                        e.preventDefault();
                                                        if (e.deltaY > 0) setSortOrder('random');
                                                        else setSortOrder('newest');
                                                    }}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setIsSortOpen(!isSortOpen);
                                                    }}
                                                >
                                                    <span className="text-white/70 text-sm font-bold pointer-events-none">מיון:</span>
                                                    <div className="relative flex items-center bg-transparent text-white text-sm font-medium pr-1 pl-6 hover:text-white/80 transition-colors z-10">
                                                        {sortOrder === 'newest' ? 'הכי חדשים' : 'אקראי'}
                                                        <div className={`absolute left-1 text-white/50 text-[10px] transition-transform ${isSortOpen ? 'rotate-180' : ''}`}>▲</div>

                                                        {/* Upwards Dropdown Menu (Click based) */}
                                                        {isSortOpen && (
                                                            <div className="absolute bottom-full left-0 mb-2 w-32 bg-slate-800/95 backdrop-blur-md rounded-xl border border-white/10 shadow-[0_-5px_20px_rgba(0,0,0,0.5)] animate-in fade-in zoom-in-95 duration-200 z-50 flex flex-col overflow-hidden origin-bottom">
                                                                <div
                                                                    className={`px-4 py-2.5 text-sm text-right transition-colors ${sortOrder === 'newest' ? 'text-white font-bold bg-white/10' : 'text-white/70 hover:bg-white/5'}`}
                                                                    onClick={(e) => { e.stopPropagation(); setSortOrder('newest'); setIsSortOpen(false); }}
                                                                >הכי חדשים</div>
                                                                <div
                                                                    className={`px-4 py-2.5 text-sm text-right transition-colors ${sortOrder === 'random' ? 'text-white font-bold bg-white/10' : 'text-white/70 hover:bg-white/5'}`}
                                                                    onClick={(e) => { e.stopPropagation(); setSortOrder('random'); setIsSortOpen(false); }}
                                                                >אקראי</div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Mobile Explanation overlay (Float atop the image in mobile) */}
                                        {showExplanation && (
                                            <div className="absolute inset-4 lg:hidden z-40 bg-black/80 backdrop-blur-md rounded-2xl p-5 border border-white/20 shadow-2xl overflow-y-auto animate-in fade-in zoom-in-95 custom-scrollbar flex flex-col">
                                                <button onClick={() => setShowExplanation(false)} className="self-end p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors mb-2 shrink-0">
                                                    <X size={20} />
                                                </button>
                                                <div className="flex-1">
                                                    <h3 className={`text-xl font-bold mb-3 text-transparent bg-clip-text bg-gradient-to-r ${theme.titleGrad} text-center`}>ההסבר</h3>
                                                    <p className={`text-base text-white/90 leading-relaxed text-right dir-rtl font-medium`}>
                                                        {fileMetadata?.explanation}
                                                    </p>
                                                    <div className="mt-6 pt-3 border-t border-white/10 text-white/50 text-xs font-medium text-right dir-rtl">
                                                        * ההסבר נוסח ע"י בינה מלאכותית (AI) ועלול להכיל אי דיוקים.
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                </div>
                            </div>

                        </div>
                    )}
                </div>

                {/* ── Right/Side: About Section ── */}
                <div className="w-full lg:w-[380px] xl:w-[440px] shrink-0 mt-2 lg:mt-0 flex flex-col bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-[2.5rem] shadow-2xl relative min-h-0">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none rounded-[2.5rem]" />

                    {/* Desktop Floating Explanation View */}
                    {showExplanation && (
                        <div className="hidden lg:flex absolute inset-0 z-30 bg-slate-900/95 backdrop-blur-3xl rounded-[2.5rem] p-6 lg:p-8 border border-white/20 shadow-[0_0_40px_rgba(0,0,0,0.6)] animate-in fade-in zoom-in-95 duration-200 flex flex-col overflow-y-auto">
                            <button onClick={() => setShowExplanation(false)} className="self-end p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors mb-4 shrink-0">
                                <X size={20} />
                            </button>
                            <div className="text-center pb-4 flex-1 flex flex-col justify-between">
                                <div>
                                    <h3 className={`text-2xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r ${theme.titleGrad}`}>ההסבר</h3>
                                    <p className={`text-lg md:text-xl ${theme.explainTextCls} leading-relaxed mx-auto font-medium`}>
                                        {fileMetadata?.explanation}
                                    </p>
                                </div>
                                <div className="mt-8 pt-4 border-t border-white/10 text-white/40 text-xs sm:text-sm font-medium">
                                    * ההסבר נוסח ע"י בינה מלאכותית (AI) ועלול להכיל אי דיוקים.
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="p-4 sm:p-6 flex flex-col items-center flex-1 h-full min-h-0 overflow-y-auto w-full no-scrollbar">
                        {/* Hidden on mobile, shown on lg screens */}
                        <div className="hidden lg:flex flex-col items-center w-full">
                            <div className="flex justify-center mb-0 sm:mb-2 w-full shrink-0">
                                <img
                                    src="./logo.png"
                                    alt="כפלשון"
                                    className="h-20 sm:h-24 md:h-28 object-contain drop-shadow-[0_0_20px_rgba(236,72,153,0.5)] transition-transform hover:scale-105"
                                    style={{ transform: 'scaleX(1.15)' }}
                                />
                            </div>

                            <div className="flex flex-col gap-4 sm:gap-6 items-center text-slate-300 w-full shrink-0 mb-6">
                                <div className="leading-relaxed text-center font-medium text-sm sm:text-base lg:text-lg">
                                    ברוכים הבאים ל<strong className="text-white mx-1 xl:text-xl drop-shadow-md">'כפלשון'</strong>!
                                    <br />
                                    <span>
                                        {images.length} איורים דיגיטליים ויצירות AI הממחישים ביטויים, כפל לשון ומשחקי מילים בעברית — להעלות חיוך ולחגוג את השפה בצורתה הכיפית ביותר.
                                    </span>
                                    <br />
                                    <span className="text-purple-400 font-semibold flex items-center justify-center gap-2 mt-2 xl:text-xl">הכל ביצירת מוחי הקודח... 😊</span>
                                    <span className="text-indigo-300 font-bold block mt-1 xl:text-lg">ספי רייכקינד</span>
                                </div>
                            </div>
                        </div>

                        {/* Always visible logic (QR + Socials) */}
                        <div className="flex flex-col gap-3 items-center text-slate-300 w-full shrink-0 mt-auto">
                            {/* QR Code + Socials Side by Side */}
                            <div className="flex flex-row justify-center items-center gap-6 xl:gap-8 bg-black/30 p-4 xl:p-6 rounded-3xl border border-white/5 shadow-inner w-full flex-wrap sm:flex-nowrap">

                                {/* QR Image with Share action on click */}
                                <div
                                    className="w-[176px] h-[176px] relative group cursor-pointer rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] bg-white overflow-hidden shrink-0 flex items-center justify-center border-[3px] border-white/80 transition-all duration-500 hover:shadow-[0_0_40px_rgba(255,105,180,0.6)] hover:border-pink-300 hover:scale-[1.03]"
                                    onClick={async () => {
                                        const url = window.location.href;
                                        try {
                                            if (navigator.share) {
                                                await navigator.share({ title: 'כפלשון', url: url });
                                            } else {
                                                await navigator.clipboard.writeText(url);
                                                alert('הקישור הועתק הלוח!');
                                            }
                                        } catch (err) { }
                                    }}
                                >
                                    <img src="./qrcode.png" alt="QR Code" className="w-full h-full object-contain transition-transform duration-700 group-hover:scale-110 group-hover:rotate-1" />
                                    <div className="absolute inset-0 bg-black/75 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center text-white backdrop-blur-sm z-10">
                                        <Share2 size={36} className="mb-2 text-pink-400 drop-shadow-[0_0_8px_rgba(236,72,153,0.8)] animate-pulse" />
                                        <span className="text-sm font-bold text-center leading-tight tracking-wide px-2">לשיתוף האתר<br />לחץ כאן</span>
                                    </div>
                                </div>

                                {/* Social buttons stacked vertically (2 items ~ 80px + 16px gap = 176px total height) */}
                                <div className="flex flex-col h-[176px] justify-between shrink-0">
                                    <a
                                        href="https://whatsapp.com/channel/0029VajNwaPL2AU0jdlgxa20"
                                        target="_blank"
                                        rel="noreferrer"
                                        className="group relative flex items-center justify-center text-[#128C7E] hover:text-white hover:bg-[#128C7E] transition-all hover:scale-105 drop-shadow-md border-[2.5px] border-[#128C7E] rounded-xl p-1 w-16 h-20"
                                        title="ערוץ"
                                    >
                                        <MessageCircle size={32} strokeWidth={1.5} className="shrink-0 mb-3 transition-transform group-hover:-translate-y-1" />
                                        <span className="absolute bottom-1.5 font-bold text-[#128C7E] group-hover:text-white text-[14px] transition-colors" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>ערוץ</span>
                                    </a>
                                    <a
                                        href="https://chat.whatsapp.com/LN6nwJ8cYiLHaj5uhTum9P"
                                        target="_blank"
                                        rel="noreferrer"
                                        className="group relative flex items-center justify-center text-[#25D366] hover:text-white hover:bg-[#25D366] transition-all hover:scale-105 drop-shadow-md border-[2.5px] border-[#25D366] rounded-xl p-1 w-16 h-20"
                                        title="קבוצה"
                                    >
                                        <MessageCircle size={32} strokeWidth={1.5} className="shrink-0 mb-3 transition-transform group-hover:-translate-y-1" />
                                        <span className="absolute bottom-1.5 font-bold text-[#25D366] group-hover:text-white text-[14px] transition-colors" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>קבוצה</span>
                                    </a>
                                </div>
                            </div>

                            <p className="text-white/60 text-sm mt-2 italic font-medium px-4 text-center">
                                אם יש לכם רעיון ליצירה, אל תהססו ליצור בעצמכם!<br />עזרה תמיד תינתן... צרו קשר באישי.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Theme Select Button ────────────────────────────────────────── */}
            <div className="fixed bottom-6 left-6 z-50">
                <button
                    onClick={() => setIsThemeMenuOpen(!isThemeMenuOpen)}
                    className={`${theme.themeBtnCls} p-3 sm:p-4 rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.6)] backdrop-blur-lg flex items-center justify-center transition-all hover:scale-110 active:scale-95 border-2`}
                >
                    <Palette size={26} className="drop-shadow-md" />
                </button>

                {isThemeMenuOpen && (
                    <div className="absolute bottom-full left-0 mb-4 bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl p-2 w-40 flex flex-col gap-1 shadow-2xl animate-in fade-in slide-in-from-bottom-5">
                        <div className="text-white/50 text-[10px] uppercase tracking-wider px-2 pt-1 pb-2 font-black">בחר עיצוב</div>
                        {THEMES.map((t, i) => (
                            <button
                                key={t.id}
                                onClick={() => setTheme(i)}
                                className={`text-right px-4 py-3 rounded-xl transition-all font-bold tracking-wide border border-transparent ${themeIndex === i
                                    ? 'bg-white/20 text-white border-white/30 shadow-inner'
                                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                                    }`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Fullscreen Lightbox ────────────────────────────────────────── */}
            {
                isFullscreen && (
                    <div
                        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 backdrop-blur-sm animate-in fade-in duration-200"
                        onTouchStart={onTouchStart}
                        onTouchMove={onTouchMove}
                        onTouchEnd={onTouchEnd}
                        onClick={() => setIsFullscreen(false)}
                    >
                        <button
                            className="absolute top-4 right-4 text-white bg-white/10 hover:bg-white/20 rounded-full p-3 transition-colors z-[80] cursor-pointer shadow-md"
                            onClick={(e) => { e.stopPropagation(); setIsFullscreen(false); }}
                        >
                            <X size={28} />
                        </button>

                        {/* Tooltip on first visit */}
                        {showTooltip && (
                            <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-indigo-500/90 text-white px-5 py-2.5 rounded-full font-bold shadow-[0_0_20px_rgba(99,102,241,0.6)] animate-in slide-in-from-top-4 fade-in z-[80] text-sm md:text-base pointer-events-none border border-white/20">
                                ✨ ניתן לעבור בין התמונות עם החיצים או גלגלת העכבר
                            </div>
                        )}

                        <div className="w-full h-full flex flex-row-reverse items-center justify-center gap-6 p-6 md:p-12 relative pointer-events-none z-50">

                            {/* Left Panel (Absolute overlay or fixed flex to avoid shrinking image) */}
                            {showFullscreenInfo ? (
                                <div className="hidden lg:flex absolute left-6 lg:left-12 top-1/2 -translate-y-1/2 w-[320px] xl:w-[380px] shrink-0 bg-black/80 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.8)] flex-col z-[75] max-h-[85vh] pointer-events-auto animate-in fade-in slide-in-from-left-8">
                                    <div className="px-6 pt-6 pb-4 border-b border-white/10 flex items-center justify-between">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setShowFullscreenInfo(false); }}
                                            className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors flex shrink-0 ml-3"
                                            title="הסתר פרטים"
                                        >
                                            <X size={20} />
                                        </button>
                                        {fileMetadata?.title ? (
                                            <h3 className="text-xl xl:text-2xl font-['Varela_Round',sans-serif] text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400 font-black leading-tight text-right flex-1 truncate ml-8">
                                                {fileMetadata.title}
                                            </h3>
                                        ) : (
                                            <span className="flex-1"></span>
                                        )}
                                    </div>

                                    {fileMetadata?.explanation && (
                                        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 text-right dir-rtl">
                                            <div className="text-white/90 text-[15px] xl:text-base leading-relaxed">
                                                {fileMetadata.explanation.split('\n').map((paragraph, index) => (
                                                    <p key={index} className="mb-4 last:mb-0">{paragraph}</p>
                                                ))}
                                            </div>
                                            <div className="mt-6 pt-3 border-t border-white/10 text-white/40 text-[11px] font-medium">
                                                * ההסבר נוסח ע"י בינה מלאכותית (AI) ועלול להכיל אי דיוקים.
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                /* When panel is hidden, show floating action button & title on the left */
                                <div className="hidden lg:flex absolute top-12 left-12 flex-row items-center gap-4 z-[80] pointer-events-auto">
                                    {(fileMetadata?.title || fileMetadata?.explanation) && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setShowFullscreenInfo(true); }}
                                            className="bg-white/10 hover:bg-white/20 text-white px-5 py-2.5 rounded-full backdrop-blur-md transition-colors border border-white/20 shadow-lg flex items-center gap-2 text-sm font-bold cursor-pointer"
                                        >
                                            <MessageCircle size={18} />
                                            הצג פרטים
                                        </button>
                                    )}
                                    {fileMetadata?.title && (
                                        <div className="bg-black/50 backdrop-blur-md px-5 py-2.5 rounded-xl border border-white/10 shadow-lg text-white font-bold max-w-[250px] truncate text-right dir-rtl text-sm">
                                            {fileMetadata.title}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Center Column: Perfectly Centered Image (Uses all available space but respects absolute left pane) */}
                            <div className="flex-1 flex flex-col items-center justify-center h-full max-h-[95vh] pointer-events-auto">
                                <div className="relative inline-flex items-center justify-center max-w-[70vw] lg:max-w-[50vw] xl:max-w-[60vw]">
                                    <img
                                        src={`./images/${encodeURIComponent(currentFile)}`}
                                        alt={fileMetadata?.title || 'תמונה'}
                                        className="max-h-[85vh] xl:max-h-[92vh] object-contain drop-shadow-[0_0_60px_rgba(0,0,0,0.9)] rounded-2xl cursor-zoom-out"
                                        onClick={(e) => { e.stopPropagation(); setIsFullscreen(false); }}
                                    />

                                    <button
                                        onClick={(e) => { e.stopPropagation(); nextImage(); }}
                                        disabled={currentIndex === displayImages.length - 1}
                                        className={`absolute top-1/2 -translate-y-1/2 -right-8 md:-right-16 z-[70] bg-black/50 text-white backdrop-blur-md p-3 md:p-4 rounded-full shadow-[0_0_16px_rgba(0,0,0,0.4)] disabled:opacity-0 disabled:pointer-events-none hover:bg-white/20 hover:scale-110 transition-all cursor-pointer`}
                                    >
                                        <ChevronRight size={28} />
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); prevImage(); }}
                                        disabled={currentIndex === 0}
                                        className={`absolute top-1/2 -translate-y-1/2 -left-8 md:-left-16 z-[70] bg-black/50 text-white backdrop-blur-md p-3 md:p-4 rounded-full shadow-[0_0_16px_rgba(0,0,0,0.4)] disabled:opacity-0 disabled:pointer-events-none hover:bg-white/20 hover:scale-110 transition-all cursor-pointer`}
                                    >
                                        <ChevronLeft size={28} />
                                    </button>
                                </div>
                            </div>

                        </div>
                    </div>
                )
            }

            {/* ── Search Modal ─────────────────────────────────────────────────── */}
            {
                isSearchOpen && (
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
                )
            }
        </div >
    );
}

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ChevronRight, ChevronLeft, Search, X, MessageCircle, Info, Palette, Linkedin, Share2 } from 'lucide-react';

// ── Themes ────────────────────────────────────────────────────────────────────
const THEMES = [
    {
        id: 'dark',
        label: '🌌 חלל עמוק',
        className: 'theme-dark-purple',
        textClass: 'text-cyan-400',
        bgStyle: 'bg-slate-950',
        frameGrad: 'from-pink-500 via-purple-500 to-cyan-500',
        innerBg: 'bg-slate-900',
        titleGrad: 'from-cyan-400 to-purple-400',
        headerBtnSearchCls: 'bg-cyan-500/20 hover:bg-cyan-500/40 border-cyan-400/50 text-cyan-100 shadow-[0_4px_15px_rgba(34,211,238,0.2)] hover:shadow-[0_4px_20px_rgba(34,211,238,0.4)]',
        headerBtnAboutCls: 'bg-purple-500/20 hover:bg-purple-500/40 border-purple-400/50 text-purple-100 shadow-[0_4px_15px_rgba(168,85,247,0.2)] hover:shadow-[0_4px_20px_rgba(168,85,247,0.4)]',
        navBtnCls: 'bg-slate-900 text-cyan-400 border-cyan-500/30',
        explainBtnCls: 'text-cyan-400 hover:text-cyan-300',
        explainTextCls: 'text-slate-200',
        glowClass: 'from-cyan-500/20',
        topicBadgeCls: 'bg-purple-600 border-purple-400',
        themeBtnCls: 'bg-slate-900/80 border-cyan-500/50 text-cyan-400 hover:bg-slate-800',
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
        id: 'light',
        label: '☀️ יום בהיר',
        className: 'theme-light',
        textClass: 'text-violet-600',
        bgStyle: 'bg-slate-100',
        frameGrad: 'from-sky-300 via-indigo-300 to-pink-300',
        innerBg: 'bg-white',
        titleGrad: 'from-violet-600 to-fuchsia-600',
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
        navBtnCls: 'bg-[#2d1b00] text-orange-400 border-amber-300/40',
        explainBtnCls: 'text-amber-300/70 hover:text-amber-200',
        explainTextCls: 'text-amber-50',
        glowClass: 'from-orange-500/20',
        topicBadgeCls: 'bg-fuchsia-600 border-fuchsia-400',
        themeBtnCls: 'bg-[#1c0a00]/80 border-amber-500/50 text-amber-300 hover:bg-amber-900/40',
    },
];


// ── Sub-Components ───────────────────────────────────────────────────────────
const SingleViewHeader = ({ 
    currentIndex, displayImages, 
    viewMode, setViewMode, theme, setIsSearchOpen, isMobile
}) => {
    return (
        <div className="flex items-center justify-between px-3 sm:px-6 py-2 sm:py-3 border-b border-white/5 bg-black/20 shrink-0 min-h-[50px] sm:min-h-0">
            {/* Index indicator */}
            <div className={`flex items-center gap-1.5 ${theme.textClass} font-bold text-xs sm:text-sm`}>
                <span className="opacity-50 font-medium">תמונה</span>
                <span>{displayImages.length > 0 ? currentIndex + 1 : 0}</span>
                <span className="opacity-30">/</span>
                <span className="opacity-50">{displayImages.length}</span>
            </div>

            {/* Middle: Grid/Single Toggles (Hidden on Mobile) */}
            {!isMobile && (
                <div className="flex items-center gap-1 sm:gap-2">
                    <button 
                        onClick={() => setViewMode('grid-3x4')}
                        className={`p-1.5 sm:p-2 rounded-lg transition-all ${viewMode === 'grid-3x4' ? `bg-gradient-to-br ${theme.frameGrad} text-white shadow-lg` : 'hover:bg-white/5 text-white/40'}`}
                        title="תצוגת רשת צפופה"
                    >
                        <div className="grid grid-cols-4 grid-rows-3 gap-[2px] w-4 h-4 sm:w-5 sm:h-5">
                            {[...Array(12)].map((_, i) => <div key={i} className="bg-current rounded-[1px] aspect-square"></div>)}
                        </div>
                    </button>
                    <button 
                        onClick={() => setViewMode('grid-2x3')}
                        className={`p-1.5 sm:p-2 rounded-lg transition-all ${viewMode === 'grid-2x3' ? `bg-gradient-to-br ${theme.frameGrad} text-white shadow-lg` : 'hover:bg-white/5 text-white/40'}`}
                        title="תצוגת רשת"
                    >
                        <div className="grid grid-cols-3 grid-rows-2 gap-[2px] w-4 h-4 sm:w-5 sm:h-5">
                            {[...Array(6)].map((_, i) => <div key={i} className="bg-current rounded-[1px] aspect-square"></div>)}
                        </div>
                    </button>
                    <button 
                        onClick={() => setViewMode('single')}
                        className={`p-1.5 sm:p-2 rounded-lg transition-all ${viewMode === 'single' ? `bg-gradient-to-br ${theme.frameGrad} text-white shadow-lg` : 'hover:bg-white/5 text-white/40'}`}
                        title="תצוגת יחיד"
                    >
                        <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-current rounded-sm"></div>
                    </button>
                </div>
            )}

            {/* Left: Search Trigger */}
            <button 
                onClick={() => setIsSearchOpen(true)}
                className={`p-2 rounded-full transition-all hover:scale-110 active:scale-95 ${theme.headerBtnSearchCls} sm:bg-white/5 sm:hover:bg-white/10`}
                title="חפש ביצירות"
            >
                <Search className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
        </div>
    );
};

export default function PublicGallery({ images, metadata }) {
    const [shuffledImages, setShuffledImages] = useState([]);
    const isSelectingResult = useRef(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [showExplanation, setShowExplanation] = useState(false);
    const [hasSeenTooltip, setHasSeenTooltip] = useState(() => localStorage.getItem('kefel-tooltip') === 'true');
    const [showTooltip, setShowTooltip] = useState(false);
    const [showFullscreenInfo, setShowFullscreenInfo] = useState(true);
    const [sortOrder, setSortOrder] = useState('random'); // 'newest', 'oldest' or 'random'
    const [viewMode, setViewMode] = useState('single'); // 'single', 'grid-2x3', 'grid-3x4'
    const [activeMobileTab, setActiveMobileTab] = useState('info');
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

    // Sidebar dynamic height measurement
    const sidebarRef = useRef(null);
    const [sidebarH, setSidebarH] = useState(700);
    const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 1024);
    
    // Gallery container measurement for adaptive grid
    const galleryRef = useRef(null);
    const [galleryAspectRatio, setGalleryAspectRatio] = useState(1.5);

    useEffect(() => {
        const measure = () => {
            if (sidebarRef.current) {
                const h = sidebarRef.current.getBoundingClientRect().height;
                if (h > 0) setSidebarH(h);
            }
            if (galleryRef.current) {
                const rect = galleryRef.current.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                    setGalleryAspectRatio(rect.width / rect.height);
                }
            }
            setIsMobile(window.innerWidth < 1024);
        };
        measure();
        const raf = requestAnimationFrame(measure);
        const t = setTimeout(measure, 300);
        window.addEventListener('resize', measure);
        const ro = new ResizeObserver(measure);
        if (sidebarRef.current) ro.observe(sidebarRef.current);
        if (galleryRef.current) ro.observe(galleryRef.current);
        return () => {
            cancelAnimationFrame(raf);
            clearTimeout(t);
            window.removeEventListener('resize', measure);
            ro.disconnect();
        };
    }, []);

    const theme = THEMES[themeIndex];

    const setTheme = (idx) => {
        setThemeIndex(idx);
        setIsThemeMenuOpen(false);
        try { localStorage.setItem('kefel-theme', THEMES[idx].id); } catch { }
    };

    useEffect(() => {
        const sortArray = (arr) => {
            if (sortOrder === 'newest' || sortOrder === 'oldest') {
                return [...arr].sort((a, b) => {
                    const dateA = metadata[a]?.dateMillis || 0;
                    const dateB = metadata[b]?.dateMillis || 0;
                    if (dateA !== dateB) {
                        return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
                    }
                    const extractDate = (filename) => {
                        const match = filename.match(/_(\d{8})_(\d{6})_/);
                        return match ? parseInt(match[1] + match[2], 10) : 0;
                    };
                    const fbA = extractDate(a);
                    const fbB = extractDate(b);
                    if (fbA && fbB) {
                        return sortOrder === 'newest' ? fbB - fbA : fbA - fbB;
                    }
                    return 0;
                });
            } else {
                const shuffled = [...arr];
                for (let i = shuffled.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                }
                return shuffled;
            }
        };

        if (sortOrder === 'newest' || sortOrder === 'oldest') {
            setShuffledImages(sortArray(images));
        } else {
            const tagged = [];
            const untagged = [];
            images.forEach(img => {
                const hasInfo = metadata[img]?.title || metadata[img]?.explanation;
                if (hasInfo) tagged.push(img);
                else untagged.push(img);
            });
            const sorted = [...sortArray(tagged), ...sortArray(untagged)];
            setShuffledImages(sorted);
        }
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

    const getGridSize = () => {
        if (viewMode === 'single') return 1;
        const isSquare = galleryAspectRatio < 1.35;
        if (viewMode === 'grid-3x4') return isSquare ? 9 : 12;
        if (viewMode === 'grid-2x3') return isSquare ? 4 : 6;
        return 1;
    };

    const nextImage = () => {
        const step = getGridSize();
        if (currentIndex + step < displayImages.length) {
            setCurrentIndex(p => p + step);
            setShowExplanation(false);
        } else if (currentIndex < displayImages.length - 1) {
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

    const handleQRCodeClick = useCallback(async (e) => {
        if (e) e.stopPropagation();
        const url = window.location.href;
        const qrImagePath = './qrcode.webp';
        try {
            const response = await fetch(qrImagePath);
            const blob = await response.blob();
            const file = new File([blob], 'qrcode.webp', { type: blob.type });
            if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: 'כפלשון - QR Code',
                    text: 'סרקו והצטרפו לגלריית כפלשון!'
                });
                return;
            }
            if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
                try {
                    await navigator.clipboard.write([
                        new ClipboardItem({ [blob.type]: blob })
                    ]);
                    alert('תמונת ה-QR הועתקה ללוח! ניתן להדביק אותה בצ\'אט.');
                    return;
                } catch (clipboardErr) {
                    console.error('Clipboard image copy failed', clipboardErr);
                }
            }
            if (navigator.clipboard) {
                await navigator.clipboard.writeText(url);
                alert('הקישור לאתר הועתק ללוח!');
            }
        } catch (err) {
            console.error('Sharing failed', err);
            if (navigator.clipboard) {
                navigator.clipboard.writeText(url).catch(() => {});
                alert('הקישור לאתר הועתק ללוח!');
            }
        }
    }, []);

    useEffect(() => { 
        if (isSelectingResult.current) {
            isSelectingResult.current = false;
            return;
        }
        if (searchQuery || viewMode !== 'single') {
            setCurrentIndex(0); 
        }
    }, [searchQuery, viewMode]);

    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 640 && viewMode !== 'single') {
                setViewMode('single');
            }
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [viewMode]);

    const [globalTouchStartX, setGlobalTouchStartX] = useState(0);
    const [globalTouchEndX, setGlobalTouchEndX] = useState(0);

    const onGlobalTouchStart = (e) => {
        setGlobalTouchEndX(0);
        setGlobalTouchStartX(e.targetTouches[0].clientX);
    };
    const onGlobalTouchMove = (e) => setGlobalTouchEndX(e.targetTouches[0].clientX);
    const onGlobalTouchEnd = (e) => {
        if (e.target.closest('.image-swipe-area')) return;
        if (!globalTouchStartX || !globalTouchEndX) return;
        const distance = globalTouchStartX - globalTouchEndX;
        if (distance > 60 && activeMobileTab === 'info') setActiveMobileTab('gallery');
        if (distance < -60 && activeMobileTab === 'gallery') setActiveMobileTab('info');
    };

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
        if (distance > minSwipeDistance) nextImage();
        if (distance < -minSwipeDistance) prevImage();
    };

    useEffect(() => {
        const handleWheel = (e) => {
            if (!isFullscreen) return;
            if (e.deltaY > 0) nextImage();
            else if (e.deltaY < 0) prevImage();
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
            className={`h-[100dvh] lg:h-screen lg:overflow-hidden ${theme.bgStyle} text-white font-['Fredoka',sans-serif] flex flex-col items-center ${isMobile ? 'justify-center px-4 py-4' : 'lg:py-6'} relative ${theme.className} overflow-hidden`}
            style={{ letterSpacing: '0.01em' }}
        >
            {/* ── Main Layout Container ── */}
            <div 
                className={`relative w-full max-w-[1400px] px-0 lg:px-4 mx-auto flex flex-col lg:flex-row gap-8 lg:gap-12 ${isMobile ? 'items-center justify-center' : 'items-stretch justify-center'} flex-1 min-h-0`}
                onTouchStart={isMobile ? onGlobalTouchStart : undefined}
                onTouchMove={isMobile ? onGlobalTouchMove : undefined}
                onTouchEnd={isMobile ? onGlobalTouchEnd : undefined}
            >
                {/* Mobile Floating Tab Toggle */}
                {isMobile && (
                    <div className="fixed top-6 right-6 z-[60] pointer-events-none">
                        <button 
                            onClick={(e) => { e.stopPropagation(); setActiveMobileTab(activeMobileTab === 'info' ? 'gallery' : 'info'); }}
                            className={`${theme.headerBtnAboutCls} px-5 py-2 rounded-full backdrop-blur-md border border-white/20 shadow-2xl transition-all hover:scale-105 active:scale-95 flex items-center justify-center text-sm font-bold pointer-events-auto`}
                        >
                            {activeMobileTab === 'info' ? 'לגלריה' : 'לדף הראשי'}
                        </button>
                    </div>
                )}

                {/* ── Left/Main: Search + Image Frame ── */}
                <div className={`${!isMobile && viewMode === 'single' ? 'w-fit flex-none' : 'w-full flex-1'} max-w-2xl md:max-w-4xl flex-col items-center relative shrink-0 mx-auto min-h-0 ${isMobile && activeMobileTab === 'info' ? 'hidden' : 'flex'}`}>
                    {displayImages.length === 0 ? (
                        <div className="text-center bg-white/10 backdrop-blur-lg p-12 rounded-3xl border border-white/20">
                            <span className="text-6xl mb-4 block">😢</span>
                            <h2 className="text-2xl font-bold text-white mb-2">לא מצאנו מה שחיפשת...</h2>
                            <p className={theme.textClass}>נסה מילת חיפוש אחרת!</p>
                        </div>
                    ) : (
                        <div className="w-full relative flex-1 flex flex-col min-h-0">
                            <div
                                className={`relative ${!isMobile ? 'aspect-square h-full w-auto flex-none' : 'w-full flex-1'} max-w-full max-h-full p-[3px] sm:p-1.5 md:p-[10px] rounded-[2rem] sm:rounded-[2.5rem] shadow-[0_20px_60px_rgba(0,0,0,0.55)] flex flex-col min-h-0 ${isMobile ? 'mt-0' : 'mt-0 lg:mt-0'} bg-gradient-to-br ${theme.frameGrad} mx-auto`}
                                style={{ willChange: 'transform', ...(!isMobile && sidebarH ? { width: `${sidebarH}px` } : {}) }}
                            >
                                {/* Nav Arrows - Desktop */}
                                <button onClick={(e) => { e.stopPropagation(); nextImage(); }} style={{ right: '5px' }} className={`hidden lg:flex absolute top-1/2 -translate-y-1/2 translate-x-1/2 z-50 w-12 h-12 md:w-14 md:h-14 rounded-full bg-gradient-to-br ${theme.frameGrad} items-center justify-center shadow-lg transition-all hover:scale-110 ${currentIndex + getGridSize() >= displayImages.length ? 'opacity-0 pointer-events-none' : ''}`}>
                                    <div className={`w-9 h-9 md:w-10 md:h-10 rounded-full ${theme.innerBg} flex items-center justify-center`}>
                                        <ChevronRight className={`w-5 h-5 md:w-6 md:h-6 ${theme.textClass}`} />
                                    </div>
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); prevImage(); }} style={{ left: '5px' }} className={`hidden lg:flex absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-50 w-12 h-12 md:w-14 md:h-14 rounded-full bg-gradient-to-br ${theme.frameGrad} items-center justify-center shadow-lg transition-all hover:scale-110 ${currentIndex === 0 ? 'opacity-0 pointer-events-none' : ''}`}>
                                    <div className={`w-9 h-9 md:w-10 md:h-10 rounded-full ${theme.innerBg} flex items-center justify-center`}>
                                        <ChevronLeft className={`w-5 h-5 md:w-6 md:h-6 ${theme.textClass}`} />
                                    </div>
                                </button>

                                <div className={`relative ${theme.innerBg} rounded-[1.8rem] sm:rounded-[2.2rem] flex flex-col ${!isMobile ? 'w-full h-full' : 'flex-1 w-full'} min-h-0 overflow-hidden mx-auto`}>
                                        {!isMobile && viewMode === 'single' && (
                                            <div className="px-3 sm:px-6 py-4 flex items-center justify-between gap-3 relative flex-shrink-0 z-20 w-full min-h-[5rem] overflow-hidden">
                                                <div className={`absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r ${theme.frameGrad} opacity-60`} />
                                                {/* Right: Search button */}
                                                <div className="relative z-10 flex-shrink-0 flex items-center justify-start w-24 sm:w-28">
                                                    <button
                                                        onClick={() => setIsSearchOpen(true)}
                                                        className={`w-10 h-10 lg:w-11 lg:h-11 rounded-full backdrop-blur-md flex items-center justify-center ${theme.headerBtnSearchCls} animate-in fade-in duration-300 ml-auto`}
                                                        title="חיפוש"
                                                    >
                                                        <Search size={20} />
                                                    </button>
                                                </div>

                                                {/* Center: Title absolutely centered within the bar (only single mode) */}
                                                <div className="flex-1 w-full flex items-center justify-center px-1 overflow-hidden">
                                                    <h2
                                                        className={`text-[clamp(1.3rem,4vw,2.5rem)] font-['Varela_Round',sans-serif] text-transparent bg-clip-text bg-gradient-to-r ${theme.titleGrad} text-center tracking-wide leading-tight transition-opacity duration-300 break-words line-clamp-2`}
                                                        style={{ filter: 'drop-shadow(0 2px 8px rgba(34,211,238,0.25))' }}
                                                    >
                                                        {fileMetadata?.title || ''}
                                                    </h2>
                                                </div>

                                                {/* Left: Explain button overlay trigger (only single mode) */}
                                                <div className="relative z-50 w-24 sm:w-28 flex items-center justify-start flex-shrink-0">
                                                    {fileMetadata?.explanation ? (
                                                        <button
                                                            onClick={() => setShowExplanation(!showExplanation)}
                                                            className={`flex items-center gap-1.5 p-1.5 sm:p-2 px-3 sm:px-4 rounded-full backdrop-blur-md transition-all border border-cyan-500/30 hover:border-cyan-400 bg-slate-900/60 hover:bg-slate-800/80 text-cyan-50 shadow-[0_4px_12px_rgba(0,0,0,0.5)] whitespace-nowrap text-xs sm:text-sm font-bold animate-in fade-in duration-300`}
                                                        >
                                                            <div className="flex flex-col items-end leading-snug text-right pointer-events-none">
                                                                <span>להסבר</span>
                                                                <span className="text-cyan-200">לחץ כאן</span>
                                                            </div>
                                                            <ChevronLeft size={18} sm={{ size: 22 }} strokeWidth={2.5} className={`transition-transform duration-300 shrink-0 text-cyan-400 ${showExplanation ? '-rotate-90' : 'rotate-0'}`} />
                                                        </button>
                                                    ) : <div className="invisible w-full h-10"></div>}
                                                </div>
                                            </div>
                                        )}

                                        <div className={`relative flex-1 flex flex-col justify-center items-center h-full ${!isMobile && viewMode === 'single' ? 'w-auto' : 'w-full'} min-h-0`}>
                                            {/* Mobile: Consolidated Header Row (Search | Title | Explanation) */}
                                            {isMobile && viewMode === 'single' && (
                                                <div className="relative w-full flex items-center justify-between gap-2 px-4 mb-4 mt-14 shrink-0">
                                                    {/* Right: Search (Starts from right in RTL) */}
                                                    <button
                                                        onClick={() => setIsSearchOpen(true)}
                                                        className={`w-9 h-9 min-w-[36px] rounded-full backdrop-blur-md flex items-center justify-center ${theme.headerBtnSearchCls} border border-white/10 shrink-0`}
                                                        title="חיפוש"
                                                    >
                                                        <Search size={16} />
                                                    </button>

                                                    {/* Middle: Centered Title - Absolutely centered relative to the screen */}
                                                    <div className="absolute left-1/2 -translate-x-1/2 w-[55%] pointer-events-none z-10">
                                                        {fileMetadata && fileMetadata.title && (
                                                            <h2 className={`text-xl font-['Varela_Round',sans-serif] font-bold text-center dir-rtl text-transparent bg-clip-text bg-gradient-to-r ${theme.titleGrad} drop-shadow-md tracking-wide truncate`}>
                                                                {fileMetadata.title}
                                                            </h2>
                                                        )}
                                                    </div>

                                                    {/* Left: Explanation */}
                                                    {fileMetadata && fileMetadata.explanation ? (
                                                        <button 
                                                            onClick={() => setShowExplanation(p => !p)} 
                                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/60 border border-cyan-500/30 text-cyan-50 text-xs font-bold shadow-lg transition-transform active:scale-95 shrink-0"
                                                        >
                                                            <span>הסבר</span>
                                                            <Info className={`w-3.5 h-3.5 transition-transform ${showExplanation ? '-rotate-90' : 'rotate-0'}`} />
                                                        </button>
                                                    ) : <div className="w-9" />}
                                                </div>
                                            )}

                                            {/* Image Area */}
                                            <div className="relative w-full flex-1 flex flex-col min-h-0" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
                                                <div 
                                                    ref={galleryRef}
                                                    className={`relative flex-1 flex flex-col items-center justify-center bg-white/5 backdrop-blur-[2px] w-full h-full ${viewMode === 'single' ? 'aspect-square' : ''} max-h-full max-w-full overflow-hidden cursor-zoom-in min-h-0 mx-auto animate-pulse-slow`} 
                                                    onClick={() => viewMode === 'single' ? openFullscreen() : null}
                                                >
                                                    <div className={`absolute inset-0 bg-gradient-to-t ${theme.glowClass} to-transparent opacity-50 mix-blend-screen pointer-events-none`} />
                                                    {viewMode === 'single' ? (
                                                        <img 
                                                            key={currentFile} 
                                                            src={`./images/${encodeURIComponent(currentFile.replace(/\.(jpg|jpeg|png)$/i, '.webp'))}?v=${fileMetadata?.dateMillis || ''}`} 
                                                            alt={fileMetadata?.title || 'תמונה'} 
                                                            className="w-full h-full object-contain filter drop-shadow-2xl relative z-10 animate-in zoom-in-95 duration-500" 
                                                            onError={(ev) => { ev.currentTarget.src = `./images/${encodeURIComponent(currentFile)}`; }}
                                                        />
                                                    ) : (
                                                        <div className={`grid gap-2 sm:gap-4 p-2 w-full h-full relative z-10 items-center justify-items-center ${
                                                            viewMode === 'grid-3x4' 
                                                                ? (galleryAspectRatio < 1.35 ? 'grid-cols-3 grid-rows-3' : 'grid-cols-4 grid-rows-3') 
                                                                : (galleryAspectRatio < 1.35 ? 'grid-cols-2 grid-rows-2' : 'grid-cols-3 grid-rows-2')
                                                        }`}>
                                                            {displayImages.slice(currentIndex, currentIndex + getGridSize()).map((file, idx) => (
                                                                <div key={file} className="relative aspect-square w-full h-full flex items-center justify-center cursor-zoom-in group" onClick={(e) => { e.stopPropagation(); setCurrentIndex(currentIndex + idx); setViewMode('single'); openFullscreen(); }}>
                                                                    <img 
                                                                        src={`./images/${encodeURIComponent(file.replace(/\.(jpg|jpeg|png)$/i, '.webp'))}?v=${metadata[file]?.dateMillis || ''}`} 
                                                                        className="w-full h-full object-contain filter drop-shadow-md rounded-xl transition-transform group-hover:scale-105" 
                                                                        onError={(ev) => { ev.currentTarget.src = `./images/${encodeURIComponent(file)}`; }}
                                                                    />
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Mobile Explanation Overlay */}
                                                {showExplanation && (
                                                    <div className="absolute inset-4 lg:hidden z-50 bg-black/90 backdrop-blur-lg rounded-2xl p-5 border border-white/20 shadow-2xl overflow-y-auto animate-in fade-in zoom-in-95 flex flex-col">
                                                        <button onClick={() => setShowExplanation(false)} className="self-end p-2 bg-white/10 rounded-full text-white mb-2"><X size={20} /></button>
                                                        <div className="flex-1 text-right dir-rtl">
                                                            <h3 className={`text-xl font-bold mb-3 text-transparent bg-clip-text bg-gradient-to-r ${theme.titleGrad}`}>ההסבר</h3>
                                                            <p className="text-base text-white/90 leading-relaxed font-medium">{fileMetadata?.explanation}</p>
                                                            <div className="mt-6 pt-3 border-t border-white/10 text-white/40 text-[10px]">
                                                                * ההסבר נוסח ע"י בינה מלאכותית (AI).
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Mobile Nav Bar */}
                                            <div className="lg:hidden flex flex-col gap-2 p-2 sm:p-3 border-t border-white/10 bg-black/20">
                                                <div className="flex items-center justify-center gap-4">
                                                    <button onClick={(e) => { e.stopPropagation(); prevImage(); }} disabled={currentIndex === 0} className={`w-[110px] flex items-center justify-center gap-2 py-2 rounded-xl bg-gradient-to-br ${theme.frameGrad} shadow-lg disabled:opacity-20 shrink-0`}>
                                                        <ChevronRight size={18} /> <span className="text-xs font-bold tracking-tight">הקודם</span>
                                                    </button>
                                                    <div className="w-16 flex items-center justify-center">
                                                        <span className="text-white/50 text-[10px] tabular-nums font-bold">{currentIndex + 1} / {displayImages.length}</span>
                                                    </div>
                                                    <button onClick={(e) => { e.stopPropagation(); nextImage(); }} disabled={currentIndex + getGridSize() >= displayImages.length} className={`w-[110px] flex items-center justify-center gap-2 py-2 rounded-xl bg-gradient-to-br ${theme.frameGrad} shadow-lg disabled:opacity-20 shrink-0`}>
                                                        <span className="text-xs font-bold tracking-tight">הבא</span> <ChevronLeft size={18} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Tag Footer - Strictly Fixed Height to Prevent Layout Shift */}
                                        <div className={`bg-black/50 backdrop-blur-md border-t border-white/10 p-3 sm:p-4 rounded-b-[1.8rem] sm:rounded-b-[2.2rem] flex flex-col sm:flex-row items-center justify-center sm:justify-between gap-4 relative z-30 shrink-0 flex-none overflow-hidden ${viewMode === 'single' ? 'h-[110px] lg:h-[90px]' : ''}`}>
                                            <div className="flex flex-wrap gap-2 items-center justify-center flex-1">
                                                <span className="text-white/60 text-sm font-bold">תגיות:</span>
                                                {(() => {
                                                    const rawTags = fileMetadata?.tags || fileMetadata?.topic || '';
                                                    const tagsList = Array.isArray(rawTags) ? rawTags : rawTags.split(',').map(t => t.trim()).filter(Boolean);
                                                    if (tagsList.length === 0 || viewMode !== 'single') return <span className="text-white/30 text-sm italic">אין תגיות</span>;
                                                    // Advanced Tag Compression to prevent layout shifts
                                                    const finalTags = isMobile ? tagsList.slice(0, 5) : tagsList;
                                                    const tagsCount = finalTags.length;
                                                    // Advanced Tag Compression to prevent layout shifts
                                                    const tagSizeClass = !isMobile 
                                                        ? (tagsCount > 15 ? 'text-[9px] px-1.5 py-0.5' : (tagsCount > 10 ? 'text-[10px] px-2 py-0.5' : (tagsCount > 6 ? 'text-xs px-2.5 py-1' : 'text-sm px-3 py-1'))) 
                                                        : 'text-sm px-3 py-1';
                                                    
                                                    return finalTags.map(tag => (
                                                        <button
                                                            key={tag}
                                                            onClick={(e) => { e.stopPropagation(); setSearchQuery(searchQuery === tag ? '' : tag); }}
                                                            className={`rounded-full text-white font-bold transition-all hover:scale-105 shadow-sm z-40 relative border shrink-0 ${tagSizeClass} ${
                                                                searchQuery === tag 
                                                                    ? 'bg-emerald-500/80 hover:bg-emerald-400 border-emerald-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]' 
                                                                    : 'bg-white/10 hover:bg-white/20 border-white/10 font-medium'
                                                            }`}
                                                            title={searchQuery === tag ? "נקה סינון זה" : "לחץ כדי להציג את כל התמונות עם תג זה"}
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
                                                    <button onClick={() => setViewMode('grid-2x3')} className={`p-1 rounded transition-colors ${viewMode === 'grid-2x3' ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white'}`} title={`רשת ${galleryAspectRatio < 1.35 ? '2x2' : '2x3'}`}>
                                                        <div className={`w-5 h-5 grid ${galleryAspectRatio < 1.35 ? 'grid-cols-2 grid-rows-2' : 'grid-cols-3 grid-rows-2'} gap-[2px]`}>
                                                            <div className="bg-current rounded-[1px] aspect-square"></div><div className="bg-current rounded-[1px] aspect-square"></div>
                                                            {galleryAspectRatio >= 1.35 && <div className="bg-current rounded-[1px] aspect-square"></div>}
                                                            <div className="bg-current rounded-[1px] aspect-square"></div><div className="bg-current rounded-[1px] aspect-square"></div>
                                                            {galleryAspectRatio >= 1.35 && <div className="bg-current rounded-[1px] aspect-square"></div>}
                                                        </div>
                                                    </button>
                                                    <button onClick={() => setViewMode('grid-3x4')} className={`p-1 rounded transition-colors ${viewMode === 'grid-3x4' ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white'}`} title={`רשת ${galleryAspectRatio < 1.35 ? '3x3' : '3x4'}`}>
                                                        <div className={`w-5 h-5 grid ${galleryAspectRatio < 1.35 ? 'grid-cols-3 grid-rows-3' : 'grid-cols-4 grid-rows-3'} gap-[1px]`}>
                                                            <div className="bg-current rounded-[1px] aspect-square"></div><div className="bg-current rounded-[1px] aspect-square"></div><div className="bg-current rounded-[1px] aspect-square"></div>
                                                            {galleryAspectRatio >= 1.35 && <div className="bg-current rounded-[1px] aspect-square"></div>}
                                                            <div className="bg-current rounded-[1px] aspect-square"></div><div className="bg-current rounded-[1px] aspect-square"></div><div className="bg-current rounded-[1px] aspect-square"></div>
                                                            {galleryAspectRatio >= 1.35 && <div className="bg-current rounded-[1px] aspect-square"></div>}
                                                            <div className="bg-current rounded-[1px] aspect-square"></div><div className="bg-current rounded-[1px] aspect-square"></div><div className="bg-current rounded-[1px] aspect-square"></div>
                                                            {galleryAspectRatio >= 1.35 && <div className="bg-current rounded-[1px] aspect-square"></div>}
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
                                                    <div className="relative flex items-center bg-transparent text-white text-sm font-medium pr-1 pl-6 hover:text-white/80 transition-colors z-10 w-[110px] justify-start whitespace-nowrap">
                                                        <span>{sortOrder === 'newest' ? 'הכי חדש' : (sortOrder === 'oldest' ? 'הכי ישן' : 'אקראי')}</span>
                                                        <div className={`absolute left-1 text-white/50 text-[10px] transition-transform ${isSortOpen ? 'rotate-180' : ''}`}>▼</div>

                                                        {/* Upwards Dropdown Menu (Click based) */}
                                                        {isSortOpen && (
                                                            <div className="absolute bottom-full left-0 mb-2 w-32 bg-slate-800/95 backdrop-blur-md rounded-xl border border-white/10 shadow-[0_5px_20px_rgba(0,0,0,0.5)] animate-in fade-in zoom-in-95 duration-200 z-50 flex flex-col overflow-hidden origin-bottom">
                                                                <div
                                                                    className={`px-4 py-2.5 text-sm text-right transition-colors ${sortOrder === 'newest' ? 'text-white font-bold bg-white/10' : 'text-white/70 hover:bg-white/5'}`}
                                                                    onClick={(e) => { e.stopPropagation(); setSortOrder('newest'); setIsSortOpen(false); }}
                                                                >הכי חדש</div>
                                                                <div
                                                                    className={`px-4 py-2.5 text-sm text-right transition-colors ${sortOrder === 'oldest' ? 'text-white font-bold bg-white/10' : 'text-white/70 hover:bg-white/5'}`}
                                                                    onClick={(e) => { e.stopPropagation(); setSortOrder('oldest'); setIsSortOpen(false); }}
                                                                >הכי ישן</div>
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
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                {!isMobile && (
                    <div ref={sidebarRef} className={`w-full lg:w-[380px] xl:w-[440px] shrink-0 mt-0 lg:mt-0 flex flex-col bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-[2.5rem] shadow-2xl relative min-h-0 lg:self-stretch`}>
                        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none rounded-[2.5rem]" />

                        {/* Desktop Floating Explanation View */}
                        {showExplanation && (
                            <div className="hidden lg:flex absolute inset-0 z-[100] bg-slate-900/95 backdrop-blur-3xl rounded-[2.5rem] p-6 lg:p-8 border border-white/20 shadow-[0_0_40px_rgba(0,0,0,0.6)] animate-in fade-in zoom-in-95 duration-200 flex flex-col overflow-y-auto">
                                <button onClick={() => setShowExplanation(false)} className="self-end p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors mb-4 shrink-0">
                                    <X size={20} />
                                </button>
                                <div className="text-center pb-4 flex-1 flex flex-col justify-between">
                                    <div>
                                        <h3 className={`text-2xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r ${theme.titleGrad}`}>ההסבר</h3>
                                        <p className={`text-lg md:text-xl ${theme.explainTextCls} leading-relaxed mx-auto font-medium text-right dir-rtl`}>
                                            {fileMetadata?.explanation}
                                        </p>
                                    </div>
                                    <div className="mt-8 pt-4 border-t border-white/10 text-white/40 text-xs sm:text-sm font-medium text-right dir-rtl">
                                        * ההסבר נוסח ע"י בינה מלאכותית (AI) ועלול להכיל אי דיוקים.
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="flex flex-col items-center justify-between flex-1 w-full lg:overflow-hidden no-scrollbar" style={{ height: '100%', padding: `${sidebarH * 0.032}px ${sidebarH * 0.03}px` }}>
                            <div className="flex flex-col items-center w-full flex-1">
                                <div className="flex flex-col items-center justify-around w-full flex-1 text-right dir-rtl">
                                    <div className="flex justify-center w-full shrink-0">
                                        <img src="./logo.webp" alt="כפלשון" className="object-contain drop-shadow-[0_0_32px_rgba(236,72,153,0.7)] transition-transform hover:scale-105" style={{ height: `${sidebarH * 0.23}px`, maxHeight: '160px', transform: 'scaleX(1.15)' }} onError={(e) => { e.target.onerror = null; e.target.src = './logo.png'; }} />
                                    </div>
                                    <div className="flex flex-col items-center text-slate-300 w-full shrink-0" style={{ gap: `${sidebarH * 0.008}px` }}>
                                        <div className="leading-relaxed text-center font-medium" style={{ fontSize: `${sidebarH * 0.024}px` }}>
                                            ברוכים הבאים ל<strong className="text-white mx-1 drop-shadow-md">'כפלשון'</strong>!
                                            <br />
                                            <span>
                                                <span className="mr-[3px]">{shuffledImages.length}</span> איורים דיגיטליים ויצירות AI הממחישים ביטויים, כפל לשון ומשחקי מילים בעברית – להעלות חיוך ולחגוג את השפה.
                                            </span>
                                            <br />
                                            <span className="text-purple-400 font-semibold flex items-center justify-center gap-1.5" style={{ marginTop: `${sidebarH * 0.008}px`, fontSize: `${sidebarH * 0.024}px` }}>הכל ביצירת מוחי הקודח... 😊</span>
                                            <span className="flex items-center justify-center gap-2 text-indigo-300 font-bold" style={{ marginTop: `${sidebarH * 0.008}px`, fontSize: `${sidebarH * 0.024}px` }}>
                                                ספי רייכקינד
                                                <a href="https://www.linkedin.com/in/sefi-riechkind-679b67136" target="_blank" rel="noreferrer" className="text-[#0077b5] hover:text-white hover:bg-[#0077b5] transition-all hover:scale-110 drop-shadow-md border border-[#0077b5] rounded-lg flex items-center justify-center bg-white/5 shrink-0" style={{ width: `${sidebarH * 0.038}px`, height: `${sidebarH * 0.038}px` }} title="לינקדאין">
                                                    <Linkedin style={{ width: `${sidebarH * 0.023}px`, height: `${sidebarH * 0.023}px` }} fill="currentColor" strokeWidth={1} className="shrink-0" />
                                                </a>
                                            </span>
                                        </div>
                                        <div className="w-full mt-4 px-2">
                                            <a href="https://links.payboxapp.com/pKXjNclWz1b" target="_blank" rel="noreferrer" className="flex items-center justify-between w-full rounded-2xl overflow-hidden transition-all hover:scale-[1.03] hover:brightness-110 shadow-[0_6px_24px_rgba(0,174,239,0.5)] border border-[#00d4ff]/30" style={{ background: 'linear-gradient(135deg, #0096CC 0%, #00AEEF 50%, #00C8F0 100%)', boxShadow: '0 6px 24px rgba(0,174,239,0.5), inset 0 1px 0 rgba(255,255,255,0.25)', padding: `${Math.max(10, sidebarH * 0.014)}px ${Math.max(14, sidebarH * 0.02)}px` }}>
                                                <div className="flex flex-col items-center text-center leading-tight flex-1">
                                                    <span className="text-white font-bold" style={{ fontSize: `${Math.max(13, sidebarH * 0.02)}px` }}>תנו טיפ בפייבוקס 💙</span>
                                                    <span className="text-white/80 font-medium" style={{ fontSize: `${Math.max(10, sidebarH * 0.015)}px` }}>האתר חינמי - תמכו בו!</span>
                                                </div>
                                                <img src="./paybox-logo.webp" alt="Paybox" className="h-8 w-auto shrink-0 brightness-0 invert" onError={(e) => { e.target.onerror = null; e.target.src = './paybox-logo.png'; }} />
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-col items-center text-slate-300 w-full shrink-0" style={{ gap: `${sidebarH * 0.008}px` }}>
                                <div className="flex flex-row justify-center items-center bg-black/30 rounded-3xl border border-white/5 shadow-inner w-full" style={{ gap: `${sidebarH * 0.02}px`, padding: `${sidebarH * 0.02}px` }}>
                                    <div className="relative group cursor-pointer rounded-2xl shadow-lg bg-white overflow-hidden shrink-0 flex items-center justify-center border-[3px] border-white/80 transition-all duration-500 hover:scale-[1.03]" style={{ width: `${sidebarH * 0.23}px`, height: `${sidebarH * 0.23}px` }} onClick={handleQRCodeClick}>
                                        <img src="./qrcode.webp" alt="QR Code" className="w-full h-full object-contain transition-transform duration-700 group-hover:scale-110" onError={(e) => { e.target.onerror = null; e.target.src = './qrcode.png'; }} />
                                        <div className="absolute inset-0 bg-black/75 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center text-white backdrop-blur-sm z-10">
                                            <Share2 size={28} className="mb-2 text-pink-400" />
                                            <span className="text-[11px] font-bold text-center leading-tight px-2">לשיתוף האתר<br />לחץ כאן</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col justify-between shrink-0" style={{ height: `${sidebarH * 0.23}px` }}>
                                        <a href="https://whatsapp.com/channel/0029VajNwaPL2AU0jdlgxa20" target="_blank" rel="noreferrer" className="group flex flex-col items-center justify-center text-[#128C7E] border-[2.5px] border-[#128C7E] rounded-xl hover:bg-[#128C7E] hover:text-white transition-all" style={{ width: `${sidebarH * 0.095}px`, height: `${sidebarH * 0.105}px` }}>
                                            <MessageCircle style={{ width: `${sidebarH * 0.042}px`, height: `${sidebarH * 0.042}px` }} strokeWidth={1.5} />
                                            <span className="font-bold" style={{ fontSize: `${sidebarH * 0.018}px` }}>ערוץ</span>
                                        </a>
                                        <a href="https://chat.whatsapp.com/LN6nwJ8cYiLHaj5uhTum9P" target="_blank" rel="noreferrer" className="group flex flex-col items-center justify-center text-[#25D366] border-[2.5px] border-[#25D366] rounded-xl hover:bg-[#25D366] hover:text-white transition-all" style={{ width: `${sidebarH * 0.095}px`, height: `${sidebarH * 0.105}px` }}>
                                            <MessageCircle style={{ width: `${sidebarH * 0.042}px`, height: `${sidebarH * 0.042}px` }} strokeWidth={1.5} />
                                            <span className="font-bold" style={{ fontSize: `${sidebarH * 0.018}px` }}>קבוצה</span>
                                        </a>
                                    </div>
                                </div>
                                <p className="text-white/60 italic font-medium px-2 text-center leading-snug" style={{ fontSize: `${sidebarH * 0.018}px`, marginTop: `${sidebarH * 0.005}px` }}>
                                    אם יש לכם רעיון ליצירה, אל תהססו ליצור בעצמכם!<br />עזרה תמיד תינתן... צרו קשר באישי.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Mobile: Dynamic Tabs Section */}
                {isMobile && (
                    <div ref={sidebarRef} className={`w-full lg:w-[380px] xl:w-[440px] shrink-0 flex flex-col bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-3xl relative h-full max-h-full min-h-0 overflow-hidden ${activeMobileTab === 'gallery' ? 'hidden' : 'flex'}`}>
                        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none rounded-3xl" />
                        <div className="flex flex-col items-center justify-between flex-1 w-full overflow-hidden no-scrollbar p-4 md:p-6 h-full">
                            <div className="flex flex-col items-center w-full flex-1 justify-start">
                                <div className="flex flex-col items-center flex-1 mb-6 bg-slate-950/40 border border-white/10 rounded-3xl p-4 sm:p-6 shadow-xl w-full text-right dir-rtl justify-evenly">
                                    <img src="./logo.webp" alt="כפלשון" className="h-[clamp(80px,18vh,115px)] object-contain mb-2 drop-shadow-[0_0_20px_rgba(236,72,153,0.4)]" onError={(e) => { e.target.onerror = null; e.target.src = './logo.png'; }} />
                                    <div className="leading-relaxed text-center font-medium text-[clamp(14px,4.1vw,18px)] sm:text-lg text-slate-300">
                                        ברוכים הבאים ל<strong className="text-white mx-1 drop-shadow-md">'כפלשון'</strong>!
                                        <br />
                                        <span>
                                            <span className="mr-[3px]">{shuffledImages.length}</span> איורים דיגיטליים ויצירות AI הממחישים ביטויים, כפל לשון ומשחקי מילים בעברית – להעלות חיוך ולחגוג את השפה.
                                        </span>
                                        <br />
                                        <span className="text-purple-400 font-semibold flex items-center justify-center gap-1.5 mt-1">הכל ביצירת מוחי הקודח... 😊</span>
                                        <span className="flex items-center justify-center gap-2 text-indigo-300 font-bold mt-0.5">
                                            ספי רייכקינד
                                            <a href="https://www.linkedin.com/in/sefi-riechkind-679b67136" target="_blank" rel="noreferrer" className="text-[#0077b5] hover:text-white hover:bg-[#0077b5] transition-all hover:scale-110 drop-shadow-md border border-[#0077b5] rounded-lg flex items-center justify-center bg-white/5 w-8 h-8 shrink-0" title="לינקדאין">
                                                <Linkedin size={18} fill="currentColor" strokeWidth={1} />
                                            </a>
                                        </span>
                                    </div>
                                    <div className="w-full mt-4">
                                        <a href="https://links.payboxapp.com/pKXjNclWz1b" target="_blank" rel="noreferrer" className="flex items-center justify-between w-full rounded-2xl overflow-hidden shadow-lg p-3" style={{ background: 'linear-gradient(135deg, #0096CC 0%, #00AEEF 50%, #00C8F0 100%)' }}>
                                            <div className="flex flex-col items-center text-center leading-tight flex-1">
                                                <span className="text-white font-bold text-sm">תנו טיפ בפייבוקס 💙</span>
                                                <span className="text-white/80 font-medium text-[10px]">האתר חינמי - תמכו בו!</span>
                                            </div>
                                            <img src="./paybox-logo.webp" alt="Paybox" className="h-6 w-auto shrink-0 brightness-0 invert" onError={(e) => { e.target.onerror = null; e.target.src = './paybox-logo.png'; }} />
                                        </a>
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-col items-center text-slate-300 w-full shrink-0 gap-4">
                                <div className="flex flex-row items-stretch gap-2 w-full px-1">
                                    <div className="relative group cursor-pointer rounded-2xl shadow-lg bg-white overflow-hidden flex-1 flex items-center justify-center border-2 border-white/80 aspect-square" onClick={handleQRCodeClick}>
                                        <img src="./qrcode.webp" alt="QR Code" className="w-full h-full object-contain" onError={(e) => { e.target.onerror = null; e.target.src = './qrcode.png'; }} />
                                        <div className="absolute inset-0 bg-black/75 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center text-white backdrop-blur-sm z-10">
                                            <Share2 size={24} className="mb-1 text-pink-400" />
                                            <span className="text-[10px] font-bold text-center leading-tight">לשיתוף לחץ כאן</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-2 flex-1">
                                        <a href="https://whatsapp.com/channel/0029VajNwaPL2AU0jdlgxa20" target="_blank" rel="noreferrer" className="group flex flex-col items-center justify-center gap-1 flex-1 text-[#128C7E] border-2 border-[#128C7E] rounded-2xl py-1">
                                            <MessageCircle size={24} strokeWidth={1.5} />
                                            <span className="font-bold text-xs">ערוץ</span>
                                        </a>
                                        <a href="https://chat.whatsapp.com/LN6nwJ8cYiLHaj5uhTum9P" target="_blank" rel="noreferrer" className="group flex flex-col items-center justify-center gap-1 flex-1 text-[#25D366] border-2 border-[#25D366] rounded-2xl py-1">
                                            <MessageCircle size={24} strokeWidth={1.5} />
                                            <span className="font-bold text-xs">קבוצה</span>
                                        </a>
                                    </div>
                                </div>
                                <p className="text-white/60 italic font-medium px-2 text-center leading-snug text-xs mt-1">
                                    אם יש לכם רעיון ליצירה, אל תהססו ליצור בעצמכם!<br />עזרה תמיד תינתן... צרו קשר באישי.
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Theme Toggle */}
            <div className="fixed bottom-6 left-6 z-50">
                <button 
                    onClick={() => setIsThemeMenuOpen(!isThemeMenuOpen)} 
                    className={`${theme.themeBtnCls} ${isMobile ? 'p-2.5' : 'p-3'} rounded-full shadow-2xl transition-transform hover:scale-110 border-2`}
                >
                    <Palette size={isMobile ? 20 : 24} />
                </button>
                {isThemeMenuOpen && (
                    <div className="absolute bottom-full left-0 mb-4 bg-slate-900/90 backdrop-blur-xl border border-white/20 rounded-2xl p-2 w-36 shadow-2xl flex flex-col gap-1 animate-in slide-in-from-bottom-2">
                        {THEMES.map((t, i) => (
                            <button key={t.id} onClick={() => setTheme(i)} className={`text-right px-3 py-2 rounded-xl text-xs font-bold ${themeIndex === i ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white transition-colors'}`}>{t.label}</button>
                        ))}
                    </div>
                )}
            </div>

            {/* Fullscreen Modal */}
            {isFullscreen && (
                <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center" onClick={() => setIsFullscreen(false)} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
                    <button className="absolute top-4 right-4 p-2 bg-white/10 rounded-full text-white z-[110]"><X size={28} /></button>
                    <div className="relative w-full h-full flex items-center justify-center p-4">
                        <img src={`./images/${encodeURIComponent(currentFile.replace(/\.(jpg|jpeg|png)$/i, '.webp'))}`} className="max-h-full max-w-full object-contain shadow-2xl rounded-lg" onError={(ev) => { ev.currentTarget.src = `./images/${encodeURIComponent(currentFile)}`; }} />
                        <button onClick={(e) => { e.stopPropagation(); nextImage(); }} className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white/10 rounded-full text-white hidden lg:block"><ChevronRight size={40} /></button>
                        <button onClick={(e) => { e.stopPropagation(); prevImage(); }} className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white/10 rounded-full text-white hidden lg:block"><ChevronLeft size={40} /></button>
                    </div>
                </div>
            )}

            {/* Search Modal */}
            {isSearchOpen && (
                <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-20">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => { setIsSearchOpen(false); setSearchQuery(''); }} />
                    <div className="relative w-full max-w-xl bg-slate-900 border border-white/10 rounded-3xl p-4 shadow-2xl animate-in fade-in slide-in-from-top-4 flex flex-col max-h-[70vh]">
                        <div className="flex items-center gap-3 bg-slate-800 rounded-2xl px-4 py-3">
                            <Search size={22} className="text-slate-400" />
                            <input type="text" autoFocus placeholder="חפש..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="bg-transparent text-white w-full outline-none text-right font-bold" dir="rtl" />
                        </div>
                        <div className="mt-4 flex-1 overflow-y-auto space-y-2 no-scrollbar">
                            {filteredImages.length > 0 ? filteredImages.map(file => (
                                <button key={file} onClick={() => { isSelectingResult.current = true; setCurrentIndex(shuffledImages.indexOf(file)); setIsSearchOpen(false); setSearchQuery(''); }} className="flex items-center gap-3 w-full p-2 hover:bg-white/5 rounded-xl transition-all border border-transparent hover:border-white/5">
                                    <div className="flex-1 text-right"><div className="text-white font-bold text-sm truncate">{metadata[file]?.title || file}</div></div>
                                    <img src={`./images/${encodeURIComponent(file)}`} className="w-12 h-12 rounded-lg object-cover" />
                                </button>
                            )) : searchQuery && <div className="text-center py-10 opacity-50">לא נמצאו תוצאות</div>}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

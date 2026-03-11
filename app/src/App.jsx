import { useState, useEffect, useMemo } from 'react';
import { ChevronRight, ChevronLeft, Save, MessageCircle, CheckCircle, Trash2, Search, X, Upload, Github, Loader, LayoutGrid, Image as ImageIcon } from 'lucide-react';
import PublicGallery from './PublicGallery';

const API_BASE = 'http://localhost:3088';

function formatBytes(bytes) {
  if (!+bytes) return '0 Bytes';
  const kb = bytes / 1024;
  // If it's over 1MB, show MB but also show exact KB
  if (kb > 1024) {
    const mb = kb / 1024;
    return `${mb.toFixed(2)} MB (${kb.toFixed(1)} KB)`;
  }
  return `${kb.toFixed(1)} KB (${bytes} Bytes)`;
}

function App() {
  const [images, setImages] = useState([]);
  const [allImages, setAllImages] = useState([]);
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'tagged' | 'untagged' | 'no-topic' | 'ai'
  const [metadata, setMetadata] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [title, setTitle] = useState('');
  const [explanation, setExplanation] = useState('');
  const [topic, setTopic] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [fileSizes, setFileSizes] = useState({});
  const [adminViewMode, setAdminViewMode] = useState('edit'); // 'edit' | 'grid'

  // ── Publish state ──
  const [publishState, setPublishState] = useState('idle'); // idle | loading | success | error | skipped
  const [publishResult, setPublishResult] = useState(null);
  const [lastCommit, setLastCommit] = useState(null);

  // Detect public mode: either via env var (production build) or if not on localhost
  const isPublicViewer = import.meta.env.VITE_PUBLIC_VIEWER === 'true' || 
    (typeof window !== 'undefined' && 
     window.location.hostname !== 'localhost' && 
     window.location.hostname !== '127.0.0.1');

  const fetchImages = async () => {
    try {
      // In public viewer mode (on live site), fetch from static JSON file
      // In admin mode (local), fetch from the backend API
      const url = isPublicViewer ? './public-data.json' : `${API_BASE}/api/images`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch images from ${url}`);
      const data = await res.json();
      
      setAllImages(data.files || []);
      setImages(data.files || []);
      setMetadata(data.data || {});
      setFileSizes(data.fileStats || {}); // Assuming fileStats is the correct property for fileSizes
    } catch (e) {
      console.error('Error fetching images:', e);
      setError(e.message);
    }
  };

  const fetchPublishStatus = async () => {
    if (isPublicViewer) return; // No publishing status on live site
    try {
      const res = await fetch(`${API_BASE}/api/publish/status`);
      if (res.ok) {
        const data = await res.json();
        if (data.ok) setLastCommit(data);
      }
    } catch (e) {
      console.error('Error fetching publish status:', e);
      // Non-critical, so no setError
    }
  };

  const [selectedTopic, setSelectedTopic] = useState(null);

  useEffect(() => {
    fetchImages();
    fetchPublishStatus();
  }, []);

  // Debounce search query to prevent lag on every keystroke
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const filteredImages = useMemo(() => {
    const result = (allImages || []).filter(img => {
      const meta = metadata[img] || {};
      
      // 1. Filter Mode
      if (filterMode === 'tagged' && (!meta.title || !meta.explanation)) return false;
      if (filterMode === 'untagged' && meta.title && meta.explanation) return false;
      if (filterMode === 'no-topic' && meta.topic) return false;
      if (filterMode === 'ai' && meta.isAIGenerated !== true) return false;

      // 2. Topic Filter
      if (selectedTopic && (!meta.topic || !meta.topic.includes(selectedTopic))) return false;

      // 3. Search Query
      if (debouncedSearchQuery) {
        const q = debouncedSearchQuery.toLowerCase();
        const matchTitle = meta.title?.toLowerCase().includes(q);
        const matchFilename = img.toLowerCase().includes(q);
        const matchExplanation = meta.explanation?.toLowerCase().includes(q);
        const matchTopic = meta.topic?.toLowerCase().includes(q);
        if (!matchTitle && !matchFilename && !matchExplanation && !matchTopic) return false;
      }

      return true;
    });

    return result;
  }, [filterMode, selectedTopic, debouncedSearchQuery, allImages, metadata]);

  // Sync images state with filtered results
  useEffect(() => {
    setImages(filteredImages);
    setCurrentIndex(0);
  }, [filteredImages]);

  // Derived unique topics list
  const allTopics = Array.from(new Set(
    Object.values(metadata)
      .filter(m => m.topic)
      .flatMap(m => m.topic.split(',').map(t => t.trim()))
  )).sort();



  const handlePublish = async () => {
    setPublishState('loading');
    setPublishResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/publish`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setPublishState('error');
        setPublishResult(data);
      } else if (data.skipped) {
        setPublishState('skipped');
        setPublishResult(data);
      } else {
        setPublishState('success');
        setPublishResult(data);
        setLastCommit({ hash: data.hash, message: data.message, date: new Date().toISOString() });
      }
    } catch (e) {
      setPublishState('error');
      setPublishResult({ error: e.message });
    }
    // Reset to idle after 8 seconds
    setTimeout(() => setPublishState('idle'), 8000);
  };

  const handleUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
        formData.append('images', files[i]);
    }

    try {
        const response = await fetch(`${API_BASE}/api/upload`, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            throw new Error(`Upload failed: ${response.statusText}`);
        }

        const result = await response.json();
        if (result.success) {
            // Refresh image list to include the newly uploaded files
            await fetchImages();
            // Optional: reset file input via its ref or event target
            e.target.value = null;
        }
    } catch (err) {
        console.error('Upload Error:', err);
        setError('שגיאה בהעלאת התמונות: ' + err.message);
    }
  };

  useEffect(() => {
    if (images.length > 0) {
      const currentFile = images[currentIndex];
      const data = metadata[currentFile];
      setTitle(data?.title || '');
      setExplanation(data?.explanation || '');
      setTopic(data?.topic || '');
    }
  }, [currentIndex, images, metadata]);



  const handleSave = async (goToNext = false) => {
    if (images.length === 0) return;
    setIsSaving(true);
    const currentFile = images[currentIndex];

    try {
      const res = await fetch(`${API_BASE}/api/metadata`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: currentFile,
          title,
          explanation,
          topic
        })
      });

      if (!res.ok) throw new Error('Failed to save');

      const resData = await res.json();
      const newFilename = resData.newFilename || currentFile;

      setMetadata(prev => {
        const newData = { ...prev };
        if (newFilename !== currentFile && newData[currentFile]) {
          delete newData[currentFile];
        }
        newData[newFilename] = { title, explanation, topic };
        return newData;
      });

      if (newFilename !== currentFile) {
        setImages(prev => {
          const newImages = [...prev];
          newImages[currentIndex] = newFilename;
          return newImages;
        });
        setAllImages(prev => {
          const newAll = [...prev];
          const idx = newAll.indexOf(currentFile);
          if (idx !== -1) newAll[idx] = newFilename;
          return newAll;
        });
        setFileSizes(prev => {
          const newSizes = { ...prev };
          if (newSizes[currentFile] !== undefined) {
            newSizes[newFilename] = newSizes[currentFile];
            delete newSizes[currentFile];
          }
          return newSizes;
        });
      }

      if (goToNext && currentIndex < images.length - 1) {
        setCurrentIndex(prev => prev + 1);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (images.length === 0) return;

    const currentFile = images[currentIndex];

    if (window.confirm(`האם אתה בטוח שברצונך למחוק לצמיתות את התמונה "${currentFile}"?`)) {
      try {
        const res = await fetch(`${API_BASE}/api/images/${encodeURIComponent(currentFile)}`, {
          method: 'DELETE'
        });

        if (!res.ok) throw new Error('Failed to delete image');

        // Remove from local state
        setImages(prev => prev.filter((_, idx) => idx !== currentIndex));
        setAllImages(prev => prev.filter(img => img !== currentFile));
        setMetadata(prev => {
          const newData = { ...prev };
          delete newData[currentFile];
          return newData;
        });

        // Adjust index if we deleted the last item
        if (currentIndex >= images.length - 1 && currentIndex > 0) {
          setCurrentIndex(prev => prev - 1);
        }

      } catch (err) {
        setError(err.message);
      }
    }
  };

  const nextImage = () => {
    if (currentIndex < images.length - 1) setCurrentIndex(prev => prev + 1);
  };

  const prevImage = () => {
    if (currentIndex > 0) setCurrentIndex(prev => prev - 1);
  };

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-red-50 text-red-600">
        <div className="text-center p-8 bg-white rounded-xl shadow-xl border border-red-100 max-w-md">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
            <span className="text-2xl">⚠️</span>
          </div>
          <h2 className="text-2xl font-bold mb-2">אופס, משהו השתבש</h2>
          <p>{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
          >
            נסה שוב
          </button>
        </div>
      </div>
    );
  }

  if (allImages.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-slate-500 font-medium">טוען תמונות...</p>
        </div>
      </div>
    );
  }

  const currentFile = images[currentIndex];
  const isCompleted = metadata[currentFile]?.title && metadata[currentFile]?.explanation;
  const progressPercentage = allImages.length ? (Object.keys(metadata).length / allImages.length) * 100 : 0;

  if (isPublicViewer) {
    return <PublicGallery images={images} metadata={metadata} />;
  }

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-br from-slate-50 to-teal-50/30 flex flex-col items-center p-4 font-sans">
      <div className="w-full max-w-7xl flex flex-col gap-4 h-full min-h-0">

        {/* Header & Progress */}
        <header className="shrink-0 flex flex-col md:flex-row md:items-center justify-between bg-white/70 backdrop-blur-md p-4 lg:p-5 rounded-2xl shadow-sm border border-slate-100">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">
              כפל <span className="text-teal-600">לשון</span>
            </h1>
            <p className="text-slate-500 mt-1">מערכת ניהול תמונות ומשמעויות</p>
          </div>

          <div className="mt-4 md:mt-0 flex flex-col items-end gap-3">
            {/* Progress + Search row */}
            <div className="flex flex-wrap items-center justify-end gap-3">
              {/* Main Search Input */}
              <div className="relative group min-w-[200px]">
                <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-teal-500 transition-colors" />
                <input 
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="חיפוש חופשי..."
                  className="w-full pr-10 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 outline-none transition-all"
                  dir="rtl"
                />
              </div>

              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-2 shadow-sm font-medium text-slate-600 text-sm">
                <select 
                  value={filterMode} 
                  onChange={(e) => setFilterMode(e.target.value)}
                  className="bg-transparent border-none focus:ring-0 py-1.5 focus:outline-none text-slate-700 cursor-pointer"
                  dir="rtl"
                >
                  <option value="all">כל התמונות ({allImages.length})</option>
                  <option value="tagged">רק מתויגות</option>
                  <option value="untagged">חסר כותרת/הסבר</option>
                  <option value="no-topic">חסר קטגוריה (Topic)</option>
                  <option value="ai">🤖 תויגו רק ב-AI</option>
                </select>
              </div>

              {/* View Mode Toggle */}
              <div className="flex bg-slate-100 rounded-lg p-1">
                <button
                  onClick={() => setAdminViewMode('grid')}
                  className={`p-1.5 rounded-md transition-all ${adminViewMode === 'grid' ? 'bg-white shadow-sm text-teal-600' : 'text-slate-400 hover:text-slate-600'}`}
                  title="תצוגת גלריה"
                >
                  <LayoutGrid size={18} />
                </button>
                <button
                  onClick={() => setAdminViewMode('edit')}
                  className={`p-1.5 rounded-md transition-all ${adminViewMode === 'edit' ? 'bg-white shadow-sm text-teal-600' : 'text-slate-400 hover:text-slate-600'}`}
                  title="תצוגת עריכה"
                >
                  <ImageIcon size={18} />
                </button>
              </div>
              
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                <span className="bg-teal-100 text-teal-800 py-1 px-3 rounded-full">
                  {Object.keys(metadata).length} / {allImages.length}
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-32 h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-teal-400 to-teal-600 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
            </div>

            {/* Topics Row */}
            <div className="flex flex-wrap justify-end gap-2 mt-2 max-w-2xl overflow-hidden">
               {allTopics.slice(0, 15).map(t => (
                 <button
                   key={t}
                   onClick={() => setSelectedTopic(selectedTopic === t ? null : t)}
                   className={`text-[10px] px-2 py-0.5 rounded-full border transition-all ${selectedTopic === t ? 'bg-teal-600 border-teal-600 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-500 hover:border-teal-200 hover:text-teal-600'}`}
                 >
                   {t}
                 </button>
               ))}
               {allTopics.length > 15 && <span className="text-[10px] text-slate-300">...</span>}
            </div>

            {/* ── Publish to GitHub button ── */}
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-3 w-full sm:w-auto overflow-x-auto sm:overflow-visible pb-2 sm:pb-0">
                {/* Upload Button */}
                <label className="flex items-center gap-2 bg-indigo-50 border-2 border-indigo-200 text-indigo-700 px-5 py-2.5 rounded-xl font-bold hover:bg-indigo-100 hover:border-indigo-300 transition-all cursor-pointer shadow-sm ml-auto sm:ml-0 whitespace-nowrap">
                  <input 
                    type="file" 
                    multiple 
                    accept="image/*"
                    onChange={handleUpload} 
                    className="hidden" 
                  />
                  <Upload size={18} />
                  <span className="hidden sm:inline">העלה יצירות</span>
                  <span className="sm:hidden">העלה</span>
                </label>

                {/* GitHub Publish Button */}
                <button
                  onClick={handlePublish}
                  disabled={publishState === 'loading'}
                  className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold shadow-sm border transition-all ${publishState === 'loading'
                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-wait'
                    : publishState === 'success'
                      ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                      : publishState === 'error'
                        ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                        : publishState === 'skipped'
                          ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                          : 'bg-slate-800 text-white border-slate-700 hover:bg-slate-700'
                  }`}
                  title="פרסם שינויי תוכן (תמונות + data.json) לגיטהאב"
                >
                  {publishState === 'loading' ? (
                    <><Loader size={15} className="animate-spin" /> מפרסם...</>
                  ) : publishState === 'success' ? (
                    <><CheckCircle size={15} /> פורסם! #{publishResult?.hash}</>
                  ) : publishState === 'error' ? (
                    <><X size={15} /> שגיאה — נסה שוב</>
                  ) : publishState === 'skipped' ? (
                    <><CheckCircle size={15} /> אין שינויים חדשים</>
                  ) : (
                    <><Upload size={15} /> פרסם לגיטהאב</>
                  )}
                </button>
              </div>

              {/* Last commit info */}
              {lastCommit && publishState === 'idle' && (
                <p className="text-xs text-slate-400 font-mono" dir="ltr">
                  last: {lastCommit.hash} · {lastCommit.message}
                </p>
              )}

              {/* Error detail */}
              {publishState === 'error' && publishResult?.error && (
                <p className="text-xs text-red-500 max-w-xs text-right" dir="rtl">
                  {publishResult.error.split('\n')[0]}
                </p>
              )}
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        {adminViewMode === 'edit' ? (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6 flex-1 min-h-0">

          {/* Image Viewer Panel */}
          <div className="flex flex-col bg-white rounded-3xl shadow-xl shadow-slate-200/50 overflow-hidden border border-slate-100 min-h-0">
            {/* Image Container with precise aspect ratio matching */}
            <div className="relative w-full flex-1 min-h-0 bg-slate-100 flex items-center justify-center p-4">
              {images.length > 0 ? (
                <img
                  src={`${API_BASE}/images/${encodeURIComponent(currentFile)}`}
                  alt={title || currentFile}
                  className="w-full h-full object-contain drop-shadow-md rounded-lg"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-400 gap-3">
                   <ImageIcon size={48} className="opacity-20" />
                   <p className="font-medium">אין תמונות העונות לסינון זה</p>
                </div>
              )}

              {/* Status Badge */}
              {isCompleted && (
                <div className="absolute top-4 right-4 bg-white/90 backdrop-blur text-teal-600 font-bold px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
                  <CheckCircle size={18} />
                  <span>מעודכן</span>
                </div>
              )}

              {/* Image Counter */}
              <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-sm text-white text-sm font-medium px-4 py-1.5 rounded-full">
                {currentIndex + 1} / {images.length}
              </div>
            </div>

            {/* Navigation Controls */}
            <div className="flex items-center justify-between p-4 bg-slate-50 border-t border-slate-100">
              <button
                onClick={nextImage}
                disabled={currentIndex === images.length - 1}
                className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-slate-700 bg-white shadow-sm border border-slate-200 hover:bg-slate-50 hover:text-teal-600 disabled:opacity-50 disabled:hover:bg-white transition-all"
              >
                <ChevronRight size={20} />
                <span>הבא</span>
              </button>

              <span className="text-xs text-slate-400 font-mono truncate max-w-[150px]" dir="ltr">
                {currentFile}
              </span>

              <button
                onClick={prevImage}
                disabled={currentIndex === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-slate-700 bg-white shadow-sm border border-slate-200 hover:bg-slate-50 hover:text-teal-600 disabled:opacity-50 disabled:hover:bg-white transition-all"
              >
                <span>הקודם</span>
                <ChevronLeft size={20} />
              </button>
            </div>
          </div>

          {/* Editor Panel */}
          <div className="flex flex-col gap-4 bg-white p-6 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 min-h-0 overflow-y-auto">
            <div className="shrink-0">
              <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="bg-teal-100 text-teal-600 w-10 h-10 rounded-xl flex items-center justify-center">✍️</span>
                  עריכת פרטים
                </div>
                <button
                  onClick={handleDelete}
                  className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium border border-transparent hover:border-rose-100"
                  title="מחק תמונה זו"
                >
                  <Trash2 size={18} />
                  <span>מחק תמונה</span>
                </button>
              </h2>
              {/* File Size Badge */}
              <div className="flex items-center gap-2 text-sm font-mono text-slate-500 font-medium mb-4">
                <span className="py-0.5 px-2 bg-slate-200/50 rounded-md shadow-sm border border-slate-300">
                    {fileSizes[images[currentIndex]] ? formatBytes(fileSizes[images[currentIndex]]) : '...'}
                </span>
                
                {metadata[images[currentIndex]]?.isAIGenerated && (
                    <span className="flex items-center gap-1 bg-indigo-100 text-indigo-700 text-xs px-2 py-1 rounded-md border border-indigo-200 font-medium shadow-sm transition-all"
                      title="הסבר זה נוצר על ידי בינה מלאכותית. שמירה ידנית תמחק תווית זו.">
                      <span className="text-sm">🤖</span> AI Review
                    </span>
                )}
            </div>
            </div>

            <div className="flex flex-col gap-5 flex-1 mt-1">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 ml-1 flex items-center justify-between">
                  <span>שם התמונה (המשחק מילים)</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="לדוגמה: אבטיח (אב-טיח)..."
                  className="w-full text-lg px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-teal-500/20 focus:border-teal-500 transition-all font-medium text-slate-800"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 ml-1">נושא / קטגוריה</label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="לדוגמה: חיות, היסטוריה, אוכל..."
                  className="w-full text-lg px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-teal-500/20 focus:border-teal-500 transition-all font-medium text-slate-800"
                />
              </div>

              <div className="space-y-2 flex-1 flex flex-col">
                <label className="text-sm font-bold text-slate-700 ml-1 flex justify-between">
                  <span>הסבר (להרחבה / LLM)</span>
                  <span className="font-normal text-slate-400 text-xs">יוסתר למשתמשים בממשק הסופי</span>
                </label>
                <textarea
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  placeholder="הסבר את משמעות כפל הלשון בפירוט..."
                  className="w-full flex-1 min-h-[120px] px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-teal-500/20 focus:border-teal-500 transition-all text-slate-700 resize-none leading-relaxed"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row gap-3 mt-2 shrink-0">
              <button
                onClick={() => handleSave(true)}
                disabled={isSaving}
                className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-l from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white py-4 px-6 rounded-2xl font-bold shadow-lg shadow-teal-500/30 transform active:scale-[0.98] transition-all disabled:opacity-70"
              >
                {isSaving ? (
                  <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>שמור והמשך לבא <ChevronLeft size={20} /></>
                )}
              </button>

              <button
                onClick={() => handleSave(false)}
                disabled={isSaving}
                className="sm:w-32 flex items-center justify-center gap-2 bg-white text-teal-700 border-2 border-teal-100 hover:bg-teal-50 py-4 px-6 rounded-2xl font-bold transition-all disabled:opacity-70"
              >
                <Save size={20} />
                שמור
              </button>
            </div>
          </div>
        </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto pr-1 pb-8">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {images.map((filename, index) => {
                const data = metadata[filename];
                const isTagged = data?.title && data?.explanation;
                return (
                  <div 
                    key={filename} 
                    className="group relative bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md hover:border-teal-300 transition-all cursor-pointer aspect-square"
                    onClick={() => {
                      setCurrentIndex(index);
                      setAdminViewMode('edit');
                    }}
                  >
                    <img 
                      src={`${API_BASE}/images/${encodeURIComponent(filename)}`} 
                      alt={data?.title || filename}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                    
                    {/* Overlay Grad */}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-900/90 to-transparent p-3 pt-8 pb-3">
                      <p className="text-white text-sm font-bold truncate text-right drop-shadow-md">
                        {data?.title || <span className="text-slate-300 font-normal italic">ללא שם</span>}
                      </p>
                    </div>

                    {/* Status Indicator */}
                    <div className="absolute top-2 right-2">
                      {isTagged ? (
                        <div className="w-2.5 h-2.5 bg-teal-500 rounded-full shadow-[0_0_5px_rgba(20,184,166,0.8)]" title="מעודכן"></div>
                      ) : (
                        <div className="w-2.5 h-2.5 bg-slate-300 rounded-full shadow-[0_0_5px_rgba(203,213,225,0.8)]" title="חסר נתונים"></div>
                      )}
                    </div>

                    {/* Delete Button Area (shows only on hover) */}
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (window.confirm(`האם אתה בטוח שברצונך למחוק לצמיתות את "${filename}"?`)) {
                          try {
                            const res = await fetch(`${API_BASE}/api/images/${encodeURIComponent(filename)}`, { method: 'DELETE' });
                            if (res.ok) {
                              setImages(prev => prev.filter(img => img !== filename));
                              setAllImages(prev => prev.filter(img => img !== filename));
                              setMetadata(prev => {
                                const newData = { ...prev };
                                delete newData[filename];
                                return newData;
                              });
                            }
                          } catch (err) {
                             setError(err.message);
                          }
                        }
                      }}
                      className="absolute top-2 left-2 p-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-md shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                      title="מחק כליל תמונה זו"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Search Modal */}
      {isSearchOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Search className="text-teal-600" size={24} />
                חפש במאגר שיישמר
              </h3>
              <button
                onClick={() => {
                  setIsSearchOpen(false);
                  setSearchQuery('');
                }}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 border-b border-slate-100">
              <input
                type="text"
                placeholder="חפש לפי שם תמונה או משחק מילים..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-teal-500/20 focus:border-teal-500 transition-all font-medium text-slate-800 text-lg"
              />
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/30">
              {Object.keys(metadata).length === 0 ? (
                <div className="text-center p-8 text-slate-500">
                  <span className="text-4xl mb-3 block">📭</span>
                  אין עדיין תמונות מאושרות במאגר.
                </div>
              ) : (
                Object.entries(metadata)
                  .filter(([filename, data]) => {
                    const query = searchQuery.toLowerCase();
                    const hasTitle = data.title && data.title.toLowerCase().includes(query);
                    const hasFilename = filename.toLowerCase().includes(query);
                    const hasExplanation = data.explanation && data.explanation.toLowerCase().includes(query);
                    return hasTitle || hasFilename || hasExplanation;
                  })
                  .map(([filename, data]) => (
                    <button
                      key={filename}
                      onClick={() => {
                        const idxInFiltered = images.indexOf(filename);
                        if (idxInFiltered !== -1) {
                          setCurrentIndex(idxInFiltered);
                        } else {
                          // Crucial Fix: If not in current filtered list, reset filters
                          setFilterMode('all');
                          setSelectedTopic(null);
                          setSearchQuery('');
                          
                          // We know it's in allImages
                          const idxInAll = allImages.indexOf(filename);
                          if (idxInAll !== -1) {
                             // Use setTimeout to allow the filter reset to trigger a re-render 
                             // and update the 'images' array before we set the index.
                             setTimeout(() => {
                               setCurrentIndex(idxInAll);
                             }, 0);
                          }
                        }
                        setIsSearchOpen(false);
                        setSearchQuery('');
                        setAdminViewMode('edit');
                      }}
                      className="w-full text-right p-4 rounded-2xl bg-white border border-slate-100 shadow-sm hover:border-teal-300 hover:shadow-md transition-all flex gap-4 items-center group"
                    >
                      <img
                        src={`${API_BASE}/images/${encodeURIComponent(filename)}`}
                        className="w-16 h-16 object-cover rounded-lg border border-slate-200 shrink-0"
                        alt=""
                        loading="lazy"
                      />
                      <div className="flex flex-col gap-1 flex-1 min-w-0">
                        <div className="font-bold text-slate-800 group-hover:text-teal-700 transition-colors">
                          {data.title}
                        </div>
                        <div className="text-sm text-slate-500 font-mono flex items-center gap-2" dir="ltr">
                          <span className="bg-slate-100 px-2 py-0.5 rounded text-xs shrink-0">קובץ</span>
                          <span className="truncate">{filename}</span>
                          {fileSizes[filename] !== undefined && (
                            <span className="text-slate-400 text-xs ml-auto shrink-0 bg-slate-50 px-2 border border-slate-100 rounded font-sans" dir="ltr">
                              {formatBytes(fileSizes[filename])}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))
              )}

              {Object.keys(metadata).length > 0 &&
                Object.entries(metadata).filter(([f, d]) => d.title && (d.title.toLowerCase().includes(searchQuery.toLowerCase()) || f.toLowerCase().includes(searchQuery.toLowerCase()) || (d.explanation && d.explanation.toLowerCase().includes(searchQuery.toLowerCase())))).length === 0 && (
                  <div className="text-center p-8 text-slate-500">
                    לא נמצאו תוצאות לחיפוש שלך.
                  </div>
                )}
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Floating CTA */}
      <a
        href="https://wa.me/972500000000?text=שלום,%20הגעתי%20ממערכת%20כפל%20לשון"
        target="_blank"
        rel="noreferrer"
        className="fixed bottom-6 left-6 bg-[#25D366] text-white p-4 rounded-full shadow-lg hover:shadow-xl hover:scale-110 transition-all flex items-center justify-center group"
        title="צור קשר בווטסאפ"
      >
        <MessageCircle size={28} />
        <span className="max-w-0 overflow-hidden whitespace-nowrap group-hover:max-w-xs group-hover:mr-3 transition-all duration-300 font-medium">
          יצירת קשר בווסטאפ
        </span>
      </a>
    </div>
  );
}

export default App;

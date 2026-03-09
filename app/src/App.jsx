import { useState, useEffect } from 'react';
import { ChevronRight, ChevronLeft, Save, MessageCircle, CheckCircle, Trash2, Search, X, Upload, Github, Loader } from 'lucide-react';
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
  const [metadata, setMetadata] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [title, setTitle] = useState('');
  const [explanation, setExplanation] = useState('');
  const [topic, setTopic] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [fileSizes, setFileSizes] = useState({});

  // ── Publish state ──
  const [publishState, setPublishState] = useState('idle'); // idle | loading | success | error | skipped
  const [publishResult, setPublishResult] = useState(null);
  const [lastCommit, setLastCommit] = useState(null);

  useEffect(() => {
    fetchImages();
    fetchPublishStatus();
  }, []);

  const fetchPublishStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/publish/status`);
      if (res.ok) {
        const data = await res.json();
        if (data.ok) setLastCommit(data);
      }
    } catch { /* non-critical */ }
  };

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

  const fetchImages = async () => {
    try {
      const isPublic = import.meta.env.VITE_PUBLIC_VIEWER === 'true';
      const endpoint = isPublic ? './public-data.json' : `${API_BASE}/api/images`;
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error('Failed to fetch images');
      const json = await res.json();
      setImages(json.files || []);
      setMetadata(json.data || {});
      setFileSizes(json.fileStats || {});

      // Load first image data if exists
      if (json.files && json.files.length > 0) {
        const firstFile = json.files[0];
        const initialData = json.data[firstFile];
        if (initialData) {
          setTitle(initialData.title || '');
          setExplanation(initialData.explanation || '');
          setTopic(initialData.topic || '');
        }
      }
    } catch (err) {
      setError(err.message);
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

  const isPublicViewer = import.meta.env.VITE_PUBLIC_VIEWER === 'true';

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

  if (images.length === 0) {
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
  const progressPercentage = (Object.keys(metadata).length / images.length) * 100;

  if (isPublicViewer) {
    return <PublicGallery images={images} metadata={metadata} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-teal-50/30 flex flex-col items-center py-8 font-sans">
      <div className="w-full max-w-5xl px-4 flex flex-col gap-6">

        {/* Header & Progress */}
        <header className="flex flex-col md:flex-row md:items-center justify-between bg-white/70 backdrop-blur-md p-6 rounded-2xl shadow-sm border border-slate-100">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">
              כפל <span className="text-teal-600">לשון</span>
            </h1>
            <p className="text-slate-500 mt-1">מערכת ניהול תמונות ומשמעויות</p>
          </div>

          <div className="mt-4 md:mt-0 flex flex-col items-end gap-3">
            {/* Progress + Search row */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsSearchOpen(true)}
                className="flex items-center gap-2 px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors"
                title="חפש במאגר התמונות שאושרו"
              >
                <Search size={16} />
                <span>חיפוש במאגר</span>
              </button>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                <span>{Math.round(progressPercentage)}% הושלמו</span>
                <span className="bg-teal-100 text-teal-800 py-1 px-3 rounded-full">
                  {Object.keys(metadata).length} / {images.length}
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-48 h-2.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-teal-400 to-teal-600 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>

            {/* ── Publish to GitHub button ── */}
            <div className="flex flex-col items-end gap-1">
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* Image Viewer Panel */}
          <div className="flex flex-col bg-white rounded-3xl shadow-xl shadow-slate-200/50 overflow-hidden border border-slate-100">
            {/* Image Container with precise aspect ratio matching */}
            <div className="relative w-full aspect-square bg-slate-100 flex items-center justify-center p-4">
              <img
                src={`${API_BASE}/images/${encodeURIComponent(currentFile)}`}
                alt={title || currentFile}
                className="w-full h-full object-contain drop-shadow-md rounded-lg"
              />

              {/* Status Badge */}
              {isCompleted && (
                <div className="absolute top-4 right-4 bg-white/90 backdrop-blur text-teal-600 font-bold px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
                  <CheckCircle size={18} />
                  <span>מעודכן</span>
                </div>
              )}

              {/* File Size Badge */}
              <div className="absolute top-4 left-4 bg-white/90 backdrop-blur text-slate-700 font-medium px-3 py-1.5 rounded-lg shadow-md border border-slate-200 text-sm flex items-center gap-2 tracking-wide" dir="ltr">
                <span className="text-slate-400 text-xs uppercase font-bold tracking-wider">Size</span>
                {fileSizes[currentFile] ? formatBytes(fileSizes[currentFile]) : '...'}
              </div>

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
          <div className="flex flex-col gap-6 bg-white p-8 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100">
            <div>
              <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center justify-between">
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
            </div>

            <div className="flex flex-col gap-5 flex-1">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 ml-1">שם התמונה (המשחק מילים)</label>
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
                  className="w-full flex-1 min-h-[160px] px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-teal-500/20 focus:border-teal-500 transition-all text-slate-700 resize-none leading-relaxed"
                />
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row gap-3 mt-4">
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
                    if (!data.title) return false;
                    const query = searchQuery.toLowerCase();
                    return data.title.toLowerCase().includes(query) || filename.toLowerCase().includes(query) || (data.explanation && data.explanation.toLowerCase().includes(query));
                  })
                  .map(([filename, data]) => (
                    <button
                      key={filename}
                      onClick={() => {
                        const idx = images.indexOf(filename);
                        if (idx !== -1) {
                          setCurrentIndex(idx);
                          setIsSearchOpen(false);
                          setSearchQuery('');
                        }
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
      )
      }

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
    </div >
  );
}

export default App;

import { useState, useEffect, useMemo, useRef } from 'react';
import { ChevronRight, ChevronLeft, Save, MessageCircle, CheckCircle, Trash2, Search, X, Upload, Github, Loader, LayoutGrid, Image as ImageIcon, Copy, Instagram, Facebook, Twitter, Share2, ExternalLink } from 'lucide-react';
import PublicGallery from './PublicGallery';
import DuplicatesReview from './DuplicatesReview';

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
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'tagged' | 'untagged' | 'no-topic' | 'ai' | 'new-images'
  const [metadata, setMetadata] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [title, setTitle] = useState('');
  const [explanation, setExplanation] = useState('');
  const [topic, setTopic] = useState('');
  const [isApproved, setIsApproved] = useState(false);
  const [needsAIImprovement, setNeedsAIImprovement] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [fileSizes, setFileSizes] = useState({});
  const [fileSources, setFileSources] = useState({});
  const [adminViewMode, setAdminViewMode] = useState('edit'); // 'edit' | 'grid' | 'duplicates'
  const [xConnected, setXConnected] = useState(false);
  const [metaConnected, setMetaConnected] = useState(false);
  const [metaError, setMetaError] = useState(null);

  // ── Publish state ──
  const [publishState, setPublishState] = useState('idle'); // idle | loading | success | error | skipped
  const [publishResult, setPublishResult] = useState(null);
  const [lastCommit, setLastCommit] = useState(null);
  const [masterCategories, setMasterCategories] = useState([]);
  const [isTopicModalOpen, setIsTopicModalOpen] = useState(false);
  const [topicSearchQuery, setTopicSearchQuery] = useState('');
  const [newTagInput, setNewTagInput] = useState('');

  // ── Social Media state ──
  const [socialPostState, setSocialPostState] = useState('idle'); // idle | loading | success | error
  const [socialPlatform, setSocialPlatform] = useState('all'); 
  const [socialResult, setSocialResult] = useState(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);
  const [bulkProgress, setBulkProgress] = useState(null); // { current, total, countdown, status }

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
      setFileSizes(data.fileStats || {});
      setFileSources(data.fileSources || {});
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

  const fetchMasterTags = async () => {
    if (isPublicViewer) return;
    try {
      const res = await fetch(`${API_BASE}/api/tags`);
      if (res.ok) {
        const data = await res.json();
        setMasterCategories(data.categories || []);
      }
    } catch (e) {
      console.error('Error fetching master tags:', e);
    }
  };

  const checkXStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/social/x/status`);
      const data = await res.json();
      setXConnected(data.connected);
    } catch (e) {
      console.error('Failed to check X status', e);
    }
  };

  const checkMetaStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/social/meta/status`);
      const data = await res.json();
      setMetaConnected(data.connected);
      setMetaError(data.error || null);
    } catch (e) {
      console.error('Failed to check Meta status', e);
    }
  };

  useEffect(() => {
    fetchImages();
    // Add small delay to ensure backend is fully ready before headless check
    setTimeout(() => {
      checkXStatus();
      checkMetaStatus();
    }, 2000);
    fetchPublishStatus();
    fetchMasterTags();
  }, []);

  const toggleSelectImage = (img) => {
    setSelectedImages(prev => {
      if (prev.includes(img)) {
        return prev.filter(i => i !== img);
      } else {
        return [...prev, img];
      }
    });
  };

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
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
      if (filterMode === 'tagged' && (!meta.title?.trim() || !meta.explanation?.trim() || !meta.topic?.trim())) return false;
      if (filterMode === 'no-title' && meta.title) return false;
      if (filterMode === 'no-explanation' && meta.explanation) return false;
      if (filterMode === 'no-topic' && meta.topic) return false;
      if (filterMode === 'ai' && meta.isAIGenerated !== true) return false;
      if (filterMode === 'approved' && meta.isApproved !== true) return false;
      if (filterMode === 'not-approved' && meta.isApproved === true) return false;
      if (filterMode === 'new-images' && fileSources[img] !== 'new') return false;
      if (filterMode === 'ai-improved' && meta.isAIImproved !== true) return false;
      if (filterMode === 'ai-added' && meta.isAIAdded !== true) return false;
      if (filterMode === 'needs-ai' && meta.needsAIImprovement !== true) return false;
      if (filterMode === 'ai-suggestions' && (!meta.aiSuggestion || meta.aiSuggestion.trim() === '')) return false;
      if (filterMode === 'generic-ai') {
        const isGeneric = meta.explanation?.includes('התמונה ממחישה את הכפל המשמעות הטמון בביטוי');
        if (!isGeneric) return false;
      }
      if (filterMode === 'untitled') {
        if (!img.includes('עיצוב ללא שם')) return false;
      }

      // 2. Topic Filter
      if (selectedTopic && (!meta.topic || !meta.topic.includes(selectedTopic))) return false;

      // 3. Search Query
      if (debouncedSearchQuery) {
        const q = debouncedSearchQuery.toLowerCase();
        // Check if the filename itself matches (without extension)
        const filenameWithoutExt = img.replace(/\.[^/.]+$/, "").toLowerCase();
        const matchTitle = meta.title?.toLowerCase().includes(q);
        const matchFilename = img.toLowerCase().includes(q) || filenameWithoutExt.includes(q);
        const matchExplanation = meta.explanation?.toLowerCase().includes(q);
        const matchTopic = meta.topic?.toLowerCase().includes(q);
        if (!matchTitle && !matchFilename && !matchExplanation && !matchTopic) return false;
      }

      return true;
    });

    return result;
  }, [filterMode, selectedTopic, debouncedSearchQuery, allImages, metadata]);

  const prevFiltersRef = useRef({ mode: filterMode, topic: selectedTopic, query: debouncedSearchQuery });

  // Sync images state with filtered results
  useEffect(() => {
    setImages(filteredImages);
    
    const filtersChanged = prevFiltersRef.current.mode !== filterMode || 
                           prevFiltersRef.current.topic !== selectedTopic || 
                           prevFiltersRef.current.query !== debouncedSearchQuery;

    if (filtersChanged) {
      setCurrentIndex(0);
      prevFiltersRef.current = { mode: filterMode, topic: selectedTopic, query: debouncedSearchQuery };
    } else {
      // If filters didn't change (e.g. just saving metadata), try to keep the index valid
      setCurrentIndex(prev => {
        if (filteredImages.length === 0) return 0;
        return prev >= filteredImages.length ? filteredImages.length - 1 : prev;
      });
    }
  }, [filteredImages, filterMode, selectedTopic, debouncedSearchQuery]);

  // Derived counts for filters and topics
  const { filterCounts, topicCounts, allTopics } = useMemo(() => {
    const fc = {
      all: allImages.length,
      tagged: 0,
      noTitle: 0,
      noExplanation: 0,
      noTopic: 0,
      ai: 0,
      approved: 0,
      notApproved: 0,
      newImages: 0,
      genericAi: 0,
      aiImproved: 0,
      aiAdded: 0,
      needsAi: 0,
      aiSuggestions: 0,
      untitled: 0
    };

    const tc = {};
    
    allImages.forEach(img => {
      const meta = metadata[img] || {};
      
      // Filter counts
      if (meta.title?.trim() && meta.explanation?.trim() && meta.topic?.trim()) fc.tagged++;
      if (!meta.title) fc.noTitle++;
      if (!meta.explanation) fc.noExplanation++;
      if (!meta.topic) fc.noTopic++;
      if (meta.isAIGenerated === true) fc.ai++;
      if (meta.isApproved === true) fc.approved++;
      if (meta.isApproved !== true) fc.notApproved++;
      if (fileSources[img] === 'new') fc.newImages++;
      if (meta.isAIImproved === true) fc.aiImproved++;
      if (meta.isAIAdded === true) fc.aiAdded++;
      if (meta.needsAIImprovement === true) fc.needsAi++;
      if (meta.aiSuggestion && meta.aiSuggestion.trim() !== '') fc.aiSuggestions++;
      if (meta.explanation?.includes('התמונה ממחישה את הכפל המשמעות הטמון בביטוי')) fc.genericAi++;
      if (img.includes('עיצוב ללא שם')) fc.untitled++;

      // Topic counts
      if (meta.topic) {
        meta.topic.split(',').forEach(t => {
          const trimmed = t.trim();
          if (trimmed) {
            tc[trimmed] = (tc[trimmed] || 0) + 1;
          }
        });
      }
    });

    return { 
      filterCounts: fc, 
      topicCounts: tc, 
      allTopics: Object.keys(tc).sort() 
    };
  }, [allImages, metadata, fileSources]);



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
      const currFile = images[currentIndex];
      const data = metadata[currFile];
      setTitle(data?.title || '');
      setExplanation(data?.explanation || '');
      setTopic(data?.topic || '');
      setIsApproved(data?.isApproved || false);
      setNeedsAIImprovement(data?.needsAIImprovement || false);
      setAiSuggestion(data?.aiSuggestion || null);
    }
  }, [currentIndex, images, metadata]);



  const handleSave = async (goToNext = false) => {
    if (images.length === 0) return;
    setIsSaving(true);
    const currFile = images[currentIndex];

    try {
      const res = await fetch(`${API_BASE}/api/metadata`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: currentFile,
          title,
          explanation,
          topic,
          isApproved,
          needsAIImprovement,
          aiSuggestion
        })
      });

      if (!res.ok) throw new Error('Failed to save');

      const resData = await res.json();
      const newFilename = resData.newFilename || currFile;

      // If it was a new image, it moved, so we better refresh images to get updated sources
      const wasNew = fileSources[currFile] === 'new';
      if (wasNew) {
          await fetchImages();
          setIsSaving(false);
          if (goToNext && currentIndex < images.length - 1) {
              setCurrentIndex(prev => prev + 1);
          }
          return;
      }

      setMetadata(prev => {
        const newData = { ...prev };
        if (newFilename !== currFile && newData[currFile]) {
          delete newData[currFile];
        }
        newData[newFilename] = { 
          title, 
          explanation, 
          topic, 
          isApproved, 
          isAIGenerated: metadata[currFile]?.isAIGenerated 
        };
        return newData;
      });

      if (newFilename !== currFile) {
        setImages(prev => {
          const newImages = [...prev];
          newImages[currentIndex] = newFilename;
          return newImages;
        });
        setAllImages(prev => {
          const newAll = [...prev];
          const idx = newAll.indexOf(currFile);
          if (idx !== -1) newAll[idx] = newFilename;
          return newAll;
        });
        setFileSizes(prev => {
          const newSizes = { ...prev };
          if (newSizes[currFile] !== undefined) {
            newSizes[newFilename] = newSizes[currFile];
            delete newSizes[currFile];
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

  const postSingleImage = async (filename, platforms) => {
    const footer = `\n\n***\nלינק לאתר: KefeLashon.co.il\n\nלינק להצטרפות לערוץ: https://whatsapp.com/channel/0029VajNwaPL2AU0jdlgxa20\nלינק להצטרפות לקבוצה: https://chat.whatsapp.com/LN6nwJ8cYiLHaj5uhTum9P`;
    const siteLink = 'KefeLashon.co.il';
    const results = [];
    
    // Get metadata for this specific image
    const meta = metadata[filename] || {};
    const imgTitle = meta.title || filename.replace(/\.[^/.]+$/, "");

    for (const p of platforms) {
      const xFooter = `\n\n***\nלינק לאתר: KefeLashon.co.il`;
      const finalCaption = p === 'x' 
        ? `${imgTitle}\n#כפלשון${xFooter}`
        : `${imgTitle}\n#כפלשון${footer}`;

      const res = await fetch(`${API_BASE}/api/social/post`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename,
          caption: finalCaption,
          platform: p
        })
      });
      const isJson = res.headers.get('content-type')?.includes('application/json');
      const data = isJson ? await res.json() : { error: `Server error: ${res.status} ${res.statusText}` };
      results.push({ platform: p, ok: res.ok, data });
    }
    return results;
  };

  const handleSocialPost = async () => {
    if (images.length === 0) return;
    setSocialPostState('loading');
    setSocialResult(null);

    const currFile = images[currentIndex];
    const platforms = socialPlatform === 'all' ? ['instagram', 'facebook', 'x'] : [socialPlatform];
    
    try {
      const results = await postSingleImage(currFile, platforms);

      const allOk = results.every(r => r.ok);
      setSocialPostState(allOk ? 'success' : 'error');
      
      if (allOk) {
        setTimeout(() => setSocialPostState('idle'), 5000);
      }
      
      if (allOk || results.some(r => r.ok)) {
        fetchImages();
      }
      
      if (results.length === 1) {
        setSocialResult(results[0].data);
      } else {
        const errors = results.filter(r => !r.ok).map(r => `${r.platform}: ${r.data.error || 'שגיאה'}`);
        if (errors.length > 0) {
          setSocialResult({ error: errors.join(', ') });
        } else {
          setSocialResult({ message: 'פורסם בהצלחה בשניהם!' });
        }
      }
    } catch (e) {
      setSocialPostState('error');
      setSocialResult({ error: e.message });
    }
  };

  const handleBulkPost = async () => {
    if (selectedImages.length === 0) return;
    const platforms = socialPlatform === 'all' ? ['instagram', 'facebook', 'x'] : [socialPlatform];
    
    setBulkProgress({ 
      current: 0, 
      total: selectedImages.length, 
      status: 'starting', 
      countdown: 0 
    });

    for (let i = 0; i < selectedImages.length; i++) {
        const img = selectedImages[i];
        setBulkProgress(prev => ({ ...prev, current: i + 1, status: `מפרסם: ${img}...`, countdown: 0 }));
        
        try {
            const results = await postSingleImage(img, platforms);
            const anyOk = results.some(r => r.ok);
            if (!anyOk) {
                console.error(`Bulk post failed for ${img}`);
            }
        } catch (e) {
            console.error(`Error in bulk post ${img}:`, e);
        }

        // Wait unless it's the last image
        if (i < selectedImages.length - 1) {
            // Random interval between 5-10 minutes (300-600 seconds)
            // For testing purposes during dev, you might want to shorter it, 
            // but the user's request is "non-bot-like". 
            // Let's use 5-10 mins as default.
            const baseDelay = 300; // 5 mins
            const randomAdd = Math.floor(Math.random() * 300); // 0-5 mins
            let countdown = baseDelay + randomAdd;

            setBulkProgress(prev => ({ ...prev, status: 'ממתין לפוסט הבא...', countdown }));

            while (countdown > 0) {
                await new Promise(r => setTimeout(r, 1000));
                countdown--;
                setBulkProgress(prev => {
                    if (!prev) return null;
                    return { ...prev, countdown };
                });
                // Check if user cancelled (to be implemented)
            }
        }
    }

    setBulkProgress(null);
    setSelectedImages([]);
    setSelectionMode(false);
    fetchImages();
  };

  const handleXLogin = async () => {
    try {
      setSocialPostState('loading');
      const url = `${API_BASE}/api/social/x/login${xConnected ? '?force=true' : ''}`;
      const res = await fetch(url, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        // No alert! The window opens automatically.
        // Check status periodically after opening login
        const interval = setInterval(async () => {
          const sRes = await fetch(`${API_BASE}/api/social/x/status`);
          const sData = await sRes.json();
          if (sData.connected) {
            setXConnected(true);
            clearInterval(interval);
          }
        }, 5000);
        setTimeout(() => clearInterval(interval), 60000); // Stop after 1 min
      } else {
        throw new Error(data.error || 'Failed to open login window');
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setSocialPostState('idle');
    }
  };

  const handleDelete = async () => {
    if (images.length === 0) return;

    const currFile = images[currentIndex];

    if (window.confirm(`האם אתה בטוח שברצונך למחוק לצמיתות את התמונה "${currFile}"?`)) {
      try {
        const res = await fetch(`${API_BASE}/api/images/${encodeURIComponent(currFile)}`, {
          method: 'DELETE'
        });

        if (!res.ok) throw new Error('Failed to delete image');

        // Remove from local state
        setImages(prev => prev.filter((_, idx) => idx !== currentIndex));
        setAllImages(prev => prev.filter(img => img !== currFile));
        setMetadata(prev => {
          const newData = { ...prev };
          delete newData[currFile];
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
  const isCompleted = metadata[currentFile]?.title?.trim() && metadata[currentFile]?.explanation?.trim() && metadata[currentFile]?.topic?.trim();
  const progressPercentage = allImages.length ? (Object.keys(metadata).length / allImages.length) * 100 : 0;
  
  if (isPublicViewer) {
    return <PublicGallery images={images} metadata={metadata} />;
  }

  return (
    <div className={`h-screen overflow-hidden flex flex-col items-center ${isPublicViewer ? 'p-0' : 'p-2 sm:p-4'} font-sans ${isPublicViewer ? 'bg-slate-950' : 'bg-gradient-to-br from-slate-50 to-teal-50/30'}`}>
      <div className={`w-full ${isPublicViewer ? 'max-w-[1920px]' : 'max-w-7xl'} flex flex-col gap-4 h-full min-h-0`}>

        {/* Header & Progress (Admin Only) */}
        {!isPublicViewer && (
        <header className="shrink-0 flex flex-col bg-white/80 backdrop-blur-md p-2 md:p-3 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
            <div className="flex items-center justify-between w-full md:w-auto">
              <div className="flex items-center gap-2">
                <h1 className="text-lg md:text-2xl font-extrabold text-slate-800 tracking-tight leading-none">
                  כפל <span className="text-teal-600">לשון</span>
                </h1>
                <span className="hidden sm:inline text-[9px] text-slate-400 font-bold uppercase tracking-widest border border-slate-200 px-1.5 py-0.5 rounded">ADMIN</span>
              </div>
              <div className="md:hidden flex items-center gap-2">
                 <button onClick={() => setIsTopicModalOpen(true)} className="p-1.5 bg-teal-50 text-teal-600 rounded-lg"><LayoutGrid size={16} /></button>
                 <span className="text-[10px] font-bold text-slate-600 bg-teal-100 px-2 py-1 rounded-lg">
                  {Object.keys(metadata).length} / {allImages.length}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-start md:justify-end gap-2">
              <div className="relative group w-full sm:w-auto sm:min-w-[150px]">
                <Search size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-teal-500" />
                <input 
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="חיפוש..."
                  className="w-full pr-8 pl-2 py-1 bg-slate-50 border border-slate-200 rounded-xl text-[11px] outline-none"
                  dir="rtl"
                />
              </div>

              <div className="flex bg-slate-50 border border-slate-200 rounded-xl px-1 h-7 items-center">
                <select 
                  value={filterMode} 
                  onChange={(e) => setFilterMode(e.target.value)}
                  className="bg-transparent border-none focus:ring-0 py-0 text-[10px] text-slate-700 font-bold"
                  dir="rtl"
                >
                  <option value="all">הכל ({filterCounts.all})</option>
                  <option value="tagged">מלא ({filterCounts.tagged})</option>
                  <option value="no-title">ללא כו' ({filterCounts.noTitle})</option>
                  <option value="no-explanation">ללא הס' ({filterCounts.noExplanation})</option>
                  <option value="no-topic">ללא נו' ({filterCounts.noTopic})</option>
                  <option value="ai">🤖 AI ({filterCounts.ai})</option>
                  <option value="approved">✅ מאושר ({filterCounts.approved})</option>
                  <option value="not-approved">⏳ ממתין ({filterCounts.notApproved})</option>
                  <option value="new-images">🆕 חדש ({filterCounts.newImages})</option>
                </select>
              </div>

              <div className="flex bg-slate-100 rounded-lg p-0.5 h-7">
                <button onClick={() => setAdminViewMode('grid')} className={`px-1.5 rounded-md ${adminViewMode === 'grid' ? 'bg-white text-teal-600 shadow-sm' : 'text-slate-400'}`} title="תצוגת גלריה"><LayoutGrid size={12} /></button>
                <button onClick={() => setAdminViewMode('edit')} className={`px-1.5 rounded-md ${adminViewMode === 'edit' ? 'bg-white text-teal-600 shadow-sm' : 'text-slate-400'}`} title="תצוגת עריכה"><ImageIcon size={12} /></button>
                <button onClick={() => setAdminViewMode('duplicates')} className={`px-1.5 rounded-md ${adminViewMode === 'duplicates' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`} title="כפלויות"><Copy size={12} /></button>
                {adminViewMode === 'grid' && (
                  <button 
                    onClick={() => {
                      setSelectionMode(!selectionMode);
                      if (selectionMode) setSelectedImages([]);
                    }} 
                    className={`px-1.5 rounded-md ml-1 border-r border-slate-200 pl-2 ${selectionMode ? 'bg-amber-100 text-amber-600 shadow-sm' : 'text-slate-400'}`}
                    title="בחירה מרובה (Bulk)"
                  >
                    <CheckCircle size={12} />
                  </button>
                )}
              </div>

              <div className="hidden md:flex items-center gap-2">
                <div className="w-16 h-1 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-teal-500 rounded-full" style={{ width: `${progressPercentage}%` }} />
                </div>
                <span className="text-[10px] font-bold text-slate-400">{Object.keys(metadata).length}/{allImages.length}</span>
              </div>

              <div className="flex items-center gap-1.5">
                <label className="flex items-center gap-1 bg-indigo-50 border border-indigo-100 text-indigo-700 px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-colors hover:bg-indigo-100">
                  <input type="file" multiple accept="image/*" onChange={handleUpload} className="hidden" />
                  <Upload size={12} />
                  <span>העלה</span>
                </label>
                <button onClick={handlePublish} disabled={publishState === 'loading'} className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50">
                  {publishState === 'loading' ? <Loader size={10} className="animate-spin" /> : <Github size={10} />}
                  <span>{publishState === 'loading' ? 'מפרסם' : 'פרסם'}</span>
                </button>
              </div>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-100/50 overflow-x-auto no-scrollbar">
             {allTopics.slice(0, 50).map(t => (
               <button
                 key={t}
                 onClick={() => setSelectedTopic(selectedTopic === t ? null : t)}
                 className={`text-[9px] px-2 py-0.5 rounded-md border transition-all whitespace-nowrap font-bold ${selectedTopic === t ? 'bg-teal-600 border-teal-600 text-white' : 'bg-white border-slate-100 text-slate-500 hover:border-teal-300'}`}
               >
                 {t} <span className="opacity-40 font-normal">[{topicCounts[t] || 0}]</span>
               </button>
             ))}
          </div>
        </header>
        )}

        {/* Main Content Area */}
        {isPublicViewer ? (
          <div className="flex-1 min-h-0 flex flex-col relative">
             <PublicGallery images={images} metadata={metadata} />
          </div>
        ) : adminViewMode === 'edit' ? (
          <div className="flex flex-col lg:flex-row gap-4 md:gap-6 flex-1 min-h-0 relative">
            
            {/* Editor Panel */}
            <div className="flex flex-col gap-4 bg-white p-4 md:p-6 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 min-h-0 overflow-y-auto lg:w-[400px] order-2 lg:order-1">
              <div className="shrink-0">
                <h2 className="text-lg md:text-xl font-bold text-slate-800 mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="bg-teal-100 text-teal-600 w-8 h-8 rounded-lg flex items-center justify-center text-sm">✍️</span>
                    עריכת פרטים
                  </div>
                  <button onClick={handleDelete} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors flex items-center gap-2 text-xs font-medium">
                    <Trash2 size={16} />
                    <span>מחק</span>
                  </button>
                </h2>
                
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 mb-2 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono" dir="ltr">
                    <span className="flex items-center gap-1.5 font-bold text-slate-500">
                      <ImageIcon size={12} /> FILE
                    </span>
                    <span className="truncate max-w-[150px]">{currentFile}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-500 font-bold bg-slate-200/40 px-1.5 py-0.5 rounded border border-slate-200">
                        {fileSizes[images[currentIndex]] ? formatBytes(fileSizes[images[currentIndex]]) : '...'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-4 flex-1">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 ml-1">שם התמונה (משחק מילים)</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full text-sm px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 outline-none transition-all font-bold text-slate-800"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 ml-1">נושאים וקטגוריות</label>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-2 min-h-[50px] flex flex-wrap gap-1.5">
                    {topic.split(',').map(t => t.trim()).filter(Boolean).map((tag, idx) => (
                      <span key={`${tag}-${idx}`} className="flex items-center gap-1 bg-teal-100 text-teal-800 px-2 py-0.5 rounded-lg border border-teal-200 text-[10px] font-bold">
                        {tag}
                        <button onClick={() => setTopic(topic.split(',').map(t => t.trim()).filter(t => t !== tag).join(', '))} className="p-0.5 hover:bg-teal-200 rounded-full"><X size={10} /></button>
                      </span>
                    ))}
                    <input
                      type="text"
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); const val = newTagInput.trim().replace(/,/g, ''); if (val) { const tags = topic ? topic.split(',').map(t => t.trim()) : []; if (!tags.includes(val)) setTopic(topic ? `${topic}, ${val}` : val); setNewTagInput(''); } } }}
                      placeholder="+"
                      className="flex-1 min-w-[50px] bg-transparent border-none focus:ring-0 text-xs font-bold p-1"
                      dir="rtl"
                    />
                  </div>
                </div>

                <div className="space-y-1 flex-1 flex flex-col">
                  <label className="text-[11px] font-bold text-slate-700 ml-1">הסבר</label>
                  <textarea
                    value={explanation}
                    onChange={(e) => setExplanation(e.target.value)}
                    className="w-full flex-1 min-h-[80px] px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs leading-relaxed resize-none"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="checkbox"
                      checked={isApproved}
                      onChange={(e) => setIsApproved(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-teal-600 cursor-pointer"
                    />
                    <label className="cursor-pointer text-slate-700 font-bold text-xs" htmlFor="checkbox">תמונה מאושרת ✅</label>
                  </div>
                </div>

                {/* Social Media Sharing */}
                <div className="space-y-2 p-3 bg-indigo-50/50 border border-indigo-100 rounded-2xl">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-indigo-700 ml-1">שיתוף ברשתות חברתיות</label>
                    <div className="flex bg-white rounded-lg p-0.5 border border-indigo-100 shrink-0 gap-1">
                      <button 
                        onClick={() => setSocialPlatform('instagram')} 
                        className={`px-2 py-0.5 rounded-md text-[9px] font-bold transition-all ${
                          socialPlatform === 'instagram' ? 'bg-indigo-600 text-white shadow-sm' : 'text-indigo-400 hover:text-indigo-600'
                        } ${metaConnected ? 'shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'shadow-[0_0_8px_rgba(239,68,68,0.6)]'}`}
                      >
                        Instagram
                      </button>
                      <button 
                        onClick={() => setSocialPlatform('facebook')} 
                        className={`px-2 py-0.5 rounded-md text-[9px] font-bold transition-all ${
                          socialPlatform === 'facebook' ? 'bg-indigo-600 text-white shadow-sm' : 'text-indigo-400 hover:text-indigo-600'
                        } ${metaConnected ? 'shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'shadow-[0_0_8px_rgba(239,68,68,0.6)]'}`}
                      >
                        Facebook
                      </button>
                      <button 
                        onClick={() => setSocialPlatform('x')} 
                        className={`px-2 py-0.5 rounded-md text-[9px] font-bold transition-all ${
                          socialPlatform === 'x' ? 'bg-indigo-600 text-white shadow-sm' : 'text-indigo-400 hover:text-indigo-600'
                        } ${xConnected ? 'shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'shadow-[0_0_8px_rgba(239,68,68,0.6)]'}`}
                      >
                        X
                      </button>
                      <button 
                        onClick={() => setSocialPlatform('all')} 
                        className={`px-2 py-0.5 rounded-md text-[9px] font-bold transition-all ${
                          socialPlatform === 'all' ? 'bg-indigo-600 text-white shadow-sm' : 'text-indigo-400 hover:text-indigo-600'
                        }`}
                      >
                        כולם
                      </button>
                    </div>
                  </div>
                  
                  <button
                    onClick={handleSocialPost}
                    disabled={socialPostState === 'loading' || !isApproved}
                    className={`w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all ${
                      socialPostState === 'success' ? 'bg-green-100 text-green-700 border border-green-200' :
                      socialPostState === 'error' ? 'bg-rose-100 text-rose-700 border border-rose-200' :
                      'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
                    } disabled:opacity-50`}
                  >
                    {socialPostState === 'loading' ? <Loader size={14} className="animate-spin" /> : 
                      socialPostState === 'success' ? <CheckCircle size={14} /> :
                      socialPostState === 'error' ? <X size={14} /> : 
                      socialPlatform === 'instagram' ? <Instagram size={14} /> :
                      socialPlatform === 'facebook' ? <Facebook size={14} /> :
                      socialPlatform === 'x' ? <Twitter size={14} /> :
                      <Share2 size={14} />}
                    <span>
                      {socialPostState === 'loading' ? 'מפרסם...' : 
                       socialPostState === 'success' ? 'פורסם בהצלחה!' :
                       socialPostState === 'error' ? 'שגיאה בפרסום' : 
                       `פרסם ב-${
                         socialPlatform === 'instagram' ? 'אינסטגרם' : 
                         socialPlatform === 'facebook' ? 'פייסבוק' : 
                         socialPlatform === 'x' ? 'X (Twitter)' : 'כולם'
                       }`}
                    </span>
                  </button>
                  {socialPostState === 'error' && socialResult && (
                    <div className="relative group">
                      <p className="text-[9px] text-rose-500 font-medium text-center px-4 bg-rose-50 rounded-lg py-1 border border-rose-100 mt-1">
                        {socialResult.error || 'שגיאה לא ידועה'}
                      </p>
                      <button 
                        onClick={() => { setSocialPostState('idle'); setSocialResult(null); }}
                        className="absolute -top-1 -right-1 bg-rose-500 text-white rounded-full p-0.5 hover:bg-rose-600 transition-colors shadow-sm"
                      >
                        <X size={8} />
                      </button>
                    </div>
                  )}

                  {isApproved && (socialPlatform === 'instagram' || socialPlatform === 'facebook' || socialPlatform === 'all') && (
                    <div className="mt-1 px-2 py-1 bg-amber-50/50 rounded-lg border border-amber-100">
                       <p className="text-[8px] text-amber-700 leading-tight text-center">
                         💡 <b>טיפ:</b> וודא שהתמונה פורסמה לאתר (GitHub Sync) לפני הפרסום ב-Meta.
                       </p>
                    </div>
                  )}
                  
                  {!isApproved && (
                    <p className="text-[9px] text-indigo-400 font-medium text-center">
                      יש לאשר את התמונה לפני הפרסום
                    </p>
                  )}

                  {/* Post History & Warning */}
                  {isApproved && (
                    <div className="mt-2 space-y-2">
                      {metadata[images[currentIndex]]?.social_posts?.length > 0 && (
                        <div className="bg-white/50 rounded-xl p-2 border border-indigo-100">
                          <p className="text-[10px] font-bold text-indigo-700 mb-1 border-b border-indigo-50 pb-1">היסטוריית פרסומים:</p>
                          <div className="space-y-1">
                            {metadata[images[currentIndex]].social_posts.slice().reverse().map((post, idx) => (
                              <div key={idx} className="flex items-center justify-between text-[9px] text-slate-600">
                                <span className="font-bold capitalize">{post.platform === 'x' ? 'X.com' : post.platform}</span>
                                <span>{new Date(post.date).toLocaleDateString('he-IL')} {new Date(post.date).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {socialPlatform !== 'all' && metadata[images[currentIndex]]?.social_posts?.some(p => p.platform === socialPlatform) && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-xl text-[10px] text-amber-700 font-bold animate-pulse">
                          <span>⚠️ כבר פורסם ב-{socialPlatform === 'x' ? 'X' : socialPlatform === 'instagram' ? 'אינסטגרם' : 'פייסבוק'}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {isApproved && (socialPlatform === 'x' || socialPlatform === 'all') && (
                    <div className="flex flex-col items-center gap-1 mt-1">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold">
                        <div className={`w-2 h-2 rounded-full ${xConnected ? 'bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.6)]' : 'bg-slate-300'}`}></div>
                        <span className={xConnected ? 'text-green-600' : 'text-slate-500'}>
                          {xConnected ? 'מחובר ל-X' : 'לא מחובר ל-X'}
                        </span>
                      </div>
                      <button 
                        onClick={handleXLogin}
                        className="text-[10px] text-indigo-500 hover:text-indigo-700 font-bold underline flex items-center gap-1"
                      >
                        <Twitter size={10} />
                        התחבר/רענן חיבור
                      </button>
                    </div>
                  )}

                  {isApproved && (socialPlatform === 'instagram' || socialPlatform === 'facebook' || socialPlatform === 'all') && (
                    <div className="flex flex-col items-center gap-1 mt-1 pt-1 border-t border-indigo-100/50">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold">
                        <div className={`w-2 h-2 rounded-full ${metaConnected ? 'bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.6)]' : 'bg-rose-500 shadow-[0_0_5px_rgba(244,63,94,0.6)]'}`}></div>
                        <span className={metaConnected ? 'text-green-600' : 'text-rose-600'}>
                          {metaConnected ? 'מחובר ל-Meta' : 'חיבור ל-Meta פג'}
                        </span>
                      </div>
                      {!metaConnected && (
                        <a 
                          href="https://developers.facebook.com/tools/explorer/"
                          target="_blank"
                          rel="noreferrer"
                          className="text-[9px] text-indigo-500 hover:text-indigo-700 font-bold underline flex items-center gap-1"
                        >
                          <ExternalLink size={10} />
                          לחץ כאן לחידוש הטוקן
                        </a>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handleSave(true)}
                    disabled={isSaving}
                    className="flex-1 flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white py-3 rounded-xl font-bold transition-all disabled:opacity-50 text-sm shadow-md"
                  >
                    {isSaving ? <Loader size={16} className="animate-spin" /> : <>שמור והמשך <ChevronLeft size={16} /></>}
                  </button>
                  <button onClick={() => handleSave(false)} disabled={isSaving} className="w-20 lg:w-32 flex items-center justify-center bg-white text-teal-700 border border-teal-200 hover:bg-teal-50 rounded-xl font-bold transition-all disabled:opacity-50">
                    <Save size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Image Viewer Panel */}
            <div className="flex flex-col bg-white rounded-3xl shadow-xl shadow-slate-200/50 overflow-hidden border border-slate-100 flex-1 min-h-[300px] lg:min-h-0 order-1 lg:order-2">
              <div className="relative w-full h-full flex flex-col overflow-hidden bg-slate-950 transition-colors duration-700" id="public-gallery-root">
      {/* Top Header - Unified Scaling */}
                {images.length > 0 ? (
                  <img
                    src={`${API_BASE}/images/${encodeURIComponent(currentFile)}?v=${fileSizes[currentFile] || ''}`}
                    alt={title || currentFile}
                    className="max-w-full max-h-full object-contain drop-shadow-md rounded-lg"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-300 gap-2">
                     <ImageIcon size={32} />
                     <p className="text-xs font-bold">אין תמונות</p>
                  </div>
                )}
                <div className="absolute bottom-3 left-3 bg-black/50 backdrop-blur-sm text-white text-[10px] font-bold px-3 py-1 rounded-full">
                  {currentIndex + 1} / {images.length}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 border-t border-slate-100 shrink-0">
                <button onClick={nextImage} disabled={currentIndex === images.length - 1} className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-slate-700 bg-white shadow-sm border border-slate-200 hover:bg-slate-50 hover:text-teal-600 disabled:opacity-30 transition-all text-xs">
                  <ChevronRight size={16} />
                  <span>הבא</span>
                </button>
                <button onClick={prevImage} disabled={currentIndex === 0} className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-slate-700 bg-white shadow-sm border border-slate-200 hover:bg-slate-50 hover:text-teal-600 disabled:opacity-30 transition-all text-xs">
                  <span>הקודם</span>
                  <ChevronLeft size={16} />
                </button>
              </div>
            </div>
          </div>
        ) : adminViewMode === 'duplicates' ? (
          <DuplicatesReview onComplete={() => setAdminViewMode('edit')} />
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto pr-1 pb-8">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {images.map((filename, index) => {
                const data = metadata[filename];
                const isTagged = data?.title && data?.explanation;
                return (
                  <div 
                    key={filename} 
                    onClick={() => {
                        if (selectionMode) {
                            toggleSelectImage(filename);
                        } else {
                            setCurrentIndex(index);
                            setAdminViewMode('edit');
                        }
                    }}
                    className={`group relative bg-white border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer aspect-square ${
                        selectionMode && selectedImages.includes(filename) 
                            ? 'border-indigo-500 ring-2 ring-indigo-200' 
                            : 'border-slate-200 hover:border-teal-300'
                    }`}
                  >
                    {selectionMode && (
                      <div className={`absolute top-2 right-2 z-10 w-5 h-5 rounded-full border-2 transition-all flex items-center justify-center ${
                        selectedImages.includes(filename) 
                            ? 'bg-indigo-500 border-indigo-500 text-white' 
                            : 'bg-white/80 border-slate-300'
                      }`}>
                        {selectedImages.includes(filename) && <CheckCircle size={12} />}
                      </div>
                    )}
                    <img 
                      src={`${API_BASE}/images/${encodeURIComponent(filename)}`} 
                      alt={data?.title || filename}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                    
                    {/* Overlay Grad */}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-900/95 to-transparent p-3 pt-10 pb-3">
                      <p className="text-white text-sm font-bold truncate text-right drop-shadow-md">
                        {data?.title || <span className="text-slate-300 font-normal italic">ללא שם</span>}
                      </p>
                      <p className="text-white/40 text-[10px] font-mono truncate text-right mt-0.5" dir="ltr">
                        {filename}
                      </p>
                    </div>

                    {/* Status Indicator */}
                    <div className="absolute top-2 right-2 flex flex-col gap-1.5 items-center">
                      {isTagged ? (
                        <div className="w-2.5 h-2.5 bg-teal-500 rounded-full shadow-[0_0_5px_rgba(20,184,166,0.8)]" title="מעודכן (יש כותרת והסבר)"></div>
                      ) : (
                        <div className="w-2.5 h-2.5 bg-slate-300 rounded-full shadow-[0_0_5px_rgba(203,213,225,0.8)]" title="חסר נתונים"></div>
                      )}
                      {data?.isApproved && (
                        <div className="w-2.5 h-2.5 bg-amber-400 rounded-full shadow-[0_0_5px_rgba(251,191,36,0.8)]" title="בקרת איכות (מאושרת)"></div>
                      )}
                    </div>

                    {/* Delete Button Area */}
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


      {/* Topic Browser Modal */}
      {isTopicModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <LayoutGrid className="text-teal-600" size={24} />
                בחר נושא לסינון
              </h3>
              <button
                onClick={() => {
                  setIsTopicModalOpen(false);
                  setTopicSearchQuery('');
                }}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 border-b border-slate-100">
              <div className="relative">
                <Search size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="חפש נושא או קטגוריה..."
                  value={topicSearchQuery}
                  onChange={(e) => setTopicSearchQuery(e.target.value)}
                  autoFocus
                  className="w-full pr-12 pl-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-teal-500/20 focus:border-teal-500 transition-all font-medium text-slate-800 text-lg"
                  dir="rtl"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-slate-50/30">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <button
                      onClick={() => {
                        setSelectedTopic(null);
                        setIsTopicModalOpen(false);
                      }}
                      className={`p-4 rounded-2xl border transition-all text-center font-bold ${!selectedTopic ? 'bg-teal-600 border-teal-600 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-600 hover:border-teal-300'}`}
                    >
                      כל הנושאים
                    </button>
                    {allTopics
                      .filter(t => t.toLowerCase().includes(topicSearchQuery.toLowerCase()))
                      .map(t => (
                        <button
                          key={t}
                          onClick={() => {
                            setSelectedTopic(selectedTopic === t ? null : t);
                            setIsTopicModalOpen(false);
                          }}
                          className={`p-4 rounded-2xl border transition-all text-center flex flex-col items-center justify-center gap-1 ${selectedTopic === t ? 'bg-teal-600 border-teal-600 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-600 hover:border-teal-300'}`}
                        >
                          <span className="font-bold">{t}</span>
                          <span className={`text-[10px] ${selectedTopic === t ? 'text-teal-100' : 'text-slate-400'}`}>[{topicCounts[t] || 0} תמונות]</span>
                        </button>
                      ))}
                </div>
                {allTopics.filter(t => t.toLowerCase().includes(topicSearchQuery.toLowerCase())).length === 0 && (
                  <div className="text-center p-8 text-slate-500 italic">
                    לא נמצאו נושאים תואמים...
                  </div>
                )}
            </div>
            
            <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
                <p className="text-xs text-slate-400 font-medium italic">
                    סה"כ {allTopics.length} נושאים במערכת
                </p>
            </div>
          </div>
        </div>
      )}
      {/* Bulk Action Bar */}
      {selectionMode && selectedImages.length > 0 && adminViewMode === 'grid' && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900/90 backdrop-blur-md text-white px-6 py-4 rounded-2xl shadow-2xl border border-white/10 flex items-center gap-6 transition-all animate-in slide-in-from-bottom-4">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-400">נבחרו {selectedImages.length} תמונות</span>
            <span className="text-[10px] text-slate-500">הפרסום יתבצע במרווחים של 5-10 דקות</span>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => { setSelectedImages([]); setSelectionMode(false); }}
              className="px-4 py-2 rounded-xl text-xs font-bold border border-white/20 hover:bg-white/10 transition-all"
            >
              ביטול
            </button>
            <button 
              onClick={handleBulkPost}
              className="px-6 py-2 rounded-xl text-xs font-bold bg-indigo-500 hover:bg-indigo-600 shadow-lg shadow-indigo-500/20 flex items-center gap-2 transition-all"
            >
              <Share2 size={14} /> פרסם הכל (Bulk)
            </button>
          </div>
        </div>
      )}

      {/* Bulk Progress Overlay */}
      {bulkProgress && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl p-10 max-w-md w-full shadow-2xl text-center space-y-6 animate-in zoom-in-95">
            <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto animate-pulse">
              <Share2 size={32} />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-2xl font-black text-slate-900">פרסום מתוזמר בתהליך</h3>
              <p className="text-slate-500 font-bold">{bulkProgress.status}</p>
            </div>

            <div className="bg-slate-100 h-3 rounded-full overflow-hidden">
              <div 
                className="bg-indigo-500 h-full transition-all duration-500" 
                style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
              />
            </div>

            <div className="flex justify-between text-xs font-black text-slate-400 uppercase tracking-wider">
              <span>תמונה {bulkProgress.current} מתוך {bulkProgress.total}</span>
              <span>{(bulkProgress.current / bulkProgress.total * 100).toFixed(0)}%</span>
            </div>

            {bulkProgress.countdown > 0 && (
              <div className="p-4 bg-indigo-50 rounded-2xl">
                <p className="text-indigo-900 font-black text-3xl tabular-nums">
                  {Math.floor(bulkProgress.countdown / 60)}:{(bulkProgress.countdown % 60).toString().padStart(2, '0')}
                </p>
                <p className="text-indigo-600 text-[10px] font-bold mt-1">עד הפוסט הבא</p>
              </div>
            )}
            
            <p className="text-[10px] text-slate-400">אנא אל תסגור את החלון עד לסיום התהליך</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

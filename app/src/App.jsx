import { useState, useEffect, useMemo, useRef } from 'react';
import { ChevronRight, ChevronLeft, ArrowLeft, ArrowRight, Save, MessageCircle, Check, Trash2, Search, X, Upload, Github, Loader, LayoutGrid, Image as ImageIcon, Copy, Instagram, Facebook, Twitter, Share2, ExternalLink, PenTool, Minus, Layers, RotateCw, Square, ArrowRightLeft, Sparkles } from 'lucide-react';
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
  const [igConnected, setIgConnected] = useState(false);
  const [metaConnected, setMetaConnected] = useState(false);
  const [metaError, setMetaError] = useState(null);
  const [fileCreationTimes, setFileCreationTimes] = useState({});
  const [sortOrder, setSortOrder] = useState('default'); // 'default' (backend alphanumeric) | 'newest'

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
  const [platformStatuses, setPlatformStatuses] = useState({}); // { [platform]: { status: 'pending'|'loading'|'success'|'error', message: string, shareUrl?: string } }
  const [editModeTab, setEditModeTab] = useState('details'); // 'details' | 'social'
  const [shareToFacebook, setShareToFacebook] = useState(false);
  const [shareToPersonalProfile, setShareToPersonalProfile] = useState(true);
  const [fbPersonalConnected, setFbPersonalConnected] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);
  const [bulkProgress, setBulkProgress] = useState(null); // { current, total, countdown, status }
  const [waTargetId, setWaTargetId] = useState(localStorage.getItem('waTargetId') || '');
  const [waStatus, setWaStatus] = useState({ status: 'DISCONNECTED', qr: null });
  const [isBulkMinimized, setIsBulkMinimized] = useState(false);
  const [bulkCardPos, setBulkCardPos] = useState({ x: 24, y: 24 }); // Offset from top-right
  const [isDragging, setIsDragging] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkSelectedPlatforms, setBulkSelectedPlatforms] = useState(['instagram', 'facebook', 'x', 'whatsapp']);
  const dragRef = useRef(null);
  const dragStartRef = useRef(null);
  const bulkModalRef = useRef(null);
  const topicModalRef = useRef(null);

  useEffect(() => {
    const dialog = bulkModalRef.current;
    if (!dialog) return;
    if (isBulkModalOpen) {
      if (!dialog.open) dialog.showModal();
    } else {
      if (dialog.open) dialog.close();
    }
  }, [isBulkModalOpen]);

  useEffect(() => {
    const dialog = topicModalRef.current;
    if (!dialog) return;
    if (isTopicModalOpen) {
      if (!dialog.open) dialog.showModal();
    } else {
      if (dialog.open) dialog.close();
    }
  }, [isTopicModalOpen]);

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
      setFileCreationTimes(data.fileCreationTimes || {});
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

  const checkFbPersonalStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/social/facebook-personal/status`);
      const data = await res.json();
      setFbPersonalConnected(!!data.connected);
    } catch (e) {
      console.error('Failed to check FB personal status', e);
    }
  };

  const checkIgStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/social/instagram/status`);
      const data = await res.json();
      setIgConnected(!!data.connected);
    } catch (e) {
      console.error('Failed to check Instagram status', e);
    }
  };

  const [newMetaToken, setNewMetaToken] = useState('');
  const [metaAppSecret, setMetaAppSecret] = useState('');
  const [metaTokenSavedMsg, setMetaTokenSavedMsg] = useState(null);
  const [isUpdatingMetaToken, setIsUpdatingMetaToken] = useState(false);
  const [isCheckingDiagnostics, setIsCheckingDiagnostics] = useState(false);
  const [showTokenPanel, setShowTokenPanel] = useState(false);

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

  const handleUpdateMetaToken = async () => {
    if (!newMetaToken.trim()) return;
    setIsUpdatingMetaToken(true);
    setMetaTokenSavedMsg(null);
    try {
      const res = await fetch(`${API_BASE}/api/social/meta/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: newMetaToken.trim(),
          appSecret: metaAppSecret.trim() || undefined
        })
      });
      const data = await res.json();
      if (res.ok && data.connected) {
        setNewMetaToken('');
        if (data.tokenTypeMsg) setMetaTokenSavedMsg(data.tokenTypeMsg);
        await checkMetaStatus();
        await runSocialDiagnostics();
      } else {
        setMetaError(data.error || 'הטוקן שהוזן אינו תקין');
      }
    } catch (e) {
      setMetaError(`שגיאה בעדכון הטוקן: ${e.message}`);
    } finally {
      setIsUpdatingMetaToken(false);
    }
  };

  const handleFbPersonalLogin = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/social/facebook-personal/login`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        alert('נפתח חלון דפדפן להתחברות חד-פעמית לפייסבוק האישי שלך.\nהתחבר לחשבון בפופ-אפ שנפתח — ברגע שהפיד ייטען החלון ייסגר אוטומטית והסשן יישמר!');
        setTimeout(checkFbPersonalStatus, 5000);
        setTimeout(checkFbPersonalStatus, 15000);
        setTimeout(checkFbPersonalStatus, 30000);
      } else {
        alert('שגיאה בפתיחת חלון התחברות לפייסבוק: ' + (data.error || 'שגיאה'));
      }
    } catch (e) {
      alert('שגיאת תקשורת עם השרת: ' + e.message);
    }
  };

  const handleInstagramLogin = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/social/instagram/login`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        alert('נפתח חלון דפדפן להתחברות חד-פעמית לאינסטגרם שלך.\nהתחבר לחשבון בחלון שנפתח — ברגע שהפיד ייטען החלון ייסגר אוטומטית והסשן יישמר!');
        setTimeout(checkIgStatus, 5000);
        setTimeout(checkIgStatus, 15000);
        setTimeout(checkIgStatus, 30000);
      } else {
        alert('שגיאה בפתיחת חלון התחברות לאינסטגרם: ' + (data.error || 'שגיאה'));
      }
    } catch (e) {
      alert('שגיאת תקשורת עם השרת: ' + e.message);
    }
  };

  const runSocialDiagnostics = async () => {
    setIsCheckingDiagnostics(true);
    setPlatformStatuses({
      instagram: { status: 'loading', message: 'בודק סשן אינסטגרם המקומי וקובץ...' },
      facebook: { status: 'loading', message: 'בודק Page Access Token...' },
      'facebook-personal': { status: 'loading', message: 'בודק חיבור לפרופיל האישי...' },
      x: { status: 'loading', message: 'בודק סשן X.com וקובץ מקומי...' },
      whatsapp: { status: 'loading', message: 'בודק חיבור WhatsApp ויעד...' }
    });
    try {
      const currFile = images[currentIndex] || null;
      const res = await fetch(`${API_BASE}/api/social/diagnostics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: currFile,
          shareToPersonalProfile,
          waTargetId: waTargetId || undefined
        })
      });
      const data = await res.json();
      if (data.ok && data.diagnostics) {
        setPlatformStatuses(data.diagnostics);
      }
      checkMetaStatus();
      checkXStatus();
      checkIgStatus();
      checkFbPersonalStatus();
      checkWaStatus();
    } catch (e) {
      setPlatformStatuses({
        system: { status: 'error', message: `שגיאה בתקשורת עם השרת: ${e.message}` }
      });
    } finally {
      setIsCheckingDiagnostics(false);
    }
  };

  const handleAutoSuggest = async () => {
    if (!images[currentIndex]) return;
    setIsSuggesting(true);
    try {
      const res = await fetch(`${API_BASE}/api/images/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: images[currentIndex] })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.title) setTitle(data.title);
        if (data.explanation) setExplanation(data.explanation);
        if (data.topic) setTopic(data.topic);
      } else {
        const err = await res.json();
        alert(`שגיאה בהצעה: ${err.error || 'אלמונית'}`);
      }
    } catch (e) {
      console.error('Auto suggest error:', e);
      alert('שגיאה בחיבור לשרת ה-AI');
    } finally {
      setIsSuggesting(false);
    }
  };

  const checkWaStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/social/whatsapp/status`);
      const data = await res.json();
      setWaStatus(data);
    } catch (e) {
      console.error('Failed to check WhatsApp status', e);
    }
  };

  useEffect(() => {
    fetchImages();
    if (isPublicViewer) return; // Do not check backend statuses in public mode
    // Add small delay to ensure backend is fully ready before headless check
    setTimeout(() => {
      checkXStatus();
      checkIgStatus();
      checkMetaStatus();
      checkFbPersonalStatus();
      checkWaStatus();
    }, 2000);
    fetchPublishStatus();
    fetchMasterTags();
  }, []);

  // Poll for WhatsApp status if scanning QR
  useEffect(() => {
    if (isPublicViewer) return; // No WA polling in public mode
    let interval;
    if (waStatus.status === 'SCAN_QR' || waStatus.status === 'LOADING' || waStatus.status === 'INITIALIZING') {
      interval = setInterval(checkWaStatus, 3000);
    }
    return () => clearInterval(interval);
  }, [waStatus.status]);

  const toggleSelectImage = (img) => {
    setSelectedImages(prev => {
      if (prev.includes(img)) {
        return prev.filter(i => i !== img);
      } else {
        return [...prev, img];
      }
    });
  };

  const selectAllFiltered = () => {
    setSelectedImages(filteredImages);
  };

  const handleBulkDelete = async () => {
    if (selectedImages.length === 0) return;
    if (!window.confirm(`האם אתה בטוח שברצונך למחוק ${selectedImages.length} תמונות? הפעולה אינה ניתנת לביטול.`)) return;

    const resolutions = selectedImages.map(img => ({
        filename: img,
        action: 'delete'
    }));

    setIsSaving(true);
    try {
        const res = await fetch(`${API_BASE}/api/duplicates/resolve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ resolutions })
        });

        if (!res.ok) throw new Error('Failed to delete images');

        setSelectedImages([]);
        fetchImages();
        alert('התמונות נמחקו בהצלחה');
    } catch (err) {
        alert('שגיאה במחיקת התמונות: ' + err.message);
    } finally {
        setIsSaving(false);
    }
  };

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Poll for background bulk status
  useEffect(() => {
    if (isPublicViewer) return; // Do not poll for bulk status in public mode
    let interval;
    const checkStatus = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/social/bulk/status`);
        const data = await res.json();
        if (data.isActive) {
          setBulkProgress(data);
        } else if (bulkProgress && !data.isActive) {
            setBulkProgress(null);
            fetchImages();
        }
      } catch (e) {
        console.error('Error polling bulk status:', e);
      }
    };

    interval = setInterval(checkStatus, 3000);
    checkStatus();

    return () => clearInterval(interval);
  }, [bulkProgress]);

  // Debounce search query to prevent lag on every keystroke
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const filteredImages = useMemo(() => {
    let result = (allImages || []).filter(img => {
      const meta = metadata[img] || {};
      
      // 1. Filter Mode
      let passesFilter = true;
      if (filterMode === 'all') passesFilter = true;
      else if (filterMode === 'tagged' && (!meta.title?.trim() || !meta.explanation?.trim() || !meta.topic?.trim())) passesFilter = false;
      else if (filterMode === 'no-title' && meta.title) passesFilter = false;
      else if (filterMode === 'no-explanation' && meta.explanation) passesFilter = false;
      else if (filterMode === 'no-topic' && meta.topic) passesFilter = false;
      else if (filterMode === 'ai' && meta.isAIGenerated !== true) passesFilter = false;
      else if (filterMode === 'approved' && meta.isApproved !== true) passesFilter = false;
      else if (filterMode === 'not-approved' && meta.isApproved === true) passesFilter = false;
      else if (filterMode === 'new-images' && fileSources[img] !== 'new') passesFilter = false;
      else if (filterMode === 'ai-improved' && meta.isAIImproved !== true) passesFilter = false;
      else if (filterMode === 'ai-added' && meta.isAIAdded !== true) passesFilter = false;
      else if (filterMode === 'needs-ai' && meta.needsAIImprovement !== true) passesFilter = false;
      else if (filterMode === 'ai-suggestions' && (!meta.aiSuggestion || meta.aiSuggestion.trim() === '')) passesFilter = false;
      else if (filterMode === 'generic-ai') {
        const isGeneric = meta.explanation?.includes('התמונה ממחישה את הכפל המשמעות הטמון בביטוי');
        if (!isGeneric) passesFilter = false;
      }
      else if (filterMode === 'published-any' && (!meta.social_posts || meta.social_posts.length === 0)) passesFilter = false;
      else if (filterMode === 'not-published' && meta.social_posts?.length > 0) passesFilter = false;
      else if (filterMode === 'published-instagram' && !meta.social_posts?.some(p => p.platform === 'instagram')) passesFilter = false;
      else if (filterMode === 'published-facebook' && !meta.social_posts?.some(p => p.platform === 'facebook')) passesFilter = false;
      else if (filterMode === 'published-x' && !meta.social_posts?.some(p => p.platform === 'x')) passesFilter = false;
      
      // Social "Need" Filters
      else if (filterMode === 'need-any' && meta.social_posts?.length >= 3) passesFilter = false;
      else if (filterMode === 'need-instagram' && meta.social_posts?.some(p => p.platform === 'instagram')) passesFilter = false;
      else if (filterMode === 'need-facebook' && meta.social_posts?.some(p => p.platform === 'facebook')) passesFilter = false;
      else if (filterMode === 'need-x' && meta.social_posts?.some(p => p.platform === 'x')) passesFilter = false;
      else if (filterMode === 'untitled') {
        if (!img.includes('עיצוב ללא שם')) passesFilter = false;
      }

      if (!passesFilter) return false;

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

    // 4. Global Sorting
    if (sortOrder === 'newest') {
        result = [...result].sort((a, b) => {
            const timeA = fileCreationTimes[a] || 0;
            const timeB = fileCreationTimes[b] || 0;
            return timeB - timeA;
        });
    }

    return result;
  }, [filterMode, selectedTopic, debouncedSearchQuery, allImages, metadata, sortOrder, fileCreationTimes]);

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
      untitled: 0,
      publishedAny: 0,
      notPublished: 0,
      publishedInstagram: 0,
      publishedFacebook: 0,
      publishedX: 0,
      needAny: 0,
      needInstagram: 0,
      needFacebook: 0,
      needX: 0
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
      
      const hasPosts = meta.social_posts?.length > 0;
      if (hasPosts) fc.publishedAny++;
      else fc.notPublished++;
      if (meta.social_posts?.some(p => p.platform === 'instagram')) fc.publishedInstagram++;
      if (meta.social_posts?.some(p => p.platform === 'facebook')) fc.publishedFacebook++;
      if (meta.social_posts?.some(p => p.platform === 'x')) fc.publishedX++;

      if (!meta.social_posts || meta.social_posts.length < 3) fc.needAny++;
      if (!meta.social_posts?.some(p => p.platform === 'instagram')) fc.needInstagram++;
      if (!meta.social_posts?.some(p => p.platform === 'facebook')) fc.needFacebook++;
      if (!meta.social_posts?.some(p => p.platform === 'x')) fc.needX++;

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
          filename: currFile,
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

  const postSingleImage = async (filename, platforms, shareToFacebook = false, waTargetId = null) => {
    const footer = `\n\n***\nלינק לאתר: KefeLashon.co.il\n\nלינק להצטרפות לערוץ: https://whatsapp.com/channel/0029VajNwaPL2AU0jdlgxa20\nלינק להצטרפות לקבוצה: https://chat.whatsapp.com/LN6nwJ8cYiLHaj5uhTum9P`;
    const results = [];
    
    // Get metadata for this specific image
    const meta = metadata[filename] || {};
    const imgTitle = meta.title || filename.replace(/\.[^/.]+$/, "");

    // Initialize platform statuses so the user sees all queued platforms immediately
    const initialStatuses = {};
    for (const p of platforms) {
      initialStatuses[p] = { status: 'pending', message: 'ממתין בתור...' };
      if (p === 'facebook' && shareToPersonalProfile) {
        initialStatuses['facebook-personal'] = { status: 'pending', message: 'ממתין בתור...' };
      }
    }
    setPlatformStatuses(initialStatuses);

    for (const p of platforms) {
      const xFooter = `\n\n***\nלינק לאתר: KefeLashon.co.il`;
      const finalCaption = p === 'x' 
        ? `${imgTitle}\n#כפלשון${xFooter}`
        : `${imgTitle}\n#כפלשון${footer}`;

      setPlatformStatuses(prev => ({
        ...prev,
        [p]: { 
          status: 'loading', 
          message: (p === 'x' || p === 'instagram') ? 'מריץ אוטומציית דפדפן (כ-20 שניות)...' : 'שולח לשרת...' 
        },
        ...(p === 'facebook' && shareToPersonalProfile ? {
          'facebook-personal': { status: 'loading', message: 'מנסה לבצע Repost לפרופיל...' }
        } : {})
      }));

      try {
        const res = await fetch(`${API_BASE}/api/social/post`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename,
            caption: finalCaption,
            platform: p,
            shareToFacebook: shareToFacebook,
            shareToPersonalProfile: shareToPersonalProfile,
            targetId: p === 'whatsapp' ? waTargetId : undefined
          })
        });
        const isJson = res.headers.get('content-type')?.includes('application/json');
        const data = isJson ? await res.json() : { error: `Server error: ${res.status} ${res.statusText}` };

        if (p === 'facebook' && Array.isArray(data.results)) {
          const pageRes = data.results.find(r => r.platform === 'facebook-page');
          const persRes = data.results.find(r => r.platform === 'facebook-personal');
          setPlatformStatuses(prev => ({
            ...prev,
            facebook: pageRes ? {
              status: pageRes.ok ? 'success' : 'error',
              message: pageRes.ok ? (pageRes.message || 'פורסם בדף כפלשון!') : (pageRes.error || 'נכשל בדף'),
              postUrl: pageRes.postUrl
            } : { status: res.ok ? 'success' : 'error', message: data.error || 'הסתיים' },
            ...(persRes ? {
              'facebook-personal': {
                status: persRes.ok ? 'success' : 'error',
                message: persRes.ok ? (persRes.message || 'פורסם בפרופיל האישי!') : (persRes.error || 'נכשל בפרופיל האישי'),
                needsFbLogin: persRes.needsFbLogin,
                shareUrl: persRes.shareUrl || data.postUrl
              }
            } : {})
          }));
        } else {
          setPlatformStatuses(prev => ({
            ...prev,
            [p]: {
              status: res.ok ? 'success' : 'error',
              message: res.ok ? (data.message || 'פורסם בהצלחה!') : (data.error || 'שגיאה בפרסום'),
              needsIgLogin: data.needsIgLogin
            }
          }));
        }

        results.push({ platform: p, ok: res.ok, data });
      } catch (fetchErr) {
        setPlatformStatuses(prev => ({
          ...prev,
          [p]: {
            status: 'error',
            message: `שגיאת תקשורת עם השרת: ${fetchErr.message}`
          }
        }));
        results.push({ platform: p, ok: false, data: { error: fetchErr.message } });
      }
    }
    return results;
  };

  const handleSocialPost = async () => {
    if (images.length === 0) return;
    setSocialPostState('loading');
    setSocialResult(null);

    const currFile = images[currentIndex];
    const platforms = socialPlatform === 'all' ? ['instagram', 'facebook', 'x', 'whatsapp'] : [socialPlatform];
    
    try {
      const results = await postSingleImage(currFile, platforms, shareToFacebook, waTargetId);

      const allOk = results.every(r => r.ok && !r.data?.partialError);
      const anyOk = results.some(r => r.ok);
      setSocialPostState(allOk ? 'success' : 'error');
      
      if (allOk) {
        setTimeout(() => setSocialPostState('idle'), 5000);
      }
      
      if (anyOk) {
        fetchImages();
      }
      
      const errors = results.filter(r => !r.ok || r.data?.partialError).map(r => `${r.platform}: ${r.data?.error || r.data?.partialError || 'שגיאה'}`);
      if (errors.length > 0) {
        setSocialResult({ error: errors.join(' | ') });
      } else {
        setSocialResult({ message: 'כל הפלטפורמות שנבחרו פורסמו בהצלחה!' });
      }
    } catch (err) {
      setSocialPostState('error');
      setSocialResult({ error: err.message });
    }
  };

  const handleCancelBulk = async () => {
    try {
        await fetch(`${API_BASE}/api/social/bulk/cancel`, { method: 'POST' });
        setBulkProgress(null);
    } catch (e) {
        console.error('Error canceling bulk:', e);
    }
  };

  const handleSkipBulkWait = async () => {
    try {
        await fetch(`${API_BASE}/api/social/bulk/skip`, { method: 'POST' });
    } catch (e) {
        console.error('Error skipping bulk wait:', e);
    }
  };

  const handleBulkPost = () => {
    if (selectedImages.length === 0) return;
    setIsBulkModalOpen(true);
  };

  const confirmBulkPost = async () => {
    if (selectedImages.length === 0 || bulkSelectedPlatforms.length === 0) return;
    
    setIsBulkModalOpen(false);
    
    try {
        const res = await fetch(`${API_BASE}/api/social/bulk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filenames: selectedImages,
                platforms: bulkSelectedPlatforms,
                shareToFacebook: shareToFacebook,
                shareToPersonalProfile: shareToPersonalProfile,
                waTargetId: waTargetId || undefined
            })
        });
        const data = await res.json();
        if (data.ok) {
            setSelectionMode(false);
            setSelectedImages([]);
            // Status will be polled by the useEffect
        } else {
            setError('שגיאה בהפעלת פרסום מרובה: ' + (data.error || 'שגיאה כללית'));
        }
    } catch (e) {
        setError('שגיאה בתקשורת עם השרת: ' + e.message);
    }
  };

  const handleMouseDown = (e) => {
    setIsDragging(true);
    const safeX = Number.isFinite(bulkCardPos.x) ? bulkCardPos.x : 24;
    const safeY = Number.isFinite(bulkCardPos.y) ? bulkCardPos.y : 24;
    dragStartRef.current = {
      x: e.clientX + safeX,
      y: e.clientY - safeY
    };
    
    const onMouseMove = (moveEvent) => {
      if (!dragStartRef.current) return;
      setBulkCardPos({
        x: Math.max(0, dragStartRef.current.x - moveEvent.clientX),
        y: Math.max(0, moveEvent.clientY - dragStartRef.current.y)
      });
    };
    
    const onMouseUp = () => {
      setIsDragging(false);
      dragStartRef.current = null;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const nextImage = () => {
    if (currentIndex < images.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const prevImage = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const currentFile = images[currentIndex];

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-rose-100 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <X size={32} />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">אופס, משהו השתבש</h2>
          <p className="text-slate-500 text-sm mb-6">{error}</p>
          <button onClick={() => window.location.reload()} className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 transition-colors">
            נסה שוב
          </button>
        </div>
      </div>
    );
  }

  // Calculate progress for the progress bar
  const progressPercentage = allImages.length > 0 
    ? Math.round((filterCounts.approved / allImages.length) * 100) 
    : 0;

  if (isPublicViewer) {
    return <PublicGallery images={allImages} metadata={metadata} />;
  }

  return (
    <div className="h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden flex flex-col" dir="rtl">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 py-3 sticky top-0 z-30 shrink-0">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <h1 className="text-lg font-black tracking-tight text-slate-900 flex items-center gap-2">
                <img src="./logo.webp" alt="כפלשון" className="w-8 h-8 object-contain" onError={(e) => { e.target.onerror = null; e.target.src = './logo.png'; }} />
                כפלשון
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-teal-500 transition-all duration-1000" 
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
                <span className="text-[10px] font-bold text-slate-400">{progressPercentage}% הושלם</span>
              </div>
            </div>

            <nav className="hidden md:flex items-center bg-slate-100 p-1 rounded-xl ml-4">
              <button
                onClick={() => setAdminViewMode('grid')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                  adminViewMode === 'grid' ? 'bg-white text-teal-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <LayoutGrid size={14} />
                גלריה
              </button>
              <button
                onClick={() => setAdminViewMode('edit')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                  adminViewMode === 'edit' ? 'bg-white text-teal-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <PenTool size={14} />
                עריכה
              </button>
              <button
                onClick={() => setAdminViewMode('share')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                  adminViewMode === 'share' ? 'bg-white text-teal-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
                title="ניהול פרסומים בלבד"
              >
                <Share2 size={14} />
                שיתוף
              </button>
              <button
                onClick={() => setAdminViewMode('duplicates')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                  adminViewMode === 'duplicates' ? 'bg-white text-teal-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
                title="ניהול כפילויות"
              >
                <ArrowRightLeft size={14} />
                כפילויות
              </button>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            {!isPublicViewer && (
              <div className="flex items-center gap-1.5 ml-2 mr-2 border-r border-slate-200 pr-4">
                <button 
                  onClick={runSocialDiagnostics}
                  title={igConnected ? 'אינסטגרם מחובר (לחץ לבדיקת כל הפלטפורמות)' : 'אינסטגרם מנותק – לחץ להתחברות או בדיקה'} 
                  className={`p-1.5 rounded-lg transition-colors ${igConnected ? 'bg-pink-600 text-white' : 'bg-slate-100 text-slate-300'}`}
                >
                  <Instagram size={14} />
                </button>
                <button 
                  onClick={runSocialDiagnostics}
                  title={xConnected ? 'X.com מחובר (לחץ לבדיקת כל הפלטפורמות)' : 'X.com מנותק (לחץ לבדיקה)'} 
                  className={`p-1.5 rounded-lg transition-colors ${xConnected ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-300'}`}
                >
                  <Twitter size={14} />
                </button>
                <button 
                  onClick={() => setShowTokenPanel(prev => !prev)}
                  title={metaConnected ? 'Meta (FB/IG) מחובר – לחץ לפתיחת הגדרות טוקן' : `${metaError || 'Meta מנותק'} – לחץ לעדכון טוקן`} 
                  className={`px-2 py-1.5 rounded-lg transition-colors flex items-center gap-1 text-[10px] font-black ${metaConnected ? 'bg-blue-600 text-white' : 'bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100'}`}
                >
                  {metaError ? <X size={13} className="text-rose-500" /> : <Facebook size={13} />}
                  <span>{metaConnected ? 'Meta מחובר' : 'עדכן טוקן Meta'}</span>
                </button>
                <button
                  onClick={() => {
                    setShowTokenPanel(true);
                    runSocialDiagnostics();
                  }}
                  disabled={isCheckingDiagnostics}
                  className="px-2 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-black transition-colors flex items-center gap-1"
                  title="בדיקת מוכנות לכל הפלטפורמות ללא פרסום"
                >
                  {isCheckingDiagnostics ? <Loader size={12} className="animate-spin" /> : '🔍 בדיקה'}
                </button>
              </div>
            )}

            {!isPublicViewer && (
              <div className="flex items-center gap-2">
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all ${
                  publishState === 'loading' ? 'bg-slate-50 border-slate-200 text-slate-400' :
                  publishState === 'success' ? 'bg-teal-50 border-teal-200 text-teal-700 shadow-sm shadow-teal-100' :
                  publishState === 'error' ? 'bg-rose-50 border-rose-200 text-rose-700' :
                  publishState === 'skipped' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                  'bg-white border-slate-200 text-slate-600'
                }`}>
                  {publishState === 'loading' ? <Loader size={14} className="animate-spin" /> :
                   publishState === 'success' ? <Check size={14} /> :
                   publishState === 'error' ? <X size={14} /> :
                   <Github size={14} />}
                  
                  <div className="flex flex-col items-start leading-none">
                    <span className="text-[10px] font-black uppercase tracking-wider">
                      {publishState === 'loading' ? 'מפרסם...' :
                       publishState === 'success' ? 'פורסם!' :
                       publishState === 'error' ? 'שגיאה' :
                       publishState === 'skipped' ? 'אין שינויים' :
                       'Github'}
                    </span>
                    {lastCommit && (
                      <span className="text-[8px] font-bold opacity-60 mt-0.5">
                        {new Date(lastCommit.date).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>

                  {publishState === 'idle' && (
                    <button 
                      onClick={handlePublish}
                      className="mr-1 p-1 hover:bg-slate-100 rounded-md transition-colors"
                      title="פרסם שינויים ל-GitHub"
                    >
                      <Upload size={14} />
                    </button>
                  )}
                </div>

                <label className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md shadow-slate-200 cursor-pointer">
                  <Upload size={14} />
                  <span>העלאה</span>
                  <input type="file" multiple accept="image/*" className="hidden" onChange={handleUpload} />
                </label>
              </div>
            )}

            <div className="relative group ml-2">
              <button 
                onClick={() => setIsSearchOpen(!isSearchOpen)}
                className={`p-2.5 rounded-xl transition-all ${isSearchOpen ? 'bg-teal-50 text-teal-600' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
              >
                {isSearchOpen ? <X size={18} /> : <Search size={18} />}
              </button>
              
              {isSearchOpen && (
                <div className="absolute left-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 animate-in slide-in-from-top-2 duration-200">
                  <div className="relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      autoFocus
                      type="text"
                      placeholder="חפש תמונות, נושאים..."
                      className="w-full pr-10 pl-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-sm font-bold"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-0 max-w-[1600px] mx-auto w-full px-4 pt-4 pb-6 overflow-hidden">

        {/* Top Meta Token & Platform Diagnostics Banner (auto-shown in Share mode when token expired, or when toggled from header) */}
        {!isPublicViewer && (showTokenPanel || (adminViewMode === 'share' && (!metaConnected || Object.keys(platformStatuses).length > 0))) && (
          <div className="mb-3 p-3 rounded-2xl bg-white border border-slate-200 shadow-sm shrink-0 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${metaConnected ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                  {metaConnected ? '✅ Meta (FB/IG) מחובר' : `⚠️ טוקן Meta פג תוקף: ${metaError || 'נדרש חידוש טוקן'}`}
                </span>
                <a
                  href="https://developers.facebook.com/tools/explorer/2088373928676287/"
                  target="_blank"
                  rel="noreferrer"
                  className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg text-[10px] font-black text-indigo-700 transition-colors"
                >
                  🔑 1. מחולל טוקן (Explorer) ↗
                </a>
                <a
                  href="https://developers.facebook.com/tools/debug/accesstoken/"
                  target="_blank"
                  rel="noreferrer"
                  title="הדבק שם את הטוקן ולחץ למטה על Extend Access Token כדי שיהיה תקף ל-60 יום במקום שעה אחת"
                  className="px-2 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg text-[10px] font-black text-amber-800 transition-colors"
                >
                  ⏱️ 2א. הארך ידנית (Extend) ↗
                </a>
                <a
                  href="https://developers.facebook.com/apps/2088373928676287/settings/basic/"
                  target="_blank"
                  rel="noreferrer"
                  title="העתק משם את ה-App Secret פעם אחת כדי שהשרת ימיר אוטומטית כל טוקן לטוקן קבוע לתמיד (ללא פג תוקף!)"
                  className="px-2 py-1 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg text-[10px] font-black text-purple-800 transition-colors"
                >
                  ♾️ 2ב. קח App Secret (אוטומציה לתמיד) ↗
                </a>
                <button
                  onClick={handleFbPersonalLogin}
                  className="px-2 py-1 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg text-[10px] font-black text-blue-700 transition-colors"
                  title="התחברות חד-פעמית לפרופיל הפייסבוק האישי לצורך Repost אוטומטי"
                >
                  👤 התחבר לפרופיל FB אישי
                </button>
                <button
                  onClick={handleInstagramLogin}
                  className={`px-2 py-1 rounded-lg text-[10px] font-black transition-colors border ${igConnected ? 'bg-pink-50 border-pink-200 text-pink-700 hover:bg-pink-100' : 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'}`}
                  title="התחברות חד-פעמית לאינסטגרם בדפדפן לצורך העלאה ישירה מהמחשב"
                >
                  📸 {igConnected ? 'אינסטגרם מחובר (דפדפן)' : 'התחבר לאינסטגרם'}
                </button>
              </div>

              <div className="flex items-center gap-1.5 flex-1 min-w-[280px] max-w-2xl">
                <input
                  type="text"
                  value={newMetaToken}
                  onChange={(e) => setNewMetaToken(e.target.value)}
                  placeholder="הדבק META_ACCESS_TOKEN..."
                  dir="ltr"
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                />
                <input
                  type="password"
                  value={metaAppSecret}
                  onChange={(e) => setMetaAppSecret(e.target.value)}
                  placeholder="App Secret (אופציונלי - להמרה אוטומטית לתמיד)"
                  dir="ltr"
                  className="w-48 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-purple-500 focus:bg-white"
                />
                <button
                  onClick={handleUpdateMetaToken}
                  disabled={isUpdatingMetaToken || !newMetaToken.trim()}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black disabled:opacity-50 shrink-0 transition-colors"
                >
                  {isUpdatingMetaToken ? 'שומר...' : 'שמור והמר לתמיד'}
                </button>
                <button
                  onClick={runSocialDiagnostics}
                  disabled={isCheckingDiagnostics}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-black disabled:opacity-50 shrink-0 transition-colors"
                >
                  {isCheckingDiagnostics ? 'בודק...' : '🔍 בדוק פלטפורמות'}
                </button>
                {showTokenPanel && (
                  <button
                    onClick={() => setShowTokenPanel(false)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                    title="סגור חלונית"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {metaTokenSavedMsg && (
              <div className="text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1">
                {metaTokenSavedMsg}
              </div>
            )}

            {Object.keys(platformStatuses).length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 pt-1 border-t border-slate-100">
                {Object.entries(platformStatuses).map(([plat, info]) => {
                  const labels = {
                    instagram: 'Instagram',
                    facebook: 'Facebook (דף כפלשון)',
                    'facebook-personal': 'Facebook (פרופיל אישי)',
                    x: 'X.com (Twitter)',
                    whatsapp: 'WhatsApp'
                  };
                  const isSuccess = info.status === 'success';
                  const isError = info.status === 'error';
                  const isLoading = info.status === 'loading';
                  return (
                    <div
                      key={plat}
                      className={`p-2 rounded-xl border text-[10px] flex flex-col gap-0.5 ${
                        isSuccess ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                        isError ? 'bg-rose-50 border-rose-200 text-rose-800' :
                        isLoading ? 'bg-indigo-50 border-indigo-200 text-indigo-800' :
                        'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between font-black">
                        <span>{labels[plat] || plat}</span>
                        <span>
                          {isLoading && '⏳ בודק...'}
                          {isSuccess && '✅ תקין'}
                          {isError && '❌ שגיאה'}
                        </span>
                      </div>
                      {info.message && (
                        <div className="text-[9px] font-medium opacity-90 leading-snug">{info.message}</div>
                      )}
                      {info.needsFbLogin && (
                        <button
                          onClick={handleFbPersonalLogin}
                          className="mt-1 px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[9px] font-black self-start transition-colors"
                        >
                          🔑 התחבר לפרופיל אישי
                        </button>
                      )}
                      {info.needsIgLogin && (
                        <button
                          onClick={handleInstagramLogin}
                          className="mt-1 px-2 py-1 bg-pink-600 hover:bg-pink-700 text-white rounded-lg text-[9px] font-black self-start transition-colors"
                        >
                          📸 התחבר לאינסטגרם
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
        
        {/* View Mode Switching and Filtering for Grid View */}
        {(adminViewMode === 'grid' || adminViewMode === 'share') && (
          <div className="flex flex-col gap-4 mb-4 shrink-0">
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center bg-white p-1 rounded-2xl shadow-sm border border-slate-200">
                    {[
                        { id: 'all', label: 'הכל', count: filterCounts.all },
                        { id: 'tagged', label: 'מתוייג', count: filterCounts.tagged },
                        { id: 'approved', label: 'מאושר', count: filterCounts.approved },
                        { id: 'new-images', label: 'חדשים', count: filterCounts.newImages },
                        { id: 'untitled', label: 'ללא שם', count: filterCounts.untitled }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setFilterMode(tab.id)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                            filterMode === tab.id ? 'bg-teal-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                            }`}
                        >
                            {tab.label}
                            <span className={`text-[10px] font-black ${filterMode === tab.id ? 'text-white/60' : 'text-slate-400'}`}>
                                {tab.count}
                            </span>
                        </button>
                    ))}
                    
                    <div className="w-px h-6 bg-slate-200 mx-1" />
                    
                    <button
                        onClick={() => setIsTopicModalOpen(true)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                            selectedTopic ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                        }`}
                    >
                        <LayoutGrid size={14} />
                        {selectedTopic || 'נושאים'}
                        {selectedTopic && <X size={12} className="ml-1" onClick={(e) => { e.stopPropagation(); setSelectedTopic(null); }} />}
                    </button>
                </div>
                <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                    {[
                        { id: 'grid', label: 'רשת' },
                        { id: 'share', label: 'שיתוף' }
                    ].map(mode => (
                        <button
                            key={mode.id}
                            onClick={() => setAdminViewMode(mode.id)}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                            adminViewMode === mode.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                            }`}
                        >
                            {mode.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex items-center justify-between">
                <div className="flex flex-wrap gap-2">
                    {[
                    { id: 'untagged', label: 'ללא תיוג', count: filterCounts.noTitle + filterCounts.noExplanation + filterCounts.noTopic, color: 'rose' },
                    { id: 'no-topic', label: 'ללא נושא', count: filterCounts.noTopic, color: 'rose' },
                    { id: 'not-approved', label: 'לא מאושר', count: filterCounts.notApproved, color: 'amber' },
                    { id: 'needs-ai', label: 'לשיפור AI', count: filterCounts.needsAi, color: 'indigo' },
                    { id: 'ai-suggestions', label: 'הצעות AI', count: filterCounts.aiSuggestions, color: 'indigo' },
                    { id: 'generic-ai', label: 'AI גנרי', count: filterCounts.genericAi, color: 'slate' },
                    { id: 'not-published', label: 'לא פורסם', count: filterCounts.notPublished, color: 'slate' }
                    ].map(btn => (
                    <button
                        key={btn.id}
                        onClick={() => setFilterMode(btn.id)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl font-bold text-[11px] transition-all ${
                        filterMode === btn.id 
                            ? `bg-${btn.color}-600 text-white shadow-lg` 
                            : `bg-white text-${btn.color}-600 border border-${btn.color}-100 shadow-sm hover:border-${btn.color}-300`
                        }`}
                    >
                        {btn.label}
                        <span className="opacity-40 font-black">[{btn.count}]</span>
                    </button>
                    ))}
                </div>
            </div>
          </div>
        )}

        {/* Edit Mode View */}
        {adminViewMode === 'duplicates' ? (
          <DuplicatesReview onComplete={() => setAdminViewMode('edit')} />
        ) : adminViewMode === 'edit' ? (
          <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0 overflow-hidden">
            {/* Metadata Editor Panel */}
            <div className="w-full lg:w-[450px] flex flex-col gap-4 order-2 lg:order-1 overflow-y-auto pr-1 custom-scrollbar">
              <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col overflow-hidden">
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                    {[
                      { id: 'details', label: 'פרטי תוכן', icon: PenTool },
                      { id: 'social', label: 'מדיה חברתית', icon: Share2 }
                    ].map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setEditModeTab(tab.id)}
                        className={`whitespace-nowrap flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                          editModeTab === tab.id ? 'bg-teal-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-700 hover:bg-white'
                        }`}
                      >
                        <tab.icon size={14} />
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {editModeTab === 'details' ? (
                  <div className="p-6 space-y-5">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">כותרת הביטוי</label>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={handleAutoSuggest}
                            disabled={isSuggesting}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-black transition-all ${
                              isSuggesting ? 'bg-slate-100 text-slate-400' : 'bg-teal-50 text-teal-600 hover:bg-teal-100'
                            }`}
                            title="קבל הצעה אוטומטית מה-AI"
                          >
                            {isSuggesting ? <Loader size={12} className="animate-spin" /> : <Sparkles size={12} />}
                            {isSuggesting ? 'מעבד...' : 'הצעה אוטומטית'}
                          </button>
                          <button onClick={() => navigator.clipboard.writeText(title)} className="text-teal-600 hover:text-teal-700">
                            <Copy size={12} />
                          </button>
                        </div>
                      </div>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-base font-bold text-slate-800 outline-none focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 transition-all"
                        placeholder="למשל: כדור שלג"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">הסבר והקשר</label>
                        <button onClick={() => navigator.clipboard.writeText(explanation)} className="text-teal-600 hover:text-teal-700">
                          <Copy size={12} />
                        </button>
                      </div>
                      <textarea
                        value={explanation}
                        onChange={(e) => setExplanation(e.target.value)}
                        className="w-full h-32 p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-medium text-slate-700 outline-none focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 transition-all resize-none leading-relaxed"
                        placeholder="תאר את הכפל משמעות בביטוי..."
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">נושאים (מופרד בפסיק)</label>
                        <div className="flex gap-1">
                           {(topic || '').split(',').filter(t => t.trim()).slice(0, 3).map((t, i) => (
                             <span key={i} className="text-[9px] bg-teal-50 text-teal-600 px-2 py-0.5 rounded-full font-bold">{t.trim()}</span>
                           ))}
                        </div>
                      </div>
                      <input
                        type="text"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 transition-all"
                        placeholder="למשל: כדור, שלג, חורף"
                      />
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2">
                      <button
                        onClick={() => setIsApproved(!isApproved)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all border ${
                          isApproved ? 'bg-teal-600 border-teal-600 text-white shadow-lg shadow-teal-100' : 'bg-white border-slate-200 text-slate-500 hover:border-teal-200'
                        }`}
                      >
                        <Check size={16} />
                        <span>{isApproved ? 'מאושר לפרסום' : 'סמן כמאושר'}</span>
                      </button>
                      
                      <button
                        onClick={() => setNeedsAIImprovement(!needsAIImprovement)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all border ${
                          needsAIImprovement ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-200'
                        }`}
                      >
                        {needsAIImprovement ? '🤖 מצריך שיפור AI' : 'סמן לשיפור AI'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-2 space-y-2">
                    {/* WhatsApp Connection Status */}
                    <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100 mb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <MessageCircle size={14} className={waStatus.status === 'CONNECTED' ? 'text-green-500' : 'text-slate-400'} />
                          <span className="text-[10px] font-bold text-slate-700 uppercase tracking-tighter">WA Status</span>
                        </div>
                        <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter ${
                          waStatus.status === 'CONNECTED' ? 'bg-green-100 text-green-700' :
                          waStatus.status === 'SCAN_QR' ? 'bg-amber-100 text-amber-700' :
                          'bg-slate-200 text-slate-600'
                        }`}>
                          {waStatus.status === 'CONNECTED' ? 'OK' : 
                           waStatus.status === 'SCAN_QR' ? 'סרוק' : 
                           waStatus.status === 'LOADING' || waStatus.status === 'INITIALIZING' ? 'טוען' : 'ניתוק'}
                        </span>
                      </div>
                      
                      {waStatus.status === 'SCAN_QR' && waStatus.qr && (
                        <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-100 shadow-inner group mt-1.5">
                          <div className="p-1.5 bg-white rounded-lg border-2 border-slate-50 group-hover:border-teal-100 transition-colors shrink-0">
                            <img src={waStatus.qr} alt="WA QR" className="w-16 h-16" />
                          </div>
                          <div>
                            <p className="text-[9px] text-slate-500 font-bold leading-tight">סרוק בווטסאפ</p>
                          </div>
                        </div>
                      )}

                      {waStatus.status === 'CONNECTED' && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-3 p-3 bg-white rounded-xl border border-slate-100">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                              <span className="text-[10px] text-slate-600 font-medium">מחובר</span>
                            </div>
                            <button 
                              onClick={async () => {
                                if (confirm('להתנתק מהווטסאפ?')) {
                                  await fetch(`${API_BASE}/api/social/whatsapp/logout`, { method: 'POST' });
                                  checkWaStatus();
                                }
                              }}
                              className="text-[10px] text-red-400 hover:text-red-500 font-bold transition-colors"
                            >
                              ניתוק
                            </button>
                          </div>
                          <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                            <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block">מזהה יעד (Group/Channel ID)</label>
                            <input 
                              type="text"
                              value={waTargetId}
                              onChange={(e) => {
                                setWaTargetId(e.target.value);
                                localStorage.setItem('waTargetId', e.target.value);
                              }}
                              placeholder="e.g. 12345@g.us"
                              className="w-full bg-slate-50 border-none rounded-lg p-2 text-[11px] font-medium outline-none focus:ring-1 focus:ring-teal-500/30 transition-shadow"
                            />
                            <p className="text-[8px] text-slate-400 mt-1.5 leading-tight italic">
                              * השאר ריק כדי להשתמש בברירת המחדל מהשרת.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100 transition-all">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">פלטפורמה</label>
                        <button 
                          onClick={() => {
                            checkMetaStatus();
                            checkIgStatus();
                            checkFbPersonalStatus();
                            checkXStatus();
                            checkWaStatus();
                          }}
                          className="p-1 px-1.5 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 transition-all flex items-center gap-1"
                        >
                          <RotateCw size={10} className={socialPostState === 'loading' ? 'animate-spin' : ''} />
                          <span className="text-[8px] font-bold">רענן</span>
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          { id: 'all', label: 'הכל', icon: Share2 },
                          { id: 'instagram', label: 'Instagram', icon: Instagram },
                          { id: 'facebook', label: 'Facebook', icon: Facebook },
                          { id: 'x', label: 'X.com', icon: Twitter },
                          { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle }
                        ].map(p => {
                          const isSelected = socialPlatform === p.id;
                          let statusColor = '';
                          let statusText = '';
                          
                          if (p.id === 'facebook') {
                            statusColor = metaConnected ? 'border-green-400 ring-green-500/10' : 'border-rose-400 ring-rose-500/10';
                            statusText = metaConnected ? 'מחובר' : 'מנותק';
                          } else if (p.id === 'instagram') {
                            statusColor = igConnected ? 'border-green-400 ring-green-500/10' : 'border-rose-400 ring-rose-500/10';
                            statusText = igConnected ? 'מחובר' : 'מנותק';
                          } else if (p.id === 'x') {
                            statusColor = xConnected ? 'border-green-400 ring-green-500/10' : 'border-rose-400 ring-rose-500/10';
                            statusText = xConnected ? 'מחובר' : 'מנותק';
                          } else if (p.id === 'whatsapp') {
                            statusColor = waStatus.status === 'CONNECTED' ? 'border-green-400 ring-green-500/10' : 'border-rose-400 ring-rose-500/10';
                            statusText = waStatus.status === 'CONNECTED' ? 'מחובר' : 'מנותק';
                          }

                          return (
                            <button
                              key={p.id}
                              onClick={() => setSocialPlatform(p.id)}
                              className={`flex items-center gap-1 p-1.5 rounded-xl text-[10px] font-bold border transition-all relative ${
                                isSelected 
                                  ? 'bg-white border-indigo-600 text-indigo-600 shadow-sm ring-1 ring-indigo-600/10 z-10' 
                                  : `bg-white text-slate-600 hover:border-slate-300 ${statusColor} ${statusColor ? 'border-2' : 'border-slate-100'}`
                              }`}
                            >
                              <p.icon size={11} className={isSelected ? 'text-indigo-600' : 'text-slate-400'} />
                              <div className="flex flex-col items-start leading-none">
                                <span className="whitespace-nowrap">{p.label === 'Instagram' ? 'Insta' : p.label}</span>
                                {statusText && (
                                  <span className={`text-[6px] font-black uppercase ${statusText === 'מחובר' ? 'text-green-500' : 'text-rose-500'}`}>
                                    {statusText === 'מחובר' ? 'OK' : 'OFF'}
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {!metaConnected && metaError && (
                        <div className="mt-1.5 p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-[9px] font-bold leading-snug space-y-1.5">
                          <div className="flex items-start justify-between gap-1">
                            <span>⚠️ <span className="underline">אבחון Meta (FB/IG):</span> {metaError}</span>
                            <a
                              href="https://developers.facebook.com/tools/explorer/2088373928676287/"
                              target="_blank"
                              rel="noreferrer"
                              className="shrink-0 px-1.5 py-0.5 bg-white border border-rose-200 rounded text-[8px] text-indigo-600 hover:bg-indigo-50 underline"
                            >
                              הפק טוקן חדש ↗
                            </a>
                          </div>
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={newMetaToken}
                              onChange={(e) => setNewMetaToken(e.target.value)}
                              placeholder="הדבק כאן META_ACCESS_TOKEN חדש..."
                              dir="ltr"
                              className="flex-1 bg-white border border-rose-200 rounded px-2 py-1 text-[9px] text-slate-700 outline-none focus:border-indigo-500"
                            />
                            <button
                              onClick={handleUpdateMetaToken}
                              disabled={isUpdatingMetaToken || !newMetaToken.trim()}
                              className="px-2 py-1 bg-indigo-600 text-white rounded text-[9px] font-black hover:bg-indigo-700 disabled:opacity-50 shrink-0"
                            >
                              {isUpdatingMetaToken ? 'שומר...' : 'שמור טוקן'}
                            </button>
                          </div>
                        </div>
                      )}

                      {(socialPlatform === 'instagram' || socialPlatform === 'facebook' || socialPlatform === 'all') && (
                        <div className="mt-2 pt-2 border-t border-slate-100 space-y-1.5">
                          <div className="grid grid-cols-2 gap-1.5">
                            <button
                              onClick={() => setShareToFacebook(!shareToFacebook)}
                              className={`flex items-center justify-between p-1.5 px-2 rounded-xl border transition-all ${
                                shareToFacebook ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-100 text-slate-400'
                              }`}
                            >
                              <Facebook size={12} />
                              <span className="text-[9px] font-bold">דף (Crosspost)</span>
                              <div className={`w-5 h-2.5 rounded-full relative ${shareToFacebook ? 'bg-blue-500' : 'bg-slate-200'}`}>
                                <div className={`absolute top-0.5 w-1.5 h-1.5 bg-white rounded-full ${shareToFacebook ? 'left-3' : 'left-0.5'}`} />
                              </div>
                            </button>

                            <button
                              onClick={() => setShareToPersonalProfile(!shareToPersonalProfile)}
                              className={`flex items-center justify-between p-1.5 px-2 rounded-xl border transition-all ${
                                shareToPersonalProfile ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-100 text-slate-400'
                              }`}
                            >
                              <Share2 size={12} />
                              <span className="text-[9px] font-bold">ריפוסט (פרופיל אישי)</span>
                              <div className={`w-5 h-2.5 rounded-full relative ${shareToPersonalProfile ? 'bg-indigo-500' : 'bg-slate-200'}`}>
                                <div className={`absolute top-0.5 w-1.5 h-1.5 bg-white rounded-full ${shareToPersonalProfile ? 'left-3' : 'left-0.5'}`} />
                              </div>
                            </button>
                          </div>

                          {shareToPersonalProfile && (
                            <button
                              onClick={handleFbPersonalLogin}
                              className={`w-full py-1 px-2 rounded-lg border text-[9px] font-black transition-colors flex items-center justify-center gap-1 ${
                                fbPersonalConnected
                                  ? 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700'
                                  : 'bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-800'
                              }`}
                              title="התחברות לפרופיל הפייסבוק האישי לשמירת סשן אוטומטי לריפוסט"
                            >
                              {fbPersonalConnected
                                ? '✅ פרופיל FB אישי מחובר לריפוסט אוטומטי (לחץ לחיבור מחדש)'
                                : '🔑 לחץ כאן להתחברות חד-פעמית לפרופיל FB האישי לריפוסט'}
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          onClick={handleSocialPost}
                          disabled={socialPostState === 'loading'}
                          className="col-span-2 flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-2xl font-black text-xs transition-all shadow-lg shadow-indigo-100 disabled:opacity-50"
                        >
                          {socialPostState === 'loading' ? <Loader size={15} className="animate-spin" /> : <><Share2 size={15} /> פרסם עכשיו</>}
                        </button>
                        <button
                          onClick={runSocialDiagnostics}
                          disabled={isCheckingDiagnostics || socialPostState === 'loading'}
                          className="col-span-1 flex items-center justify-center gap-1 bg-slate-800 hover:bg-slate-900 text-white py-2.5 px-2 rounded-2xl font-black text-[10px] transition-all disabled:opacity-50"
                          title="בדיקת מוכנות לכל הפלטפורמות ללא פרסום פוסט"
                        >
                          {isCheckingDiagnostics ? <Loader size={12} className="animate-spin" /> : '🔍 בדיקה'}
                        </button>
                      </div>
                      
                      {/* Live Per-Platform Status Indicator */}
                      {Object.keys(platformStatuses).length > 0 && (
                        <div className="bg-slate-50 rounded-xl p-2 border border-slate-200 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-black text-slate-500 uppercase">מחוון סטטוס לפי פלטפורמה</span>
                            <button
                              onClick={() => setPlatformStatuses({})}
                              className="text-[8px] text-slate-400 hover:text-slate-600 font-bold"
                            >
                              נקה
                            </button>
                          </div>
                          {Object.entries(platformStatuses).map(([plat, info]) => {
                            const labels = {
                              instagram: 'Instagram',
                              facebook: 'Facebook (דף כפלשון)',
                              'facebook-personal': 'Facebook (פרופיל אישי)',
                              x: 'X.com (Twitter)',
                              whatsapp: 'WhatsApp'
                            };
                            const isSuccess = info.status === 'success';
                            const isError = info.status === 'error';
                            const isLoading = info.status === 'loading';
                            return (
                              <div
                                key={plat}
                                className={`p-1.5 px-2 rounded-lg border text-[10px] flex flex-col gap-0.5 ${
                                  isSuccess ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                                  isError ? 'bg-rose-50 border-rose-200 text-rose-800' :
                                  isLoading ? 'bg-indigo-50 border-indigo-200 text-indigo-800' :
                                  'bg-white border-slate-200 text-slate-500'
                                }`}
                              >
                                <div className="flex items-center justify-between font-black">
                                  <span>{labels[plat] || plat}</span>
                                  <span className="flex items-center gap-1 text-[9px]">
                                    {isLoading && <><Loader size={10} className="animate-spin" /> מפרסם...</>}
                                    {isSuccess && <><Check size={11} className="text-emerald-600" /> הצליח</>}
                                    {isError && <><X size={11} className="text-rose-600" /> נכשל</>}
                                    {info.status === 'pending' && '⏳ ממתין'}
                                  </span>
                                </div>
                                {info.message && (
                                  <div className="text-[9px] font-medium leading-tight break-words opacity-90">
                                    {info.message}
                                  </div>
                                )}
                                {info.needsFbLogin && (
                                  <button
                                    onClick={handleFbPersonalLogin}
                                    className="mt-1 px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[9px] font-black self-start transition-colors"
                                  >
                                    🔑 התחבר לפרופיל אישי
                                  </button>
                                )}
                                {info.needsIgLogin && (
                                  <button
                                    onClick={handleInstagramLogin}
                                    className="mt-1 px-2 py-1 bg-pink-600 hover:bg-pink-700 text-white rounded-lg text-[9px] font-black self-start transition-colors"
                                  >
                                    📸 התחבר לאינסטגרם
                                  </button>
                                )}
                                {info.shareUrl && (
                                  <a
                                    href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(info.shareUrl)}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mt-1 inline-flex items-center gap-1 text-[9px] font-black text-indigo-600 underline"
                                  >
                                    <ExternalLink size={10} /> שתף ידנית לפרופיל האישי בלחיצה
                                  </a>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div className="flex items-center gap-2 mt-2">
                         <div className="h-px bg-slate-100 flex-1" />
                         <span className="text-[10px] font-bold text-slate-300 uppercase tracking-tighter">פעולות ידניות</span>
                         <div className="h-px bg-slate-100 flex-1" />
                      </div>

                      <button 
                        onClick={async () => {
                            const p = socialPlatform === 'all' ? ['instagram', 'facebook', 'x'] : [socialPlatform];
                            const res = await fetch(`${API_BASE}/api/social/manual-mark`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ filename: currentFile, platforms: p })
                            });
                            if (res.ok) {
                                fetchImages();
                                setSocialResult({ message: 'סומן כפורסם ידנית' });
                                setTimeout(() => setSocialResult(null), 3000);
                            }
                        }}
                        className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-500 text-[11px] font-bold hover:bg-slate-50 transition-colors"
                      >
                        סמן כפורסם ידנית ({socialPlatform === 'all' ? 'הכל' : socialPlatform})
                      </button>
                    </div>

                    {/* Post History */}
                    {isApproved && metadata[images[currentIndex]]?.social_posts?.length > 0 && (() => {
                      const posts = metadata[images[currentIndex]]?.social_posts || [];
                      const grouped = posts.reduce((acc, p) => {
                        acc[p.platform] = acc[p.platform] || [];
                        acc[p.platform].push(p.date);
                        return acc;
                      }, {});

                      return (
                        <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100">
                          <p className="text-[9px] font-black text-slate-400 uppercase mb-1.5 flex items-center gap-1.5">
                            <Share2 size={10} />
                            היסטוריה
                          </p>
                          <div className="max-h-[60px] overflow-y-auto pr-1 custom-scrollbar space-y-1">
                            {Object.entries(grouped).map(([platform, dates]) => (
                              <div key={platform} className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm transition-all hover:border-indigo-200">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-[10px] font-black text-indigo-600 uppercase tracking-wider">{platform === 'x' ? 'X.com' : platform}</span>
                                  <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md font-bold">{dates.length} פרסומים</span>
                                </div>
                                <div className="flex flex-col gap-1">
                                  {dates.length <= 2 ? (
                                    dates.map((d, i) => (
                                      <div key={i} className="text-[10px] text-slate-600 font-medium flex items-center justify-between">
                                          <span>• {new Date(d).toLocaleDateString('he-IL')}</span>
                                          <span className="text-[8px] text-slate-400">{new Date(d).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
                                      </div>
                                    ))
                                  ) : (
                                    <details className="group/details">
                                      <summary className="text-[10px] text-indigo-500 font-bold cursor-pointer hover:underline list-none flex items-center gap-1">
                                        הצג את כל התאריכים ({dates.length})
                                        <ChevronLeft size={10} className="group-open/details:-rotate-90 transition-transform" />
                                      </summary>
                                      <div className="mt-2 space-y-1 pl-2 border-l border-slate-100 animate-in slide-in-from-top-1 duration-200">
                                        {dates.slice().reverse().map((d, i) => (
                                          <div key={i} className="text-[9px] text-slate-500 flex items-center justify-between">
                                            <span>{new Date(d).toLocaleDateString('he-IL')}</span>
                                            <span>{new Date(d).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </details>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3 shrink-0">
                  <button
                    onClick={() => handleSave(false)}
                    disabled={isSaving}
                    className="flex-1 flex items-center justify-center gap-2 bg-slate-900 border border-slate-900 text-white py-3.5 rounded-2xl text-xs font-black transition-all hover:bg-slate-800 disabled:opacity-50"
                  >
                    {isSaving ? <Loader size={14} className="animate-spin" /> : <Save size={14} />}
                    <span>שמור שינויים</span>
                  </button>
                  <button
                    onClick={() => handleSave(true)}
                    disabled={isSaving || currentIndex === images.length - 1}
                    className="flex-1 flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-800 py-3.5 rounded-2xl text-xs font-black transition-all hover:bg-slate-50 disabled:opacity-30"
                  >
                    <span>שמור והבא</span>
                    <ArrowLeft size={14} />
                  </button>
                </div>
              </div>
            </div>

            {/* Image Preview Panel */}
            <div className="flex-1 flex flex-col min-h-0 order-1 lg:order-2 overflow-hidden">
              <div className="flex-1 bg-white rounded-[32px] shadow-2xl shadow-slate-200/50 border border-slate-100 overflow-hidden flex flex-col relative group min-h-0">
                {/* Overlay Controls */}
                <div className="absolute top-6 inset-x-6 flex items-center justify-between z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-full text-white text-[10px] font-black tracking-widest uppercase">
                    {fileSizes[images[currentIndex]] || '0 KB'} • {(images[currentIndex] || '').split('.').pop().toUpperCase()}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => window.open(`${API_BASE}/images/${images[currentIndex]}`, '_blank')} className="p-2.5 bg-black/60 backdrop-blur-md text-white rounded-full hover:bg-black/80 transition-all">
                      <ExternalLink size={16} />
                    </button>
                    <button onClick={() => navigator.clipboard.writeText(`${API_BASE}/images/${images[currentIndex]}`)} className="p-2.5 bg-black/60 backdrop-blur-md text-white rounded-full hover:bg-black/80 transition-all">
                      <Copy size={16} />
                    </button>
                  </div>
                </div>

                <div className="flex-1 flex items-center justify-center p-2 lg:p-6 bg-slate-50/50 min-h-0">
                  <div className="relative w-full h-full flex items-center justify-center min-h-0">
                    <img
                      key={images[currentIndex]}
                      src={`${API_BASE}/images/${images[currentIndex]}?t=${Date.now()}`}
                      alt="Preview"
                      className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
                    />
                    
                    {/* Approved Badge */}
                    {isApproved && (
                      <div className="absolute top-4 right-4 bg-teal-500 text-white px-4 py-2 rounded-full text-[10px] font-black shadow-lg flex items-center gap-2 animate-in zoom-in duration-300">
                        <Check size={14} />
                        מאושר
                      </div>
                    )}
                  </div>
                </div>

                {/* Navigation Toolbar */}
                <div className="px-8 py-6 bg-white border-t border-slate-100 flex items-center justify-between shrink-0">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">תמונה נוכחית</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xl font-black text-slate-900 tabular-nums">
                        {(currentIndex + 1).toString().padStart(2, '0')}
                        <span className="text-slate-300 mx-1">/</span>
                        {images.length.toString().padStart(2, '0')}
                      </span>
                      {fileSources[images[currentIndex]] === 'new' && (
                        <span className="bg-rose-50 text-rose-600 px-2 py-0.5 rounded-lg text-[10px] font-bold border border-rose-100">חדש</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 bg-slate-100 p-2 rounded-2xl">
                    <button
                      onClick={prevImage}
                      disabled={currentIndex === 0}
                      className="p-3 bg-white text-slate-900 rounded-xl shadow-sm hover:bg-slate-50 transition-all active:scale-95 disabled:opacity-30"
                    >
                      <ArrowRight size={20} />
                    </button>
                    <div className="w-48 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-teal-500 transition-all duration-500"
                        style={{ width: `${((currentIndex + 1) / images.length) * 100}%` }}
                      />
                    </div>
                    <button
                      onClick={nextImage}
                      disabled={currentIndex === images.length - 1}
                      className="p-3 bg-white text-slate-900 rounded-xl shadow-sm hover:bg-slate-50 transition-all active:scale-95 disabled:opacity-30"
                    >
                      <ArrowLeft size={20} />
                    </button>
                  </div>

                  <div className="hidden sm:block">
                    {/* Quick Tags View */}
                    <div className="flex flex-wrap gap-1 justify-end max-w-[200px]">
                      {(topic || '').split(',').map((t, i) => t.trim() && (
                        <span key={i} className="px-2 py-0.5 bg-slate-50 text-slate-500 text-[9px] font-bold rounded-md border border-slate-100">{t.trim()}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Grid Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4 shrink-0 transition-all duration-300">
                <div className="flex items-center gap-3">
                    <div className="flex items-center bg-white px-4 py-2 rounded-2xl shadow-sm border border-slate-200">
                        <span className="text-xs font-black text-slate-400 ml-3">מציג:</span>
                        <span className="text-xs font-black text-slate-900">{filteredImages.length} תמונות</span>
                    </div>
                    
                    <button
                        onClick={() => setSelectionMode(!selectionMode)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition-all border ${
                            selectionMode ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-200'
                        }`}
                    >
                        <Layers size={14} />
                        {selectionMode ? 'בטל בחירה' : 'בחירה מרובה'}
                    </button>

                    {selectionMode && (
                        <button
                            onClick={selectAllFiltered}
                            className="flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold bg-white border border-slate-200 text-slate-600 hover:border-teal-200 hover:bg-teal-50 transition-all"
                        >
                            <Check size={14} />
                            בחר הכל
                        </button>
                    )}

                    {selectionMode && selectedImages.length > 0 && (
                        <div className="flex items-center gap-2 animate-in slide-in-from-right-2 duration-300">
                            <div className="bg-indigo-50 text-indigo-600 px-3 py-2 rounded-xl text-xs font-black border border-indigo-100">
                                {selectedImages.length} נבחרו
                            </div>
                            <button
                                onClick={handleBulkPost}
                                className="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-black shadow-md hover:bg-slate-800 flex items-center gap-2"
                            >
                                <Share2 size={14} />
                                פרסם נבחרות ({selectedImages.length})
                            </button>
                            <button
                                onClick={handleBulkDelete}
                                className="bg-rose-50 text-rose-600 px-4 py-2 rounded-xl text-xs font-black border border-rose-100 hover:bg-rose-100 transition-all flex items-center gap-2"
                            >
                                <Trash2 size={14} />
                                מחק ({selectedImages.length})
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setSortOrder(prev => prev === 'newest' ? 'default' : 'newest')} 
                        className={`p-2.5 rounded-xl border transition-all shadow-sm flex items-center gap-2 ${
                            sortOrder === 'newest' ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                        }`}
                        title={sortOrder === 'newest' ? "ממוין לפי תאריך (חדש קודם)" : "מיין לפי תאריך"}
                    >
                        <Sparkles size={16} />
                        {sortOrder === 'newest' && <span className="text-[10px] font-black uppercase">NEWEST</span>}
                    </button>
                    <button 
                        onClick={() => fetchImages()} 
                        className="p-2.5 bg-white text-slate-500 rounded-xl border border-slate-200 hover:bg-slate-50 transition-all shadow-sm"
                        title="רענן גלריה"
                    >
                        <RotateCw size={16} />
                    </button>
                </div>
            </div>

            {/* Scrollable Grid Area */}
            <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar min-h-0">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 pb-8">
                {filteredImages.map((img, idx) => {
                  const meta = metadata[img] || {};
                  const isSelected = selectedImages.includes(img);
                  const isCurrent = images[currentIndex] === img;
                  
                  return (
                    <div
                      key={img}
                      onClick={() => {
                          if (selectionMode) {
                              setSelectedImages(prev => 
                                  prev.includes(img) ? prev.filter(i => i !== img) : [...prev, img]
                              );
                          } else {
                              const newIndex = images.indexOf(img);
                              if (newIndex !== -1) {
                                  setCurrentIndex(newIndex);
                                  setAdminViewMode('edit');
                              }
                          }
                      }}
                      className={`group relative aspect-square rounded-[32px] overflow-hidden cursor-pointer transition-all duration-500 ${
                        isCurrent && !selectionMode ? ' ring-4 ring-teal-500 ring-offset-4 ring-offset-slate-50 scale-95 shadow-2xl' : 
                        isSelected ? 'ring-4 ring-indigo-500 ring-offset-2 ring-offset-slate-50 scale-95' :
                        'hover:scale-[1.02] hover:shadow-2xl hover:shadow-slate-200 shadow-sm border border-slate-100'
                      }`}
                    >
                      <img
                        loading="lazy"
                        src={`${API_BASE}/images/${img}`}
                        alt=""
                        className={`w-full h-full object-cover transition-transform duration-700 ${isSelected ? 'opacity-70 scale-110' : 'group-hover:scale-110'}`}
                      />
                      
                      {/* Grid Item Overlay */}
                      <div className={`absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent transition-opacity duration-300 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                        <div className="absolute top-4 right-4 flex gap-2">
                            {meta.isApproved && (
                                <div className="bg-teal-500 text-white p-1.5 rounded-xl shadow-lg">
                                    <Check size={12} />
                                </div>
                            )}
                            {meta.social_posts?.length > 0 && adminViewMode === 'share' && (
                                <div className="bg-indigo-500 text-white p-1.5 rounded-xl shadow-lg flex gap-1">
                                    {['instagram', 'facebook', 'x'].map(p => (
                                        meta.social_posts.some(post => post.platform === p) && (
                                            <span key={p} className="opacity-100">
                                                {p === 'instagram' && <Instagram size={10} />}
                                                {p === 'facebook' && <Facebook size={10} />}
                                                {p === 'x' && <Twitter size={10} />}
                                            </span>
                                        )
                                    ))}
                                </div>
                            )}
                        </div>
                        
                        <div className="absolute inset-x-4 bottom-4">
                            <p className="text-[11px] font-black text-white/90 truncate leading-tight mb-1" dir="rtl">
                                {meta.title || img.replace(/\.[^/.]+$/, "")}
                            </p>
                            <div className="flex items-center justify-between">
                                <span className="text-[9px] font-bold text-white/50">{fileSizes[img] || '0 KB'}</span>
                                {isSelected && (
                                    <div className="bg-indigo-500 text-white rounded-full p-1 shadow-lg animate-in zoom-in duration-200">
                                        <Layers size={10} />
                                    </div>
                                )}
                            </div>
                        </div>
                      </div>

                      {/* Share Mode Specific Overlay: Platforms and Needs */}
                      {adminViewMode === 'share' && (
                          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                              <div className="flex gap-2">
                                  {['instagram', 'facebook', 'x'].map(platform => {
                                      const isPublished = meta.social_posts?.some(p => p.platform === platform);
                                      return (
                                          <div key={platform} className={`p-2 rounded-2xl shadow-xl backdrop-blur-md transition-all duration-500 border-2 ${
                                              isPublished 
                                              ? 'bg-teal-500/20 border-teal-500 text-teal-500 scale-110' 
                                              : 'bg-white/10 border-white/20 text-white/40'
                                          }`}>
                                              {platform === 'instagram' && <Instagram size={16} />}
                                              {platform === 'facebook' && <Facebook size={16} />}
                                              {platform === 'x' && <Twitter size={16} />}
                                          </div>
                                      );
                                  })}
                              </div>
                          </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Bulk Selection Modal */}
        <dialog
          ref={bulkModalRef}
          onCancel={(e) => {
            e.preventDefault();
            setIsBulkModalOpen(false);
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsBulkModalOpen(false);
          }}
          className="fixed inset-0 w-full h-full max-w-none max-h-none p-4 m-0 bg-transparent border-none outline-none flex items-center justify-center backdrop:bg-slate-900/60 backdrop:backdrop-blur-sm z-50"
        >
          {isBulkModalOpen && (
            <div className="bg-white w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
              <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 leading-tight">פרסום קבוצתי</h2>
                  <p className="text-slate-400 text-xs font-bold mt-1 uppercase tracking-widest">בחר רשתות חברתיות לפרסום {selectedImages.length} תמונות</p>
                </div>
                <button 
                  onClick={() => setIsBulkModalOpen(false)}
                  className="p-3 bg-slate-100 text-slate-400 rounded-2xl hover:bg-slate-200 hover:text-slate-600 transition-all"
                >
                  <X size={24} />
                </button>
              </div>
              
              <div className="p-8 space-y-4">
                <div className="grid grid-cols-1 gap-3">
                  {[
                    { id: 'instagram', label: 'Instagram', icon: Instagram, color: 'rose' },
                    { id: 'facebook', label: 'Facebook', icon: Facebook, color: 'blue' },
                    { id: 'x', label: 'X.com', icon: Twitter, color: 'slate' },
                    { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, color: 'green' }
                  ].map(p => {
                    const isSelected = bulkSelectedPlatforms.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        onClick={() => {
                          setBulkSelectedPlatforms(prev => 
                            prev.includes(p.id) ? prev.filter(i => i !== p.id) : [...prev, p.id]
                          );
                        }}
                        className={`group flex items-center justify-between p-5 rounded-3xl border-2 transition-all ${
                          isSelected 
                            ? `bg-${p.color}-50 border-${p.color}-500 text-${p.color}-700 shadow-md ring-4 ring-${p.color}-500/5` 
                            : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`p-3 rounded-2xl transition-colors ${isSelected ? `bg-${p.color}-500 text-white` : 'bg-slate-50 text-slate-300'}`}>
                            <p.icon size={20} />
                          </div>
                          <span className="font-black text-sm uppercase tracking-wider">{p.label}</span>
                        </div>
                        <div className={`w-6 h-6 rounded-full border-2 transition-all flex items-center justify-center ${
                          isSelected ? `bg-${p.color}-500 border-${p.color}-500 text-white` : 'border-slate-200'
                        }`}>
                          {isSelected && <Check size={14} />}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {bulkSelectedPlatforms.includes('facebook') && (
                  <div className="pt-2 border-t border-slate-100 space-y-2">
                    <button
                      onClick={() => setShareToPersonalProfile(!shareToPersonalProfile)}
                      className={`w-full flex items-center justify-between p-3.5 rounded-2xl border-2 transition-all ${
                        shareToPersonalProfile
                          ? 'bg-indigo-50 border-indigo-400 text-indigo-800'
                          : 'bg-slate-50 border-slate-200 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 text-right">
                        <Share2 size={16} />
                        <span className="text-xs font-black">ריפוסט אוטומטי מהפרופיל האישי לפוסט של כפלשון</span>
                      </div>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                        shareToPersonalProfile ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300'
                      }`}>
                        {shareToPersonalProfile && <Check size={13} />}
                      </div>
                    </button>
                  </div>
                )}
              </div>
              
              <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-4">
                <button 
                  onClick={() => setIsBulkModalOpen(false)}
                  className="flex-1 py-4 rounded-2xl text-slate-500 font-black text-sm hover:bg-slate-100 transition-all"
                >
                  ביטול
                </button>
                <button 
                  onClick={confirmBulkPost}
                  disabled={bulkSelectedPlatforms.length === 0}
                  className="flex-[2] bg-indigo-600 text-white py-4 rounded-2xl font-black text-sm shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50"
                >
                  התחל פרסום ({selectedImages.length} תמונות)
                </button>
              </div>
            </div>
          )}
        </dialog>

        {/* Topic Management Modal */}
        <dialog
          ref={topicModalRef}
          onCancel={(e) => {
            e.preventDefault();
            setIsTopicModalOpen(false);
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsTopicModalOpen(false);
          }}
          className="fixed inset-0 w-full h-full max-w-none max-h-none p-4 m-0 bg-transparent border-none outline-none flex items-center justify-center backdrop:bg-slate-900/60 backdrop:backdrop-blur-sm z-50"
        >
          {isTopicModalOpen && (
            <div className="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
              <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 leading-tight">סינון לפי נושאים</h2>
                  <p className="text-slate-400 text-xs font-bold mt-1 uppercase tracking-widest">בחר נושא כדי למקד את החיפוש</p>
                </div>
                <button 
                  onClick={() => setIsTopicModalOpen(false)}
                  className="p-3 bg-slate-100 text-slate-400 rounded-2xl hover:bg-slate-200 hover:text-slate-600 transition-all"
                >
                  <X size={24} />
                </button>
              </div>
              
              <div className="p-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <button
                    onClick={() => { setSelectedTopic(null); setIsTopicModalOpen(false); }}
                    className={`p-4 rounded-3xl text-sm font-black transition-all border-2 text-center ${
                      !selectedTopic ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-slate-50 border-transparent text-slate-500 hover:border-slate-200'
                    }`}
                  >
                    הצג הכל
                  </button>
                  {allTopics.map(t => (
                    <button
                      key={t}
                      onClick={() => { setSelectedTopic(t); setIsTopicModalOpen(false); }}
                      className={`p-4 rounded-3xl text-sm font-black transition-all border-2 text-right flex items-center justify-between ${
                        selectedTopic === t ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-slate-50 border-transparent text-slate-500 hover:border-slate-200'
                      }`}
                    >
                      <span className="truncate">{t}</span>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${selectedTopic === t ? 'bg-white/20 text-white' : 'bg-white text-slate-400 border border-slate-100'}`}>
                        {topicCounts[t]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="p-6 bg-slate-50 border-t border-slate-100 text-center">
                <p className="text-[11px] font-bold text-slate-400 italic">סה"כ {allTopics.length} נושאים פעילים במערכת</p>
              </div>
            </div>
          )}
        </dialog>

        {/* Global Bulk Progress Popup */}
        {bulkProgress && (
          <div 
            className="fixed z-[60] shadow-2xl transition-all duration-200"
            style={{ 
              right: Number.isFinite(bulkCardPos.x) ? bulkCardPos.x : 24, 
              top: Number.isFinite(bulkCardPos.y) ? bulkCardPos.y : 24, 
              width: isBulkMinimized ? '200px' : '340px',
              transition: isDragging ? 'none' : 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
            }}
          >
            <div className="bg-white rounded-[28px] border border-indigo-100 shadow-2xl overflow-hidden flex flex-col">
              {/* Draggable Header */}
              <div 
                className="bg-indigo-600 p-3.5 cursor-move flex items-center justify-between select-none"
                onMouseDown={handleMouseDown}
              >
                <div className="flex items-center gap-2">
                  <Share2 className="text-white" size={15} />
                  <span className="text-white text-xs font-black uppercase tracking-widest">תהליך פרסום מרובה</span>
                </div>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => setIsBulkMinimized(!isBulkMinimized)}
                    className="p-1 hover:bg-white/20 rounded text-white transition-colors"
                  >
                    {isBulkMinimized ? <Square size={12} /> : <Minus size={12} />}
                  </button>
                  <button 
                    onClick={handleCancelBulk}
                    className="p-1 hover:bg-white/20 rounded text-white transition-colors ml-1"
                    title="בטל וסגור"
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>

              {!isBulkMinimized && (
                <div className="p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">סטטוס</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      bulkProgress.status === 'done' ? 'bg-emerald-50 text-emerald-700' :
                      bulkProgress.status === 'waiting' ? 'bg-amber-50 text-amber-700' :
                      'bg-indigo-50 text-indigo-600'
                    }`}>
                        {bulkProgress.status === 'processing' ? 'מעלה ומפרסם כעת...' : 
                         bulkProgress.status === 'waiting' ? `ממתין לפוסט הבא (${Math.floor((bulkProgress.countdown || 0) / 60)}:${String((bulkProgress.countdown || 0) % 60).padStart(2, '0')})` :
                         bulkProgress.status === 'done' ? 'הסתיים' : bulkProgress.status || 'פעיל'}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-end">
                      <span className="text-2xl font-black text-slate-900 tabular-nums">
                        {bulkProgress.current}
                        <span className="text-slate-300 mx-1 text-lg">/</span>
                        {bulkProgress.total}
                      </span>
                      <span className="text-xs font-black text-indigo-600">
                        {bulkProgress.total > 0 ? Math.round((bulkProgress.current / bulkProgress.total) * 100) : 0}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                      <div 
                        className="h-full bg-indigo-500 transition-all duration-500 relative"
                        style={{ width: `${bulkProgress.total > 0 ? (bulkProgress.current / bulkProgress.total) * 100 : 0}%` }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" style={{ backgroundSize: '200% 100%' }} />
                      </div>
                    </div>
                  </div>

                  {bulkProgress.lastFile && (
                    <div className="flex flex-col gap-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">תמונה נוכחית:</span>
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg overflow-hidden border border-slate-200 shrink-0">
                                <img src={`${API_BASE}/images/${bulkProgress.lastFile}`} className="w-full h-full object-cover" alt="" />
                            </div>
                            <span className="text-[10px] font-bold text-slate-700 truncate flex-1">{bulkProgress.lastFile}</span>
                        </div>
                    </div>
                  )}

                  {/* Per-Platform Status Indicator inside Bulk Popup */}
                  {bulkProgress.platformStatuses && Object.keys(bulkProgress.platformStatuses).length > 0 && (
                    <div className="space-y-1 max-h-[160px] overflow-y-auto pr-1 custom-scrollbar">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter block">סטטוס לפי פלטפורמה:</span>
                      {Object.entries(bulkProgress.platformStatuses).map(([plat, info]) => {
                        const isSuccess = info.status === 'success';
                        const isError = info.status === 'error';
                        const isLoading = info.status === 'loading';
                        return (
                          <div
                            key={plat}
                            className={`p-1.5 px-2 rounded-lg border text-[9px] flex flex-col gap-0.5 ${
                              isSuccess ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                              isError ? 'bg-rose-50 border-rose-200 text-rose-800' :
                              isLoading ? 'bg-indigo-50 border-indigo-200 text-indigo-800' :
                              'bg-slate-50 border-slate-200 text-slate-500'
                            }`}
                          >
                            <div className="flex items-center justify-between font-black">
                              <span className="uppercase">{plat === 'x' ? 'X.com' : plat}</span>
                              <span className="flex items-center gap-1">
                                {isLoading && <><Loader size={9} className="animate-spin" /> מפרסם...</>}
                                {isSuccess && <><Check size={10} className="text-emerald-600" /> הצליח</>}
                                {isError && <><X size={10} className="text-rose-600" /> נכשל</>}
                                {info.status === 'pending' && '⏳ ממתין'}
                              </span>
                            </div>
                            {info.message && (
                              <div className="text-[8px] font-medium leading-tight break-words opacity-90">
                                {info.message}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {bulkProgress.status === 'waiting' && (
                    <button 
                      onClick={handleSkipBulkWait}
                      className="w-full bg-indigo-600 text-white py-2 rounded-xl text-[11px] font-black transition-all hover:bg-indigo-700 shadow-sm"
                    >
                      דלג על המתנה ופרסם תמונה הבאה כעת
                    </button>
                  )}

                  {bulkProgress.status === 'done' && (
                    <button 
                      onClick={handleCancelBulk}
                      className="w-full bg-slate-900 text-white py-2.5 rounded-xl text-[11px] font-black transition-all hover:bg-slate-800"
                    >
                      סגור חלון
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;

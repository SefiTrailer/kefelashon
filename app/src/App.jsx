import { useState, useEffect, useMemo, useRef } from 'react';
import { ChevronRight, ChevronLeft, ArrowLeft, ArrowRight, Save, MessageCircle, Check, Trash2, Search, X, Upload, Github, Loader, LayoutGrid, Image as ImageIcon, Copy, Instagram, Facebook, Twitter, Share2, ExternalLink, PenTool, Minus, Layers, RotateCw, Square } from 'lucide-react';
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
  const [editModeTab, setEditModeTab] = useState('details'); // 'details' | 'social'
  const [shareToFacebook, setShareToFacebook] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);
  const [bulkProgress, setBulkProgress] = useState(null); // { current, total, countdown, status }
  const [waTargetId, setWaTargetId] = useState(localStorage.getItem('waTargetId') || '');
  const [waStatus, setWaStatus] = useState({ status: 'DISCONNECTED', qr: null });
  const [isBulkMinimized, setIsBulkMinimized] = useState(false);
  const [bulkCardPos, setBulkCardPos] = useState({ x: 24, y: 24 }); // Offset from top-right
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef(null);
  const dragStartRef = useRef(null);

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
    // Add small delay to ensure backend is fully ready before headless check
    setTimeout(() => {
      checkXStatus();
      checkMetaStatus();
      checkWaStatus();
    }, 2000);
    fetchPublishStatus();
    fetchMasterTags();
  }, []);

  // Poll for WhatsApp status if scanning QR
  useEffect(() => {
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

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Poll for background bulk status
  useEffect(() => {
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
  // Handle Dragging
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!dragStartRef.current) return;
      const dx = e.clientX - dragStartRef.current.mouseX;
      const dy = e.clientY - dragStartRef.current.mouseY;
      setBulkCardPos({
        x: dragStartRef.current.cardX - dx,
        y: dragStartRef.current.cardY + dy
      });
    };

    const handleMouseUp = () => {
      dragStartRef.current = null;
    };

    if (bulkProgress) {
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [bulkProgress]);

  const onDragStart = (e) => {
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      cardX: bulkCardPos.x,
      cardY: bulkCardPos.y
    };
  };

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
      if (filterMode === 'all') return true;
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
      if (filterMode === 'published-any' && (!meta.social_posts || meta.social_posts.length === 0)) return false;
      if (filterMode === 'not-published' && meta.social_posts?.length > 0) return false;
      if (filterMode === 'published-instagram' && !meta.social_posts?.some(p => p.platform === 'instagram')) return false;
      if (filterMode === 'published-facebook' && !meta.social_posts?.some(p => p.platform === 'facebook')) return false;
      if (filterMode === 'published-x' && !meta.social_posts?.some(p => p.platform === 'x')) return false;
      
      // Social "Need" Filters
      if (filterMode === 'need-any' && meta.social_posts?.length >= 3) return false;
      if (filterMode === 'need-instagram' && meta.social_posts?.some(p => p.platform === 'instagram')) return false;
      if (filterMode === 'need-facebook' && meta.social_posts?.some(p => p.platform === 'facebook')) return false;
      if (filterMode === 'need-x' && meta.social_posts?.some(p => p.platform === 'x')) return false;
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
          platform: p,
          shareToFacebook: p === 'instagram' ? shareToFacebook : false,
          targetId: p === 'whatsapp' ? waTargetId : undefined
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
    const platforms = socialPlatform === 'all' ? ['instagram', 'facebook', 'x', 'whatsapp'] : [socialPlatform];
    
    try {
      const results = await postSingleImage(currFile, platforms, shareToFacebook, waTargetId);

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
          setSocialResult({ success: true });
        }
      }
    } catch (err) {
      setSocialPostState('error');
      setSocialResult({ error: err.message });
    } finally {
      // Done
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

  const handleBulkPost = async () => {
    if (selectedImages.length === 0) return;
    
    // Switch to non-grid mode to show progress if needed, but the popup is global now
    // setAdminViewMode('edit'); 
    
    try {
        const res = await fetch(`${API_BASE}/api/social/bulk/post`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filenames: selectedImages,
                platforms: ['instagram', 'facebook', 'x', 'whatsapp'],
                shareToFacebook: shareToFacebook
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
    dragStartRef.current = {
      x: e.clientX + bulkCardPos.x,
      y: e.clientY - bulkCardPos.y
    };
    
    const onMouseMove = (moveEvent) => {
      setBulkCardPos({
        x: dragStartRef.current.x - moveEvent.clientX,
        y: moveEvent.clientY - dragStartRef.current.y
      });
    };
    
    const onMouseUp = () => {
      setIsDragging(false);
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
            </nav>
          </div>
          <div className="flex items-center gap-2">
            {!isPublicViewer && (
              <div className="flex items-center gap-1.5 ml-2 mr-2 border-r border-slate-200 pr-4">
                <button 
                  title={xConnected ? 'X connected' : 'X disconnected'} 
                  className={`p-1.5 rounded-lg transition-colors ${xConnected ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-300'}`}
                >
                  <Twitter size={14} />
                </button>
                <button 
                  title={metaConnected ? 'Meta (FB/IG) connected' : metaError || 'Meta disconnected'} 
                  className={`p-1.5 rounded-lg transition-colors ${metaConnected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-300'}`}
                >
                  {metaError ? <X size={14} className="text-rose-500" /> : <Facebook size={14} />}
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
        {adminViewMode === 'edit' ? (
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
                        <button onClick={() => navigator.clipboard.writeText(title)} className="text-teal-600 hover:text-teal-700">
                          <Copy size={12} />
                        </button>
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
                  <div className="p-6 space-y-6">
                    {/* WhatsApp Connection Status */}
                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 mb-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <MessageCircle size={16} className={waStatus.status === 'CONNECTED' ? 'text-green-500' : 'text-slate-400'} />
                          <span className="text-xs font-bold text-slate-700">WhatsApp Status</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-tighter ${
                          waStatus.status === 'CONNECTED' ? 'bg-green-100 text-green-700' :
                          waStatus.status === 'SCAN_QR' ? 'bg-amber-100 text-amber-700' :
                          'bg-slate-200 text-slate-600'
                        }`}>
                          {waStatus.status === 'CONNECTED' ? 'מחובר' : 
                           waStatus.status === 'SCAN_QR' ? 'סרוק קוד' : 
                           waStatus.status === 'LOADING' || waStatus.status === 'INITIALIZING' ? 'טוען...' : 'מנותק'}
                        </span>
                      </div>
                      
                      {waStatus.status === 'SCAN_QR' && waStatus.qr && (
                        <div className="flex flex-col items-center bg-white p-4 rounded-xl border border-slate-100 shadow-inner group">
                          <p className="text-[10px] text-slate-500 mb-3 font-medium text-center">סרוק את הקוד בווטסאפ (Linked Devices)</p>
                          <div className="p-2 bg-white rounded-lg border-2 border-slate-50 group-hover:border-teal-100 transition-colors">
                            <img src={waStatus.qr} alt="WA QR" className="w-32 h-32" />
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

                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 block">בחר פלטפורמה</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'all', label: 'הכל', icon: Share2 },
                        { id: 'instagram', label: 'Instagram', icon: Instagram },
                        { id: 'facebook', label: 'Facebook', icon: Facebook },
                        { id: 'x', label: 'X.com', icon: Twitter },
                        { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle }
                      ].map(p => (
                        <button
                          key={p.id}
                          onClick={() => setSocialPlatform(p.id)}
                          className={`flex items-center gap-2 p-3 rounded-xl text-xs font-bold border transition-all ${
                            socialPlatform === p.id 
                              ? 'bg-white border-teal-500 text-teal-600 shadow-md ring-2 ring-teal-500/10' 
                              : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'
                          }`}
                        >
                          <p.icon size={14} className={socialPlatform === p.id ? 'text-teal-600' : ''} />
                          {p.label}
                        </button>
                      ))}
                    </div>

                    {(socialPlatform === 'instagram' || socialPlatform === 'all') && (
                      <div className="mt-4 pt-4 border-t border-slate-100 animate-in slide-in-from-top-2 duration-300">
                        <button
                          onClick={() => setShareToFacebook(!shareToFacebook)}
                          className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                            shareToFacebook 
                              ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm' 
                              : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Facebook size={14} className={shareToFacebook ? 'text-blue-600' : ''} />
                            <span className="text-[11px] font-bold">פרסם גם בפייסבוק (Crosspost)</span>
                          </div>
                          <div className={`w-8 h-4 rounded-full relative transition-colors ${shareToFacebook ? 'bg-blue-500' : 'bg-slate-200'}`}>
                            <div className={`absolute top-1 w-2 h-2 bg-white rounded-full transition-all ${shareToFacebook ? 'left-5' : 'left-1'}`} />
                          </div>
                        </button>
                        <p className="text-[9px] text-slate-400 font-medium mt-2 leading-tight">
                          * מבוסס על הגדרות הקישור בין אינסטגרם לפייסבוק ב-Accounts Center.
                        </p>
                      </div>
                    )}
                  </div>

                    <div className="flex flex-col gap-3">
                      <button
                        onClick={handleSocialPost}
                        disabled={socialPostState === 'loading'}
                        className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-black text-sm transition-all shadow-lg shadow-indigo-100 disabled:opacity-50"
                      >
                        {socialPostState === 'loading' ? <Loader size={18} className="animate-spin" /> : <><Share2 size={18} /> פרסם עכשיו</>}
                      </button>
                      
                      {socialResult && (
                        <div className={`p-3 rounded-xl text-xs font-bold text-center animate-in zoom-in-95 duration-200 ${socialPostState === 'error' ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-teal-50 text-teal-600 border border-teal-100'}`}>
                          {socialResult.error || socialResult.message || 'הפעולה הושלמה'}
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
                          <p className="text-[11px] font-bold text-slate-700 mb-3 flex items-center gap-2">
                            <Share2 size={12} className="text-slate-400" />
                            היסטוריית פרסומים
                          </p>
                          <div className="space-y-2">
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
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2">
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

        {/* Topic Management Modal */}
        {isTopicModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
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
          </div>
        )}

        {/* Global Bulk Progress Popup */}
        {bulkProgress && (
          <div 
            className="fixed z-[60] shadow-2xl transition-all duration-200"
            style={{ 
              right: bulkCardPos.x, 
              top: bulkCardPos.y, 
              width: isBulkMinimized ? '200px' : '320px',
              transition: isDragging ? 'none' : 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
            }}
          >
            <div className="bg-white rounded-[28px] border border-indigo-100 shadow-2xl overflow-hidden flex flex-col">
              {/* Draggable Header */}
              <div 
                className="bg-indigo-600 p-4 cursor-move flex items-center justify-between select-none"
                onMouseDown={handleMouseDown}
              >
                <div className="flex items-center gap-2">
                  <Share2 className="text-white" size={16} />
                  <span className="text-white text-xs font-black uppercase tracking-widest">תהליך פרסום</span>
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
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>

              {!isBulkMinimized && (
                <div className="p-5 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">סטטוס</span>
                    <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-bold">
                        {bulkProgress.status === 'processing' ? 'מעלה תמונות...' : 
                         bulkProgress.status === 'done' ? 'הסתיים' : 'פעיל'}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-end">
                      <span className="text-2xl font-black text-slate-900 tabular-nums">
                        {bulkProgress.current}
                        <span className="text-slate-300 mx-1 text-lg">/</span>
                        {bulkProgress.total}
                      </span>
                      <span className="text-xs font-black text-indigo-600">
                        {Math.round((bulkProgress.current / bulkProgress.total) * 100)}%
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                      <div 
                        className="h-full bg-indigo-500 transition-all duration-500 relative"
                        style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" style={{ backgroundSize: '200% 100%' }} />
                      </div>
                    </div>
                  </div>

                  {bulkProgress.lastFile && (
                    <div className="flex flex-col gap-1.5 bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">מעבד כרגע:</span>
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg overflow-hidden border border-slate-200">
                                <img src={`${API_BASE}/images/${bulkProgress.lastFile}`} className="w-full h-full object-cover" alt="" />
                            </div>
                            <span className="text-[10px] font-bold text-slate-700 truncate flex-1">{bulkProgress.lastFile}</span>
                            {bulkProgress.lastPlatform && (
                                <span className="text-[8px] bg-white border border-slate-100 text-slate-400 px-1.5 py-0.5 rounded font-black uppercase">{bulkProgress.lastPlatform}</span>
                            )}
                        </div>
                    </div>
                  )}

                  {bulkProgress.status === 'done' && (
                    <button 
                      onClick={() => setBulkProgress(null)}
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

import { useState, useEffect } from 'react';
import { Trash2, Check, Copy, AlertTriangle, Loader, ChevronRight, ChevronLeft, X, ArrowRightLeft, Edit3, Save, ArrowLeftCircle, ArrowRightCircle } from 'lucide-react';

const API_BASE = 'http://localhost:3088';

function formatBytes(bytes) {
    if (!+bytes) return '0 Bytes';
    const kb = bytes / 1024;
    if (kb > 1024) {
        const mb = kb / 1024;
        return `${mb.toFixed(2)} MB (${kb.toFixed(1)} KB)`;
    }
    return `${kb.toFixed(1)} KB`;
}

export default function DuplicatesReview({ onComplete }) {
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [resolving, setResolving] = useState(null); // ID of group being resolved
    const [error, setError] = useState(null);

    const fetchDuplicates = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/duplicates`);
            const data = await res.json();
            const initializedGroups = (data.groups || []).map(group => {
                const newGroup = group.map(img => ({
                    ...img,
                    tempTitle: img.metadata?.title || '',
                    tempExplanation: img.metadata?.explanation || '',
                    tempTopic: img.metadata?.topic || '',
                    keep: true // Default to keeping all, user can uncheck
                }));
                newGroup.isTitleMatch = group.isTitleMatch;
                newGroup.isFilenameMatch = group.isFilenameMatch;
                return newGroup;
            });
            setGroups(initializedGroups);
        } catch (err) {
            setError('שגיאה בטעינת כפילויות: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDuplicates();
    }, []);

    const updateTempMetadata = (gIdx, iIdx, field, value) => {
        setGroups(prev => prev.map((g, idx) => {
            if (idx !== gIdx) return g;
            const newGroup = g.map((img, imgIdx) => {
                if (imgIdx !== iIdx) return img;
                return { ...img, [field]: value };
            });
            newGroup.isTitleMatch = g.isTitleMatch;
            newGroup.isFilenameMatch = g.isFilenameMatch;
            return newGroup;
        }));
    };

    const toggleKeep = (gIdx, iIdx) => {
        setGroups(prev => prev.map((g, idx) => {
            if (idx !== gIdx) return g;
            const newGroup = g.map((img, imgIdx) => {
                if (imgIdx !== iIdx) return img;
                return { ...img, keep: !img.keep };
            });
            newGroup.isTitleMatch = g.isTitleMatch;
            newGroup.isFilenameMatch = g.isFilenameMatch;
            return newGroup;
        }));
    };

    const copyMetadata = (gIdx, fromIdx, toIdx) => {
        const fromImg = groups[gIdx][fromIdx];
        updateTempMetadata(gIdx, toIdx, 'tempTitle', fromImg.tempTitle);
        updateTempMetadata(gIdx, toIdx, 'tempExplanation', fromImg.tempExplanation);
        updateTempMetadata(gIdx, toIdx, 'tempTopic', fromImg.tempTopic);
    };

    const resolveGroup = async (groupIndex) => {
        const group = groups[groupIndex];
        
        const resolutions = group.map(img => ({
            filename: img.filename,
            action: img.keep ? 'keep' : 'delete',
            metadata: {
                title: img.tempTitle,
                explanation: img.tempExplanation,
                topic: img.tempTopic
            }
        }));

        setResolving(groupIndex);
        try {
            const res = await fetch(`${API_BASE}/api/duplicates/resolve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ resolutions })
            });

            if (!res.ok) throw new Error('Failed to resolve');

            setGroups(prev => prev.filter((_, i) => i !== groupIndex));
        } catch (err) {
            alert('שגיאה בביצוע הפעולה: ' + err.message);
        } finally {
            setResolving(null);
        }
    };

    const deleteEntireGroup = async (groupIndex) => {
        if (!window.confirm('האם אתה בטוח שברצונך למחוק את כל התמונות בקבוצה זו?')) return;

        const group = groups[groupIndex];
        const resolutions = group.map(img => ({
            filename: img.filename,
            action: 'delete'
        }));

        setResolving(groupIndex);
        try {
            const res = await fetch(`${API_BASE}/api/duplicates/resolve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ resolutions })
            });

            if (!res.ok) throw new Error('Failed to delete group');

            setGroups(prev => prev.filter((_, i) => i !== groupIndex));
        } catch (err) {
            alert('שגיאה במחיקת הקבוצה: ' + err.message);
        } finally {
            setResolving(null);
        }
    };

    const toggleGroupSelection = (groupIndex, keepAll) => {
        setGroups(prev => prev.map((g, idx) => {
            if (idx !== groupIndex) return g;
            const newGroup = g.map(img => ({ ...img, keep: keepAll }));
            newGroup.isTitleMatch = g.isTitleMatch;
            newGroup.isFilenameMatch = g.isFilenameMatch;
            return newGroup;
        }));
    };

    const markAsNotDuplicate = async (groupIndex) => {
        const filenames = groups[groupIndex].map(img => img.filename);
        setResolving(groupIndex);
        try {
            const res = await fetch(`${API_BASE}/api/duplicates/ignore`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filenames })
            });

            if (!res.ok) throw new Error('Failed to mark as not duplicates');

            setGroups(prev => prev.filter((_, i) => i !== groupIndex));
        } catch (err) {
            alert('שגיאה בסימון כלא כפולים: ' + err.message);
        } finally {
            setResolving(null);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-white rounded-3xl border border-slate-100 shadow-sm flex-1">
                <Loader className="animate-spin text-teal-600 mb-4" size={32} />
                <p className="text-slate-500 font-medium text-lg">סורק את המערכת לכפילויות... (1,500+ תמונות)</p>
            </div>
        );
    }

    if (groups.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-white rounded-3xl border border-slate-100 shadow-sm text-center flex-1">
                <div className="w-16 h-16 bg-teal-50 text-teal-600 rounded-full flex items-center justify-center mb-4">
                    <Check size={32} />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">לא נמצאו כפילויות!</h3>
                <p className="text-slate-500">המערכת נקייה. כל התמונות ייחודיות.</p>
                <button 
                    onClick={onComplete}
                    className="mt-6 px-6 py-2 bg-teal-600 text-white rounded-xl font-bold hover:bg-teal-700 transition"
                >
                    חזרה לעריכה
                </button>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto pr-2 pb-12 custom-scrollbar">
            <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full">
                <div className="bg-amber-50 border border-amber-200 p-5 rounded-3xl flex items-start gap-4">
                    <div className="bg-amber-100 p-2 rounded-xl">
                        <AlertTriangle className="text-amber-600" size={24} />
                    </div>
                    <div>
                        <h3 className="font-bold text-amber-900 text-lg">נמצאו {groups.length} קבוצות חשודות ככפולות</h3>
                        <p className="text-amber-700 mt-1">
                            תוכל לערוך את הטקסטים לכל תמונה, לבחור אילו תמונות להשאיר (Keep) ואילו למחוק, ולבצע את השינויים לקבוצה כולה.
                        </p>
                    </div>
                </div>

                <div className="grid gap-12">
                    {groups.map((group, gIdx) => (
                        <div key={gIdx} className={`bg-white rounded-[2rem] border-2 p-8 shadow-sm transition-all ${resolving === gIdx ? 'opacity-50 animate-pulse scale-[0.98]' : 'hover:border-teal-200 hover:shadow-xl'}`}>
                            
                            {/* Group Header */}
                            <div className="flex justify-between items-center mb-8 bg-slate-50 -mx-8 -mt-8 p-6 rounded-t-[1.8rem] border-b border-slate-100">
                                <div className="flex items-center gap-4">
                                    <div className={`px-4 py-1.5 rounded-full text-sm font-black uppercase tracking-wider ${group.isTitleMatch ? 'bg-indigo-600 text-white' : group.isFilenameMatch ? 'bg-blue-600 text-white' : 'bg-amber-500 text-white'}`}>
                                        {group.isTitleMatch ? 'כותרת זהה' : group.isFilenameMatch ? 'שם קובץ זהה' : 'דמיון ויזואלי'}
                                    </div>
                                    <div className="h-6 w-px bg-slate-200"></div>
                                    <span className="text-slate-500 font-bold text-sm tracking-widest uppercase">קבוצה #{gIdx + 1}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={() => toggleGroupSelection(gIdx, true)}
                                        className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-[10px] font-black hover:bg-teal-50 hover:text-teal-700 transition"
                                    >
                                        בחר הכל
                                    </button>
                                    <button 
                                        onClick={() => toggleGroupSelection(gIdx, false)}
                                        className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-[10px] font-black hover:bg-rose-50 hover:text-rose-700 transition"
                                    >
                                        בטל הכל
                                    </button>
                                    <div className="h-6 w-px bg-slate-200 mx-1"></div>
                                    <button 
                                        onClick={() => setGroups(prev => prev.filter((_, i) => i !== gIdx))}
                                        className="p-2 text-slate-400 hover:text-slate-600 transition bg-white rounded-full shadow-sm"
                                        title="התעלם מהתראה זו"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>
                            </div>

                            <div className="relative grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
                                
                                {/* Quick Copy Controls */}
                                <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex-col gap-4">
                                     <button 
                                        onClick={() => copyMetadata(gIdx, 1, 0)}
                                        className="bg-white border-2 border-slate-100 p-2 rounded-full shadow-lg text-teal-600 hover:bg-teal-50 hover:border-teal-200 transition-all transform active:scale-90"
                                        title="העבר את הטקסט ימינה"
                                     >
                                        <ArrowRightCircle size={28} />
                                     </button>
                                     <button 
                                        onClick={() => copyMetadata(gIdx, 0, 1)}
                                        className="bg-white border-2 border-slate-100 p-2 rounded-full shadow-lg text-teal-600 hover:bg-teal-50 hover:border-teal-200 transition-all transform active:scale-90"
                                        title="העבר את הטקסט שמאלה"
                                     >
                                        <ArrowLeftCircle size={28} />
                                     </button>
                                </div>

                                {group.map((img, iIdx) => {
                                    const otherIdx = 1 - iIdx;
                                    const isDraft = !img.tempTitle?.trim() || !img.tempExplanation?.trim() || !img.tempTopic?.trim();

                                    return (
                                        <div key={iIdx} className={`flex flex-col gap-4 p-5 rounded-3xl border-2 transition-all ${!img.keep ? 'opacity-60 bg-slate-50 grayscale' : isDraft ? 'border-amber-100 bg-amber-50/20' : 'border-teal-50 bg-teal-50/10'}`}>
                                            
                                            {/* Header Info */}
                                            <div className={`flex items-center justify-between pb-3 -mx-2 px-2 rounded-t-2xl border-b border-dashed transition-all ${img.keep ? 'bg-emerald-50/50 border-emerald-200' : 'bg-rose-50/50 border-rose-200'}`}>
                                                <div className="flex items-center gap-3">
                                                    <div className="relative flex items-center">
                                                        <input 
                                                            type="checkbox"
                                                            checked={img.keep}
                                                            onChange={() => toggleKeep(gIdx, iIdx)}
                                                            className={`w-6 h-6 rounded-lg border-2 transition-all cursor-pointer focus:ring-offset-0 ${img.keep ? 'bg-emerald-500 border-emerald-600 text-white focus:ring-emerald-500' : 'bg-white border-rose-400 text-rose-500 focus:ring-rose-500'}`}
                                                            id={`keep-${gIdx}-${iIdx}`}
                                                        />
                                                    </div>
                                                    <label htmlFor={`keep-${gIdx}-${iIdx}`} className={`text-sm font-black cursor-pointer transition-all ${img.keep ? 'text-emerald-700' : 'text-rose-600'}`}>
                                                        {img.keep ? '✅ שמור תמונה זו' : '❌ מחק תמונה זו'}
                                                    </label>
                                                </div>
                                                <span className="text-[10px] font-bold bg-slate-200 text-slate-700 px-3 py-1 rounded-full whitespace-nowrap">{formatBytes(img.size)}</span>
                                            </div>

                                            {/* Image Preview */}
                                            <div className="relative aspect-video bg-white rounded-2xl overflow-hidden border border-slate-200 group/img">
                                                <img 
                                                    src={`${API_BASE}/images/${encodeURIComponent(img.filename)}`} 
                                                    className={`w-full h-full object-contain p-2 transition-all ${!img.keep ? 'brightness-50' : ''}`}
                                                    alt={img.filename}
                                                />
                                                
                                                {/* Status Badges */}
                                                <div className="absolute bottom-3 right-3 flex flex-wrap gap-2">
                                                    <div className={`px-2.5 py-1 rounded-full text-[9px] font-black shadow-lg ${img.type === 'new' ? 'bg-amber-500 text-white' : 'bg-teal-600 text-white'}`}>
                                                        {img.type === 'new' ? '📥 העלאה חדשה' : '🖼️ בגלריה העיקרית'}
                                                    </div>
                                                    {Object.keys(img.metadata || {}).length > 0 && (
                                                        <div className="bg-indigo-600 text-white px-2.5 py-1 rounded-full text-[9px] font-black shadow-lg">
                                                            📝 יש מידע קיים
                                                        </div>
                                                    )}
                                                </div>

                                                {img.keep && isDraft && (
                                                    <div className="absolute top-3 right-3 bg-rose-500 text-white px-3 py-1 rounded-lg text-[10px] font-bold shadow-lg animate-pulse">
                                                        ⚠️ דרוש טיפול בטקסט
                                                    </div>
                                                )}
                                            </div>

                                            {/* Metadata Form */}
                                            <div className={`space-y-4 pt-2 transition-all ${!img.keep ? 'pointer-events-none' : ''}`}>
                                                <div className="space-y-1.5">
                                                    <div className="flex justify-between items-center px-1">
                                                        <label className="text-xs font-black text-slate-400 uppercase tracking-tighter">כותרת (שם הקובץ ישתנה בהתאם)</label>
                                                    </div>
                                                    <input 
                                                        type="text"
                                                        value={img.tempTitle}
                                                        disabled={!img.keep}
                                                        onChange={(e) => updateTempMetadata(gIdx, iIdx, 'tempTitle', e.target.value)}
                                                        className={`w-full text-sm px-4 py-2.5 rounded-xl border-2 focus:outline-none focus:ring-4 focus:ring-teal-500/10 transition-all font-bold ${!img.tempTitle ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-white border-slate-100 text-slate-800 focus:border-teal-500'}`}
                                                        placeholder="חסר כותרת..."
                                                    />
                                                </div>

                                                <div className="space-y-1.5">
                                                    <div className="flex justify-between items-center px-1">
                                                        <label className="text-xs font-black text-slate-400 uppercase tracking-tighter">הסבר</label>
                                                    </div>
                                                    <textarea 
                                                        value={img.tempExplanation}
                                                        disabled={!img.keep}
                                                        onChange={(e) => updateTempMetadata(gIdx, iIdx, 'tempExplanation', e.target.value)}
                                                        className={`w-full text-xs px-4 py-3 rounded-xl border-2 focus:outline-none focus:ring-4 focus:ring-teal-500/10 min-h-[90px] resize-none leading-relaxed transition-all ${!img.tempExplanation ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-white border-slate-100 text-slate-600 focus:border-teal-500'}`}
                                                        placeholder="חסר הסבר..."
                                                    />
                                                </div>

                                                <div className="space-y-1.5">
                                                    <div className="flex justify-between items-center px-1">
                                                        <label className="text-xs font-black text-slate-400 uppercase tracking-tighter">נושא (Topic)</label>
                                                    </div>
                                                    <input 
                                                        type="text"
                                                        value={img.tempTopic}
                                                        disabled={!img.keep}
                                                        onChange={(e) => updateTempMetadata(gIdx, iIdx, 'tempTopic', e.target.value)}
                                                        className={`w-full text-sm px-4 py-2.5 rounded-xl border-2 focus:outline-none focus:ring-4 focus:ring-teal-500/10 transition-all font-bold ${!img.tempTopic ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-white border-slate-100 text-slate-800 focus:border-teal-500'}`}
                                                        placeholder="חסר נושא..."
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Group Footer Actions */}
                            <div className="mt-8 pt-8 border-t-2 border-slate-50 flex flex-col md:flex-row items-center justify-center gap-4">
                                <button 
                                    onClick={() => resolveGroup(gIdx)}
                                    disabled={resolving === gIdx || group.every(img => !img.keep)}
                                    className="px-12 py-4 bg-teal-600 text-white rounded-2xl font-black hover:bg-teal-700 transition shadow-xl shadow-teal-500/20 text-lg tracking-wide disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                                >
                                    בצע פעולות לקבוצה #{gIdx + 1}
                                </button>
                                
                                <button 
                                    onClick={() => deleteEntireGroup(gIdx)}
                                    disabled={resolving === gIdx}
                                    className="px-8 py-4 bg-rose-50 text-rose-600 border-2 border-rose-100 rounded-2xl font-black hover:bg-rose-100 transition text-lg tracking-wide disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 flex items-center gap-2"
                                >
                                    <Trash2 size={20} />
                                    מחק הכל
                                </button>

                                <button 
                                    onClick={() => markAsNotDuplicate(gIdx)}
                                    disabled={resolving === gIdx}
                                    className="px-8 py-4 bg-indigo-50 text-indigo-600 border-2 border-indigo-100 rounded-2xl font-black hover:bg-indigo-100 transition text-lg tracking-wide disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 flex items-center gap-2"
                                >
                                    <ArrowRightLeft size={20} />
                                    זה לא כפול
                                </button>
                            </div>
                            {group.every(img => !img.keep) && (
                                <p className="text-rose-500 text-sm font-bold animate-pulse text-center mt-4">בחר לפחות תמונה אחת לשמירה, או לחץ על "מחק הכל"</p>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

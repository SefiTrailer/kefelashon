import { useState, useEffect } from 'react';
import { Trash2, CheckCircle, Copy, AlertTriangle, Loader, ChevronRight, ChevronLeft, X } from 'lucide-react';

const API_BASE = 'http://localhost:3088';

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
            setGroups(data.groups || []);
        } catch (err) {
            setError('שגיאה בטעינת כפילויות: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDuplicates();
    }, []);

    const resolveGroup = async (groupIndex, action, keepIndex, removeIndex) => {
        const group = groups[groupIndex];
        const keep = group[keepIndex];
        const remove = group[removeIndex];

        setResolving(groupIndex);
        try {
            const res = await fetch(`${API_BASE}/api/duplicates/resolve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, keep, remove })
            });

            if (!res.ok) throw new Error('Failed to resolve');

            setGroups(prev => prev.filter((_, i) => i !== groupIndex));
        } catch (err) {
            alert('שגיאה בביצוע הפעולה: ' + err.message);
        } finally {
            setResolving(null);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-white rounded-3xl border border-slate-100 shadow-sm">
                <Loader className="animate-spin text-teal-600 mb-4" size={32} />
                <p className="text-slate-500 font-medium">סורק את המערכת לכפילויות...</p>
            </div>
        );
    }

    if (groups.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-white rounded-3xl border border-slate-100 shadow-sm text-center">
                <div className="w-16 h-16 bg-teal-50 text-teal-600 rounded-full flex items-center justify-center mb-4">
                    <CheckCircle size={32} />
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
        <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full pb-12">
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-start gap-3">
                <AlertTriangle className="text-amber-600 shrink-0" size={24} />
                <div>
                    <h3 className="font-bold text-amber-900">נמצאו {groups.length} קבוצות של תמונות חשודות ככפולות</h3>
                    <p className="text-amber-700 text-sm mt-1">אנא בדוק וקבע כיצד לטפל בכל קבוצה. המערכת מזהה דמיון ויזואלי גבוה.</p>
                </div>
            </div>

            <div className="grid gap-8">
                {groups.map((group, gIdx) => (
                    <div key={gIdx} className={`bg-white rounded-3xl border p-6 shadow-sm transition-all ${resolving === gIdx ? 'opacity-50 animate-pulse' : 'hover:border-teal-200 hover:shadow-md'}`}>
                        <div className="flex justify-between items-center mb-6">
                            <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold">קבוצה #{gIdx + 1}</span>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => setGroups(prev => prev.filter((_, i) => i !== gIdx))}
                                    className="p-2 text-slate-400 hover:text-slate-600 transition"
                                    title="התעלם מהתראה זו"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                            {group.map((img, iIdx) => (
                                <div key={iIdx} className="flex flex-col gap-3">
                                    <div className="relative aspect-square bg-slate-100 rounded-2xl overflow-hidden border border-slate-200">
                                        <img 
                                            src={`${API_BASE}/images/${encodeURIComponent(img.filename)}`} 
                                            className="w-full h-full object-contain"
                                            alt={img.filename}
                                        />
                                        <div className={`absolute top-3 left-3 px-3 py-1 rounded-full text-[10px] font-bold shadow-sm ${img.type === 'new' ? 'bg-indigo-600 text-white' : 'bg-teal-600 text-white'}`}>
                                            {img.type === 'new' ? 'חדשה (בתיקיית קליטה)' : 'במערכת'}
                                        </div>
                                    </div>
                                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                        <p className="text-xs font-bold text-slate-400 mb-1">שם הקובץ:</p>
                                        <p className="text-sm text-slate-700 font-mono truncate" dir="ltr" title={img.filename}>{img.filename}</p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 mt-2">
                                        <button 
                                            onClick={() => resolveGroup(gIdx, 'keep_this', iIdx, 1 - iIdx)}
                                            className="flex items-center justify-center gap-2 bg-white text-teal-700 border border-teal-200 py-2 rounded-xl text-sm font-bold hover:bg-teal-50 transition"
                                        >
                                            <CheckCircle size={14} /> בחר בזו
                                        </button>
                                        <button 
                                            onClick={() => resolveGroup(gIdx, iIdx === 0 ? 'delete_new' : 'replace_old', 1 - iIdx, iIdx)}
                                            className="flex items-center justify-center gap-2 bg-white text-rose-600 border border-rose-100 py-2 rounded-xl text-sm font-bold hover:bg-rose-50 transition"
                                        >
                                            <Trash2 size={14} /> מחק זו
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-8 pt-6 border-t border-slate-100 flex flex-wrap gap-3 justify-center">
                            <button 
                                onClick={() => resolveGroup(gIdx, 'keep_both', 0, 1)}
                                className="px-6 py-2.5 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-700 transition shadow-sm text-sm"
                            >
                                השאר את שתיהן (אל תמחוק כלום)
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

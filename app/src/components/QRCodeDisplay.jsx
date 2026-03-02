import React from 'react';
import QRCode from 'react-qr-code';

export default function QRCodeDisplay({ url = "https://sefitrailer.github.io/kefel-lashon/" }) {
    return (
        <div className="flex flex-col items-center justify-center p-4 bg-white rounded-3xl shadow-lg border-4 border-purple-100 transform transition hover:scale-105 hover:rotate-2">
            <div className="bg-gradient-to-br from-purple-500 to-rose-500 p-2 rounded-2xl mb-3 shadow-md">
                <div className="bg-white p-2 rounded-xl">
                    <QRCode value={url} size={120} level="H" />
                </div>
            </div>
            <p className="text-sm font-bold text-slate-700 text-center tracking-wide">
                סרוק אותי בטלפון! 📱
            </p>
        </div>
    );
}

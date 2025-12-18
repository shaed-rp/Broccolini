
import React from 'react';

interface ChefDisplayProps {
  message: string;
  isThinking?: boolean;
  onSpeak?: () => void;
  isSpeaking?: boolean;
  isAudioLoading?: boolean;
}

const ChefDisplay: React.FC<ChefDisplayProps> = ({ 
  message, 
  isThinking, 
  onSpeak, 
  isSpeaking, 
  isAudioLoading 
}) => {
  return (
    <div className="flex flex-col items-center md:items-start md:flex-row gap-6 p-6">
      <div className="relative group" aria-label="Big Query Broccolini Avatar">
        <div className="absolute -inset-1 bg-gradient-to-r from-teal-400 to-green-500 rounded-lg blur opacity-25 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
        <div className="relative flex flex-col items-center bg-slate-900 border-2 border-teal-500/50 rounded-xl p-4 w-48 shadow-2xl transition-all">
          <div className="w-32 h-32 mb-2 bg-slate-800 rounded-lg overflow-hidden flex items-center justify-center border-2 border-teal-500/30 relative">
             {/* Enhanced Pixel-style Broccolini SVG */}
             <svg viewBox="0 0 100 100" className="w-28 h-28 drop-shadow-lg">
                {/* Lush Green Floret Head (Fluffy) */}
                <g className={isSpeaking ? 'animate-pulse' : ''}>
                  <path d="M30 40 C 15 40, 15 20, 30 20 C 30 5, 50 5, 55 20 C 75 15, 85 35, 70 45 L 30 45" fill="#22c55e" stroke="#166534" strokeWidth="2" />
                  <circle cx="35" cy="25" r="5" fill="#4ade80" />
                  <circle cx="55" cy="18" r="6" fill="#4ade80" />
                  <circle cx="70" cy="30" r="5" fill="#4ade80" />
                </g>
                
                {/* Body / Stem */}
                <rect x="38" y="45" width="24" height="40" fill="#4ade80" stroke="#166534" strokeWidth="2" />
                
                {/* Teal Tech Hoodie */}
                <path d="M35 60 Q 50 55 65 60 L 70 85 L 30 85 Z" fill="#0d9488" stroke="#083344" strokeWidth="1.5" />
                <rect x="30" y="80" width="40" height="5" fill="#2563eb" />
                
                {/* Face with Distinguished Mustache */}
                <path d="M43 52 H 48 M 52 52 H 57" stroke="black" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M45 58 Q 50 63 55 58" fill="none" stroke="black" strokeWidth="1" />
                <path d="M38 58 Q 44 54 48 58 Q 50 62 52 58 Q 56 54 62 58" fill="black" stroke="black" strokeWidth="1.5" />
                
                {/* Golden 'BQ' Medallion */}
                <circle cx="50" cy="72" r="6" fill="#fbbf24" stroke="#92400e" strokeWidth="1" />
                <text x="50" y="74" fontSize="5" fontWeight="bold" textAnchor="middle" fill="#451a03" fontFamily="sans-serif">BQ</text>
                
                {/* Fork & Data Bits */}
                <path d="M35 70 L 25 75" stroke="#4ade80" strokeWidth="6" strokeLinecap="round" />
                <path d="M22 65 L 22 75 M 20 65 L 20 68 M 24 65 L 24 68" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
             </svg>
          </div>
          <h3 className="pixel-font text-[10px] text-teal-400 mt-2 text-center leading-tight">BQ BROCCOLINI</h3>
          <span className="text-[9px] text-slate-400 mt-1 uppercase tracking-wider">Senior Data Chef</span>
        </div>
        {(isThinking || isAudioLoading) && (
          <div className="absolute -top-4 -right-4 bg-yellow-400 text-slate-900 text-[10px] font-bold px-2 py-1 rounded-full animate-bounce shadow-lg z-10">
            {isAudioLoading ? 'Warming Voice...' : 'Thinking...'}
          </div>
        )}
      </div>

      <div className="flex-1 w-full group/msg">
        <div className="relative glass-panel rounded-2xl p-6 border-l-4 border-teal-500 h-full flex flex-col justify-center">
          <div className="absolute left-0 top-6 w-0 h-0 border-y-8 border-y-transparent border-r-8 border-r-teal-500 -ml-2 hidden md:block"></div>
          
          <button 
            onClick={onSpeak}
            disabled={isSpeaking || isThinking || isAudioLoading}
            className={`absolute top-4 right-4 p-2 rounded-full transition-all ${isSpeaking ? 'bg-teal-500 text-slate-900 animate-pulse' : 'bg-slate-800 text-teal-400 hover:bg-slate-700 opacity-0 group-hover/msg:opacity-100 disabled:opacity-50'}`}
            title="Listen to Broccolini's Italian flair"
            aria-label="Speak message"
          >
            {isAudioLoading ? (
              <svg className="animate-spin h-5 w-5 text-teal-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
              </svg>
            )}
          </button>

          <p className="text-lg italic leading-relaxed font-medium transition-colors pr-8">
            "{message}"
          </p>
          <div className="mt-4 flex gap-2">
             <span className="text-xs font-mono text-teal-400/80 bg-teal-500/10 px-2 py-0.5 rounded">#ProjectCRISTIAN</span>
             <span className="text-xs font-mono text-green-400/80 bg-green-500/10 px-2 py-0.5 rounded">#ChefLevelData</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChefDisplay;

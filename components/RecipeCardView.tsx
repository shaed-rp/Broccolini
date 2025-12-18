
import React, { memo } from 'react';
import { RecipeCard, Course } from '../types';

interface RecipeCardViewProps {
  card: RecipeCard;
  isCompact?: boolean;
}

const RecipeCardView: React.FC<RecipeCardViewProps> = memo(({ card, isCompact }) => {
  const getCourseStyles = (course: Course) => {
    switch (course) {
      case Course.BRONZE: return 'bg-teal-600 border-teal-500';
      case Course.SILVER: return 'bg-slate-600 border-slate-500';
      case Course.GOLD: return 'bg-yellow-600 border-yellow-500';
      default: return 'bg-teal-600 border-teal-500';
    }
  };

  if (isCompact) {
    return (
      <div className="bg-white text-slate-900 rounded-sm shadow-md p-3 border-l-4 border-teal-500 font-serif flex justify-between items-center group hover:bg-slate-50 transition-colors">
        <div className="flex flex-col">
          <span className="text-[9px] uppercase font-bold text-teal-700 tracking-tighter">Field: {card.fieldName}</span>
          <span className="text-xs font-bold truncate max-w-[200px]">{card.decision}</span>
        </div>
        <div className="text-[10px] italic text-slate-400">Card #{card.id}</div>
      </div>
    );
  }

  return (
    <div className="bg-white text-slate-900 rounded-sm shadow-xl p-6 border-t-8 border-teal-500 font-serif relative overflow-hidden group animate-in zoom-in-95 duration-300">
      {/* Decorative Stamp */}
      <div className="absolute -top-2 -right-2 w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center border-4 border-white rotate-12 opacity-50 group-hover:rotate-0 transition-transform">
        <span className="text-teal-600 font-bold text-[8px] uppercase text-center leading-tight">Chef<br/>BQ</span>
      </div>

      <div className="flex justify-between items-start mb-4 border-b border-slate-200 pb-2">
        <div>
           <h3 className="text-lg font-bold">📝 Recipe Card #{card.id}</h3>
           <p className="text-[10px] uppercase tracking-widest text-slate-500">Big Q - Project CRISTIAN</p>
        </div>
        <span className={`${getCourseStyles(card.course)} text-white text-[10px] px-2 py-1 rounded font-sans font-bold`}>
          COURSE: {card.course}
        </span>
      </div>

      <div className="space-y-4 text-sm leading-snug">
        <div>
          <span className="font-bold text-teal-700 uppercase text-[10px]">Field:</span>
          <p className="font-mono bg-slate-50 p-1 rounded mt-1 text-[11px]">{card.fieldName}</p>
        </div>

        <div>
          <span className="font-bold text-teal-700 uppercase text-[10px]">Decision:</span>
          <p className="italic font-medium">{card.decision}</p>
        </div>

        <div>
          <span className="font-bold text-teal-700 uppercase text-[10px]">Rationale:</span>
          <p className="text-xs text-slate-700">{card.rationale}</p>
        </div>

        <div className="border-l-4 border-slate-300 pl-3 py-1 bg-slate-50">
          <span className="font-bold text-slate-600 uppercase text-[10px]">BigQuery Note:</span>
          <p className="text-[10px] font-mono mt-1 text-slate-600">{card.bigQueryNote}</p>
        </div>

        <div className="pt-2 border-t border-slate-100 flex gap-3 items-center">
          <div className="w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center shrink-0">
             <span className="text-[10px] text-white">🥦</span>
          </div>
          <div>
            <span className="font-bold text-teal-800 uppercase text-[10px]">Broccolini:</span>
            <p className="text-[11px] italic text-teal-900 leading-tight">"{card.broccoliniReaction}"</p>
          </div>
        </div>
      </div>
    </div>
  );
});

export default RecipeCardView;


import React from 'react';
import { GameState, Course, KitchenStatus } from '../types';
import { COURSE_INFO } from '../constants';

interface StatsPanelProps {
  state: GameState;
}

const StatsPanel: React.FC<StatsPanelProps> = ({ state }) => {
  const courses = [Course.BRONZE, Course.SILVER, Course.GOLD];
  
  const getMeterColor = (status: KitchenStatus) => {
    switch(status) {
      case KitchenStatus.DUMPSTER_FIRE: return 'bg-red-500';
      case KitchenStatus.FUNCTIONAL: return 'bg-yellow-500';
      case KitchenStatus.PROFESSIONAL: return 'bg-green-500';
      case KitchenStatus.MICHELIN_STAR: return 'bg-teal-400 shadow-[0_0_15px_rgba(45,212,191,0.5)]';
      default: return 'bg-slate-600';
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full lg:w-80 shrink-0">
      {/* Progress Card */}
      <div className="glass-panel rounded-xl p-5 border border-teal-500/20">
        <h3 className="pixel-font text-[10px] text-teal-500 mb-4 uppercase">Course Progress</h3>
        <div className="space-y-4">
          {courses.map((c) => {
            const isActive = state.currentCourse === c;
            const isCompleted = courses.indexOf(state.currentCourse) > courses.indexOf(c);
            const info = COURSE_INFO[c];
            
            return (
              <div key={c} className={`flex items-center gap-3 p-2 rounded-lg transition-all ${isActive ? 'bg-teal-500/10 border border-teal-500/30' : ''}`}>
                <span className={`text-2xl ${!isActive && !isCompleted ? 'grayscale opacity-30' : ''}`}>{info.icon}</span>
                <div className="flex-1">
                  <div className={`text-xs font-bold ${isActive ? 'text-teal-600' : isCompleted ? 'text-green-500' : 'text-slate-400'}`}>
                    {c} Course {isCompleted && '✓'}
                  </div>
                  <div className="text-[10px] text-slate-500 line-clamp-1">{info.description}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stats Card */}
      <div className="glass-panel rounded-xl p-5 border border-teal-500/20">
        <h3 className="pixel-font text-[10px] text-teal-500 mb-4 uppercase">Chef Stats</h3>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-500">Score</span>
              <span className="text-yellow-600 font-bold font-mono">{state.points} PTS</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5">
              <div className="bg-yellow-400 h-1.5 rounded-full" style={{ width: `${Math.min((state.points / 1000) * 100, 100)}%` }}></div>
            </div>
          </div>

          <div>
            <div className="text-[10px] text-slate-400 uppercase mb-2">Kitchen Meter</div>
            <div className={`text-sm font-bold text-center py-2 rounded border border-white/5 ${getMeterColor(state.kitchenMeter)}`}>
              {state.kitchenMeter}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200 dark:border-white/5">
             <div className="flex justify-between text-xs">
                <span className="text-slate-500">Decisions</span>
                <span className="text-teal-600 font-mono">{state.decisions.length}</span>
             </div>
             <div className="flex justify-between text-xs mt-1">
                <span className="text-slate-500">Total Fields</span>
                <span className="text-teal-600 font-mono">{state.fields.length}</span>
             </div>
          </div>
        </div>
      </div>

      {/* Activity Log */}
      <div className="glass-panel rounded-xl p-5 border border-teal-500/20 flex-1 overflow-hidden flex flex-col min-h-[200px]">
        <h3 className="pixel-font text-[10px] text-teal-500 mb-4 uppercase">Activity Log</h3>
        <div className="space-y-2 text-[11px] font-mono text-slate-500 overflow-y-auto max-h-48 md:max-h-none">
          {state.history.slice().reverse().map((log, i) => (
            <div key={i} className="border-l-2 border-slate-300 dark:border-slate-700 pl-2 py-0.5">
              <span className="text-teal-600 mr-2">>>></span> {log}
            </div>
          ))}
          {state.history.length === 0 && <div className="text-slate-400 italic">No activity yet...</div>}
        </div>
      </div>
    </div>
  );
};

export default StatsPanel;

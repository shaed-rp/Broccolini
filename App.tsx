
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  GameState, Course, Confidence, KitchenStatus, 
  Field, Question, RecipeCard, FinalDeliverables 
} from './types';
import { 
  parseFileData, generateQuestion, generateRecipeCard, generateFinalDeliverables, refineQuestion, generateSpeech 
} from './services/geminiService';
import { POINT_VALUES } from './constants';
import ChefDisplay from './components/ChefDisplay';
import StatsPanel from './components/StatsPanel';
import RecipeCardView from './components/RecipeCardView';

const INITIAL_MESSAGE = "Welcome back to the kitchen, Chef! 🥦 I'm Big Query Broccolini, Senior Data Chef. I've been at Big Q for a decade perfecting Project CRISTIAN. Upload your raw data and let's plate a perfect Medallion Schema. Clean data! ✨";

/**
 * Base64 decoding for raw PCM audio data.
 */
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Decodes raw Int16 PCM data into an AudioBuffer.
 */
async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const App: React.FC = () => {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const [gameState, setGameState] = useState<GameState>({
    currentCourse: Course.BRONZE,
    fields: [],
    decisions: [],
    points: 0,
    kitchenMeter: KitchenStatus.DUMPSTER_FIRE,
    currentQuestion: null,
    isCompleted: false,
    history: []
  });

  const [chefMessage, setChefMessage] = useState<string>(INITIAL_MESSAGE);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isAudioLoading, setIsAudioLoading] = useState<boolean>(false);
  const [isCapturingRationale, setIsCapturingRationale] = useState<boolean>(false);
  const [tempDecision, setTempDecision] = useState<{ field: string; decision: string } | null>(null);
  const [deliverables, setDeliverables] = useState<FinalDeliverables | null>(null);
  const [customThoughts, setCustomThoughts] = useState<string>("");
  const [isRefining, setIsRefining] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    // Sync dark mode class with root element
    document.documentElement.classList.toggle('light', !isDarkMode);
  }, [isDarkMode]);

  const addHistory = useCallback((entry: string) => {
    setGameState(prev => ({ ...prev, history: [...prev.history, entry] }));
  }, []);

  const updatePoints = useCallback((amount: number) => {
    setGameState(prev => {
      const newPoints = prev.points + amount;
      let newMeter = KitchenStatus.DUMPSTER_FIRE;
      if (newPoints > 600) newMeter = KitchenStatus.MICHELIN_STAR;
      else if (newPoints > 300) newMeter = KitchenStatus.PROFESSIONAL;
      else if (newPoints > 100) newMeter = KitchenStatus.FUNCTIONAL;
      
      return { ...prev, points: newPoints, kitchenMeter: newMeter };
    });
  }, []);

  /**
   * Triggers the Text-to-Speech generation and playback.
   */
  const handleSpeak = async () => {
    if (isSpeaking || isAudioLoading) return;
    setIsAudioLoading(true);

    try {
      const base64Audio = await generateSpeech(chefMessage);
      
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') await ctx.resume();

      const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.onended = () => setIsSpeaking(false);
      
      setIsSpeaking(true);
      setIsAudioLoading(false);
      source.start();
    } catch (error) {
      console.error("Audio playback error:", error);
      setIsSpeaking(false);
      setIsAudioLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setChefMessage(`Checking the quality of "${file.name}"... Stand by.`);
    addHistory(`Uploaded: ${file.name}`);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const content = event.target?.result as string;
        const parsedFields = await parseFileData(file.name, content);
        
        setGameState(prev => ({ ...prev, fields: parsedFields }));
        addHistory(`Parsed ${parsedFields.length} fields.`);
        
        setChefMessage(`Found ${parsedFields.length} fields. Most of them look edible. Let's start the Appetizer: The Bronze Layer.`);
        
        const firstQ = await generateQuestion(parsedFields, [], Course.BRONZE);
        setGameState(prev => ({ ...prev, currentQuestion: firstQ }));
        setIsLoading(false);
      };
      reader.readAsText(file.slice(0, 10000));
    } catch (error) {
      console.error(error);
      setChefMessage("This file is spoiled. Please provide a fresh CSV or JSON data source.");
      setIsLoading(false);
    }
  };

  const handleDecision = (optionValue: string) => {
    if (!gameState.currentQuestion) return;
    setTempDecision({ field: gameState.currentQuestion.field, decision: optionValue });
    setIsCapturingRationale(true);
    setChefMessage(`Bold move. Now, explain the rationale so the developers don't choke on it.`);
  };

  const submitRationale = async (rationale: string) => {
    if (!tempDecision || !gameState.currentQuestion) return;
    
    setIsLoading(true);
    setIsCapturingRationale(false);
    
    try {
      const newCard = await generateRecipeCard(
        tempDecision.field,
        tempDecision.decision,
        rationale,
        gameState.currentCourse,
        gameState.decisions.length + 1
      );

      setGameState(prev => ({
        ...prev,
        decisions: [...prev.decisions, newCard]
      }));

      addHistory(`Decision logged for ${tempDecision.field}`);
      
      // Award points based on the complexity of the course
      let points = 0;
      switch(gameState.currentCourse) {
        case Course.BRONZE: points += POINT_VALUES.BRONZE_CLASSIFICATION; break;
        case Course.SILVER: points += POINT_VALUES.SILVER_STANDARDIZATION; break;
        case Course.GOLD: points += POINT_VALUES.GOLD_BUSINESS_LOGIC; break;
      }
      if (rationale.length > 20) points += POINT_VALUES.RATIONALE_PROVIDED;
      updatePoints(points);

      let nextCourse = gameState.currentCourse;
      const totalDecisions = gameState.decisions.length + 1;
      
      if (totalDecisions === 3) nextCourse = Course.SILVER;
      else if (totalDecisions === 6) nextCourse = Course.GOLD;
      else if (totalDecisions === 9) {
        setGameState(prev => ({ ...prev, isCompleted: true }));
        setChefMessage("Magnificent! ✨ The schema is plated. Let me package the deliverables for the engineers.");
        const finalData = await generateFinalDeliverables(gameState.fields, [...gameState.decisions, newCard]);
        setDeliverables(finalData);
        setIsLoading(false);
        return;
      }

      setGameState(prev => ({ ...prev, currentCourse: nextCourse }));
      
      const nextQ = await generateQuestion(gameState.fields, [...gameState.decisions, newCard], nextCourse);
      setGameState(prev => ({ ...prev, currentQuestion: nextQ }));
      setChefMessage(`${newCard.broccoliniReaction} Ready for the next ingredient?`);
      
    } catch (error) {
      console.error("Decision processing error:", error);
    } finally {
      setIsLoading(false);
      setTempDecision(null);
    }
  };

  return (
    <div className={`min-h-screen p-4 md:p-8 flex flex-col items-center transition-colors duration-300 ${isDarkMode ? 'bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-teal-900/20 via-slate-900 to-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      <header className={`w-full max-w-6xl mb-8 flex flex-col md:flex-row items-center justify-between gap-4 border-b pb-6 ${isDarkMode ? 'border-teal-500/20' : 'border-slate-200'}`}>
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-xl border ${isDarkMode ? 'bg-teal-500/20 border-teal-500/50' : 'bg-teal-50 border-teal-200'}`}>
             <span className="text-3xl" role="img" aria-label="Chef Broccoli">🥦</span>
          </div>
          <div>
            <h1 className={`pixel-font text-xl md:text-2xl tracking-tighter ${isDarkMode ? 'text-teal-400' : 'text-teal-600'}`}>SCHEMA QUEST</h1>
            <p className={`text-xs uppercase tracking-[0.2em] font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>BQ Broccolini &bull; Project CRISTIAN</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={`p-2 rounded-full transition-all ${isDarkMode ? 'bg-slate-800 text-yellow-400' : 'bg-slate-200 text-slate-700'}`}
            title="Toggle Light/Dark Mode"
          >
            {isDarkMode ? '☀️' : '🌙'}
          </button>
          <div className="flex gap-4">
            <div className="text-right">
               <div className={`text-[10px] uppercase font-bold ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Kitchen Status</div>
               <div className={`text-sm font-bold ${isDarkMode ? 'text-teal-400' : 'text-teal-600'}`}>{gameState.kitchenMeter}</div>
            </div>
            <div className={`text-right border-l pl-4 ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
               <div className={`text-[10px] uppercase font-bold ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Exp Points</div>
               <div className="text-sm font-bold text-yellow-500 font-mono">{gameState.points}</div>
            </div>
          </div>
        </div>
      </header>

      <main className="w-full max-w-6xl flex flex-col lg:flex-row gap-8">
        <div className="flex-1 flex flex-col gap-6">
          <ChefDisplay 
            message={chefMessage} 
            isThinking={isLoading} 
            onSpeak={handleSpeak} 
            isSpeaking={isSpeaking} 
            isAudioLoading={isAudioLoading}
          />

          {!gameState.fields.length && !isLoading && (
            <div className={`glass-panel rounded-2xl p-12 border-2 border-dashed flex flex-col items-center gap-6 text-center group transition-all ${isDarkMode ? 'border-teal-500/30 hover:border-teal-500/60' : 'border-slate-300 hover:border-teal-500/60'}`}>
              <div className={`w-20 h-20 rounded-full flex items-center justify-center text-4xl group-hover:scale-110 transition-transform ${isDarkMode ? 'bg-teal-500/10' : 'bg-teal-50'}`}>
                🍳
              </div>
              <div>
                <h2 className="text-xl font-bold mb-2">Initialize Project CRISTIAN</h2>
                <p className={`${isDarkMode ? 'text-slate-400' : 'text-slate-600'} max-w-sm mx-auto`}>Upload your messy CSV, JSON, or text file to start the transformation.</p>
              </div>
              <label className="bg-teal-500 hover:bg-teal-400 text-slate-900 font-bold px-8 py-4 rounded-xl cursor-pointer transition-all active:scale-95 shadow-lg shadow-teal-500/20">
                UPLOAD DATA FILE
                <input type="file" className="hidden" onChange={handleFileUpload} accept=".csv,.json,.txt,.md" />
              </label>
            </div>
          )}

          {gameState.currentQuestion && !isCapturingRationale && !gameState.isCompleted && (
            <div className={`glass-panel rounded-2xl p-8 border animate-in fade-in slide-in-from-bottom-4 duration-500 ${isDarkMode ? 'border-teal-500/20' : 'border-slate-200'}`}>
              <div className="flex items-center justify-between gap-3 mb-6">
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded text-xs font-bold font-mono ${isDarkMode ? 'bg-teal-500/20 text-teal-400' : 'bg-teal-50 text-teal-600'}`}>
                    FIELD: {gameState.currentQuestion.field}
                  </span>
                  <span className={`text-xs uppercase font-bold tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    {gameState.currentCourse} Layer
                  </span>
                </div>
                {!isRefining && (
                  <button onClick={() => setIsRefining(true)} className={`text-[10px] font-bold uppercase tracking-widest border-b ${isDarkMode ? 'text-teal-500 hover:text-teal-400 border-teal-500/30' : 'text-teal-600 hover:text-teal-700 border-teal-600/30'}`}>
                    Refine Options
                  </button>
                )}
              </div>
              
              <div className="space-y-4 mb-8">
                <div>
                  <h4 className={`text-xs uppercase font-bold mb-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Observation</h4>
                  <p className={isDarkMode ? 'text-slate-200' : 'text-slate-700'}>{gameState.currentQuestion.observation}</p>
                </div>
                <div>
                  <h4 className={`text-xs uppercase font-bold mb-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Architectural Ambiguity</h4>
                  <p className={isDarkMode ? 'text-slate-200' : 'text-slate-700'}>{gameState.currentQuestion.ambiguity}</p>
                </div>
              </div>

              {isRefining ? (
                <div className={`p-6 rounded-xl border mb-6 ${isDarkMode ? 'bg-slate-900/50 border-teal-500/20' : 'bg-slate-50 border-slate-200'}`}>
                  <textarea 
                    className={`w-full h-24 border rounded-lg p-3 text-sm outline-none mb-4 ${isDarkMode ? 'bg-slate-950 border-white/10 text-slate-200 focus:border-teal-500' : 'bg-white border-slate-200 text-slate-800 focus:border-teal-600'}`}
                    placeholder="Provide specific context to Broccolini..."
                    value={customThoughts}
                    onChange={(e) => setCustomThoughts(e.target.value)}
                  />
                  <div className="flex justify-end gap-3">
                    <button onClick={() => { setIsRefining(false); setCustomThoughts(""); }} className="text-xs font-bold uppercase text-slate-400">Cancel</button>
                    <button onClick={() => { /* refineQuestion logic here */ }} className="bg-teal-500 text-slate-900 px-4 py-2 rounded-lg text-xs font-bold">RECOOK ✨</button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {gameState.currentQuestion.options.map((opt, idx) => {
                    const isRecommended = gameState.currentQuestion?.recommendedIndex === idx;
                    return (
                      <button
                        key={idx}
                        onClick={() => handleDecision(opt.value)}
                        className={`flex flex-col text-left p-4 rounded-xl transition-all group relative ${isDarkMode ? 'bg-slate-800/50 hover:bg-slate-800' : 'bg-white hover:bg-slate-50 shadow-sm'} ${isRecommended ? 'ring-2 ring-teal-500' : 'border border-transparent'}`}
                      >
                        {isRecommended && <span className="absolute -top-3 -right-2 px-2 py-0.5 rounded-full text-[8px] font-bold bg-teal-500 text-slate-900 uppercase">Recommended</span>}
                        <span className="font-bold mb-1 group-hover:text-teal-500">{opt.text}</span>
                        <span className={`text-xs italic ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Impact: {opt.tradeoff}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {isCapturingRationale && (
            <div className={`glass-panel rounded-2xl p-8 border animate-in zoom-in-95 duration-300 ${isDarkMode ? 'border-yellow-500/20' : 'border-yellow-200'}`}>
               <h3 className="text-xl font-bold mb-2">Decision Rationale</h3>
               <textarea 
                  className={`w-full h-32 border rounded-xl p-4 outline-none transition-colors mb-4 ${isDarkMode ? 'bg-slate-950 border-white/10 text-slate-200 focus:border-teal-500' : 'bg-white border-slate-200 text-slate-800 focus:border-teal-600'}`}
                  placeholder="Why is this the correct technical choice for Big Q?"
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && submitRationale((e.target as HTMLTextAreaElement).value)}
               />
               <div className="flex justify-end gap-3">
                  <button onClick={() => setIsCapturingRationale(false)} className="px-4 py-2 text-xs font-bold uppercase text-slate-400">Cancel</button>
                  <button onClick={(e) => submitRationale(((e.currentTarget.parentElement?.previousElementSibling as HTMLTextAreaElement).value))} className="bg-yellow-500 text-slate-900 px-6 py-2 rounded-lg font-bold">LOG DECISION</button>
               </div>
            </div>
          )}

          {gameState.isCompleted && deliverables && (
            <div className="space-y-6 pb-20 animate-in fade-in duration-1000">
               <div className={`glass-panel rounded-2xl p-8 border-2 border-teal-500 shadow-2xl ${isDarkMode ? 'bg-teal-500/5' : 'bg-white'}`}>
                  <h2 className="pixel-font text-xl mb-4 text-teal-400">MISSION COMPLETE</h2>
                  <p className="mb-6">Project CRISTIAN has successfully normalized your data chaos. Here are the plated deliverables.</p>
                  <div className="grid grid-cols-2 gap-4 mb-8">
                     <div className="bg-slate-950 p-4 rounded-xl border border-white/10">
                        <h4 className="text-[10px] text-teal-400 font-bold uppercase mb-1">Final Score</h4>
                        <p className="text-2xl font-mono">{gameState.points} PTS</p>
                     </div>
                     <div className="bg-slate-950 p-4 rounded-xl border border-white/10">
                        <h4 className="text-[10px] text-teal-400 font-bold uppercase mb-1">Kitchen Status</h4>
                        <p className="text-xl font-bold uppercase">{gameState.kitchenMeter}</p>
                     </div>
                  </div>
                  <div className="bg-slate-950 p-6 rounded-xl border border-white/10 overflow-x-auto">
                    <h3 className="text-xs font-bold text-teal-500 mb-4 uppercase">BigQuery DDL</h3>
                    <pre className="text-[11px] font-mono leading-tight text-teal-300">{deliverables.bigQueryDDL}</pre>
                  </div>
               </div>
               <button onClick={() => window.location.reload()} className="w-full bg-slate-800 hover:bg-slate-700 py-4 rounded-xl font-bold tracking-widest border border-white/10">START NEW QUEST</button>
            </div>
          )}

          {gameState.decisions.length > 0 && (
            <div className="mt-8 border-t border-white/10 pt-8">
              <h2 className="pixel-font text-[10px] mb-6 uppercase text-teal-400 tracking-widest">Recipe Log</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {gameState.decisions.map((card) => <RecipeCardView key={card.id} card={card} />)}
              </div>
            </div>
          )}
        </div>

        <StatsPanel state={gameState} />
      </main>

      <footer className="w-full max-w-6xl mt-16 pt-8 border-t border-white/5 flex justify-between items-center text-[10px] text-slate-600 font-bold uppercase tracking-widest">
        <div>Big Q Systems &copy; 2024</div>
        <div className="flex gap-4">
          <span className="text-teal-900">BRONZE</span>
          <span className="text-slate-800">SILVER</span>
          <span className="text-yellow-900">GOLD</span>
        </div>
      </footer>
    </div>
  );
};

export default App;


import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  GameState, Course, Confidence, KitchenStatus, 
  Field, Question, RecipeCard, FinalDeliverables 
} from './types';
import { 
  parseFileData, generateQuestion, generateRecipeCard, generateFinalDeliverables, refineQuestion, generateSpeech 
} from './services/geminiService';
import { uploadToProjectFolder } from './services/driveService';
import { POINT_VALUES } from './constants';
import ChefDisplay from './components/ChefDisplay';
import StatsPanel from './components/StatsPanel';
import RecipeCardView from './components/RecipeCardView';

const INITIAL_MESSAGE = "Welcome back to the kitchen Slick Eddie! 🥦 I'm Big Queryini Broccolini, Senior Data Chef. I've been at Big Q for a decade perfecting Project CRISTIAN. Upload your raw data or drop a link, and let's plate a perfect Medallion Schema. Clean data! ✨";

const SYNTHESIS_STEPS = [
  "Harvesting decision metadata...",
  "Architecting BigQuery DDL...",
  "Formatting JSON Schemas...",
  "Drafting the Data Dictionary...",
  "Applying Medallion best practices...",
  "Finalizing Project CRISTIAN package..."
];

const DRIVE_FOLDER_LINK = "https://drive.google.com/drive/folders/1xCVtm2t7XMZxM0ZrkEHLalAZUUsmT1kf?usp=sharing";

// Known Demo Link to bypass CORS for specific user request
const DEMO_FLEET_LINK = "https://drive.google.com/file/d/1x-MudRM_6ZPxga8FkcCRrl40IkUasR1W/view?usp=sharing";
const DEMO_FLEET_CONTENT = `vin,unit_number,make,model,year,fuel_type,gvwr_lbs,odometer_reading,state_of_charge_pct,charging_kw_capacity,license_plate,fleet_category
1FTFW1ED0PFA00001,EV-101,Ford,F-150 Lightning,2023,BEV,8500,12450,82,150,FLT-101,Light Duty
3HGCP2F80BA000002,DSL-502,Freightliner,Cascadia,2022,Diesel,35000,145200,,,TX-502,Heavy Duty
1N4BL3AP0NC000003,EV-102,Nissan,Leaf,2021,BEV,4500,28900,45,50,CA-102,Light Duty`;

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

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
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
  const [isSynthesizing, setIsSynthesizing] = useState<boolean>(false);
  const [isAutoChefActive, setIsAutoChefActive] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [showSyncReminder, setShowSyncReminder] = useState<boolean>(false);
  const [synthesisStep, setSynthesisStep] = useState<number>(0);
  const [tempDecision, setTempDecision] = useState<{ field: string; decision: string } | null>(null);
  const [rationaleText, setRationaleText] = useState<string>("");
  const [deliverables, setDeliverables] = useState<FinalDeliverables | null>(null);
  const [customThoughts, setCustomThoughts] = useState<string>("");
  const [isRefining, setIsRefining] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [uploadMode, setUploadMode] = useState<'file' | 'link'>('file');
  const [inputLink, setInputLink] = useState<string>("");
  
  const [nextQuestionBuffer, setNextQuestionBuffer] = useState<Question | null>(null);
  const [isPrefetching, setIsPrefetching] = useState<boolean>(false);
  const [activeLogTab, setActiveLogTab] = useState<Course>(Course.BRONZE);

  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('light', !isDarkMode);
  }, [isDarkMode]);

  useEffect(() => {
    let interval: any;
    if (isSynthesizing) {
      interval = setInterval(() => {
        setSynthesisStep(prev => (prev < SYNTHESIS_STEPS.length - 1 ? prev + 1 : prev));
      }, 3000);
    } else {
      setSynthesisStep(0);
    }
    return () => clearInterval(interval);
  }, [isSynthesizing]);

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

  const processContent = async (name: string, content: string, mimeType: string = 'text/plain', originalFile?: File) => {
    setIsLoading(true);
    setChefMessage(`Checking the quality of "${name}"... Stand by.`);
    addHistory(`Processing Source: ${name} (${mimeType})`);
    setSyncError(null);
    
    // Background sync attempt
    if (originalFile) {
      setIsSyncing(true);
      uploadToProjectFolder(originalFile, gameState.currentCourse).then((result) => {
        setIsSyncing(false);
        if (result.success) {
          addHistory(`☁️ Archived "${name}" to Project Folder.`);
        } else {
          // If auth failed, we log the intent but notify the user of manual sync need
          if (result.errorType === 'AUTH') {
            addHistory(`📝 Local Log: "${name}" prepped for archival. (Manual Sync required)`);
            setSyncError("Cloud Garden requires a Token for automatic sync. Please use Manual Sync below! 🤌");
            setShowSyncReminder(true);
          } else {
            addHistory(`⚠️ Sync issue for "${name}". Check project permissions.`);
          }
        }
      });
    }

    try {
      const parsedFields = await parseFileData(name, content, mimeType);
      setGameState(prev => ({ ...prev, fields: parsedFields }));
      addHistory(`Parsed ${parsedFields.length} fields.`);
      setChefMessage(`Found ${parsedFields.length} fields. I've prepped the ingredient for Project CRISTIAN auditing! 📂`);
      const firstQ = await generateQuestion(parsedFields, [], Course.BRONZE);
      setGameState(prev => ({ ...prev, currentQuestion: firstQ }));
    } catch (error: any) {
      console.error(error);
      const isRateLimit = JSON.stringify(error).toLowerCase().includes('429') || error?.status === 429;
      setChefMessage(isRateLimit 
        ? "The kitchen is too crowded right now (Rate Limit). Let's take a deep breath and try again in a moment. 🧘‍♂️"
        : "This data is spoiled. Please provide a fresh CSV, JSON, or PDF data source."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const reader = new FileReader();

    reader.onload = async (event) => {
      let content = '';
      if (isPdf) {
        const result = event.target?.result as string;
        content = result.split(',')[1];
      } else {
        content = event.target?.result as string;
      }
      processContent(file.name, content, file.type || (isPdf ? 'application/pdf' : 'text/plain'), file);
    };

    if (isPdf) {
      reader.readAsDataURL(file);
    } else {
      reader.readAsText(file.slice(0, 10000));
    }
  };

  const handleLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputLink.trim()) return;
    
    setIsLoading(true);
    setChefMessage("Reaching out to the cloud garden... harvesting your link.");
    
    if (inputLink.trim() === DEMO_FLEET_LINK) {
      addHistory("Chef's Secret detected: High-Quality Fleet Demo Link.");
      setChefMessage("Mamma mia! This is a verified Project CRISTIAN Fleet Ingredient. Harvesting now! ✨");
      await new Promise(r => setTimeout(r, 1500));
      processContent("Fleet_Asset_Sample.csv", DEMO_FLEET_CONTENT, 'text/plain');
      return;
    }

    let fetchUrl = inputLink;
    if (inputLink.includes('drive.google.com/file/d/')) {
      const match = inputLink.match(/\/d\/([^/]+)/);
      if (match) {
        fetchUrl = `https://docs.google.com/uc?id=${match[1]}&export=download`;
      }
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const response = await fetch(fetchUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
      const text = await response.text();
      processContent(inputLink.split('/').pop() || 'Remote Asset', text, response.headers.get('content-type') || 'text/plain');
    } catch (error: any) {
      console.error("Fetch Error Detail:", error);
      let failMessage = "Ah, the garden gate is locked! 🔒 Browser security (CORS) or a private link prevents me from reaching this directly.";
      if (error.name === 'AbortError') failMessage = "The cloud garden is taking too long to respond. Harvest timed out! ⌛";
      else if (error.message.includes('Failed to fetch')) failMessage = "CORS Blocked! 🛑 External server doesn't allow direct browsing. Please download and upload as 'Local Ingredient'.";
      setChefMessage(failMessage);
      setIsLoading(false);
    }
  };

  const prefetchNextQuestion = async (currentField: string, currentDecision: string) => {
    setIsPrefetching(true);
    try {
      let nextCourse = gameState.currentCourse;
      const totalDecisionsPredict = gameState.decisions.length + 1;
      if (totalDecisionsPredict === 3) nextCourse = Course.SILVER;
      else if (totalDecisionsPredict === 6) nextCourse = Course.GOLD;
      if (totalDecisionsPredict >= 9) {
        setIsPrefetching(false);
        return;
      }
      const mockDecisions = [...gameState.decisions, { fieldName: currentField, decision: currentDecision } as any];
      const nextQ = await generateQuestion(gameState.fields, mockDecisions, nextCourse);
      setNextQuestionBuffer(nextQ);
    } catch (e) {
      console.warn("Prefetch failed", e);
    } finally {
      setIsPrefetching(false);
    }
  };

  const handleDecision = (optionValue: string, suggestedRationale: string) => {
    if (!gameState.currentQuestion) return;
    const field = gameState.currentQuestion.field;
    setTempDecision({ field, decision: optionValue });
    setRationaleText(suggestedRationale);
    setIsCapturingRationale(true);
    setChefMessage(`I've pre-filled the expert rationale for you. Refine it or confirm to proceed.`);
    prefetchNextQuestion(field, optionValue);
  };

  const submitRationale = async (rationale: string) => {
    if (!tempDecision || !gameState.currentQuestion) return;
    setIsTransitioning(true);
    setIsCapturingRationale(false);
    try {
      const newCard = await generateRecipeCard(
        tempDecision.field,
        tempDecision.decision,
        rationale,
        gameState.currentCourse,
        gameState.decisions.length + 1
      );
      const updatedDecisions = [...gameState.decisions, newCard];
      setGameState(prev => ({ ...prev, decisions: updatedDecisions }));
      addHistory(`Decision logged for ${tempDecision.field}`);
      let points = 0;
      switch(gameState.currentCourse) {
        case Course.BRONZE: points += POINT_VALUES.BRONZE_CLASSIFICATION; break;
        case Course.SILVER: points += POINT_VALUES.SILVER_STANDARDIZATION; break;
        case Course.GOLD: points += POINT_VALUES.GOLD_BUSINESS_LOGIC; break;
      }
      if (rationale.length > 20) points += POINT_VALUES.RATIONALE_PROVIDED;
      updatePoints(points);
      const totalDecisions = updatedDecisions.length;
      if (totalDecisions >= 9) {
        setIsSynthesizing(true);
        setChefMessage("Magnificent! ✨ The schema is plated. Let me package the deliverables for the engineers.");
        const finalData = await generateFinalDeliverables(gameState.fields, updatedDecisions);
        setDeliverables(finalData);
        setGameState(prev => ({ ...prev, isCompleted: true }));
        setIsSynthesizing(false);
        setIsTransitioning(false);
        return;
      }
      let nextQ = nextQuestionBuffer || await generateQuestion(gameState.fields, updatedDecisions, totalDecisions === 3 ? Course.SILVER : totalDecisions === 6 ? Course.GOLD : gameState.currentCourse);
      setGameState(prev => ({ ...prev, currentCourse: nextQ?.course || prev.currentCourse, currentQuestion: nextQ }));
      setChefMessage(`${newCard.broccoliniReaction} Ready for the next ingredient?`);
      setNextQuestionBuffer(null);
      setActiveLogTab(nextQ?.course || gameState.currentCourse);
    } catch (error: any) {
      console.error("Decision processing error:", error);
      const isRateLimit = JSON.stringify(error).toLowerCase().includes('429') || error?.status === 429;
      setChefMessage(isRateLimit ? "The kitchen is a bit overloaded! Cooling down... 🌡️" : "Oof, something went wrong with that ingredient.");
    } finally {
      setIsTransitioning(false);
      setTempDecision(null);
      setRationaleText("");
    }
  };

  const handleAutoChef = async () => {
    if (!gameState.fields.length || isAutoChefActive) return;
    setIsAutoChefActive(true);
    setChefMessage("Mamma mia! Fasten your apron, Chef! 🥦 I'm taking over to show you how a Medallion pro plates. Auto-Plating Mode engaged!");
    let currentDecisions = [...gameState.decisions];
    let currentFields = [...gameState.fields];
    let currentQuestion = gameState.currentQuestion;
    try {
      while (currentDecisions.length < 9) {
        if (!currentQuestion) {
          const courseToFetch = currentDecisions.length < 3 ? Course.BRONZE : currentDecisions.length < 6 ? Course.SILVER : Course.GOLD;
          currentQuestion = await generateQuestion(currentFields, currentDecisions, courseToFetch);
          setGameState(prev => ({ ...prev, currentQuestion: currentQuestion, currentCourse: currentQuestion?.course || prev.currentCourse }));
        }
        if (!currentQuestion) break;
        const recIndex = currentQuestion.recommendedIndex ?? 0;
        const option = currentQuestion.options[recIndex];
        setChefMessage(`Expertly plating "${currentQuestion.field}" as ${option.value}...`);
        const newCard = await generateRecipeCard(currentQuestion.field, option.value, option.suggestedRationale, currentQuestion.course, currentDecisions.length + 1);
        currentDecisions.push(newCard);
        setGameState(prev => ({ ...prev, decisions: [...currentDecisions], points: prev.points + 50, history: [...prev.history, `Auto-Chef: Plated ${newCard.fieldName}`] }));
        setActiveLogTab(newCard.course);
        currentQuestion = null;
        await new Promise(r => setTimeout(r, 4000));
      }
      setIsSynthesizing(true);
      setChefMessage("Perfecto! The full Medallion Menu is ready. Finalizing package...");
      const finalData = await generateFinalDeliverables(currentFields, currentDecisions);
      setDeliverables(finalData);
      setGameState(prev => ({ ...prev, isCompleted: true, currentQuestion: null }));
    } catch (error: any) {
      console.error("Auto-Chef error:", error);
      const isRateLimit = JSON.stringify(error).toLowerCase().includes('429') || error?.status === 429;
      setChefMessage(isRateLimit ? "Mamma mia! Too fast! Kitchen overwhelmed. Try manual! 🤌" : "Oof, the kitchen caught fire! Please refresh.");
    } finally {
      setIsAutoChefActive(false);
      setIsSynthesizing(false);
    }
  };

  const handleRefineOptions = async () => {
    if (!customThoughts.trim() || !gameState.currentQuestion) return;
    setIsLoading(true);
    setChefMessage("Adjusting the seasoning... rethinking the options.");
    try {
      const refinedQ = await refineQuestion(gameState.currentQuestion, customThoughts, gameState.currentCourse);
      setGameState(prev => ({ ...prev, currentQuestion: refinedQ }));
      setChefMessage("I've recooked the options for you. ✨");
      setCustomThoughts("");
      setIsRefining(false);
      setNextQuestionBuffer(null);
    } catch (error) { console.error(error); } finally { setIsLoading(false); }
  };

  // Logic to download the final Project CRISTIAN package as JSON
  const handleDownloadPackage = useCallback(() => {
    if (!deliverables) return;
    const blob = new Blob([JSON.stringify(deliverables, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Project_CRISTIAN_Deliverables_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [deliverables]);

  const filteredDecisions = useMemo(() => gameState.decisions.filter(d => d.course === activeLogTab), [gameState.decisions, activeLogTab]);
  const counts = useMemo(() => ({
    [Course.BRONZE]: gameState.decisions.filter(d => d.course === Course.BRONZE).length,
    [Course.SILVER]: gameState.decisions.filter(d => d.course === Course.SILVER).length,
    [Course.GOLD]: gameState.decisions.filter(d => d.course === Course.GOLD).length,
  }), [gameState.decisions]);

  return (
    <div className={`min-h-screen p-4 md:p-8 flex flex-col items-center transition-colors duration-300 ${isDarkMode ? 'bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-teal-900/20 via-slate-900 to-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      <header className={`w-full max-w-6xl mb-8 flex flex-col md:flex-row items-center justify-between gap-4 border-b pb-6 ${isDarkMode ? 'border-teal-500/20' : 'border-slate-200'}`}>
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-xl border ${isDarkMode ? 'bg-teal-500/20 border-teal-500/50' : 'bg-teal-50 border-teal-200'}`}><span className="text-3xl" role="img" aria-label="Chef Broccoli">🥦</span></div>
          <div>
            <h1 className={`pixel-font text-xl md:text-2xl tracking-tighter ${isDarkMode ? 'text-teal-400' : 'text-teal-600'}`}>SCHEMA QUEST</h1>
            <p className={`text-xs uppercase tracking-[0.2em] font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>BQ Broccolini &bull; Project CRISTIAN</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-end gap-1">
             <a href={DRIVE_FOLDER_LINK} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase transition-all ${isDarkMode ? 'bg-slate-800 border-white/10 text-slate-300 hover:text-teal-400' : 'bg-white border-slate-200 text-slate-600 hover:text-teal-600 shadow-sm'}`}>📂 Project Folder</a>
            {isSyncing && (
              <div className="flex items-center gap-2 text-[8px] font-bold text-teal-500 uppercase animate-pulse">
                 <div className="w-1.5 h-1.5 bg-teal-500 rounded-full"></div>Archiving...
              </div>
            )}
          </div>
          <button onClick={() => setIsDarkMode(!isDarkMode)} className={`p-2 rounded-full transition-all ${isDarkMode ? 'bg-slate-800 text-yellow-400' : 'bg-slate-200 text-slate-700'}`}>{isDarkMode ? '☀️' : '🌙'}</button>
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
          <ChefDisplay message={chefMessage} isThinking={isLoading || isTransitioning || isSynthesizing || isAutoChefActive} onSpeak={handleSpeak} isSpeaking={isSpeaking} isAudioLoading={isAudioLoading} />

          {showSyncReminder && !gameState.isCompleted && (
            <div className="animate-in slide-in-from-top-4 fade-in duration-500">
               <div className={`p-4 rounded-xl border flex flex-col md:flex-row items-center justify-between gap-4 ${isDarkMode ? 'bg-teal-500/10 border-teal-500/30' : 'bg-teal-50 border-teal-200'}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🚛</span>
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-teal-500">{syncError ? 'Manual Sync Needed' : 'Kitchen Sync Ready'}</h4>
                      <p className="text-[11px] text-slate-500 italic">{syncError || 'Season the garden by dropping your source into the reference folder.'}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => setShowSyncReminder(false)} className="px-3 py-1.5 text-[10px] font-bold uppercase text-slate-500 hover:text-slate-400">Dismiss</button>
                    <a href={DRIVE_FOLDER_LINK} target="_blank" rel="noopener noreferrer" className="bg-teal-500 text-slate-950 px-4 py-1.5 rounded-lg text-[10px] font-bold hover:bg-teal-400 transition-colors shadow-lg shadow-teal-500/20">MANUAL SYNC 📂</a>
                  </div>
               </div>
            </div>
          )}

          {isSynthesizing && (
            <div className={`glass-panel rounded-2xl p-12 border-2 border-teal-500 shadow-2xl animate-in zoom-in-95 duration-500 flex flex-col items-center gap-8 ${isDarkMode ? 'bg-teal-500/5' : 'bg-white'}`}>
               <div className="relative w-24 h-24">
                  <div className="absolute inset-0 border-4 border-teal-500/20 rounded-full"></div>
                  <div className="absolute inset-0 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center text-4xl animate-bounce">📦</div>
               </div>
               <div className="text-center w-full">
                  <h2 className="pixel-font text-lg text-teal-400 mb-2">PACKAGING DELIVERABLES</h2>
                  <div className="w-full max-w-md mx-auto h-2 bg-slate-800 rounded-full overflow-hidden mb-4">
                     <div className="h-full bg-teal-500 transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(45,212,191,0.5)]" style={{ width: `${((synthesisStep + 1) / SYNTHESIS_STEPS.length) * 100}%` }}></div>
                  </div>
                  <p className="text-sm font-mono text-slate-300 italic animate-pulse">"{SYNTHESIS_STEPS[synthesisStep]}"</p>
               </div>
            </div>
          )}

          {!gameState.fields.length && !isLoading && (
            <div className={`glass-panel rounded-2xl p-8 md:p-12 border-2 border-dashed flex flex-col items-center gap-8 text-center transition-all ${isDarkMode ? 'border-teal-500/30' : 'border-slate-300'}`}>
              <div className="flex flex-col items-center gap-4">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center text-4xl shadow-xl ${isDarkMode ? 'bg-teal-500/10' : 'bg-teal-50'}`}>🍳</div>
                <div><h2 className="text-xl font-bold mb-1">Initialize Project CRISTIAN</h2><p className={`${isDarkMode ? 'text-slate-400' : 'text-slate-600'} text-xs max-w-xs mx-auto`}>Select your data sourcing method to begin.</p></div>
              </div>
              <div className="w-full max-w-md">
                 <div className={`flex p-1 rounded-xl mb-6 ${isDarkMode ? 'bg-slate-900' : 'bg-slate-200'}`}>
                    <button onClick={() => setUploadMode('file')} className={`flex-1 py-2 text-xs font-bold uppercase rounded-lg transition-all ${uploadMode === 'file' ? (isDarkMode ? 'bg-teal-500 text-slate-950' : 'bg-teal-600 text-white') : 'text-slate-500'}`}>Local Ingredient</button>
                    <button onClick={() => setUploadMode('link')} className={`flex-1 py-2 text-xs font-bold uppercase rounded-lg transition-all ${uploadMode === 'link' ? (isDarkMode ? 'bg-teal-500 text-slate-950' : 'bg-teal-600 text-white') : 'text-slate-500'}`}>Cloud Sourcing</button>
                 </div>
                 {uploadMode === 'file' ? (
                    <label className="block w-full group">
                      <div className={`border-2 border-dashed rounded-2xl p-8 cursor-pointer transition-all hover:scale-[1.02] active:scale-95 ${isDarkMode ? 'border-teal-500/20 bg-teal-500/5 hover:border-teal-500/50' : 'border-slate-300 bg-slate-50 hover:border-teal-500/50'}`}>
                        <span className="text-3xl mb-4 block">📄</span>
                        <p className="text-sm font-bold uppercase tracking-widest text-teal-600">Click to Browse</p>
                        <p className="text-[10px] text-slate-500 mt-2 font-mono">CSV, JSON, TXT, OR PDF</p>
                      </div>
                      <input type="file" className="hidden" onChange={handleFileUpload} accept=".csv,.json,.txt,.md,.pdf" />
                    </label>
                 ) : (
                    <form onSubmit={handleLinkSubmit} className="space-y-4">
                       <div className="relative"><input type="url" placeholder="https://..." value={inputLink} onChange={(e) => setInputLink(e.target.value)} required className={`w-full px-4 py-4 rounded-xl border font-mono text-xs outline-none transition-all ${isDarkMode ? 'bg-slate-950 border-teal-500/20 focus:border-teal-500 text-teal-400' : 'bg-white border-slate-300 focus:border-teal-600'}`} /><div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">🔗</div></div>
                       <button type="submit" className="w-full bg-teal-500 text-slate-950 font-bold py-4 rounded-xl shadow-lg shadow-teal-500/20 active:scale-95 transition-all">HARVEST DATA ✨</button>
                    </form>
                 )}
              </div>
            </div>
          )}

          {gameState.fields.length > 0 && !gameState.currentQuestion && !gameState.isCompleted && !isLoading && !isAutoChefActive && (
             <div className="flex flex-col items-center gap-4 animate-in fade-in duration-500">
                <div className="w-full max-w-md h-1 bg-teal-500/20 rounded-full overflow-hidden"><div className="h-full bg-teal-500 w-1/3 animate-pulse"></div></div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Awaiting First Ingredient...</p>
             </div>
          )}

          {gameState.fields.length > 0 && !gameState.isCompleted && !isSynthesizing && !isAutoChefActive && (
            <div className="flex justify-center mb-4">
               <button onClick={handleAutoChef} className="group relative flex items-center gap-3 bg-slate-900 border border-yellow-500/30 px-6 py-3 rounded-xl transition-all hover:border-yellow-500 hover:shadow-[0_0_15px_rgba(234,179,8,0.2)] active:scale-95 overflow-hidden">
                  <div className="absolute inset-0 bg-yellow-500/5 group-hover:bg-yellow-500/10 transition-colors"></div>
                  <span className="text-xl group-hover:rotate-12 transition-transform">🎓</span>
                  <div className="flex flex-col text-left"><span className="text-[10px] font-bold text-yellow-500 uppercase tracking-widest">Masterclass Mode</span><span className="text-sm font-bold">Show me how it's done</span></div>
               </button>
            </div>
          )}

          {gameState.currentQuestion && !isCapturingRationale && !gameState.isCompleted && !isSynthesizing && !isAutoChefActive && (
            <div className={`glass-panel rounded-2xl p-8 border relative transition-all duration-500 ${isDarkMode ? 'border-teal-500/20' : 'border-slate-200'} ${isTransitioning ? 'blur-sm grayscale opacity-50' : 'animate-in fade-in slide-in-from-bottom-4'}`}>
              <div className="flex items-center justify-between gap-3 mb-6">
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded text-xs font-bold font-mono ${isDarkMode ? 'bg-teal-500/20 text-teal-400' : 'bg-teal-50 text-teal-600'}`}>FIELD: {gameState.currentQuestion.field}</span>
                  <span className={`text-xs uppercase font-bold tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{gameState.currentCourse} Layer</span>
                </div>
                {!isRefining && !isTransitioning && <button onClick={() => setIsRefining(true)} className={`text-[10px] font-bold uppercase tracking-widest border-b ${isDarkMode ? 'text-teal-500 hover:text-teal-400 border-teal-500/30' : 'text-teal-600 hover:text-teal-700 border-teal-600/30'}`}>Refine Options</button>}
              </div>
              <div className="space-y-4 mb-8">
                <div><h4 className={`text-xs uppercase font-bold mb-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Observation</h4><p className={isDarkMode ? 'text-slate-200' : 'text-slate-700'}>{gameState.currentQuestion.observation}</p></div>
                <div><h4 className={`text-xs uppercase font-bold mb-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Architectural Ambiguity</h4><p className={isDarkMode ? 'text-slate-200' : 'text-slate-700'}>{gameState.currentQuestion.ambiguity}</p></div>
              </div>
              {isRefining ? (
                <div className={`p-6 rounded-xl border mb-6 ${isDarkMode ? 'bg-slate-900/50 border-teal-500/20' : 'bg-slate-50 border-slate-200'}`}>
                  <textarea className={`w-full h-24 border rounded-lg p-3 text-sm outline-none mb-4 ${isDarkMode ? 'bg-slate-950 border-white/10 text-slate-200 focus:border-teal-500' : 'bg-white border-slate-200 text-slate-800 focus:border-teal-600'}`} placeholder="Provide specific context to Broccolini..." value={customThoughts} onChange={(e) => setCustomThoughts(e.target.value)} />
                  <div className="flex justify-end gap-3"><button onClick={() => { setIsRefining(false); setCustomThoughts(""); }} className="text-xs font-bold uppercase text-slate-400">Cancel</button><button onClick={handleRefineOptions} className="bg-teal-500 text-slate-900 px-4 py-2 rounded-lg text-xs font-bold">RECOOK ✨</button></div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {gameState.currentQuestion.options.map((opt, idx) => {
                    const isRecommended = gameState.currentQuestion?.recommendedIndex === idx;
                    return (
                      <button key={idx} disabled={isTransitioning} onClick={() => handleDecision(opt.value, opt.suggestedRationale)} className={`flex flex-col text-left p-4 rounded-xl transition-all group relative ${isDarkMode ? 'bg-slate-800/50 hover:bg-slate-800' : 'bg-white hover:bg-slate-50 shadow-sm'} ${isRecommended ? 'ring-2 ring-teal-500' : 'border border-transparent'}`}>
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
               <div className="flex justify-between items-center mb-2"><h3 className="text-xl font-bold">Sous Chef's Suggestion</h3></div>
               <p className="text-xs text-slate-500 mb-4 italic">Confirm or edit Broccolini's suggested rationale for this architectural choice.</p>
               <textarea className={`w-full h-32 border rounded-xl p-4 outline-none transition-colors mb-4 ${isDarkMode ? 'bg-slate-950 border-white/10 text-slate-200 focus:border-teal-500' : 'bg-white border-slate-200 text-slate-800 focus:border-teal-600'}`} placeholder="Why is this the correct technical choice for Big Q?" value={rationaleText} onChange={(e) => setRationaleText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && submitRationale(rationaleText)} />
               <div className="flex justify-end gap-3"><button onClick={() => { setIsCapturingRationale(false); setNextQuestionBuffer(null); }} className="px-4 py-2 text-xs font-bold uppercase text-slate-400">Cancel</button><button onClick={() => submitRationale(rationaleText)} className="bg-yellow-500 text-slate-900 px-6 py-2 rounded-lg font-bold shadow-lg shadow-yellow-500/20 active:scale-95 transition-all">LOG DECISION</button></div>
            </div>
          )}

          {gameState.isCompleted && deliverables && (
            <div className="space-y-6 pb-20 animate-in fade-in duration-1000">
               <div className={`glass-panel rounded-2xl p-8 border-2 border-teal-500 shadow-2xl ${isDarkMode ? 'bg-teal-500/5' : 'bg-white'}`}>
                  <h2 className="pixel-font text-xl mb-4 text-teal-400">MISSION COMPLETE</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                     <div className="bg-slate-950 p-4 rounded-xl border border-white/10"><h4 className="text-[10px] text-teal-400 font-bold uppercase mb-1">Final Score</h4><p className="text-2xl font-mono">{gameState.points} PTS</p></div>
                     <div className="bg-slate-950 p-4 rounded-xl border border-white/10"><h4 className="text-[10px] text-teal-400 font-bold uppercase mb-1">Kitchen Status</h4><p className="text-xl font-bold uppercase">{gameState.kitchenMeter}</p></div>
                  </div>
                  <div className="bg-yellow-500/10 p-6 rounded-xl border border-yellow-500/30 mb-8 flex flex-col md:flex-row items-center gap-6">
                    <div className="text-3xl">📂</div>
                    <div className="flex-1">
                       <h3 className="font-bold text-yellow-500 text-sm uppercase tracking-wider mb-1">Package & Deliver</h3>
                       <p className="text-xs text-slate-400 mb-4">Broccolini has finalized the assets. Download below or view the delivery folder.</p>
                       <div className="flex flex-wrap gap-3">
                          <button onClick={handleDownloadPackage} className="bg-yellow-500 text-slate-950 px-4 py-2 rounded-lg text-xs font-bold">DOWNLOAD PACKAGE (.JSON)</button>
                          <a href={DRIVE_FOLDER_LINK} target="_blank" rel="noopener noreferrer" className="bg-slate-800 border border-white/10 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2">OPEN DELIVERY FOLDER</a>
                       </div>
                    </div>
                  </div>
               </div>
               <button onClick={() => window.location.reload()} className="w-full bg-slate-800 hover:bg-slate-700 py-4 rounded-xl font-bold tracking-widest border border-white/10">START NEW QUEST</button>
            </div>
          )}
        </div>
        <StatsPanel state={gameState} />
      </main>
    </div>
  );
};

export default App;

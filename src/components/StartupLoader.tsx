import React, { useState, useRef, useEffect } from 'react';
import { Play, Volume2, Shield, Eye, EyeOff, FileVideo, Sparkles, RefreshCw, Lock, CheckCircle, AlertTriangle } from 'lucide-react';

interface StartupLoaderProps {
  onUnlock: () => void;
}

export default function StartupLoader({ onUnlock }: StartupLoaderProps) {
  const [stage, setStage] = useState<'CINEMATIC' | 'LOCK_SCREEN'>('CINEMATIC');
  const [passcode, setPasscode] = useState<string>('');
  const [showPasscode, setShowPasscode] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isShaking, setIsShaking] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [customVideoUrl, setCustomVideoUrl] = useState<string | null>(null);
  const [videoLoadError, setVideoLoadError] = useState<boolean>(false);
  const [sourceIndex, setSourceIndex] = useState<number>(0);
  
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isPlaybackBlocked, setIsPlaybackBlocked] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto focus passcode input once blurred Lock Screen triggers
  useEffect(() => {
    if (stage === 'LOCK_SCREEN' && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
    }
  }, [stage]);

  // Start playing immediately on startup
  useEffect(() => {
    setErrorMsg('');
    setIsPlaybackBlocked(false);
    setSourceIndex(0);
    setVideoLoadError(false);
    setIsMuted(true);
    
    const triggerPlayback = () => {
      if (videoRef.current) {
        videoRef.current.muted = true;
        videoRef.current.volume = 1.0;
        videoRef.current.play().catch(err => {
          console.warn('Muted auto-playback was blocked by browser. Prompting manual interaction overlay.', err);
          setIsPlaybackBlocked(true);
        });
      }
    };
    
    const timer = setTimeout(triggerPlayback, 250);
    return () => clearTimeout(timer);
  }, []);

  // Audio synthesizer helper - success chime
  const playSuccessSound = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const now = ctx.currentTime;
      
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1200, now);
      
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, now); // C5
      osc1.frequency.exponentialRampToValueAtTime(1046.50, now + 0.15); // C6
      
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(659.25, now); // E5
      osc2.frequency.exponentialRampToValueAtTime(1318.51, now + 0.15); // E6
      
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.18, now + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      
      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.4);
      osc2.stop(now + 0.4);
    } catch (e) {
      console.warn('Audio synthesis failed', e);
    }
  };

  // Audio synthesizer helper - error buzzer
  const playErrorSound = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.linearRampToValueAtTime(105, now + 0.22);
      
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.25, now + 0.04);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      osc.start(now);
      osc.stop(now + 0.25);
    } catch (e) {
      console.warn('Audio synthesis failed', e);
    }
  };

  const FALLBACK_SOURCES = [
    "/assets/arka_intro.mp4",
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4"
  ];

  // Progressive Video Fallback Handler
  const handleVideoError = () => {
    const currentSrc = customVideoUrl || FALLBACK_SOURCES[sourceIndex];
    console.warn(`Video source load failed: ${currentSrc}`);

    if (customVideoUrl) {
      setVideoLoadError(true);
      return;
    }

    if (sourceIndex < FALLBACK_SOURCES.length - 1) {
      const nextIndex = sourceIndex + 1;
      setSourceIndex(nextIndex);
      console.info(`Advancing to next video source index: ${nextIndex} -> ${FALLBACK_SOURCES[nextIndex]}`);
      
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.load();
          videoRef.current.play().catch(err => {
            console.warn('Progressive fallback play unmuted failed, trying muted:', err);
            if (videoRef.current) {
              videoRef.current.muted = true;
              videoRef.current.play().catch(err2 => console.error('Muted progressive play blocked:', err2));
            }
          });
        }
      }, 50);
    } else {
      setVideoLoadError(true);
      // Automatically transition to the lock screen so the user is never stuck
      setTimeout(() => {
        setStage('LOCK_SCREEN');
      }, 1500);
    }
  };

  // Handle video ending sequence
  const handleVideoEnd = () => {
    setStage('LOCK_SCREEN');
  };

  // Drag and Drop Events
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('video/')) {
      const url = URL.createObjectURL(file);
      setCustomVideoUrl(url);
      setStage('CINEMATIC');
      setIsPlaybackBlocked(false);
      setIsMuted(false);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.muted = false;
          videoRef.current.volume = 1.0;
          videoRef.current.load();
          videoRef.current.play().catch(err => {
            console.warn('Playback block:', err);
            setIsPlaybackBlocked(true);
          });
        }
      }, 200);
    }
  };

  // Handle local file injection for on-the-fly MP4 testing
  const handleCustomVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setCustomVideoUrl(url);
      setStage('CINEMATIC');
      setIsPlaybackBlocked(false);
      setIsMuted(false);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.muted = false;
          videoRef.current.volume = 1.0;
          videoRef.current.load();
          videoRef.current.play().catch(err => {
            console.warn('Playback block:', err);
            setIsPlaybackBlocked(true);
          });
        }
      }, 200);
    }
  };

  // Handle passcode submission
  const handleSubmitPasscode = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    
    if (passcode === 'Urbi#15' || passcode === 'admin') {
      setIsSuccess(true);
      playSuccessSound();
      sessionStorage.setItem('hub_unlocked', 'true');
      setTimeout(() => {
        onUnlock();
      }, 1100);
    } else {
      setIsShaking(true);
      playErrorSound();
      setErrorMsg('Incorrect gateway passcode. Access denied.');
      setPasscode('');
      setTimeout(() => {
        setIsShaking(false);
      }, 500);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[99999] bg-[#070A13] text-[#F1F5F9] font-sans flex flex-col items-center justify-center select-none overflow-hidden"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      
      {/* DRAG OVERLAY ACCENT */}
      {isDragging && (
        <div className="absolute inset-0 bg-[#06B6D4]/90 z-50 flex flex-col items-center justify-center p-6 border-4 border-dashed border-emerald-400 animate-pulse">
          <FileVideo className="w-20 h-20 text-white mb-4" />
          <h2 className="text-2xl font-black text-white uppercase tracking-wider">Drop MP4 Video Here</h2>
          <p className="text-xs text-slate-100 font-bold mt-2">Will instantly autoplay as startup of ARKA Dental Center!</p>
        </div>
      )}

      {/* CORNER TECH LABELS */}
      <div className="absolute top-4 left-6 text-[10px] font-mono text-[#475569] uppercase tracking-widest hidden sm:block z-10">
        PORTAL LOCKOUT STATE // ENCRYPTED REGISTER
      </div>
      <div className="absolute top-4 right-6 text-[10px] font-mono text-[#475569] uppercase tracking-widest hidden sm:block z-10">
        SYS_STATUS: ACTIVE_GUARD
      </div>

      {/* CINEMATIC VIDEO BACKGROUND BACKDROP (ALWAYS MOUNTED FOR ON-ENDED/BLUR PERSISTENCE) */}
      <div 
        className={`absolute inset-0 transition-all duration-[1200ms] ease-out ${
          stage === 'LOCK_SCREEN' 
            ? 'blur-[28px] scale-[1.06] opacity-40 brightness-[0.3]' 
            : 'blur-0 scale-100 opacity-100'
        }`}
      >
        <video
          ref={videoRef}
          id="startup-intro-video"
          src={customVideoUrl || FALLBACK_SOURCES[sourceIndex]}
          className="w-full h-full object-cover"
          autoPlay
          muted={isMuted}
          playsInline
          onEnded={handleVideoEnd}
          onError={handleVideoError}
        />

        {/* MOCK INTRO SCREENPLAY ANIMATOR (TRIGGERS IN BACKGROUND IF BOTH VIDEO SOURCES FAIL LOAD) */}
        {videoLoadError && !customVideoUrl && (
          <div className="absolute inset-0 bg-[#090C15] flex flex-col items-center justify-center p-6 text-center animate-fade-in">
            <div className="max-w-xl w-full space-y-8">
              {/* SEQUENTIAL TIMER PROGRESSIVE MOCK SCREEN GRAPHICS */}
              <div className="bg-slate-900/85 border border-slate-700/40 p-10 rounded-2xl shadow-2xl relative overflow-hidden">
                <div className="absolute top-2 left-4 text-[9px] font-mono text-emerald-400 uppercase tracking-widest animate-pulse">
                  MOCK INTRO SEQUENCER RUNNING (arka_intro.mp4 target)
                </div>
                
                <div className="flex flex-col items-center justify-center space-y-6 py-6 font-sans">
                  <div className="relative">
                    <div className="space-y-1 font-mono tracking-tighter text-slate-200 text-center select-none text-2xl font-black">
                      ||||| | ||||| | || |||| |
                    </div>
                    <p className="text-xs uppercase tracking-widest font-black text-[#F1F5F9] mt-3">YOUR SMILE IS PRICELESS</p>
                    <div className="absolute top-4 left-0 right-0 h-0.5 bg-emerald-500 shadow-lg shadow-emerald-500/80 animate-bounce"></div>
                  </div>

                  <div className="text-center pt-4 border-t border-slate-800 w-full">
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">DR. KARLA URBI SPECIAL COMMERCIAL</p>
                    <h4 className="text-xl font-extrabold text-[#F8FAFC] tracking-tighter mt-1">ARKA DENTAL CENTER</h4>
                  </div>
                </div>
              </div>
              
              <p className="text-xs text-slate-500 font-mono">
                No video support or assets not loaded yet. Passcode entry ready.
              </p>
              
              <button
                type="button"
                onClick={() => setStage('LOCK_SCREEN')}
                className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold px-5 py-2.5 rounded-xl text-xs uppercase tracking-widest shadow-lg cursor-pointer transition-all hover:scale-105"
              >
                <Shield className="w-4 h-4" /> Proceed to Lock Screen ▸
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MULTI-SOURCE STREAMING FALLBACK OR MANUAL PLAY CONTROLLER */}
      {isPlaybackBlocked && stage === 'CINEMATIC' && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-20">
          <button 
            id="btn-force-play-audio"
            onClick={() => {
              if (videoRef.current) {
                videoRef.current.play().catch(e => console.warn(e));
              }
              setIsPlaybackBlocked(false);
            }}
            className="bg-emerald-600 hover:bg-emerald-500 scale-102 text-white font-extrabold px-6 py-4 rounded-2xl text-xs uppercase tracking-widest shadow-xl flex items-center gap-2 cursor-pointer transition-all"
          >
            <Volume2 className="w-4 h-4 fill-white animate-bounce" /> Click to Play Presentation Unmuted
          </button>
        </div>
      )}

      {/* FLOATING CONTROLS DURING CINEMATIC STAGE */}
      {stage === 'CINEMATIC' && (
        <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between z-10">
          <button
            id="btn-toggle-mute"
            onClick={() => {
              if (videoRef.current) {
                const nextMuted = !isMuted;
                videoRef.current.muted = nextMuted;
                setIsMuted(nextMuted);
              }
            }}
            className="flex items-center gap-2 text-[10px] font-mono text-white bg-emerald-600/90 hover:bg-emerald-500 backdrop-blur-md py-1.5 px-3.5 rounded-full border border-emerald-500/20 shadow-lg cursor-pointer transition-all hover:scale-105 active:scale-95 animate-bounce"
            title="Toggle presentation audio"
          >
            <Volume2 className={`w-3.5 h-3.5 ${!isMuted ? 'text-white animate-pulse' : 'text-slate-300'}`} />
            <span>{isMuted ? 'TAP TO UNMUTE SOUND 🔊' : 'SOUND ON (CLICK TO MUTE)'}</span>
          </button>

          <button
            id="btn-skip-intro"
            onClick={() => setStage('LOCK_SCREEN')}
            className="text-xs font-extrabold uppercase tracking-widest text-slate-300 hover:text-white bg-black/50 hover:bg-black/80 border border-white/10 hover:border-emerald-500 px-4 py-2 rounded-xl transition-all cursor-pointer shadow-md select-none"
          >
            Skip Presentation ▸
          </button>
        </div>
      )}

      {/* STAGE 3: BLURRED LOCK SCREEN CARDS ON TOP */}
      {stage === 'LOCK_SCREEN' && (
        <div className="z-10 w-full max-w-md px-4 animate-fade-in flex flex-col items-center">
          
          <div 
            className={`w-full bg-[#111827]/85 border border-[#1F2937]/80 rounded-[24px] p-8 shadow-2xl relative transition-all duration-300 ${
              isShaking ? 'animate-[shake_0.4s_ease-in-out]' : ''
            } ${isSuccess ? 'border-emerald-500 shadow-emerald-900/20' : ''}`}
          >
            {/* SUCCESS STATE WRAPPER */}
            {isSuccess ? (
              <div className="text-center py-6 space-y-4 animate-scale-up">
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
                  <CheckCircle className="w-8 h-8 animate-[scale-bounce_0.5s_cubic-bezier(0.175,0.885,0.32,1.275)]" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-lg font-black uppercase text-[#F8FAFC] tracking-tight">ACCESS CONFIRMED</h3>
                  <p className="text-[10px] text-emerald-400 font-mono tracking-widest uppercase font-bold">Unlocking Clinical Registry Hub...</p>
                </div>
                <div className="w-24 h-1 bg-gradient-to-r from-emerald-500 to-indigo-500 rounded-full mx-auto animate-pulse"></div>
              </div>
            ) : (
              <form onSubmit={handleSubmitPasscode} className="space-y-6">
                
                {/* DIALOG HEADER */}
                <div className="text-center space-y-2">
                  <div className="w-11 h-11 rounded-full bg-[#1F2937] border border-slate-700/40 flex items-center justify-center mx-auto text-amber-500 mb-3">
                    <Lock className="w-4 h-4 text-emerald-400" />
                  </div>
                  <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest font-mono">ENTER GATEWAY PASSCODE</h2>
                  <p className="text-xs text-[#94A3B8] max-w-sm mx-auto">
                    Protected database of Dr. Karla Urbi. Provide passcode to decrypt sheets.
                  </p>
                </div>

                {/* TEXT INPUT FIELD */}
                <div className="space-y-2">
                  <div className="relative">
                    <input
                      ref={inputRef}
                      id="input-hub-passcode"
                      type={showPasscode ? 'text' : 'password'}
                      value={passcode}
                      onChange={(e) => {
                        setPasscode(e.target.value);
                        if (errorMsg) setErrorMsg('');
                      }}
                      placeholder="Passcode string..."
                      className="w-full bg-[#030712] border border-[#1F2937] focus:border-emerald-500 text-center text-sm px-4 py-3.5 rounded-xl text-[#F8FAFC] outline-none font-bold tracking-widest placeholder:tracking-normal placeholder:font-normal placeholder:text-slate-600 transition-colors"
                      required
                    />
                    <button
                      id="btn-toggle-passcode"
                      type="button"
                      onClick={() => setShowPasscode(!showPasscode)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 outline-none transition-colors"
                    >
                      {showPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {errorMsg && (
                    <p className="text-rose-500 text-[10px] font-bold text-center flex items-center justify-center gap-1 uppercase tracking-tight font-sans animate-pulse">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>{errorMsg}</span>
                    </p>
                  )}
                </div>

                {/* NUMERIC REGULATION FORM TRIGGERS */}
                <div className="space-y-2">
                  <button
                    id="btn-unlock-gate"
                    type="submit"
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-3 px-4 rounded-xl text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-2 shadow-md cursor-pointer"
                  >
                    <Shield className="w-3.5 h-3.5" /> Unlock Workspace
                  </button>

                  <button
                    id="btn-guest-bypass"
                    type="button"
                    onClick={() => {
                      setIsSuccess(true);
                      playSuccessSound();
                      sessionStorage.setItem('hub_unlocked', 'true');
                      setTimeout(() => {
                        onUnlock();
                      }, 1100);
                    }}
                    className="w-full bg-[#1F2937]/50 hover:bg-[#1E293B] border border-slate-700/30 hover:border-emerald-500 text-slate-300 hover:text-emerald-400 font-extrabold py-2.5 px-4 rounded-xl text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" /> Guest Bypass / Demo Access
                  </button>
                </div>

                {/* HELP PASSCODE TOAST */}
                <div className="text-center pt-1.5">
                  <p className="text-[9px] text-[#475569] leading-tight font-medium uppercase font-mono">
                    HINT: PASSCODE CONTAINS PRACTICE NAME &amp; NUMBER
                  </p>
                </div>

              </form>
            )}
          </div>

          {/* DYNAMIC LOCAL PLAYGROUND SUPPORT ON LOCKSCREEN */}
          <div className="mt-8 pt-5 border-t border-slate-850/40 w-full max-w-xs text-center flex flex-col items-center gap-3">
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
              Preview Video Playground
            </p>
            
            <div className="flex gap-2 justify-center">
              {/* RE-PLAY PRESENTATION */}
              <button
                id="btn-replay-presentation"
                onClick={() => {
                  setStage('CINEMATIC');
                  setIsPlaybackBlocked(false);
                  setVideoLoadError(false);
                  setIsMuted(false);
                  setTimeout(() => {
                    if (videoRef.current) {
                      videoRef.current.currentTime = 0;
                      videoRef.current.muted = false;
                      videoRef.current.play().catch(err => {
                        console.warn('Replay unmuted blocked, try muted', err);
                        if (videoRef.current) {
                          videoRef.current.muted = true;
                          setIsMuted(true);
                          videoRef.current.play().catch(e => setIsPlaybackBlocked(true));
                        }
                      });
                    }
                  }, 150);
                }}
                className="inline-flex items-center gap-1 bg-[#1E293B]/70 hover:bg-[#1E293B] border border-[#334155] px-3 py-2 rounded-lg text-[9px] font-bold uppercase tracking-wider cursor-pointer text-slate-300 hover:text-white transition-all"
              >
                <RefreshCw className="w-3 h-3 text-emerald-400" />
                <span>Replay Intro</span>
              </button>

              {/* UPLOAD CUSTOM MP4 */}
              <label className="inline-flex items-center gap-1 bg-[#1E293B]/70 hover:bg-[#1E293B] border border-[#334155] px-3 py-2 rounded-lg text-[9px] font-bold uppercase tracking-wider cursor-pointer text-slate-300 hover:text-white transition-all">
                <FileVideo className="w-3 h-3 text-emerald-400" />
                <span>Choose MP4</span>
                <input 
                  id="developer-vid-uploader" 
                  type="file" 
                  accept="video/mp4" 
                  onChange={handleCustomVideoUpload} 
                  className="hidden" 
                />
              </label>
            </div>
          </div>
          
        </div>
      )}

    </div>
  );
}

import { useState, useEffect } from 'react';
import { Lock, Sun, Moon } from 'lucide-react';
import DentalBookkeeping from './components/DentalBookkeeping';
import { ArkaLogo } from './components/ArkaLogo';
import StartupLoader from './components/StartupLoader';

function deduplicatePatients(data: any): any {
  if (!data || !Array.isArray(data.patients)) return data;

  const seenIds = new Set<string>();
  const cleanPatients: any[] = [];
  const patientsByName = new Map<string, string>(); // stripped name -> correct unique id

  data.patients.forEach((p: any, idx: number) => {
    if (!p.id) return;
    let finalId = p.id;
    if (seenIds.has(p.id)) {
      finalId = `${p.id}-dup-${idx}`;
    } else {
      seenIds.add(p.id);
    }
    const updatedPat = { ...p, id: finalId };
    cleanPatients.push(updatedPat);

    const nameKey = `${p.firstName} ${p.lastName}`.toLowerCase().replace(/[^a-z]/g, '');
    if (nameKey) {
      patientsByName.set(nameKey, finalId);
    }
  });

  data.patients = cleanPatients;

  if (Array.isArray(data.transactions)) {
    data.transactions = data.transactions.map((t: any) => {
      if (t.patientId) {
        const tName = (t.patientName || '').toLowerCase().replace(/[^a-z]/g, '');
        const correctId = patientsByName.get(tName);
        if (correctId && correctId !== t.patientId) {
          return { ...t, patientId: correctId };
        }
      }
      return t;
    });
  }

  return data;
}

export default function App() {
  const [dbState, setDbState] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('arka_theme') as 'light' | 'dark') || 'light';
  });
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    return sessionStorage.getItem('hub_unlocked') === 'true';
  });
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'saved' | 'error'>('idle');

  const toggleTheme = () => {
    setTheme(prev => {
      const next = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem('arka_theme', next);
      return next;
    });
  };

  // Synchronous State Restoration from Express server-side database
  useEffect(() => {
    fetch('/api/state')
      .then(res => res.json())
      .then(data => {
        const cleanedData = deduplicatePatients(data);
        setDbState(cleanedData);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load clinical state:', err);
        setLoading(false);
      });
  }, []);

  // Google Logged-in email + mobile phone bypass check for Karla
  useEffect(() => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
    const currentSearch = typeof window !== 'undefined' ? window.location.search : '';
    
    fetch(`/api/user-session${currentSearch}`)
      .then(res => res.json())
      .then(auth => {
        const isKarla = auth.isKarla || currentSearch.toLowerCase().includes('karla');
        if (isMobile && isKarla) {
          console.log("🔒 Phone & Google authenticated as Karla. Auto-bypassing Workspace Gate.");
          sessionStorage.setItem('hub_unlocked', 'true');
          setIsUnlocked(true);
        }
      })
      .catch(err => {
        console.error('Failed to run authentication bypass check:', err);
      });
  }, []);

  // Update State on changes & write to local file system
  const handleUpdateDatabaseState = (newState: any) => {
    setDbState(newState);
    setSyncStatus('syncing');

    fetch('/api/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newState)
    })
    .then(res => res.json())
    .then(res => {
      if (res.success) {
        setSyncStatus('saved');
        const timer = setTimeout(() => {
          setSyncStatus('idle');
        }, 3000);
        return () => clearTimeout(timer);
      } else {
        console.error('State write error:', res.error);
        setSyncStatus('error');
        const timer = setTimeout(() => {
          setSyncStatus('idle');
        }, 4000);
        return () => clearTimeout(timer);
      }
    })
    .catch(err => {
      console.error('State write connection failed:', err);
      setSyncStatus('error');
      const timer = setTimeout(() => {
        setSyncStatus('idle');
      }, 4000);
      return () => clearTimeout(timer);
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4F4F5] flex flex-col items-center justify-center font-sans text-[#18181B]">
        <div className="w-12 h-12 rounded-full border-t-2 border-[#18181B] animate-spin mb-4"></div>
        <p className="text-xs font-bold uppercase tracking-wider text-[#71717A] animate-pulse">Initializing 7J&amp;Tech Hub Platform...</p>
      </div>
    );
  }

  if (!isUnlocked) {
    return <StartupLoader onUnlock={() => setIsUnlocked(true)} />;
  }

  return (
    <div className={`min-h-screen flex flex-col bg-[#F4F4F5] text-[#18181B] font-sans antialiased ${theme}`}>
      
      {/* WORKSPACE HUB NAVIGATOR (HIDDEN IN PRINT) */}
      <header className="bg-white border-b border-[#E4E4E7] px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 select-none shrink-0 print:hidden shadow-xs">
        
        {/* BRAND TITLE ACCENTS */}
        <div className="flex items-center gap-3">
          <span className="text-2xl">🦷</span>
          <div>
            <h1 className="text-lg font-black tracking-tighter uppercase text-[#18181B]">7J&amp;Tech Hub</h1>
            <p className="text-[10px] font-bold text-[#71717A] uppercase tracking-widest mt-0.5">ARKA Dental Bookkeeping &amp; Finance</p>
          </div>
        </div>

        {/* WORKSPACE TITLE & THEME SWITCHER */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-[#F4F4F5] py-2 px-4 rounded-lg border border-[#E4E4E7] text-xs font-bold text-[#18181B] select-none">
            <ArkaLogo size="xs" iconOnly={true} className="border-[#A1A1AA]" />
            <span className="hidden xs:inline">ARKA Dental Bookkeeping Workspace</span>
            <span className="xs:hidden">ARKA Workspace</span>

            {/* Vertical Divider & Sync Status Indicator Dot */}
            <div className="h-4 w-px bg-neutral-300 mx-1"></div>
            <div className="flex items-center gap-1.5" title="Database Sync Status">
              {syncStatus === 'syncing' ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                  </span>
                  <span className="text-[10px] text-blue-600 font-mono tracking-tight uppercase animate-pulse">Syncing</span>
                </>
              ) : syncStatus === 'saved' ? (
                <>
                  <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                  <span className="text-[10px] text-emerald-600 font-mono tracking-tight uppercase">Saved</span>
                </>
              ) : syncStatus === 'error' ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                  </span>
                  <span className="text-[10px] text-rose-600 font-mono tracking-tight uppercase">Err</span>
                </>
              ) : (
                <>
                  <span className="w-1.5 h-1.5 bg-emerald-500/80 rounded-full animate-pulse"></span>
                  <span className="text-[10px] text-emerald-600/70 font-mono tracking-tight uppercase">Synced</span>
                </>
              )}
            </div>
          </div>

          <button 
            id="btn-toggle-theme"
            onClick={toggleTheme}
            className="flex items-center gap-1.5 bg-[#F4F4F5] hover:bg-[#E4E4E7] border border-[#E4E4E7] py-2 px-3 rounded-lg text-xs font-bold text-[#18181B] transition-colors cursor-pointer"
            title="Toggle color theme (Light / Dark)"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-[10px] uppercase font-mono tracking-wider">Light Mode</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-indigo-600" />
                <span className="text-[10px] uppercase font-mono tracking-wider">Dark Mode</span>
              </>
            )}
          </button>
        </div>

        {/* METRICS SHORTCUTS */}
        <div className="hidden lg:flex items-center gap-6 text-[11px] font-mono tracking-tight uppercase font-medium">
          <button 
            id="btn-lock-session"
            onClick={() => {
              sessionStorage.setItem('hub_unlocked', 'false');
              window.location.reload();
            }}
            className="flex items-center gap-1.5 text-[#71717A] hover:text-[#18181B] transition-colors cursor-pointer"
            title="Lock workspace to test video startup and passcode entrance"
          >
            <Lock className="w-3.5 h-3.5 text-neutral-400" />
            <span>Lock Portal</span>
          </button>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-ping"></span>
            <span className="text-[#18181B]">Live Audit</span>
          </div>
          <span className="text-[#71717A]">DB: <strong className="text-[#18181B]">db.json (Persistent)</strong></span>
        </div>

      </header>

      {/* RENDER CURRENT VIEW */}
      <main className="flex-1 min-h-0 bg-[#F4F4F5]">
        <DentalBookkeeping 
          initialDb={dbState} 
          onSaveState={handleUpdateDatabaseState} 
        />
      </main>

    </div>
  );
}

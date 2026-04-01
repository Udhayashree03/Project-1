import React, { useState, useEffect, useRef } from 'react';
import { Zap, Home, DollarSign, Activity, Settings, Power, CheckCircle2, XCircle, AlertCircle, Moon, Info, Phone, Mail, ShieldAlert, Check, Globe, MapPin, Bell, Navigation } from 'lucide-react';

type Screen = 'splash' | 'home' | 'fare' | 'status' | 'settings';

type LogEntry = {
  id: string;
  time: Date;
  isSystem: boolean;
  message?: string;
  appName?: string;
  fare?: number;
  status?: 'accepted' | 'rejected';
  reason?: string;
};

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('splash');
  const [isActive, setIsActive] = useState(false);
  
  // Local Storage (Simulating SQLite local database)
  const [minFare, setMinFare] = useState<number>(() => {
    const saved = localStorage.getItem('instant_accepter_minFare');
    return saved ? parseInt(saved, 10) : 350;
  });
  const [maxFare, setMaxFare] = useState<number>(() => {
    const saved = localStorage.getItem('instant_accepter_maxFare');
    return saved ? parseInt(saved, 10) : 1000;
  });
  const [permissionsGranted, setPermissionsGranted] = useState<boolean>(() => {
    return localStorage.getItem('instant_accepter_permissions') === 'true';
  });
  const [language, setLanguage] = useState('en');

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'info' | 'error' }>({ show: false, message: '', type: 'info' });
  const logsEndRef = useRef<HTMLDivElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Persist settings to Local Storage
  useEffect(() => {
    localStorage.setItem('instant_accepter_minFare', minFare.toString());
    localStorage.setItem('instant_accepter_maxFare', maxFare.toString());
    localStorage.setItem('instant_accepter_permissions', permissionsGranted.toString());
  }, [minFare, maxFare, permissionsGranted]);

  // Splash screen timer
  useEffect(() => {
    if (currentScreen === 'splash') {
      const timer = setTimeout(() => {
        setCurrentScreen('home');
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [currentScreen]);

  // Auto-scroll logs
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, currentScreen]);

  // Toast Timer
  useEffect(() => {
    if (toast.show) {
      const timer = setTimeout(() => setToast({ ...toast, show: false }), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast.show]);

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'info') => {
    setToast({ show: true, message, type });
  };

  const initAudio = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  };

  const playSound = (type: 'success' | 'reject') => {
    if (!audioCtxRef.current) return;
    try {
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'success') {
        // Pleasant high-pitched ding
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      } else {
        // Low-pitched buzz/boop
        osc.type = 'square';
        osc.frequency.setValueAtTime(300, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
      }
    } catch (e) {
      console.error("Audio play failed", e);
    }
  };

  const addSystemLog = (message: string) => {
    setLogs(prev => [...prev, { id: Math.random().toString(36).substr(2, 9), time: new Date(), isSystem: true, message }]);
  };

  const addRideLog = (appName: string, fare: number, status: 'accepted' | 'rejected', reason: string) => {
    setLogs(prev => [...prev, { id: Math.random().toString(36).substr(2, 9), time: new Date(), isSystem: false, appName, fare, status, reason }]);
  };

  // Ride simulation engine (FCM & REST API logic)
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isActive) {
      addSystemLog('Background service started. Listening for FCM pushes...');
      interval = setInterval(() => {
        const randomFare = Math.floor(Math.random() * 1200) + 100; // 100 to 1300
        const appName = ['Uber', 'Ola', 'Rapido'][Math.floor(Math.random() * 3)];
        
        if (randomFare >= minFare && randomFare <= maxFare) {
          playSound('success');
          addRideLog(appName, randomFare, 'accepted', 'API Accept Sent');
        } else {
          playSound('reject');
          addRideLog(appName, randomFare, 'rejected', randomFare < minFare ? 'Below Min Fare' : 'Above Max Fare');
        }
      }, 4000);
    } else {
      if (logs.length > 0 && !logs[logs.length - 1].isSystem) {
        addSystemLog('Background service stopped.');
      }
    }
    return () => clearInterval(interval);
  }, [isActive, minFare, maxFare]);

  const toggleActive = () => {
    if (!permissionsGranted) {
      showToast("Please grant necessary permissions in Settings first.", "error");
      return;
    }
    if (minFare > maxFare) {
      showToast("Minimum fare cannot be greater than maximum fare.", "error");
      return;
    }
    
    initAudio(); // Initialize audio context on user interaction
    
    const newActiveState = !isActive;
    setIsActive(newActiveState);
    
    // Notification System: Alerts when auto-accept is ON/OFF
    if (newActiveState) {
      showToast("Auto-Accept ON: Running in Background", "success");
    } else {
      showToast("Auto-Accept OFF: Service Stopped", "info");
    }
  };

  if (currentScreen === 'splash') {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center max-w-md mx-auto relative shadow-2xl overflow-hidden animate-in fade-in duration-1000">
        <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(250,204,21,0.4)]">
          <Zap size={64} className="text-yellow-400" fill="currentColor" />
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight text-white">Instant Accepter</h1>
        <p className="text-gray-500 mt-4 animate-pulse">Initializing engine...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans flex flex-col max-w-md mx-auto relative shadow-2xl overflow-hidden">
      {/* Top Header */}
      <header className="flex items-center justify-center p-5 border-b border-gray-900 bg-black z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
            <Zap size={16} className="text-yellow-400" fill="currentColor" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Instant Accepter</h1>
        </div>
      </header>

      {/* Toast Notification System */}
      {toast.show && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-4 fade-in duration-300">
          <div className={`px-4 py-3 rounded-full shadow-lg flex items-center gap-2 text-sm font-bold ${
            toast.type === 'success' ? 'bg-green-500 text-white' : 
            toast.type === 'error' ? 'bg-red-500 text-white' : 
            'bg-gray-800 text-white border border-gray-700'
          }`}>
            {toast.type === 'success' && <CheckCircle2 size={16} />}
            {toast.type === 'error' && <AlertCircle size={16} />}
            {toast.type === 'info' && <Info size={16} />}
            {toast.message}
          </div>
        </div>
      )}

      {/* Permissions Overlay (Simulating Android Permissions Flow) */}
      {!permissionsGranted && currentScreen !== 'settings' && (
        <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 animate-in fade-in">
          <div className="bg-gray-900 p-8 rounded-3xl border border-gray-800 max-w-sm w-full space-y-6 shadow-2xl">
            <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShieldAlert size={32} className="text-yellow-500" />
            </div>
            <h2 className="text-2xl font-bold text-center text-white">Permissions Required</h2>
            <p className="text-gray-400 text-sm text-center">
              To receive background bookings and maintain GPS tracking, Instant Accepter needs the following permissions:
            </p>
            <ul className="space-y-3 text-sm text-gray-300">
              <li className="flex items-start gap-3">
                <MapPin size={20} className="text-gray-600 shrink-0" />
                <span><strong>Background Location:</strong> For continuous GPS tracking and navigation.</span>
              </li>
              <li className="flex items-start gap-3">
                <Bell size={20} className="text-gray-600 shrink-0" />
                <span><strong>Push Notifications:</strong> To receive FCM/APNs booking requests in the background.</span>
              </li>
            </ul>
            <button 
              onClick={() => {
                setPermissionsGranted(true);
                showToast("Permissions granted successfully", "success");
              }}
              className="w-full bg-white text-black font-bold py-4 rounded-2xl hover:bg-gray-200 transition-colors mt-4"
            >
              Grant Permissions
            </button>
            <p className="text-xs text-center text-gray-600 mt-4">
              Data Privacy: All logic runs locally on your device. No driver data is stored externally.
            </p>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto pb-20 custom-scrollbar">
        
        {/* HOME SCREEN */}
        {currentScreen === 'home' && (
          <div className="relative flex flex-col items-center justify-center h-full p-6 space-y-12 animate-in fade-in slide-in-from-bottom-4 overflow-hidden">
            {/* Map Background Placeholder */}
            <div className="absolute inset-0 z-0 opacity-10 pointer-events-none flex items-center justify-center">
              <div className="absolute w-[200%] h-[200%] border-[1px] border-gray-800 rounded-full animate-[ping_10s_cubic-bezier(0,0,0.2,1)_infinite]" />
              <div className="absolute w-[150%] h-[150%] border-[1px] border-gray-800 rounded-full animate-[ping_8s_cubic-bezier(0,0,0.2,1)_infinite]" />
              <div className="absolute w-[100%] h-[100%] border-[1px] border-gray-800 rounded-full animate-[ping_6s_cubic-bezier(0,0,0.2,1)_infinite]" />
              <Navigation size={120} className="text-blue-500 opacity-30" />
            </div>
            
            <div className="relative z-10 text-center space-y-2">
              <p className="text-gray-400 uppercase tracking-widest text-sm font-semibold">Target Fare Range</p>
              <div className="text-5xl font-black text-white tracking-tighter bg-gray-900 py-4 px-8 rounded-3xl border border-gray-800 shadow-inner">
                ₹{minFare}–₹{maxFare}
              </div>
            </div>

            <div className="flex flex-col items-center space-y-6">
              <button
                onClick={toggleActive}
                className={`relative w-48 h-48 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl ${
                  isActive 
                    ? 'bg-red-500 hover:bg-red-600 shadow-red-500/40 scale-105' 
                    : 'bg-green-500 hover:bg-green-600 shadow-green-500/40'
                }`}
              >
                <div className="absolute inset-0 rounded-full border-4 border-white/20 m-2"></div>
                <div className="flex flex-col items-center">
                  <Power size={56} className="text-white mb-2" />
                  <span className="text-xl font-bold text-white tracking-widest">
                    {isActive ? 'STOP' : 'START'}
                  </span>
                </div>
              </button>
              <p className={`text-lg font-medium ${isActive ? 'text-green-400 animate-pulse' : 'text-gray-500'}`}>
                {isActive ? 'Auto-Click is ON' : 'Auto-Click is OFF'}
              </p>
            </div>
          </div>
        )}

        {/* FARE SELECTION SCREEN */}
        {currentScreen === 'fare' && (
          <div className="p-6 space-y-8 animate-in fade-in slide-in-from-right-4">
            <div className="space-y-2">
              <h2 className="text-3xl font-bold">Fare Selection</h2>
              <p className="text-gray-400">Set your minimum and maximum acceptable ride fares.</p>
            </div>

            <div className="space-y-6 bg-gray-900 p-6 rounded-3xl border border-gray-800">
              <div className="space-y-3">
                <label className="text-sm text-gray-400 uppercase tracking-wider font-semibold">Minimum Fare (₹)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-xl">₹</span>
                  <input 
                    type="number" 
                    value={minFare} 
                    onChange={(e) => setMinFare(parseInt(e.target.value) || 0)}
                    disabled={isActive}
                    className="w-full bg-black border border-gray-700 rounded-2xl py-4 pl-10 pr-4 text-2xl font-bold text-white focus:border-green-500 focus:ring-2 focus:ring-green-500/50 outline-none transition-all disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm text-gray-400 uppercase tracking-wider font-semibold">Maximum Fare (₹)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-xl">₹</span>
                  <input 
                    type="number" 
                    value={maxFare} 
                    onChange={(e) => setMaxFare(parseInt(e.target.value) || 0)}
                    disabled={isActive}
                    className="w-full bg-black border border-gray-700 rounded-2xl py-4 pl-10 pr-4 text-2xl font-bold text-white focus:border-green-500 focus:ring-2 focus:ring-green-500/50 outline-none transition-all disabled:opacity-50"
                  />
                </div>
              </div>

              {minFare > maxFare && (
                <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-xl flex items-start gap-3">
                  <AlertCircle size={20} className="shrink-0 mt-0.5" />
                  <p className="text-sm">Minimum fare cannot be greater than maximum fare. Please adjust your range.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STATUS SCREEN */}
        {currentScreen === 'status' && (
          <div className="p-6 flex flex-col h-full animate-in fade-in slide-in-from-right-4">
            <div className="space-y-2 mb-6">
              <h2 className="text-3xl font-bold">System Status</h2>
              <div className="flex items-center gap-3 mt-2">
                <div className={`w-4 h-4 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-600'}`}></div>
                <span className={`text-xl font-semibold ${isActive ? 'text-green-400' : 'text-gray-400'}`}>
                  {isActive ? 'Running in Background' : 'Stopped'}
                </span>
              </div>
            </div>

            <div className="flex-1 bg-gray-900 rounded-3xl border border-gray-800 flex flex-col overflow-hidden">
              <div className="bg-black/50 p-4 border-b border-gray-800 flex justify-between items-center">
                <h3 className="font-semibold text-gray-300">Ride Acceptance Logs</h3>
                <span className="text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded-md">{logs.length} entries</span>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {logs.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-2">
                    <Activity size={32} className="opacity-20" />
                    <p>No activity recorded yet.</p>
                  </div>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} className="flex items-start gap-3 text-sm bg-black/40 p-3 rounded-xl border border-gray-800/50">
                      {log.isSystem ? (
                        <>
                          <span className="text-gray-500 text-xs mt-0.5 font-mono shrink-0">
                            {log.time.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' })}
                          </span>
                          <Info size={18} className="text-blue-500 shrink-0" />
                          <span className="leading-tight text-blue-100">{log.message}</span>
                        </>
                      ) : (
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-3">
                            {log.status === 'accepted' ? <CheckCircle2 size={24} className="text-green-500 shrink-0" /> : <XCircle size={24} className="text-red-500 shrink-0" />}
                            <div>
                              <p className="font-bold text-white">{log.appName} <span className="text-gray-500 font-mono text-xs ml-2">{log.time.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' })}</span></p>
                              <p className={`text-xs ${log.status === 'accepted' ? 'text-green-400' : 'text-red-400'}`}>{log.reason}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`font-black text-lg ${log.status === 'accepted' ? 'text-white' : 'text-gray-500 line-through'}`}>₹{log.fare}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
                <div ref={logsEndRef} />
              </div>
            </div>
          </div>
        )}

        {/* SETTINGS SCREEN */}
        {currentScreen === 'settings' && (
          <div className="p-6 space-y-8 animate-in fade-in slide-in-from-right-4">
            <div className="space-y-2">
              <h2 className="text-3xl font-bold">Settings</h2>
              <p className="text-gray-400">App configuration and support.</p>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider ml-2">Security & Permissions</h3>
              <div className="bg-gray-900 rounded-3xl border border-gray-800 overflow-hidden divide-y divide-gray-800">
                <div className="p-5 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center border border-gray-800">
                      <ShieldAlert size={20} className="text-yellow-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-white">System Permissions</p>
                      <p className="text-xs text-gray-400">Location & Notifications</p>
                    </div>
                  </div>
                  {permissionsGranted ? (
                    <div className="bg-green-500/20 text-green-400 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                      <Check size={14} /> GRANTED
                    </div>
                  ) : (
                    <button 
                      onClick={() => {
                        setPermissionsGranted(true);
                        showToast("Permissions granted successfully", "success");
                      }}
                      className="bg-yellow-500 text-black text-xs font-bold px-3 py-1 rounded-full hover:bg-yellow-400 transition-colors"
                    >
                      GRANT NOW
                    </button>
                  )}
                </div>
                <div className="bg-black/50 p-4 text-xs text-gray-500 flex gap-2">
                  <Info size={16} className="shrink-0" />
                  <p>Data Privacy: All logic runs locally on your device. No driver data is stored externally.</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider ml-2">Preferences</h3>
              <div className="bg-gray-900 rounded-3xl border border-gray-800 overflow-hidden divide-y divide-gray-800">
                <div className="p-5 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center border border-gray-800">
                      <Globe size={20} className="text-purple-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-white">Language</p>
                      <p className="text-xs text-gray-400">App localization</p>
                    </div>
                  </div>
                  <select 
                    value={language}
                    onChange={(e) => {
                      setLanguage(e.target.value);
                      showToast("Language updated", "success");
                    }}
                    className="bg-black border border-gray-700 text-white text-sm rounded-lg focus:ring-green-500 focus:border-green-500 block p-2 outline-none"
                  >
                    <option value="en">English</option>
                    <option value="hi">Hindi (हिंदी)</option>
                    <option value="te">Telugu (తెలుగు)</option>
                    <option value="ta">Tamil (தமிழ்)</option>
                  </select>
                </div>
                <div className="p-5 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center border border-gray-800">
                      <Moon size={20} className="text-blue-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-white">Dark Theme</p>
                      <p className="text-xs text-gray-400">Black background, white text</p>
                    </div>
                  </div>
                  <div className="bg-blue-500/20 text-blue-400 text-xs font-bold px-3 py-1 rounded-full">
                    LOCKED
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider ml-2">Support & Info</h3>
              <div className="bg-gray-900 rounded-3xl border border-gray-800 overflow-hidden divide-y divide-gray-800">
                <a href="#" className="p-5 flex items-center gap-4 hover:bg-gray-800 transition-colors">
                  <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center border border-gray-800">
                    <Phone size={20} className="text-green-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">Contact Support</p>
                    <p className="text-xs text-gray-400">+91 1800-123-4567</p>
                  </div>
                </a>
                <a href="#" className="p-5 flex items-center gap-4 hover:bg-gray-800 transition-colors">
                  <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center border border-gray-800">
                    <Mail size={20} className="text-yellow-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">Email Us</p>
                    <p className="text-xs text-gray-400">support@instantaccepter.com</p>
                  </div>
                </a>
                <div className="p-5 flex items-center justify-between bg-black/30">
                  <span className="text-sm text-gray-400">App Version</span>
                  <span className="text-sm font-mono text-gray-500">v2.4.0 (Build 482)</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      {currentScreen !== 'splash' && (
        <nav className="absolute bottom-0 w-full bg-gray-950 border-t border-gray-900 pb-safe pt-2 px-2 z-20">
          <div className="flex justify-around items-center pb-2">
            <NavItem 
              icon={<Home size={24} />} 
              label="Home" 
              isActive={currentScreen === 'home'} 
              onClick={() => setCurrentScreen('home')} 
            />
            <NavItem 
              icon={<DollarSign size={24} />} 
              label="Fare" 
              isActive={currentScreen === 'fare'} 
              onClick={() => setCurrentScreen('fare')} 
            />
            <NavItem 
              icon={<Activity size={24} />} 
              label="Status" 
              isActive={currentScreen === 'status'} 
              onClick={() => setCurrentScreen('status')} 
            />
            <NavItem 
              icon={<Settings size={24} />} 
              label="Settings" 
              isActive={currentScreen === 'settings'} 
              onClick={() => setCurrentScreen('settings')} 
            />
          </div>
        </nav>
      )}

      {/* Custom Scrollbar Styles */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #374151;
          border-radius: 20px;
        }
        .pb-safe {
          padding-bottom: env(safe-area-inset-bottom, 16px);
        }
      `}} />
    </div>
  );
}

function NavItem({ icon, label, isActive, onClick }: { icon: React.ReactNode, label: string, isActive: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center justify-center w-16 h-14 rounded-2xl transition-all duration-200 ${
        isActive ? 'text-white bg-gray-900' : 'text-gray-500 hover:text-gray-300'
      }`}
    >
      <div className={`${isActive ? 'scale-110 mb-1' : 'scale-100 mb-1'} transition-transform duration-200`}>
        {icon}
      </div>
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}

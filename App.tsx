
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { StoreProvider, useStore } from './context/StoreContext';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { POS } from './pages/POS';
import { Inventory } from './pages/Inventory';
import { Finance } from './pages/Finance';
import { Payables } from './pages/Payables';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';
import { Messages } from './pages/Messages';
import { Raffles } from './pages/Raffles';
import { Login } from './pages/Login';
import { AdminDashboard } from './pages/AdminDashboard';
import { Menu } from 'lucide-react';

const SplashScreen = () => {
  const imageId = "1kh4-T3wHvgRiwAS4Kejaeonbu-8VNr2-";
  const imageUrl = `https://drive.google.com/thumbnail?id=${imageId}&sz=w1000`;

  return (
    <div className="fixed inset-0 z-[100] bg-white flex flex-col items-center justify-center animate-fade-in">
      <div className="relative flex items-center justify-center">
         <div className="absolute w-64 h-64 bg-blue-100 rounded-full animate-ping opacity-20"></div>
         <div className="w-64 h-64 md:w-80 md:h-80 relative z-10 flex items-center justify-center p-4">
           <img
             src={imageUrl}
             alt="SmartPDV Logo"
             className="w-full h-full object-contain animate-pulse drop-shadow-xl"
             onError={(e) => { e.currentTarget.style.display = 'none'; }}
           />
         </div>
      </div>
      <div className="mt-8 flex flex-col items-center gap-2">
        <h2 className="text-2xl font-bold text-slate-800 tracking-widest uppercase">SmartPDV Pro</h2>
        <div className="flex gap-1">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
        </div>
      </div>
    </div>
  );
};

// Component to handle protected routes and layout
const ProtectedLayout = () => {
  const { currentUser } = useStore();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  if (!currentUser) {
      return <Navigate to="/login" />;
  }

  return (
    <div className="flex h-screen bg-slate-100 font-sans text-slate-900 overflow-hidden">
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        <main className="flex-1 flex flex-col h-full w-full overflow-hidden relative">
            <div className="md:hidden bg-white p-4 flex items-center gap-4 border-b border-slate-200 shrink-0">
                <button onClick={() => setIsSidebarOpen(true)} className="text-slate-700 p-1 hover:bg-slate-100 rounded">
                    <Menu size={24} />
                </button>
                <span className="font-bold text-slate-800 text-lg">VendaSmart AI</span>
            </div>
            <div className="flex-1 overflow-auto">
                <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/pos" element={<POS />} />
                    <Route path="/inventory" element={<Inventory />} />
                    <Route path="/payables" element={<Payables />} />
                    <Route path="/finance" element={<Finance />} />
                    <Route path="/reports" element={<Reports />} />
                    <Route path="/messages" element={<Messages />} />
                    <Route path="/raffles" element={<Raffles />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/admin" element={<AdminDashboard />} />
                    <Route path="*" element={<Navigate to="/" />} />
                </Routes>
            </div>
        </main>
    </div>
  );
};

const AppContent = () => {
    const [showSplash, setShowSplash] = useState(true);
    const { currentUser } = useStore();

    useEffect(() => {
        const timer = setTimeout(() => {
            setShowSplash(false);
        }, 5000);
        return () => clearTimeout(timer);
    }, []);

    if (showSplash) {
        return <SplashScreen />;
    }

    return (
        <Routes>
            {/* Allow login route if no user OR if user is a guest (so they can upgrade to admin) */}
            <Route path="/login" element={!currentUser || currentUser.id === 'guest_user' ? <Login /> : <Navigate to="/" />} />
            <Route path="/*" element={<ProtectedLayout />} />
        </Routes>
    );
};

function App() {
  return (
    <StoreProvider>
      <HashRouter>
          <AppContent />
      </HashRouter>
    </StoreProvider>
  );
}

export default App;

import React from 'react';
import { LayoutDashboard, ShoppingCart, Package, DollarSign, BarChart3, Settings, HelpCircle, X, LogOut, Shield, FileText, Lock, MessageSquareText, Trophy } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useStore } from '../context/StoreContext';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

// Helper to check if a color is reddish
const isReddish = (hexColor: string) => {
    // Default to false if invalid
    if (!hexColor || !hexColor.startsWith('#')) return false;
    
    // Parse Hex
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    // Simple heuristic: High Red, relatively low Green/Blue
    // e.g. Red > 150, Green < 100, Blue < 100
    return r > 160 && g < 120 && b < 120;
};

export const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;
  const { logout, currentUser, settings } = useStore();

  const sidebarBg = settings.sidebarConfig?.backgroundColor || '#0f172a';
  const sidebarText = settings.sidebarConfig?.textColor || '#cbd5e1'; // slate-300 default equivalent
  const activeColor = settings.sidebarConfig?.activeItemColor || '#3b82f6'; // Default Blue
  
  const isBgRed = isReddish(sidebarBg);
  
  const MenuItem = ({ to, icon: Icon, label, active, onClick }: any) => (
    <Link 
      to={to} 
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${active ? 'text-white' : 'hover:bg-white/10'}`}
      style={{ 
          color: active ? '#ffffff' : sidebarText,
          backgroundColor: active ? activeColor : 'transparent'
      }}
    >
      <Icon size={20} />
      <span className="font-medium">{label}</span>
    </Link>
  );

  return (
    <>
      {/* Mobile Overlay */}
      <div 
        className={`fixed inset-0 z-20 bg-black/50 transition-opacity duration-300 md:hidden ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
        onClick={onClose}
      />

      {/* Sidebar Container */}
      <div 
        className={`fixed md:static inset-y-0 left-0 z-30 w-64 flex flex-col border-r border-slate-800 shrink-0 transition-transform duration-300 transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 shadow-2xl md:shadow-none h-full`}
        style={{ backgroundColor: sidebarBg, color: sidebarText }}
      >
        <div className="p-6 border-b border-white/10 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">SmartPDV Pró</h1>
            <p className="text-xs mt-1" style={{ color: sidebarText, opacity: 0.7 }}>Olá, {currentUser?.username}</p>
          </div>
          <button onClick={onClose} className="md:hidden hover:text-white" style={{ color: sidebarText }}>
            <X size={24} />
          </button>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <MenuItem to="/" icon={LayoutDashboard} label="Dashboard" active={isActive('/')} onClick={onClose} />
          <MenuItem to="/pos" icon={ShoppingCart} label="PDV / Vendas" active={isActive('/pos')} onClick={onClose} />
          <MenuItem to="/inventory" icon={Package} label="Estoque & Clientes" active={isActive('/inventory')} onClick={onClose} />
          <MenuItem to="/payables" icon={FileText} label="Contas a Pagar" active={isActive('/payables')} onClick={onClose} />
          <MenuItem to="/finance" icon={DollarSign} label="Financeiro" active={isActive('/finance')} onClick={onClose} />
          <MenuItem to="/messages" icon={MessageSquareText} label="Mensagens" active={isActive('/messages')} onClick={onClose} />
          <MenuItem to="/raffles" icon={Trophy} label="Sorteios" active={isActive('/raffles')} onClick={onClose} />
          <MenuItem to="/reports" icon={BarChart3} label="Relatórios & IA" active={isActive('/reports')} onClick={onClose} />
          
          {currentUser?.role === 'admin' && (
             <MenuItem to="/admin" icon={Shield} label="Administração" active={isActive('/admin')} onClick={onClose} />
          )}

          <div className="pt-4 mt-4 border-t border-white/10">
            <MenuItem to="/settings" icon={Settings} label="Configurações" active={isActive('/settings')} onClick={onClose} />
          </div>
        </nav>

        <div className="p-4 border-t border-white/10 flex items-center gap-2">
          <button 
            onClick={() => { logout(); onClose(); }} 
            className={`flex-1 flex items-center justify-center gap-3 px-4 py-3 rounded-lg transition-colors ${isBgRed ? 'text-black hover:bg-black/10' : 'text-red-400 hover:bg-red-500/10 hover:text-red-300'}`}
          >
            <LogOut size={20} />
            <span className="font-medium">Sair</span>
          </button>
          
          {/* Admin Access Lock - Only shown if not admin */}
          {currentUser?.role !== 'admin' && (
              <Link 
                to="/login"
                onClick={onClose}
                className="p-3 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-colors"
                title="Acesso Administrativo"
              >
                  <Lock size={18} />
              </Link>
          )}
        </div>
        <div className="pb-4 text-xs text-center opacity-60">
            v1.1.0 (Auth)
        </div>
      </div>
    </>
  );
};
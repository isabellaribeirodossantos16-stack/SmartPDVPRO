
// ... existing imports
import React, { useRef, useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { Save, Download, Upload, Image as ImageIcon, ChevronDown, ChevronUp, Printer, Layout, Key, Database, Building2, CheckCircle, HelpCircle, Phone, Mail, MessageCircle, Clock, Unlock, Lock, Palette, AlertTriangle, X, Loader2, CreditCard, Wifi, WifiOff, Check, Zap, Cloud, User, Power, Info, Trash2, Archive, RefreshCw, Eye, EyeOff, Plus, Minus, Link as LinkIcon } from 'lucide-react'; // Added LinkIcon
import { CompanySettings, PlanConfig } from '../types';
import { ConfirmModal } from '../components/ConfirmModal';

// ... (SettingsSection and helpers remain same)
const SettingsSection = ({ title, icon: Icon, children, isOpen, onToggle, locked = false }: any) => {
    return (
        <div className={`bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-4 transition-all ${locked ? 'opacity-70' : ''}`}>
            <button 
                onClick={locked ? undefined : onToggle}
                className={`w-full p-5 flex items-center justify-between transition-colors ${isOpen ? 'bg-slate-50 border-b border-slate-100' : 'hover:bg-slate-50'} ${locked ? 'cursor-not-allowed bg-slate-50' : ''}`}
            >
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isOpen ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
                        {locked ? <Lock size={20} className="text-slate-400"/> : <Icon size={20} />}
                    </div>
                    <span className={`font-bold text-lg ${isOpen ? 'text-slate-800' : 'text-slate-600'}`}>{title}</span>
                </div>
                <div className="text-slate-400">
                    {locked ? <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Bloqueado</span> : (isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />)}
                </div>
            </button>
            
            {isOpen && !locked && (
                <div className="p-6 animate-fade-in">
                    {children}
                </div>
            )}
        </div>
    );
};

const getCooldown = (lastDate?: string | null) => {
    if (!lastDate) return { blocked: false, days: 0 };
    const last = new Date(lastDate).getTime();
    const now = Date.now();
    const diffMs = now - last;
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    if (diffDays >= 7) return { blocked: false, days: 0 };
    return { blocked: true, days: Math.ceil(7 - diffDays) };
};

export const Settings = () => {
  const { settings, updateSettings, backupData, restoreData, activateLicense, currentUser, licenseKeys, isFreeVersion, isAdmin, updateUserCredentials, saveCloudDataToLocal, uploadLocalDataToCloud, clearLocalData, cleanupOldData, products, sales, customers } = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [activationKey, setActivationKey] = useState('');
  const [timeLeft, setTimeLeft] = useState<string>('');
  
  // Backup & Restore State
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pendingBackupContent, setPendingBackupContent] = useState<string | null>(null);
  const [restorePassword, setRestorePassword] = useState('');
  
  // Restore Success State
  const [isRestoreSuccess, setIsRestoreSuccess] = useState(false);
  const [restoredUserName, setRestoredUserName] = useState('');
  const [restoreType, setRestoreType] = useState<'cloud' | 'local'>('local');

  // Manual Deletion Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteOptions, setDeleteOptions] = useState({
      all: false,
      revenues: false,
      payables: false,
      sales: false
  });

  // Sync Conflict Modal
  const [showSyncConflictModal, setShowSyncConflictModal] = useState(false);

  // Confirmation Config for Actions
  const [confirmConfig, setConfirmConfig] = useState<{isOpen: boolean, title: string, message: string, onConfirm: () => void, isDangerous?: boolean, confirmText?: string} | null>(null);

  // ... (User Edit State and Hooks remain same)
  const [editUserTab, setEditUserTab] = useState<'username' | 'password' | 'email'>('username');
  const [userForm, setUserForm] = useState({
      newValue: '',
      verifyUser: '',
      verifyEmail: '',
      verifyPass: ''
  });

  const toggleSection = (id: string) => {
      setOpenSection(openSection === id ? null : id);
  };

  const currentKeyData = licenseKeys.find(k => k.key === currentUser?.licenseKey);
  const isLifetime = currentKeyData?.type === 'lifetime' || (currentUser?.licenseKey && !currentUser?.licenseExpiry) || currentUser?.role === 'admin';
  
  // IMPORTANT: Plan Distinction Logic Updated
  // Allow sync if: Admin OR Fidelity Plan OR Manual Override in User Record
  const isFidelityPlan = isAdmin || currentKeyData?.type === 'monthly_fidelity' || currentUser?.allowedCloudSync === true;
  
  // --- AUTO-CORRECT CLOUD SETTING ---
  // Se o plano não permitir, FORÇA o cloudSyncEnabled para false.
  useEffect(() => {
      if (!isFidelityPlan && settings.cloudSyncEnabled) {
          // Force OFF without prompting, as permissions don't support it
          updateSettings({ ...settings, cloudSyncEnabled: false });
      }
  }, [isFidelityPlan, settings.cloudSyncEnabled]);

  const getPlanName = () => {
      if (currentUser?.role === 'admin') return "Versão Administrador";
      if (!currentKeyData) return "Versão Gratuita (Teste)";
      switch(currentKeyData.type) {
          case 'trial_30min': return 'Plano Teste (30 Min)';
          case 'monthly': return 'Plano Mensal';
          case 'monthly_fidelity': return 'Plano Mensal Fidelidade';
          case 'annual': return 'Plano Anual';
          case 'lifetime': return 'Plano Vitalício';
          default: return 'VendaSmart Pro';
      }
  };

  useEffect(() => {
    if (isLifetime) {
        setTimeLeft('Vitalício');
        return;
    }
    if (!currentUser?.licenseExpiry) {
        setTimeLeft('Indefinido');
        return;
    }
    const interval = setInterval(() => {
        const now = new Date();
        const expiry = new Date(currentUser.licenseExpiry!);
        const diff = expiry.getTime() - now.getTime();
        if (diff <= 0) {
            setTimeLeft('Expirado');
        } else {
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);
            setTimeLeft(
                `${days.toString().padStart(2, '0')}d:${hours.toString().padStart(2, '0')}h:${minutes.toString().padStart(2, '0')}m:${seconds.toString().padStart(2, '0')}s`
            );
        }
    }, 1000);
    return () => clearInterval(interval);
  }, [currentUser, isLifetime]);

  const handleUpdateUser = async () => {
      if (!userForm.newValue) return alert("Preencha o novo valor.");
      let verification = {};
      if (editUserTab === 'username') verification = { e: userForm.verifyEmail, p: userForm.verifyPass };
      else if (editUserTab === 'password') verification = { u: userForm.verifyUser, e: userForm.verifyEmail };
      else if (editUserTab === 'email') verification = { u: userForm.verifyUser, p: userForm.verifyPass };
      setIsProcessing(true);
      const result = await updateUserCredentials(editUserTab, verification, userForm.newValue);
      setIsProcessing(false);
      alert(result.message);
      if (result.success) {
          setUserForm({ newValue: '', verifyUser: '', verifyEmail: '', verifyPass: '' });
      }
  };

  const handleExecuteDelete = async () => {
      if (!deleteOptions.all && !deleteOptions.revenues && !deleteOptions.payables && !deleteOptions.sales) {
          alert("Selecione ao menos uma opção.");
          return;
      }
      setIsProcessing(true);
      try {
          const result = await cleanupOldData({
              revenues: deleteOptions.all || deleteOptions.revenues,
              payables: deleteOptions.all || deleteOptions.payables,
              sales: deleteOptions.all || deleteOptions.sales,
              forceAll: true // FIXED: Always force delete selected categories in manual mode
          });
          alert(`Limpeza concluída!\n\n${result.deletedSales} vendas excluídas.\n${result.deletedRecords} registros financeiros excluídos.`);
          setShowDeleteModal(false);
          setDeleteOptions({ all: false, revenues: false, payables: false, sales: false });
      } catch (e: any) {
          alert("Erro ao excluir dados: " + e.message);
      } finally {
          setIsProcessing(false);
      }
  };

  const handleDownloadBackup = async () => {
    // Allows backup if NOT using Cloud Sync (Available for Basic/Annual/Lifetime plans or Fidelity with Sync OFF)
    // CloudSync is auto-disabled for non-fidelity by the useEffect above
    if (isFreeVersion || settings.cloudSyncEnabled) return;
    setIsProcessing(true);
    try {
        const content = await backupData();
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup_${currentUser?.username || 'smartpdv'}_${new Date().toISOString().split('T')[0]}.enc`;
        a.click();
    } catch (e: any) {
        alert("Erro ao gerar backup: " + e.message);
    } finally {
        setIsProcessing(false);
    }
  };

  const handleUploadBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        if (event.target?.result) {
            setPendingBackupContent(event.target.result as string);
            setRestorePassword('');
            setShowPasswordModal(true); 
        }
      };
      reader.readAsText(file);
      e.target.value = ''; 
    }
  };

  const confirmRestoreWithPassword = async () => {
      if (!pendingBackupContent || !restorePassword) return;
      setIsProcessing(true);
      try {
          const result = await restoreData(pendingBackupContent, restorePassword);
          setRestoredUserName(currentUser?.username || 'Usuário');
          if (result.isCloud) {
              setRestoreType('cloud');
          } else {
              setRestoreType('local');
          }
          setIsRestoreSuccess(true);
          setShowPasswordModal(false);
          setPendingBackupContent(null);
          setRestorePassword('');
      } catch (e: any) {
          alert(e.message); // Show specific error (e.g. invalid password)
      } finally {
          setIsProcessing(false);
      }
  };

  const handleManualRestart = () => {
      window.dispatchEvent(new Event('app:soft_reset'));
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        updateSettings({...settings, logo: reader.result as string});
      };
      reader.readAsDataURL(file);
    }
  };
  
  const handleActivateKey = () => {
      if (!currentUser) return;
      if (isLifetime) return; 
      if (!activationKey.trim()) {
          alert("Por favor, insira uma chave válida.");
          return;
      }
      const result = activateLicense(activationKey, currentUser.username);
      alert(result.message);
      if (result.success) {
          setActivationKey('');
      }
  };

  const toggleWidget = (key: keyof typeof settings.dashboardWidgets) => {
      if (key === 'lists') {
         updateSettings({
            ...settings,
            dashboardWidgets: {
                ...settings.dashboardWidgets,
                lists: !settings.dashboardWidgets.lists
            }
         });
         return;
      }
      const widget = settings.dashboardWidgets[key as keyof Omit<typeof settings.dashboardWidgets, 'lists'>];
      updateSettings({
          ...settings,
          dashboardWidgets: {
              ...settings.dashboardWidgets,
              [key]: { ...widget, enabled: !widget.enabled }
          }
      });
  };

  const updateWidgetRange = (key: keyof Omit<typeof settings.dashboardWidgets, 'lists'>, days: number) => {
    const widget = settings.dashboardWidgets[key];
    updateSettings({
        ...settings,
        dashboardWidgets: {
            ...settings.dashboardWidgets,
            [key]: { ...widget, range: Math.min(30, Math.max(0, days)) }
        }
    });
  };

  const updateRetention = (key: 'revenues' | 'payables' | 'sales', months: number) => {
      updateSettings({
          ...settings,
          dataRetention: {
              ...settings.dataRetention,
              [key]: months
          } as any
      });
  };

  // --- PLAN MANAGEMENT FOR ADMIN ---
  const updatePlanConfig = (key: string, updates: Partial<PlanConfig>) => {
      const updatedPlans = settings.customPlans?.map(p => 
          p.key === key ? { ...p, ...updates } : p
      ) || [];
      updateSettings({ ...settings, customPlans: updatedPlans });
  };

  const addPlanFeature = (planKey: string) => {
      const plan = settings.customPlans?.find(p => p.key === planKey);
      if (plan) {
          const newFeatures = [...plan.features, "Novo Benefício"];
          updatePlanConfig(planKey, { features: newFeatures });
      }
  };

  const updatePlanFeature = (planKey: string, index: number, value: string) => {
      const plan = settings.customPlans?.find(p => p.key === planKey);
      if (plan) {
          const newFeatures = [...plan.features];
          newFeatures[index] = value;
          updatePlanConfig(planKey, { features: newFeatures });
      }
  };

  const removePlanFeature = (planKey: string, index: number) => {
      const plan = settings.customPlans?.find(p => p.key === planKey);
      if (plan) {
          const newFeatures = plan.features.filter((_, i) => i !== index);
          updatePlanConfig(planKey, { features: newFeatures });
      }
  };

  // --- UPDATED CLOUD TOGGLE LOGIC ---
  const handleCloudToggle = () => {
      if (!isFidelityPlan) return; // Strict block based on updated plan/manual logic

      if (settings.cloudSyncEnabled) {
          // Turning OFF
          setConfirmConfig({
              isOpen: true,
              title: "Pausar Sincronização em Nuvem?",
              message: "Ao desativar, seus dados atuais serão SALVOS neste dispositivo para uso offline. Futuras alterações offline não serão enviadas para a nuvem até que você reative a opção.",
              isDangerous: false,
              confirmText: "Salvar Localmente e Desativar",
              onConfirm: () => {
                  saveCloudDataToLocal();
                  updateSettings({...settings, cloudSyncEnabled: false});
              }
          });
      } else {
          // Turning ON
          // Check if there is ANY data locally (from manual add or previous download)
          const hasLocalData = products.length > 0 || customers.length > 0 || sales.length > 0;
          
          if (hasLocalData) {
              setShowSyncConflictModal(true);
          } else {
              // No local data, safe to just enable (Simulate Restore to activate listeners)
              clearLocalData(); 
              updateSettings({...settings, cloudSyncEnabled: true});
          }
      }
  };

  // --- SYNC CONFLICT HANDLERS (UPDATED) ---
  const handleRestoreFromCloud = () => {
      // Option A: Just wipe local and Enable. 
      // Context useEffect will trigger snapshot and download data automatically.
      setConfirmConfig({
          isOpen: true,
          title: "Restaurar Backup da Nuvem",
          message: "ATENÇÃO: Todos os dados locais deste dispositivo serão substituídos pelos dados da nuvem. Continuar?",
          isDangerous: true,
          confirmText: "Sim, Restaurar",
          onConfirm: () => {
              clearLocalData();
              updateSettings({...settings, cloudSyncEnabled: true});
              setShowSyncConflictModal(false);
              
              // Trigger Success Screen
              setRestoredUserName(currentUser?.username || 'Nuvem');
              setRestoreType('cloud');
              setIsRestoreSuccess(true);
          }
      });
  };

  const handleOverwriteCloud = () => {
      // Option B: Upload local data
      setConfirmConfig({
          isOpen: true,
          title: "Sobrescrever Nuvem",
          message: "ATENÇÃO: Os dados existentes na nuvem serão substituídos pelos dados deste dispositivo. Continuar?",
          isDangerous: true,
          confirmText: "Sim, Sobrescrever",
          onConfirm: async () => {
              setIsProcessing(true);
              try {
                  await uploadLocalDataToCloud();
                  // The upload function in context now handles setting settings.cloudSyncEnabled = true remotely
                  setShowSyncConflictModal(false);
                  alert("Os dados foram salvos na nuvem e o botão de sincronização foi ativado com sucesso.");
              } catch (e: any) {
                  alert("Erro ao enviar dados: " + (e.message || "Desconhecido"));
              } finally {
                  setIsProcessing(false);
              }
          }
      });
  };

  // ... (Rest of UI components remain same)
  // [Content omitted for brevity, keeping existing structure identical]
  const imageId = "1WmSJpYViZregaF4oeCd3gFiBNHcD-so4";
  const imageUrl = `https://drive.google.com/thumbnail?id=${imageId}&sz=w1000`;
  const whatsappNumber = "5541988192359";

  const WidgetConfigRow = ({ label, configKey, helpText }: { label: string, configKey: keyof Omit<typeof settings.dashboardWidgets, 'lists'>, helpText: string }) => {
     const config = settings.dashboardWidgets[configKey];
     return (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border rounded-lg hover:bg-slate-50 gap-3">
            <div className="flex items-center gap-3">
                <input 
                    type="checkbox" 
                    className="w-5 h-5 accent-primary cursor-pointer" 
                    checked={config.enabled} 
                    onChange={() => toggleWidget(configKey)} 
                />
                <div>
                    <span className="font-medium text-slate-700 block">{label}</span>
                    <span className="text-xs text-slate-400">{helpText}</span>
                </div>
            </div>
            
            {config.enabled && (
                <div className="flex items-center gap-2 bg-white px-2 py-1 rounded border border-slate-200">
                    <Clock size={14} className="text-slate-400" />
                    <input 
                        type="number" 
                        min="0" 
                        max="30" 
                        className="w-12 text-center text-sm font-bold text-slate-700 outline-none" 
                        value={config.range} 
                        onChange={(e) => updateWidgetRange(configKey, parseInt(e.target.value) || 0)}
                    />
                    <span className="text-xs text-slate-500 w-16 text-right">
                        {config.range === 0 ? 'Hoje' : `${config.range} dias`}
                    </span>
                </div>
            )}
        </div>
     );
  };

  const RetentionSelect = ({ label, value, onChange }: { label: string, value: number, onChange: (v: number) => void }) => (
      <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-slate-200">
          <span className="text-sm font-medium text-slate-700">{label}</span>
          <select 
            className="p-2 border rounded-lg text-sm bg-slate-50 outline-none focus:border-blue-500 text-slate-600 font-bold"
            value={value || 0}
            onChange={(e) => onChange(parseInt(e.target.value))}
          >
              <option value="0">Nunca Excluir</option>
              <option value="1">1 Mês</option>
              <option value="2">2 Meses</option>
              <option value="3">3 Meses</option>
              <option value="6">6 Meses</option>
              <option value="12">12 Meses</option>
          </select>
      </div>
  );

  const licenseStatusColor = timeLeft === 'Expirado' ? 'text-red-400' : (isLifetime ? 'text-green-400' : 'text-blue-300');

  // Base definitions for plan styling, merged with dynamic config
  const basePlans = [
      {
          key: 'monthly_basic',
          period: "/mês",
          type: "Offline",
          description: "Ideal para pequenos negócios locais.",
          isOnline: false,
          color: "bg-slate-50 border-slate-200",
          btnColor: "bg-slate-800 hover:bg-slate-900"
      },
      {
          key: 'annual_eco',
          period: "/ano",
          type: "Offline",
          description: "Maior economia para longo prazo.",
          isOnline: false,
          color: "bg-blue-50 border-blue-200",
          btnColor: "bg-blue-600 hover:bg-blue-700"
      },
      {
          key: 'lifetime',
          period: "único",
          type: "Offline",
          description: "Pague uma vez, use para sempre.",
          isOnline: false,
          color: "bg-purple-50 border-purple-200",
          btnColor: "bg-purple-600 hover:bg-purple-700"
      },
      {
          key: 'fidelity',
          period: "/mês",
          type: "Online Híbrido",
          description: "Sincronização e segurança total.",
          isOnline: true,
          color: "bg-green-50 border-green-200 shadow-md ring-1 ring-green-300",
          btnColor: "bg-green-600 hover:bg-green-700"
      }
  ];

  // Merge base plans with custom settings
  const displayPlans = basePlans.map(base => {
      const custom = settings.customPlans?.find(p => p.key === base.key);
      return { ...base, ...custom };
  }).filter(p => isAdmin || p.isVisible); // Only filter if NOT admin

  const currentCooldown = React.useMemo(() => {
      if (!currentUser) return { blocked: false, days: 0 };
      if (isAdmin) return { blocked: false, days: 0 }; 
      if (editUserTab === 'username') return getCooldown(currentUser.lastUsernameChange);
      if (editUserTab === 'password') return getCooldown(currentUser.lastPasswordChange);
      if (editUserTab === 'email') return getCooldown(currentUser.lastEmailChange);
      return { blocked: false, days: 0 };
  }, [currentUser, editUserTab, isAdmin]);

  return (
    <div className="p-4 md:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-3xl font-bold text-slate-800 mb-6">Configurações</h2>
        
        {/* --- RESTORE SUCCESS OVERLAY --- */}
        {isRestoreSuccess && (
         <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gradient-to-br from-emerald-600 to-teal-800 text-white animate-fade-in p-6 text-center">
            
            <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mb-6 animate-bounce shadow-xl backdrop-blur-sm border border-white/30">
               {restoreType === 'cloud' ? <Cloud size={48} className="text-white" /> : <CheckCircle size={48} className="text-white" />}
            </div>

            {restoreType === 'cloud' ? (
                <>
                    <h2 className="text-3xl font-bold mb-2">Restauração Online Realizada!</h2>
                    <p className="text-emerald-100 text-lg mb-8 max-w-md">
                        Restauração online realizada com sucesso. Entre novamente com seu usuário e senha para recarregar.
                    </p>
                </>
            ) : (
                <>
                    <h2 className="text-3xl font-bold mb-2">Seus dados foram restaurados!</h2>
                    <p className="text-emerald-100 text-lg mb-8 max-w-md">
                        Para restaurar o backup dos seus dados referentes a clientes, produtos, vendas e relatórios você deve fazer a restauração do backup manual.
                    </p>
                </>
            )}

            <div className="bg-white/10 rounded-xl p-6 backdrop-blur-md border border-white/20 w-full max-w-sm mb-10">
               <div className="flex justify-between items-center">
                  <span className="text-emerald-200 text-xs font-bold uppercase">Usuário</span>
                  <span className="font-bold text-white">{restoredUserName}</span>
               </div>
            </div>

            <button 
                onClick={handleManualRestart}
                className="px-8 py-4 bg-white text-emerald-800 font-bold text-lg rounded-xl shadow-2xl hover:bg-emerald-50 hover:scale-105 transition-all transform active:scale-95 flex items-center gap-3 animate-pulse"
            >
                <Power size={24} />
                REINICIAR E ENTRAR
            </button>
         </div>
       )}

       {/* ... (Rest of UI components Sections... KEEP ALL EXISTING SECTIONS) ... */}
       
       <SettingsSection 
            title="Dados da Empresa" 
            icon={Building2} 
            isOpen={openSection === 'company'} 
            onToggle={() => toggleSection('company')}
            locked={isFreeVersion}
        >
            <div className="space-y-4">
                <div className="flex flex-col sm:flex-row items-center gap-4 mb-4">
                    <div className="w-20 h-20 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                        {settings.logo ? <img src={settings.logo} className="w-full h-full object-cover" /> : <ImageIcon className="text-slate-400" size={32} />}
                    </div>
                    <div className="flex-1 w-full">
                        <label className="block text-sm font-medium text-slate-600 mb-1">Logotipo</label>
                        <label className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 text-sm font-medium text-slate-700 shadow-sm transition-colors mb-2 w-full sm:w-auto justify-center sm:justify-start">
                            <Upload size={16} /> <span>Escolher Imagem (Arquivo)</span>
                            <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                        </label>
                        <div className="relative">
                            <LinkIcon size={14} className="absolute left-3 top-3 text-slate-400" />
                            <input
                                type="text"
                                className="w-full pl-8 pr-3 py-2 border rounded-lg text-sm bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-500 transition-colors"
                                placeholder="Ou cole o link da imagem (Facebook, Google...)"
                                value={settings.logo?.startsWith('data:') ? '' : settings.logo || ''}
                                onChange={(e) => updateSettings({...settings, logo: e.target.value})}
                            />
                        </div>
                    </div>
                </div>
                <div><label className="block text-sm font-medium text-slate-600 mb-1">Nome da Empresa</label><input className="w-full border rounded-lg p-2" value={settings.name} onChange={e => updateSettings({...settings, name: e.target.value})}/></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><label className="block text-sm font-medium text-slate-600 mb-1">CPF / CNPJ</label><input className="w-full border rounded-lg p-2" value={settings.cnpj} onChange={e => updateSettings({...settings, cnpj: e.target.value})}/></div>
                    <div><label className="block text-sm font-medium text-slate-600 mb-1">Inscrição Estadual</label><input className="w-full border rounded-lg p-2" value={settings.stateRegistration || ''} onChange={e => updateSettings({...settings, stateRegistration: e.target.value})}/></div>
                </div>
                <div><label className="block text-sm font-medium text-slate-600 mb-1">Telefone da Empresa</label><input className="w-full border rounded-lg p-2" value={settings.phone || ''} onChange={e => updateSettings({...settings, phone: e.target.value})}/></div>
                <div><label className="block text-sm font-medium text-slate-600 mb-1">Chave Pix Padrão</label><input className="w-full border rounded-lg p-2" value={settings.pixKey} onChange={e => updateSettings({...settings, pixKey: e.target.value})}/></div>
                <div><label className="block text-sm font-medium text-slate-600 mb-1">Mensagem WhatsApp</label><textarea className="w-full border rounded-lg p-2 text-sm h-24" value={settings.whatsappMessageTemplate} onChange={e => updateSettings({...settings, whatsappMessageTemplate: e.target.value})}/></div>
                <div className="pt-2"><button className="bg-primary text-white px-6 py-2 rounded-lg flex items-center gap-2 hover:bg-slate-800 transition-colors shadow-sm"><Save size={18} /> Salvar Dados</button></div>
            </div>
        </SettingsSection>

        {/* ... (User Data Section) ... */}
        <SettingsSection title="Dados do Usuário" icon={User} isOpen={openSection === 'user_data'} onToggle={() => toggleSection('user_data')}>
            <div className="mb-4">
                <div className="flex flex-col sm:flex-row gap-4 mb-4">
                    <div className={`flex-1 p-4 rounded-lg border flex flex-col items-center justify-center text-center transition-colors ${currentCooldown.blocked ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                        <span className="text-xs font-bold uppercase text-slate-500 mb-1">{editUserTab === 'username' && 'TROCA DE NOME'}{editUserTab === 'password' && 'TROCA DE SENHA'}{editUserTab === 'email' && 'TROCA DE EMAIL'}</span>
                        {currentCooldown.blocked ? (<><span className="text-lg font-bold text-red-600 flex items-center gap-2"><Lock size={18} /> Bloqueado ({currentCooldown.days}d)</span><span className="text-xs text-red-400 mt-1">Última: {new Date(editUserTab === 'username' ? currentUser?.lastUsernameChange! : editUserTab === 'password' ? currentUser?.lastPasswordChange! : currentUser?.lastEmailChange!).toLocaleDateString()}</span></>) : (<span className="text-lg font-bold text-green-700 flex items-center gap-2"><Unlock size={18} /> Liberado</span>)}
                    </div>
                </div>
            </div>
            <div className="flex bg-slate-100 p-1 rounded-lg mb-4">
                <button onClick={() => { setEditUserTab('username'); setUserForm({newValue:'', verifyUser:'', verifyEmail:'', verifyPass:''}); }} className={`flex-1 py-2 text-sm font-bold rounded-md transition-colors ${editUserTab === 'username' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>Alterar Usuário</button>
                <button onClick={() => { setEditUserTab('password'); setUserForm({newValue:'', verifyUser:'', verifyEmail:'', verifyPass:''}); }} className={`flex-1 py-2 text-sm font-bold rounded-md transition-colors ${editUserTab === 'password' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>Alterar Senha</button>
                <button onClick={() => { setEditUserTab('email'); setUserForm({newValue:'', verifyUser:'', verifyEmail:'', verifyPass:''}); }} className={`flex-1 py-2 text-sm font-bold rounded-md transition-colors ${editUserTab === 'email' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>Alterar Email</button>
            </div>
            <div className={`space-y-4 ${currentCooldown.blocked ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
                <div><label className="block text-sm font-medium text-slate-600 mb-1">{editUserTab === 'username' && 'Novo Nome de Usuário'}{editUserTab === 'password' && 'Nova Senha'}{editUserTab === 'email' && 'Novo Email'}</label><input className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none" type={editUserTab === 'password' ? 'password' : 'text'} placeholder={editUserTab === 'email' ? 'exemplo@email.com' : 'Digite o novo valor'} value={userForm.newValue} onChange={(e) => setUserForm({...userForm, newValue: e.target.value})} disabled={currentCooldown.blocked} /></div>
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-100"><p className="text-xs font-bold text-slate-500 mb-3 uppercase tracking-wide flex items-center gap-1"><Lock size={12}/> Confirmação de Segurança</p><div className="space-y-3">{editUserTab !== 'username' && (<div><label className="block text-xs font-medium text-slate-500 mb-1">Usuário Atual</label><input className="w-full border rounded-lg p-2 text-sm" value={userForm.verifyUser} onChange={(e) => setUserForm({...userForm, verifyUser: e.target.value})} placeholder="Confirme seu usuário atual" disabled={currentCooldown.blocked} /></div>)}{editUserTab !== 'email' && (<div><label className="block text-xs font-medium text-slate-500 mb-1">Email Cadastrado</label><input className="w-full border rounded-lg p-2 text-sm" value={userForm.verifyEmail} onChange={(e) => setUserForm({...userForm, verifyEmail: e.target.value})} placeholder="Confirme seu email atual" disabled={currentCooldown.blocked} /></div>)}{editUserTab !== 'password' && (<div><label className="block text-xs font-medium text-slate-500 mb-1">Senha Atual</label><input type="password" className="w-full border rounded-lg p-2 text-sm" value={userForm.verifyPass} onChange={(e) => setUserForm({...userForm, verifyPass: e.target.value})} placeholder="Confirme sua senha atual" disabled={currentCooldown.blocked} /></div>)}</div></div>
                <button onClick={handleUpdateUser} disabled={isProcessing || currentCooldown.blocked} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">{isProcessing ? <Loader2 className="animate-spin" size={18}/> : <Save size={18} />}{currentCooldown.blocked ? `Bloqueado (Espere ${currentCooldown.days} dias)` : 'Salvar Alterações'}</button>
            </div>
        </SettingsSection>

        {/* ... (Data Retention Section) ... */}
        <SettingsSection title="Definições de dados de cadastros" icon={Archive} isOpen={openSection === 'data_retention'} onToggle={() => toggleSection('data_retention')} locked={isFreeVersion}>
            <div className="space-y-4">
                <div className="bg-orange-50 p-3 border border-orange-200 rounded-lg text-xs text-orange-800 flex gap-2"><AlertTriangle size={16} className="shrink-0" /><p>Configure o período máximo de armazenamento. Itens mais antigos que o período selecionado serão excluídos automaticamente para otimizar o sistema.</p></div>
                <RetentionSelect label="Excluir Receitas após:" value={settings.dataRetention?.revenues || 0} onChange={(v) => updateRetention('revenues', v)} />
                <RetentionSelect label="Excluir Despesas após:" value={settings.dataRetention?.payables || 0} onChange={(v) => updateRetention('payables', v)} />
                <RetentionSelect label="Excluir Planos/Vendas após:" value={settings.dataRetention?.sales || 0} onChange={(v) => updateRetention('sales', v)} />
                <div className="pt-4 border-t border-slate-100"><button onClick={() => setShowDeleteModal(true)} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 shadow-lg hover:shadow-red-500/20 transition-all"><Trash2 size={18} /> Excluir Dados Agora</button></div>
            </div>
        </SettingsSection>

        {/* ... (Visual Dashboard Section) ... */}
        <SettingsSection title="Visualização Dashboard" icon={Layout} isOpen={openSection === 'dashboard'} onToggle={() => toggleSection('dashboard')} locked={isFreeVersion}>
            <p className="text-sm text-slate-500 mb-4">Configure quais cards exibir e o período de dados.</p>
            <div className="space-y-3"><WidgetConfigRow label="Resumo de Vendas" configKey="sales" helpText="Total vendido no período."/><WidgetConfigRow label="Contas a Receber" configKey="receivables" helpText="Valores a receber."/><WidgetConfigRow label="Contas a Pagar" configKey="payables" helpText="Valores a pagar."/><WidgetConfigRow label="Alertas de Urgência" configKey="alerts" helpText="Contas vencendo."/><WidgetConfigRow label="Aniversariantes" configKey="birthdays" helpText="Clientes fazendo aniversário."/><label className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 cursor-pointer"><div className="flex items-center gap-3"><input type="checkbox" className="w-5 h-5 accent-primary" checked={settings.dashboardWidgets?.lists ?? true} onChange={() => toggleWidget('lists')} /><span className="font-medium text-slate-700">Listas Detalhadas</span></div></label></div>
        </SettingsSection>

        {/* ... (Sidebar Section) ... */}
        <SettingsSection title="Definições do Menu Lateral" icon={Palette} isOpen={openSection === 'sidebar'} onToggle={() => toggleSection('sidebar')} locked={isFreeVersion}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div><label className="block text-sm font-medium text-slate-600 mb-2">Cor de Fundo</label><div className="flex items-center gap-3"><input type="color" className="w-12 h-12 p-1 border rounded cursor-pointer" value={settings.sidebarConfig?.backgroundColor || '#0f172a'} onChange={(e) => updateSettings({...settings, sidebarConfig: {...settings.sidebarConfig, backgroundColor: e.target.value, textColor: settings.sidebarConfig?.textColor || '#cbd5e1', activeItemColor: settings.sidebarConfig?.activeItemColor || '#3b82f6'}})} /></div></div><div><label className="block text-sm font-medium text-slate-600 mb-2">Cor dos Textos</label><div className="flex items-center gap-3"><input type="color" className="w-12 h-12 p-1 border rounded cursor-pointer" value={settings.sidebarConfig?.textColor || '#cbd5e1'} onChange={(e) => updateSettings({...settings, sidebarConfig: {...settings.sidebarConfig, textColor: e.target.value, backgroundColor: settings.sidebarConfig?.backgroundColor || '#0f172a', activeItemColor: settings.sidebarConfig?.activeItemColor || '#3b82f6'}})} /></div></div><div><label className="block text-sm font-medium text-slate-600 mb-2">Cor Selecionado</label><div className="flex items-center gap-3"><input type="color" className="w-12 h-12 p-1 border rounded cursor-pointer" value={settings.sidebarConfig?.activeItemColor || '#3b82f6'} onChange={(e) => updateSettings({...settings, sidebarConfig: {...settings.sidebarConfig, activeItemColor: e.target.value, textColor: settings.sidebarConfig?.textColor || '#cbd5e1', backgroundColor: settings.sidebarConfig?.backgroundColor || '#0f172a'}})} /></div></div></div>
        </SettingsSection>

        {/* ... (Printer Section) ... */}
        <SettingsSection title="Impressora PDV" icon={Printer} isOpen={openSection === 'printer'} onToggle={() => toggleSection('printer')} locked={isFreeVersion}>
             <div className="space-y-4"><div className="flex items-center justify-between p-3 border rounded-lg bg-slate-50"><div><p className="font-medium text-slate-800">Habilitar Impressão</p></div><div className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors ${settings.printerConfig?.enabled ? 'bg-green-500' : 'bg-slate-300'}`} onClick={() => updateSettings({...settings, printerConfig: {...settings.printerConfig, enabled: !settings.printerConfig.enabled}})}><div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${settings.printerConfig?.enabled ? 'translate-x-6' : 'translate-x-0'}`} /></div></div><div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-medium text-slate-600 mb-1">Largura do Papel</label><select className="w-full border rounded-lg p-2 text-sm" value={settings.printerConfig?.paperWidth || '80mm'} onChange={(e) => updateSettings({...settings, printerConfig: {...settings.printerConfig, paperWidth: e.target.value as any}})}><option value="58mm">58mm</option><option value="80mm">80mm</option></select></div><div><label className="block text-sm font-medium text-slate-600 mb-1">Impressão Automática</label><select className="w-full border rounded-lg p-2 text-sm" value={settings.printerConfig?.autoPrint ? 'yes' : 'no'} onChange={(e) => updateSettings({...settings, printerConfig: {...settings.printerConfig, autoPrint: e.target.value === 'yes'}})}><option value="no">Não</option><option value="yes">Sim</option></select></div></div></div>
        </SettingsSection>

        {/* 4. BACKUP E RESTAURAÇÃO - MODIFIED */}
        <SettingsSection 
            title="Backup e Restauração" 
            icon={Database} 
            isOpen={openSection === 'backup'} 
            onToggle={() => toggleSection('backup')}
        >
            {/* CONDITIONAL MESSAGES BASED ON SYNC STATUS */}
            {settings.cloudSyncEnabled ? (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800 animate-fade-in">
                    <p className="font-bold flex items-center gap-2"><Cloud size={16} /> Backup Automático Ativo</p>
                    <p className="mt-1 text-xs md:text-sm">
                        Seus dados já estão salvos automaticamente na nuvem (Firebase).
                        <br/>
                        Desative a <b>Sincronização em Nuvem</b> nas Definições OFF/ON abaixo para realizar um backup manual no dispositivo local.
                    </p>
                </div>
            ) : (
                <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-800 animate-fade-in">
                    <p className="font-bold flex items-center gap-2"><AlertTriangle size={16} /> Modo Local (Offline)</p>
                    <p className="mt-1 text-xs md:text-sm">
                        Seus dados offline <b>NÃO</b> serão salvos online.
                        <br/>
                        Recomendamos realizar backups manuais diariamente neste dispositivo.
                        {isFidelityPlan && (
                            <>
                                <br/>
                                Para salvar automaticamente na nuvem, ative a <b>Sincronização em Nuvem</b>.
                            </>
                        )}
                    </p>
                </div>
            )}

            <p className="text-sm text-slate-500 mb-4">
                Requer confirmação de senha idêntica ao backup para restaurar.
                <br/>
                <span className="text-orange-500 font-bold text-xs">Nota: Mantenha sua senha segura.</span>
            </p>
            
            <div className="flex gap-4">
                <button 
                    onClick={handleDownloadBackup} 
                    // Disabled ONLY if Free Version OR if Cloud Sync is actually ACTIVE and VALID
                    // Since useEffect auto-disables for non-fidelity, this will be enabled for Vitalício
                    disabled={isFreeVersion || settings.cloudSyncEnabled} 
                    className={`flex-1 py-3 rounded-lg flex flex-col items-center justify-center gap-2 border transition-colors ${
                        isFreeVersion || settings.cloudSyncEnabled
                        ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed opacity-60' 
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                    }`}
                >
                    {isProcessing ? <Loader2 size={24} className="animate-spin" /> : (isFreeVersion ? <Lock size={24} /> : <Download size={24} />)}
                    <span className="font-bold text-sm">{isProcessing ? 'Gerando...' : 'Baixar Backup'}</span>
                    {isFreeVersion && <span className="text-[10px] uppercase font-bold text-red-400">Bloqueado</span>}
                    {settings.cloudSyncEnabled && <span className="text-[10px] uppercase font-bold text-blue-400">Sync Ativo</span>}
                </button>
                
                <button 
                    onClick={() => !isProcessing && fileInputRef.current?.click()} 
                    disabled={isProcessing}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-lg flex flex-col items-center justify-center gap-2 border border-slate-300 transition-colors"
                >
                    {isProcessing ? <Loader2 size={24} className="animate-spin" /> : <Upload size={24} />}
                    <span className="font-bold text-sm">{isProcessing ? 'Processando...' : 'Restaurar Backup'}</span>
                </button>
                <input type="file" ref={fileInputRef} className="hidden" accept=".enc" onChange={handleUploadBackup} />
            </div>
            <p className="text-xs text-red-600 font-bold mt-3 text-center bg-red-50 p-2 rounded border border-red-100">
               Para restaurar o backup é necessário alterar a senha para a mesma utilizada quando foi realizado o backup.
            </p>
        </SettingsSection>

        {/* 4.5 DEFINIÇÕES OFF/ON (SYNC CONTROL) */}
        <SettingsSection 
            title="Definições OFF / ON" 
            icon={settings.cloudSyncEnabled ? Wifi : WifiOff} 
            isOpen={openSection === 'cloud'} 
            onToggle={() => toggleSection('cloud')}
            // Locked is false because we handle logic inside
            locked={false} 
        >
            <div className="flex items-start gap-4">
                <div className={`p-3 rounded-full ${settings.cloudSyncEnabled ? 'bg-green-100 text-green-600' : 'bg-slate-200 text-slate-500'}`}>
                    {settings.cloudSyncEnabled ? <Cloud size={32} /> : <WifiOff size={32} />}
                </div>
                <div className="flex-1">
                    <h4 className="font-bold text-slate-800 text-lg mb-1">
                        Sincronização em Nuvem (Firebase)
                    </h4>
                    <p className="text-sm text-slate-500 mb-4 leading-relaxed">
                        Quando <b>ATIVADO (ON)</b>, seus dados de negócios (Produtos, Vendas, Clientes, Financeiro) são salvos automaticamente no banco de dados seguro na nuvem, permitindo acesso em múltiplos dispositivos e backup em tempo real.<br/><br/>
                        Quando <b>DESATIVADO (OFF)</b>, os dados são salvos apenas neste dispositivo (Local).<br/>
                        <span className="text-xs text-blue-600 italic">* Dados de login e licença são sempre salvos na nuvem para garantir seu acesso.</span>
                    </p>
                    
                    {!isFidelityPlan ? (
                        // IMAGE 1 LOOK: Force OFF, Disabled for Basic/Annual/Lifetime
                        <div className="flex items-center gap-4 opacity-60 grayscale cursor-not-allowed">
                            <span className="text-sm font-bold text-slate-800">OFF (Local)</span>
                            <div className="w-16 h-8 rounded-full p-1 bg-slate-200 relative border border-slate-300">
                                <div className="w-6 h-6 rounded-full bg-slate-400 shadow-sm translate-x-0" />
                            </div>
                            <span className="text-sm font-bold text-slate-400">ON (Nuvem)</span>
                        </div>
                    ) : (
                        // IMAGE 2 LOOK: Interactive for Fidelity OR Admin Allowed
                        <div className="flex items-center gap-4">
                            <span className={`text-sm font-bold ${!settings.cloudSyncEnabled ? 'text-slate-800' : 'text-slate-400'}`}>OFF (Local)</span>
                            <button 
                                onClick={handleCloudToggle}
                                className={`w-16 h-8 rounded-full p-1 transition-colors relative ${settings.cloudSyncEnabled ? 'bg-green-500' : 'bg-slate-300'}`}
                            >
                                <div className={`w-6 h-6 rounded-full bg-white shadow-md transition-transform transform ${settings.cloudSyncEnabled ? 'translate-x-8' : 'translate-x-0'}`} />
                            </button>
                            <span className={`text-sm font-bold ${settings.cloudSyncEnabled ? 'text-green-600' : 'text-slate-400'}`}>ON (Nuvem)</span>
                        </div>
                    )}
                </div>
            </div>
            {!isFidelityPlan && (
                <div className="mt-4 p-3 bg-slate-100 border border-slate-200 rounded-lg flex items-center gap-2 text-sm text-slate-600">
                    <Lock size={16} /> 
                    <span>Sincronização em tempo real disponível apenas no plano <b>Mensal Fidelidade</b> ou via liberação administrativa.</span>
                </div>
            )}
        </SettingsSection>

        {/* ... (License, Plans, Support remain same) ... */}
        {/* 5. LICENÇA */}
        <SettingsSection title="Licença" icon={Key} isOpen={openSection === 'license'} onToggle={() => toggleSection('license')}>
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white p-6 rounded-xl relative overflow-hidden mb-6"><div className="relative z-10"><div className="flex items-center gap-2 mb-2"><CheckCircle className="text-green-400" size={20} /><span className="font-bold tracking-wide uppercase text-sm text-slate-300">Status da Conta</span></div><h3 className="text-2xl font-bold mb-1">{getPlanName()}</h3><p className={`text-sm mb-4 font-bold opacity-80`}>{isLifetime ? 'Acesso total liberado' : (timeLeft === 'Expirado' ? 'Renove sua licença' : 'Licença em vigor')}</p><div className="bg-white/10 p-3 rounded-lg border border-white/20 backdrop-blur-sm inline-block"><p className="text-xs text-slate-300 mb-1">{isLifetime ? 'Status da Licença' : 'Tempo Restante'}</p><code className={`font-mono font-bold tracking-widest text-lg ${licenseStatusColor}`}>{timeLeft}</code></div></div></div><div className={`bg-slate-50 border border-slate-200 rounded-xl p-4 transition-opacity ${isLifetime ? 'opacity-50 pointer-events-none' : ''}`}><h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2">{isLifetime ? <Lock size={18} className="text-green-600"/> : <Unlock size={18} className="text-blue-600"/>} {isLifetime ? 'Licença Vitalícia Ativada' : 'Ativar Nova Chave'}</h4><div className="flex flex-col sm:flex-row gap-3"><input type="text" value={activationKey} onChange={(e) => setActivationKey(e.target.value)} placeholder={isLifetime ? "Licença vitalícia já ativa" : "Cole sua chave aqui"} disabled={isLifetime} className="flex-1 border border-slate-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500 font-mono uppercase disabled:bg-slate-100"/><button onClick={handleActivateKey} disabled={isLifetime} className={`font-bold py-2 px-6 rounded-lg transition-colors text-sm ${isLifetime ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}>Ativar</button></div></div>
        </SettingsSection>

        {/* 6. PLANOS - UPDATED */}
        <SettingsSection title="Nossos Planos" icon={CreditCard} isOpen={openSection === 'plans'} onToggle={() => toggleSection('plans')}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {displayPlans.length === 0 && !isAdmin && (
                    <div className="col-span-full p-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
                        Nenhum plano disponível no momento.
                    </div>
                )}
                
                {displayPlans.map(plan => (
                    <div key={plan.key} className={`p-5 rounded-xl border relative overflow-hidden flex flex-col h-full transition-transform hover:scale-[1.02] ${plan.color} ${!plan.isVisible && isAdmin ? 'opacity-70 grayscale-[0.5]' : ''}`}>
                        
                        {/* ADMIN CONTROLS HEADER */}
                        {isAdmin && (
                            <div className="absolute top-0 right-0 p-2 flex gap-2 z-20">
                                <button 
                                    onClick={() => updatePlanConfig(plan.key!, { isVisible: !plan.isVisible })}
                                    className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm transition-colors ${plan.isVisible ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-100 text-red-700 border border-red-200'}`}
                                >
                                    {plan.isVisible ? <Eye size={14}/> : <EyeOff size={14}/>}
                                    {plan.isVisible ? 'Visível' : 'Oculto'}
                                </button>
                            </div>
                        )}

                        {!isAdmin && plan.isOnline && (
                            <div className="absolute top-0 right-0 bg-green-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider flex items-center gap-1">
                                <Zap size={10} fill="currentColor" /> Recomendado
                            </div>
                        )}

                        <div className="mb-4 pt-4">
                            <h4 className="font-bold text-slate-800 text-lg">{plan.name}</h4>
                            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide flex items-center gap-1 mt-1">
                                {plan.isOnline ? <Wifi size={12} className="text-green-600"/> : <WifiOff size={12} className="text-slate-400"/>}{plan.type}
                            </p>
                        </div>

                        {/* PRICE EDITING */}
                        <div className="flex items-baseline gap-1 mb-2">
                            {isAdmin ? (
                                <div className="flex items-center gap-1 bg-white/50 p-1 rounded border border-slate-200 w-full max-w-[150px]">
                                    <input 
                                        className="text-2xl font-bold text-slate-900 w-full bg-transparent outline-none"
                                        value={plan.price}
                                        onChange={(e) => updatePlanConfig(plan.key!, { price: e.target.value })}
                                    />
                                </div>
                            ) : (
                                <span className="text-2xl font-bold text-slate-900">{plan.price}</span>
                            )}
                            <span className="text-sm text-slate-500">{plan.period}</span>
                        </div>

                        <p className="text-xs text-slate-500 mb-4 h-8">{plan.description}</p>

                        {/* FEATURES LIST EDITING */}
                        <div className="space-y-2 mb-6 flex-1">
                            {plan.features?.map((feat: string, idx: number) => (
                                <div key={idx} className="flex items-center gap-2 text-sm text-slate-700 group/feat">
                                    <Check size={14} className="text-green-500 shrink-0" />
                                    {isAdmin ? (
                                        <div className="flex-1 flex gap-2">
                                            <input 
                                                className="flex-1 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none text-xs font-medium"
                                                value={feat}
                                                onChange={(e) => updatePlanFeature(plan.key!, idx, e.target.value)}
                                            />
                                            <button 
                                                onClick={() => removePlanFeature(plan.key!, idx)}
                                                className="opacity-0 group-hover/feat:opacity-100 text-red-400 hover:text-red-600 transition-opacity"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    ) : (
                                        <span className="text-xs font-medium">{feat}</span>
                                    )}
                                </div>
                            ))}
                            
                            {isAdmin && (
                                <button 
                                    onClick={() => addPlanFeature(plan.key!)}
                                    className="text-xs text-blue-600 font-bold flex items-center gap-1 mt-2 hover:bg-blue-50 px-2 py-1 rounded w-fit transition-colors"
                                >
                                    <Plus size={12} /> Adicionar Benefício
                                </button>
                            )}
                        </div>

                        <a 
                            href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(`Olá, gostaria de assinar o plano ${plan.name} por ${plan.price}.`)}`} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className={`w-full py-3 rounded-lg font-bold text-white text-sm flex items-center justify-center gap-2 transition-all shadow-md mt-auto ${plan.btnColor}`}
                        >
                            Assinar Agora
                        </a>
                    </div>
                ))}
            </div>
        </SettingsSection>

        {/* 7. SUPORTE */}
        <SettingsSection title="Suporte" icon={HelpCircle} isOpen={openSection === 'support'} onToggle={() => toggleSection('support')}>
            <div className="flex flex-col gap-6"><div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-center"><p className="text-sm text-blue-800 font-medium">Precisando de ajuda? Fale com nosso especialista.</p></div><div className="flex flex-col md:flex-row items-center gap-6"><div className="shrink-0 relative group"><div className="w-32 h-32 rounded-xl border border-slate-100 shadow-sm overflow-hidden bg-white relative flex items-center justify-center p-2"><img src={imageUrl} alt="Suporte Técnico" className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105" onError={(e) => { e.currentTarget.src = "https://ui-avatars.com/api/?name=Suporte+Tecnico&background=0D8ABC&color=fff&size=256"; }} /></div><div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full animate-pulse"></div></div><div className="text-center md:text-left space-y-2 flex-1 w-full"><h3 className="text-xl font-bold text-slate-800">Maicon Coutinho dos Santos</h3><p className="text-accent font-medium bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full text-[10px] inline-block uppercase tracking-wider">Suporte Especializado</p><div className="flex flex-col gap-2 text-slate-600 w-full mt-2"><div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100 text-sm"><Phone size={16} className="text-slate-400" /><span className="font-mono">41 98819 2359</span></div><div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100 text-sm"><Mail size={16} className="text-slate-400" /><span>mcn.coutinho@gmail.com</span></div></div></div></div><a href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noopener noreferrer" className="group relative w-full flex items-center justify-center gap-3 bg-green-500 hover:bg-green-600 text-white py-3 rounded-xl font-bold text-base shadow-lg hover:shadow-green-500/30 transition-all transform hover:-translate-y-1 overflow-hidden"><div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 skew-x-12"></div><MessageCircle size={20} className="animate-bounce" /><span>Suporte WhatsApp</span></a></div>
        </SettingsSection>
      </div>

      {/* CONFIRM RESTORE PASSWORD MODAL */}
      {showPasswordModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
                  <div className="p-6 text-center">
                      <div className="w-16 h-16 bg-blue-100 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4"><Lock size={32} /></div>
                      <h3 className="text-xl font-bold text-slate-800 mb-2">Segurança do Backup</h3>
                      <p className="text-slate-500 text-sm mb-4">Confirme sua senha atual para verificar a propriedade deste backup.</p>
                      <div className="mb-4"><input type="password" className="w-full text-center border-2 border-slate-200 rounded-lg p-3 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-bold text-slate-700" placeholder="Sua senha..." autoFocus value={restorePassword} onChange={(e) => setRestorePassword(e.target.value)} /></div>
                      <div className="flex flex-col gap-3"><button onClick={confirmRestoreWithPassword} disabled={isProcessing} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold transition-colors flex items-center justify-center gap-2 shadow-lg">{isProcessing && <Loader2 size={18} className="animate-spin"/>}{isProcessing ? 'Verificando...' : 'Confirmar Restauração'}</button><button onClick={() => { setShowPasswordModal(false); setPendingBackupContent(null); }} disabled={isProcessing} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-lg font-medium transition-colors">Cancelar</button></div>
                  </div>
              </div>
          </div>
      )}

      {/* SYNC CONFLICT MODAL (NEW) */}
      {showSyncConflictModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden relative">
                  <div className="p-6">
                      <div className="flex flex-col items-center text-center mb-6">
                          <div className="w-16 h-16 bg-orange-100 text-orange-500 rounded-full flex items-center justify-center mb-4 border border-orange-200 shadow-sm animate-pulse">
                              <RefreshCw size={32} />
                          </div>
                          <h3 className="text-xl font-bold text-slate-800 mb-2">Conflito de Sincronização</h3>
                          <p className="text-sm text-slate-500 leading-relaxed">
                              Detectamos dados locais neste dispositivo. O que você deseja fazer ao ativar a nuvem?
                          </p>
                      </div>

                      <div className="space-y-4">
                          <button 
                              onClick={handleRestoreFromCloud}
                              className="w-full bg-white border-2 border-blue-100 hover:border-blue-500 hover:bg-blue-50 p-4 rounded-xl flex items-center gap-4 transition-all group text-left relative overflow-hidden"
                          >
                              <div className="bg-blue-100 p-2 rounded-full text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors shrink-0">
                                  <Cloud size={24} />
                              </div>
                              <div>
                                  <span className="font-bold text-slate-800 block text-sm group-hover:text-blue-700">Restaurar backup da nuvem</span>
                                  <span className="text-xs text-slate-500">Apaga dados locais e baixa da nuvem.</span>
                              </div>
                          </button>

                          <button 
                              onClick={handleOverwriteCloud}
                              disabled={isProcessing}
                              className="w-full bg-white border-2 border-green-100 hover:border-green-500 hover:bg-green-50 p-4 rounded-xl flex items-center gap-4 transition-all group text-left relative overflow-hidden"
                          >
                              <div className="bg-green-100 p-2 rounded-full text-green-600 group-hover:bg-green-600 group-hover:text-white transition-colors shrink-0">
                                  {isProcessing ? <Loader2 className="animate-spin" size={24}/> : <Upload size={24} />}
                              </div>
                              <div>
                                  <span className="font-bold text-slate-800 block text-sm group-hover:text-green-700">Salvar dados atuais na nuvem</span>
                                  <span className="text-xs text-slate-500">Substitui o que está na nuvem por este dispositivo.</span>
                              </div>
                          </button>
                      </div>

                      <div className="mt-6 pt-4 border-t border-slate-100 text-center">
                          <button 
                              onClick={() => setShowSyncConflictModal(false)}
                              className="text-slate-400 hover:text-slate-600 text-sm font-medium"
                          >
                              Cancelar Ativação
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Confirmation Modal Render */}
      {confirmConfig && (
          <ConfirmModal 
              isOpen={confirmConfig.isOpen}
              onClose={() => setConfirmConfig(null)}
              onConfirm={confirmConfig.onConfirm}
              title={confirmConfig.title}
              message={confirmConfig.message}
              isDangerous={confirmConfig.isDangerous}
              confirmText={confirmConfig.confirmText || "Confirmar"}
          />
      )}

      {/* DELETE DATA MODAL */}
      {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
                  <div className="p-6">
                      <div className="flex flex-col items-center mb-4 text-center">
                          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-3">
                              <Trash2 size={32} />
                          </div>
                          <h3 className="text-xl font-bold text-slate-800">Excluir Dados Antigos</h3>
                          <p className="text-sm text-slate-500 mt-2">Esta ação apagará <b>imediatamente</b> e <b>permanentemente</b> os registros com data anterior ao período selecionado.</p>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-6 space-y-2"><p className="text-xs font-bold text-slate-500 uppercase mb-2">Selecione o que excluir:</p><label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-white rounded border border-transparent hover:border-slate-200 transition-colors"><input type="checkbox" className="w-5 h-5 accent-red-600 rounded" checked={deleteOptions.all} onChange={() => setDeleteOptions(prev => ({ all: !prev.all, revenues: !prev.all, payables: !prev.all, sales: !prev.all }))} /><span className="font-bold text-slate-700">Todos os Dados</span></label><div className={`space-y-2 pl-4 transition-opacity ${deleteOptions.all ? 'opacity-50 pointer-events-none' : ''}`}><label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" className="w-4 h-4 accent-red-600" checked={deleteOptions.revenues} onChange={() => setDeleteOptions(p => ({...p, revenues: !p.revenues}))} /><span className="text-sm text-slate-600">Apenas Receitas</span></label><label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" className="w-4 h-4 accent-red-600" checked={deleteOptions.payables} onChange={() => setDeleteOptions(p => ({...p, payables: !p.payables}))} /><span className="text-sm text-slate-600">Apenas Despesas</span></label><label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" className="w-4 h-4 accent-red-600" checked={deleteOptions.sales} onChange={() => setDeleteOptions(p => ({...p, sales: !p.sales}))} /><span className="text-sm text-slate-600">Planos e Vendas</span></label></div></div>
                      <div className="flex flex-col gap-3"><button onClick={handleExecuteDelete} disabled={isProcessing} className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-bold transition-colors flex items-center justify-center gap-2 shadow-lg">{isProcessing ? <Loader2 size={18} className="animate-spin"/> : <Trash2 size={18} />}{isProcessing ? 'Excluindo...' : 'CONFIRMAR EXCLUSÃO'}</button><button onClick={() => setShowDeleteModal(false)} disabled={isProcessing} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-lg font-medium transition-colors">Cancelar</button></div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

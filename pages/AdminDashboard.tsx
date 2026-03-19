
// ... existing imports
import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { Key, Copy, Clock, Shield, CheckCircle, XCircle, ChevronDown, ChevronUp, UserCheck, Star, Activity, Trash2, Globe, Users, Lock, Unlock, Eye, X, Power, User as UserIcon, Cloud, CloudOff } from 'lucide-react';
import { LicenseType, User } from '../types';
import { ConfirmModal } from '../components/ConfirmModal';

// ... (Cooldown logic remains same)
const getCooldownStatus = (lastChangeDate?: string | null) => {
  if (!lastChangeDate) return { canChange: true, daysRemaining: 0 };
  const last = new Date(lastChangeDate).getTime();
  const now = Date.now();
  const diffMs = now - last;
  const diffDays = diffMs / (1000 * 60 * 60 * 24); 
  if (diffDays >= 7) { // 7 Days Config
    return { canChange: true, daysRemaining: 0 };
  } else {
    return { canChange: false, daysRemaining: Math.ceil(7 - diffDays) };
  }
};

const CooldownBadge = ({ 
  label, 
  lastChangeDate, 
  userId, 
  type, 
  onReset 
}: { 
  label: string, 
  lastChangeDate?: string | null, 
  userId: string, 
  type: 'NAME' | 'PASSWORD' | 'EMAIL',
  onReset: (uid: string, t: 'NAME' | 'PASSWORD' | 'EMAIL') => void
}) => {
   const status = getCooldownStatus(lastChangeDate);

   const handleUnlock = () => {
      if (status.canChange) return;
      if (window.confirm(`Deseja liberar a alteração de ${label} para este usuário imediatamente?`)) {
         onReset(userId, type);
      }
   };

   return (
      <div 
        onClick={handleUnlock}
        className={`flex flex-col items-center justify-center p-4 rounded-lg border text-center transition-all select-none w-full
         ${status.canChange 
            ? 'bg-green-50 border-green-200 cursor-default' 
            : 'bg-red-50 border-red-200 hover:bg-red-100 shadow-sm hover:shadow-md cursor-pointer'
         }
      `}>
         <span className="text-xs font-bold uppercase text-slate-500 mb-2">{label}</span>
         
         {status.canChange ? (
            <span className="text-sm font-bold text-green-700 flex items-center gap-2">
               <Unlock size={14} /> Liberado
            </span>
         ) : (
            <span className="text-sm font-bold text-red-600 flex items-center gap-2">
               <Lock size={14} /> Bloqueado ({status.daysRemaining}d)
            </span>
         )}

         {lastChangeDate && (
            <span className="text-[10px] text-slate-400 mt-2">
               Última: {new Date(lastChangeDate).toLocaleDateString()}
            </span>
         )}

         {!status.canChange && (
            <span className="text-[9px] text-red-400 mt-1 font-bold animate-pulse">
               (Clique para liberar)
            </span>
         )}
      </div>
   );
}

export const AdminDashboard = () => {
  const { generateLicenseKey, adminGenerateAndActivate, adminDeleteUser, adminResetCooldown, adminToggleUserSync, users, licenseKeys, logs, currentUser, updateSettings, settings } = useStore();
  
  const [selectedLicenseType, setSelectedLicenseType] = useState<LicenseType>('trial_30min');
  const [selectedUserForKey, setSelectedUserForKey] = useState<string>(''); // User ID
  const [generatedKey, setGeneratedKey] = useState('');
  const [viewUserDetail, setViewUserDetail] = useState<User | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  
  const [confirmConfig, setConfirmConfig] = useState<{isOpen: boolean, title: string, message: string, onConfirm: () => void} | null>(null);

  if (currentUser?.role !== 'admin') {
      return <div className="p-8 text-center text-red-500 font-bold">Acesso Negado. Área restrita a Administradores.</div>;
  }

  // ... (handleGenerate, handleDeleteUser, copyToClipboard remain same)
  const handleGenerate = () => {
      setSuccessMessage('');
      setGeneratedKey('');

      if (selectedUserForKey) {
          const result = adminGenerateAndActivate(selectedLicenseType, selectedUserForKey);
          if (result.success) {
              setSuccessMessage(result.message);
          } else {
              alert("Erro ao ativar licença.");
          }
      } else {
          const key = generateLicenseKey(selectedLicenseType);
          setGeneratedKey(key);
      }
  };

  const handleDeleteUser = (id: string, name: string) => {
      setConfirmConfig({
          isOpen: true,
          title: "Excluir Usuário",
          message: `Tem certeza que deseja excluir o usuário ${name}? Todos os dados dele serão perdidos.`,
          onConfirm: () => adminDeleteUser(id)
      });
  };

  const handleSyncToggle = async (userId: string, currentStatus: boolean) => {
      await adminToggleUserSync(userId, !currentStatus);
      // Update local view manually for instant feedback (Store update might take a moment)
      if (viewUserDetail) {
          setViewUserDetail({ ...viewUserDetail, allowedCloudSync: !currentStatus });
      }
  };

  const copyToClipboard = () => {
      navigator.clipboard.writeText(generatedKey);
      alert('Chave copiada!');
  };

  const toggleLoginRequirement = () => {
      const newValue = !settings.loginEnabled;
      updateSettings({ ...settings, loginEnabled: newValue });
  };

  const getLicenseStatusDisplay = (user: User) => {
      if (user.role === 'admin') return { text: "Admin Supremo", color: "text-purple-600", icon: Star };
      if (user.licenseKey === 'FREE-TRIAL' || !user.licenseKey) return { text: "Versão Gratuita", color: "text-slate-400", icon: XCircle };
      if (user.id === 'guest_user') return { text: "Visitante", color: "text-orange-500", icon: UserIcon };
      
      const keyData = licenseKeys.find(k => k.key === user.licenseKey);
      let planText = "Ativa";
      if (keyData) {
          switch(keyData.type) {
              case 'monthly': planText = "Ativa Plano Mensal"; break;
              case 'monthly_fidelity': planText = "Ativa Plano Fidelidade"; break;
              case 'annual': planText = "Ativa Plano Anual"; break;
              case 'lifetime': planText = "Ativa Plano Vitalício"; break;
              case 'trial_30min': planText = "Ativa Teste (30m)"; break;
          }
      } else if (user.licenseKey.startsWith('ADMIN-')) {
          planText = "Ativa pelo Admin";
      }
      return { text: planText, color: "text-green-600", icon: CheckCircle };
  };

  // UPDATED VALIDITY DISPLAY LOGIC
  const getValidityDisplay = (user: User) => {
      if (user.role === 'admin') return { text: '31/12/2099', sub: 'Eterno', color: 'text-purple-600' };
      if (user.id === 'guest_user') return { text: 'Ilimitado', sub: 'Modo Local', color: 'text-orange-600' };
      if (!user.licenseExpiry) {
          const keyData = licenseKeys.find(k => k.key === user.licenseKey);
          if (keyData?.type === 'lifetime') return { text: 'Vitalício', sub: 'Sem vencimento', color: 'text-green-600' };
          return { text: '-', sub: '', color: 'text-slate-400' };
      }
      const expiry = new Date(user.licenseExpiry);
      const now = new Date();
      const diffTime = expiry.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const dateStr = expiry.toLocaleDateString('pt-BR');
      
      if (diffDays < 0) {
          return { text: dateStr, sub: `(Venceu há ${Math.abs(diffDays)} dias)`, color: 'text-red-500 font-bold', subColor: 'text-red-400' };
      }
      if (diffDays <= 7) {
          return { text: dateStr, sub: `(Faltam ${diffDays} dias)`, color: 'text-orange-600 font-bold', subColor: 'text-orange-500' };
      }
      return { text: dateStr, sub: `(Faltam ${diffDays} dias)`, color: 'text-slate-700', subColor: 'text-slate-400' };
  };

  const handleResetCooldown = async (uid: string, type: 'NAME' | 'PASSWORD' | 'EMAIL') => {
      await adminResetCooldown(uid, type);
      alert("Restrição removida.");
      setViewUserDetail(null);
  };

  const modalUser = viewUserDetail ? users.find(u => u.id === viewUserDetail.id) : null;

  return (
    <div className="p-4 md:p-8 bg-slate-50 min-h-screen">
      <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <Shield size={32} className="text-blue-600" />
            <div>
                <h2 className="text-3xl font-bold text-slate-800">Painel do Administrador</h2>
                <p className="text-sm text-slate-500 flex items-center gap-1">
                    <Globe size={12} className="text-green-500" /> Sistema Online (Firebase Sync)
                </p>
            </div>
          </div>
          <div className="text-right">
              <p className="text-sm font-bold text-slate-700">Olá, {currentUser?.username}</p>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* GERADOR DE CHAVES */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <h3 className="text-xl font-bold text-slate-700 mb-4 flex items-center gap-2">
                  <Key className="text-amber-500" /> Gerador / Ativador
              </h3>
              <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                      <div>
                          <label className="block text-sm font-medium text-slate-600 mb-2">Plano</label>
                          <select 
                            className="w-full p-3 border rounded-lg bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                            value={selectedLicenseType}
                            onChange={(e) => setSelectedLicenseType(e.target.value as LicenseType)}
                          >
                              <option value="trial_30min">Teste (30 Min)</option>
                              <option value="monthly">Mensal (30 Dias)</option>
                              <option value="monthly_fidelity">Mensal Fidelidade (30 Dias)</option>
                              <option value="annual">Anual (365 Dias)</option>
                              <option value="lifetime">Vitalício</option>
                          </select>
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-slate-600 mb-2">Ativar para Usuário</label>
                          <select 
                            className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm ${selectedUserForKey ? 'bg-green-50 border-green-200' : 'bg-slate-50'}`}
                            value={selectedUserForKey}
                            onChange={(e) => {
                                setSelectedUserForKey(e.target.value);
                                setGeneratedKey('');
                                setSuccessMessage('');
                            }}
                          >
                              <option value="">Apenas Gerar Código</option>
                              {users.filter(u => u.role !== 'admin' && u.id !== 'guest_user').map(user => (
                                  <option key={user.id} value={user.id}>
                                      {user.username}
                                  </option>
                              ))}
                          </select>
                      </div>
                  </div>
                  <button 
                    onClick={handleGenerate}
                    className={`w-full font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 ${
                        selectedUserForKey 
                        ? 'bg-green-600 hover:bg-green-700 text-white shadow-green-500/20 shadow-lg' 
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                      {selectedUserForKey ? <><UserCheck size={20}/> Ativar Licença Automaticamente</> : 'Gerar Chave Copiável'}
                  </button>
                  {successMessage && (
                      <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200 animate-fade-in flex items-center gap-3">
                          <CheckCircle className="text-green-600" size={24} />
                          <div>
                              <p className="text-green-800 font-bold">Operação Concluída!</p>
                              <p className="text-sm text-green-700">{successMessage}</p>
                          </div>
                      </div>
                  )}
                  {generatedKey && !selectedUserForKey && (
                      <div className="mt-4 p-4 bg-slate-100 rounded-lg border border-slate-200 animate-fade-in">
                          <div className="flex items-center gap-2">
                              <code className="flex-1 font-mono text-lg font-bold text-slate-800 break-all">{generatedKey}</code>
                              <button onClick={copyToClipboard} className="p-2 bg-white rounded border hover:bg-slate-50"><Copy size={20} /></button>
                          </div>
                      </div>
                  )}
              </div>
          </div>

          {/* CONTROLE DE ACESSO */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between">
               <div>
                   <h3 className="text-xl font-bold text-slate-700 mb-4 flex items-center gap-2">
                       <Lock className="text-slate-500" /> Controle de Acesso
                   </h3>
                   <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-4">
                       <div className="flex items-center justify-between">
                           <div>
                               <h4 className="font-bold text-slate-800">Exigir Login ao Iniciar</h4>
                               <p className="text-xs text-slate-500 mt-1 max-w-[250px]">
                                   Se desativado, o sistema entrará automaticamente como "Visitante". Use o cadeado no menu lateral para logar como Admin.
                               </p>
                           </div>
                           <button 
                               onClick={toggleLoginRequirement}
                               className={`w-14 h-8 rounded-full p-1 transition-colors relative ${settings.loginEnabled ? 'bg-blue-600' : 'bg-slate-300'}`}
                           >
                               <div className={`w-6 h-6 rounded-full bg-white shadow-sm transition-transform ${settings.loginEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                           </button>
                       </div>
                       <div className="mt-2 text-xs font-bold text-right">
                           {settings.loginEnabled ? <span className="text-blue-600">ATIVADO</span> : <span className="text-slate-500">DESATIVADO (Modo Visitante)</span>}
                       </div>
                   </div>
               </div>

               {/* LOGS */}
               <div className="bg-white border-t border-slate-100 pt-4 flex-1 overflow-hidden flex flex-col">
                   <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2"><Activity size={16}/> Logs Recentes</h4>
                   <div className="flex-1 overflow-y-auto text-xs space-y-2 max-h-40">
                       {logs.slice(0, 10).map(log => (
                           <div key={log.id} className="border-b border-slate-100 pb-1">
                               <div className="flex justify-between font-bold text-slate-600">
                                   <span>{log.username}</span>
                                   <span className="text-slate-400">{new Date(log.timestamp).toLocaleTimeString()}</span>
                               </div>
                               <div className="text-slate-500 truncate">{log.action}: {log.details}</div>
                           </div>
                       ))}
                   </div>
               </div>
          </div>
      </div>

      {/* LISTA DE USUÁRIOS */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50">
              <h3 className="text-xl font-bold text-slate-700 flex items-center gap-2">
                  <Users className="text-blue-600" /> Gerenciar Usuários
              </h3>
          </div>
          <div className="overflow-x-auto">
              <table className="w-full text-left">
                  <thead className="bg-white text-slate-500 text-sm border-b border-slate-100">
                      <tr>
                          <th className="p-4">Usuário</th>
                          <th className="p-4">Status Online</th>
                          <th className="p-4">Licença Atual</th>
                          <th className="p-4">Validade</th>
                          <th className="p-4 text-right">Ações</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {users.map(user => {
                          const licenseStatus = getLicenseStatusDisplay(user);
                          const validity = getValidityDisplay(user);
                          
                          return (
                              <tr key={user.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setViewUserDetail(user)}>
                                  <td className="p-4 font-medium text-slate-800">
                                      {user.username}
                                      {user.role === 'admin' && <span className="ml-2 bg-purple-100 text-purple-700 text-[10px] px-2 py-0.5 rounded-full">ADMIN</span>}
                                      {user.id === 'guest_user' && <span className="ml-2 bg-orange-100 text-orange-700 text-[10px] px-2 py-0.5 rounded-full">VISITANTE</span>}
                                      <div className="text-xs text-slate-400">{user.email}</div>
                                  </td>
                                  <td className="p-4">
                                      {user.isOnline ? (
                                          <span className="flex items-center gap-1 text-green-600 text-xs font-bold"><div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div> ONLINE</span>
                                      ) : (
                                          <span className="text-slate-400 text-xs">OFFLINE</span>
                                      )}
                                      <div className="text-[10px] text-slate-400">Último login: {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : '-'}</div>
                                  </td>
                                  <td className="p-4">
                                      <span className={`flex items-center gap-1 text-sm font-medium ${licenseStatus.color}`}>
                                          <licenseStatus.icon size={14}/> {licenseStatus.text}
                                      </span>
                                  </td>
                                  <td className="p-4 text-sm">
                                      <div className={validity.color}>{validity.text}</div>
                                      {validity.sub && <div className={`text-xs ${validity.subColor || 'text-slate-400'}`}>{validity.sub}</div>}
                                  </td>
                                  <td className="p-4 text-right">
                                      <button className="text-blue-600 hover:text-blue-800 text-xs font-bold border border-blue-200 px-3 py-1 rounded">Ver Detalhes</button>
                                  </td>
                              </tr>
                          );
                      })}
                  </tbody>
              </table>
          </div>
      </div>

      {/* USER DETAILS MODAL */}
      {modalUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh] overflow-hidden">
                  <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
                      <div>
                          <h3 className="font-bold text-xl text-slate-800 flex items-center gap-2">
                              <Users size={24} className="text-blue-600"/> {modalUser.username}
                          </h3>
                          <p className="text-sm text-slate-500">Detalhes de Segurança e Logs</p>
                      </div>
                      <button onClick={() => setViewUserDetail(null)} className="p-2 bg-white rounded-full hover:bg-slate-200 text-slate-500 transition-colors">
                          <X size={20} />
                      </button>
                  </div>

                  <div className="p-6 overflow-y-auto flex-1">
                      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm mb-6">
                          <h4 className="font-bold text-slate-700 mb-4 border-b pb-2">Credenciais Atuais</h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="p-3 bg-slate-50 rounded border border-slate-100">
                                  <span className="text-xs font-bold text-slate-400 uppercase block mb-1">Usuário</span>
                                  <span className="font-mono font-medium text-slate-800">{modalUser.username}</span>
                              </div>
                              <div className="p-3 bg-slate-50 rounded border border-slate-100">
                                  <span className="text-xs font-bold text-slate-400 uppercase block mb-1">Senha Atual</span>
                                  <span className="font-mono font-medium text-slate-800 group relative">
                                      {modalUser.password}
                                  </span>
                              </div>
                              <div className="p-3 bg-slate-50 rounded border border-slate-100">
                                  <span className="text-xs font-bold text-slate-400 uppercase block mb-1">Email</span>
                                  <span className="font-mono font-medium text-slate-800">{modalUser.email || '-'}</span>
                              </div>
                          </div>
                      </div>

                      {/* NEW: MANUAL SYNC TOGGLE */}
                      <div className="bg-blue-50 p-5 rounded-xl border border-blue-200 shadow-sm mb-6">
                          <div className="flex justify-between items-center">
                              <div>
                                  <h4 className="font-bold text-blue-900 flex items-center gap-2">
                                      <Cloud size={18} /> Sincronização em Nuvem (Manual)
                                  </h4>
                                  <p className="text-xs text-blue-700 mt-1 max-w-md">
                                      Ative para permitir que este usuário faça backup de produtos/vendas na nuvem, independente do plano.
                                  </p>
                              </div>
                              <button 
                                  onClick={() => handleSyncToggle(modalUser.id, modalUser.allowedCloudSync || false)}
                                  className={`px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-colors ${modalUser.allowedCloudSync ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-slate-300 text-slate-600 hover:bg-slate-400'}`}
                              >
                                  {modalUser.allowedCloudSync ? <CheckCircle size={16} /> : <CloudOff size={16} />}
                                  {modalUser.allowedCloudSync ? 'ATIVADO' : 'DESATIVADO'}
                              </button>
                          </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm h-full">
                              <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><Shield size={18} /> Segurança & Restrições</h4>
                              <div className="flex flex-col gap-3">
                                  <CooldownBadge label="TROCA DE NOME" lastChangeDate={modalUser.lastUsernameChange} userId={modalUser.id} type="NAME" onReset={handleResetCooldown}/>
                                  <CooldownBadge label="TROCA DE SENHA" lastChangeDate={modalUser.lastPasswordChange} userId={modalUser.id} type="PASSWORD" onReset={handleResetCooldown}/>
                                  <CooldownBadge label="TROCA DE EMAIL" lastChangeDate={modalUser.lastEmailChange} userId={modalUser.id} type="EMAIL" onReset={handleResetCooldown}/>
                              </div>
                          </div>
                          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm h-full flex flex-col">
                              <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><Activity size={18} /> Histórico</h4>
                              <div className="flex-1 overflow-y-auto max-h-[300px] border rounded-lg bg-slate-50 p-2 space-y-2">
                                  {modalUser.history && modalUser.history.length > 0 ? (
                                      modalUser.history.map((h, i) => (
                                          <div key={i} className="bg-white p-3 rounded border border-slate-100 shadow-sm">
                                              <div className="flex justify-between items-center mb-1"><span className="w-2 h-2 rounded-full bg-purple-500"></span><span className="text-[10px] text-slate-400">{new Date(h.date).toLocaleDateString()} {new Date(h.date).toLocaleTimeString()}</span></div>
                                              <p className="text-sm font-bold text-slate-700 ml-3">{h.action}</p>
                                          </div>
                                      ))
                                  ) : <p className="text-center text-slate-400 text-sm py-10">Nenhum histórico.</p>}
                              </div>
                          </div>
                      </div>
                      
                      <div className="mt-6 border-t border-slate-200 pt-4 flex justify-end">
                          {modalUser.role !== 'admin' && modalUser.id !== 'guest_user' && (
                              <button onClick={() => { setViewUserDetail(null); handleDeleteUser(modalUser.id, modalUser.username); }} className="text-red-600 hover:text-red-700 font-bold flex items-center gap-2 px-4 py-2 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={18} /> Excluir Este Usuário</button>
                          )}
                      </div>
                  </div>
              </div>
          </div>
      )}

      {confirmConfig && <ConfirmModal isOpen={confirmConfig.isOpen} onClose={() => setConfirmConfig(null)} onConfirm={confirmConfig.onConfirm} title={confirmConfig.title} message={confirmConfig.message} isDangerous={true} confirmText="Sim, Excluir" />}
    </div>
  );
};

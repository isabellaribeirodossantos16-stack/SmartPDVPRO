
import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { User, Lock, Mail, ArrowRight, UserPlus, RefreshCw, KeyRound, AlertTriangle, Loader2 } from 'lucide-react';

type AuthMode = 'login' | 'register' | 'forgot_password';

export const Login = () => {
  const { login, registerUser, resetUserPassword } = useStore();
  const [mode, setMode] = useState<AuthMode>('login');
  
  // Form States
  const [formData, setFormData] = useState({
      username: '', 
      email: '',    
      password: '',
      confirmPassword: '',
      newPassword: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormData({...formData, [e.target.name]: e.target.value});
      setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setSuccess('');
      setIsLoading(true);

      try {
          if (mode === 'login') {
              if (!formData.username || !formData.password) {
                  setError('Preencha usuário e senha.');
                  setIsLoading(false);
                  return;
              }
              const ok = await login(formData.username, formData.password);
              if (!ok) {
                 setError('Usuário ou senha incorretos.');
              }
          } 
          else if (mode === 'register') {
              if (formData.password !== formData.confirmPassword) {
                  setError('As senhas não coincidem.');
                  setIsLoading(false);
                  return;
              }
              
              const result = await registerUser({ username: formData.username, password: formData.password, email: formData.email });
              
              if (result.success) {
                  setSuccess(result.message);
                  setMode('login');
                  setFormData({ username: '', password: '', email: '', confirmPassword: '', newPassword: '' });
              } else {
                  setError(result.message);
              }
          }
          else if (mode === 'forgot_password') {
              if (formData.newPassword !== formData.confirmPassword) {
                  setError('As novas senhas não coincidem.');
                  setIsLoading(false);
                  return;
              }

              const result = await resetUserPassword(formData.username, formData.email, formData.newPassword);
              
              if (result.success) {
                  setSuccess(result.message);
                  setMode('login');
                  setFormData({ username: '', password: '', email: '', confirmPassword: '', newPassword: '' });
              } else {
                  setError(result.message);
              }
          }
      } catch (err: any) {
          setError(err.message || 'Erro inesperado.');
      } finally {
          setIsLoading(false);
      }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
        {/* Background Animation */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
            <div className="absolute -top-[50%] -left-[50%] w-[200%] h-[200%] bg-[radial-gradient(circle,_rgba(59,130,246,0.1)_0%,_transparent_50%)] animate-spin-slow"></div>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md relative z-10 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-8 text-white text-center">
                <h2 className="text-3xl font-bold mb-1">SmartPDV Pro</h2>
                <p className="text-blue-100 text-sm">Gestão Inteligente & Segura</p>
            </div>

            <div className="p-8">
                <h3 className="text-xl font-bold text-slate-800 mb-6 text-center">
                    {mode === 'login' && 'Acesse sua Conta'}
                    {mode === 'register' && 'Crie sua Conta'}
                    {mode === 'forgot_password' && 'Redefinir Senha'}
                </h3>

                {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg flex items-center gap-2 animate-fade-in">
                        <AlertTriangle size={16} /> {error}
                    </div>
                )}
                
                {success && (
                    <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-600 text-sm rounded-lg flex items-center gap-2 animate-fade-in">
                        <UserPlus size={16} /> {success}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    
                    {/* LOGIN FIELDS */}
                    {mode === 'login' && (
                        <>
                            <div className="relative">
                                <User className="absolute left-3 top-3 text-slate-400" size={20} />
                                <input name="username" type="text" placeholder="Usuário" className="w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" required onChange={handleInputChange} value={formData.username} />
                            </div>
                            <div className="relative">
                                <Lock className="absolute left-3 top-3 text-slate-400" size={20} />
                                <input name="password" type="password" placeholder="Senha" className="w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" required onChange={handleInputChange} value={formData.password} />
                            </div>
                        </>
                    )}

                    {/* REGISTER FIELDS */}
                    {mode === 'register' && (
                        <>
                             <div className="relative">
                                <User className="absolute left-3 top-3 text-slate-400" size={20} />
                                <input name="username" type="text" placeholder="Nome de Usuário (Exibição)" className="w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" required onChange={handleInputChange} value={formData.username} />
                            </div>
                            <div className="relative">
                                <Mail className="absolute left-3 top-3 text-slate-400" size={20} />
                                <input name="email" type="email" placeholder="Seu Email" className="w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" required onChange={handleInputChange} value={formData.email} />
                            </div>
                            <div className="relative">
                                <Lock className="absolute left-3 top-3 text-slate-400" size={20} />
                                <input name="password" type="password" placeholder="Crie uma Senha" className="w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" required onChange={handleInputChange} value={formData.password} />
                            </div>
                            <div className="relative">
                                <Lock className="absolute left-3 top-3 text-slate-400" size={20} />
                                <input name="confirmPassword" type="password" placeholder="Confirme a Senha" className="w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" required onChange={handleInputChange} value={formData.confirmPassword} />
                            </div>
                        </>
                    )}

                    {/* FORGOT PASSWORD FIELDS */}
                    {mode === 'forgot_password' && (
                        <>
                            <div className="text-xs text-slate-500 mb-2">Confirme seus dados para redefinir:</div>
                            <div className="relative">
                                <User className="absolute left-3 top-3 text-slate-400" size={20} />
                                <input name="username" type="text" placeholder="Seu Usuário" className="w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" required onChange={handleInputChange} value={formData.username} />
                            </div>
                            <div className="relative">
                                <Mail className="absolute left-3 top-3 text-slate-400" size={20} />
                                <input name="email" type="email" placeholder="Seu Email Cadastrado" className="w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" required onChange={handleInputChange} value={formData.email} />
                            </div>
                            <div className="border-t pt-2 mt-2">
                                <div className="text-xs text-slate-500 mb-2">Nova Senha:</div>
                                <div className="relative mb-2">
                                    <KeyRound className="absolute left-3 top-3 text-slate-400" size={20} />
                                    <input name="newPassword" type="password" placeholder="Nova Senha" className="w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" required onChange={handleInputChange} value={formData.newPassword} />
                                </div>
                                <div className="relative">
                                    <KeyRound className="absolute left-3 top-3 text-slate-400" size={20} />
                                    <input name="confirmPassword" type="password" placeholder="Confirme Nova Senha" className="w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" required onChange={handleInputChange} value={formData.confirmPassword} />
                                </div>
                            </div>
                        </>
                    )}

                    <button disabled={isLoading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-50 disabled:cursor-not-allowed">
                        {isLoading ? <Loader2 className="animate-spin" size={20} /> : (
                            <>
                                {mode === 'login' && 'ENTRAR'}
                                {mode === 'register' && 'CRIAR CONTA'}
                                {mode === 'forgot_password' && 'REDEFINIR SENHA'}
                                <ArrowRight size={20} />
                            </>
                        )}
                    </button>
                </form>

                {/* Footer Links */}
                <div className="mt-6 flex flex-col gap-2 text-center text-sm">
                    {mode === 'login' && (
                        <>
                             <button onClick={() => setMode('forgot_password')} className="text-slate-500 hover:text-blue-600">
                                Esqueci a senha
                            </button>
                            <div className="mt-2">
                                <button onClick={() => setMode('register')} className="text-blue-600 font-bold hover:underline">Criar Nova Conta</button>
                            </div>
                        </>
                    )}

                    {mode !== 'login' && (
                        <button onClick={() => { setMode('login'); setError(''); setSuccess(''); }} className="text-slate-500 hover:text-blue-600 mt-2">
                            Voltar para Login
                        </button>
                    )}
                </div>
            </div>
        </div>
    </div>
  );
};

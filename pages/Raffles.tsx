
import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { Trophy, Users, Hash, Type, X, Play, Save, History, Plus, Trash2, CheckCircle, ArrowLeft, RefreshCw, Layers, Eye, PenLine } from 'lucide-react';
// @ts-ignore
import html2canvas from "html2canvas";
import { Raffle, RaffleWinner } from '../types';

export const Raffles = () => {
  const { customers, raffles, addRaffle } = useStore();
  const [view, setView] = useState<'menu' | 'setup_clients' | 'setup_numbers' | 'setup_names' | 'animation' | 'result' | 'history'>('menu');
  
  // Data for setup
  const [raffleTitle, setRaffleTitle] = useState(''); // NEW: Custom Title
  const [maxNumber, setMaxNumber] = useState<number>(100);
  const [customNames, setCustomNames] = useState<string[]>([]);
  const [newNameInput, setNewNameInput] = useState('');
  const [targetWinners, setTargetWinners] = useState<number>(1); // How many winners to draw
  
  // Data for Execution
  const [pool, setPool] = useState<string[]>([]); // Current pool of candidates
  const [poolType, setPoolType] = useState<'clients' | 'numbers' | 'names'>('clients');
  
  // Session State (Sequential Draw)
  const [currentRound, setCurrentRound] = useState<number>(1); // 1st winner, 2nd winner...
  const [sessionWinners, setSessionWinners] = useState<RaffleWinner[]>([]); // NEW: Accumulate winners
  const [currentWinnerVal, setCurrentWinnerVal] = useState<string>(''); // For big display
  const [animationValue, setAnimationValue] = useState<string>('...');
  
  // History Modal Details
  const [selectedRaffleDetails, setSelectedRaffleDetails] = useState<Raffle | null>(null);

  // Ref for saving image
  const resultRef = useRef<HTMLDivElement>(null); // For single result visual
  const fullListRef = useRef<HTMLDivElement>(null); // NEW: For full list screenshot

  // --- HANDLERS ---

  const resetSetup = () => {
      setRaffleTitle('');
      setTargetWinners(1);
      setCurrentRound(1);
      setSessionWinners([]);
      setCurrentWinnerVal('');
  };

  const handleStartClients = () => {
      const activeCustomers = customers.filter(c => c.id !== 'def' && c.name);
      if (activeCustomers.length < 2) {
          alert("É necessário ter pelo menos 2 clientes cadastrados para realizar o sorteio.");
          return;
      }
      // Prepare pool immediately for count validation
      setPool(activeCustomers.map(c => c.name));
      setPoolType('clients');
      resetSetup();
      setView('setup_clients');
  };

  const handleStartNumbers = () => {
      setPoolType('numbers');
      resetSetup();
      setView('setup_numbers');
  };

  const handleStartNames = () => {
      setPoolType('names');
      setCustomNames([]);
      resetSetup();
      setView('setup_names');
  };

  const addCustomName = () => {
      if (newNameInput.trim()) {
          setCustomNames([...customNames, newNameInput.trim()]);
          setNewNameInput('');
      }
  };

  const removeCustomName = (idx: number) => {
      setCustomNames(customNames.filter((_, i) => i !== idx));
  };

  const confirmSetup = () => {
      let finalPool: string[] = [];

      if (poolType === 'numbers') {
          if (maxNumber < 2) { alert("O número máximo deve ser pelo menos 2."); return; }
          finalPool = Array.from({ length: maxNumber }, (_, i) => (i + 1).toString());
      } else if (poolType === 'names') {
          if (customNames.length < 2) { alert("Adicione pelo menos 2 nomes."); return; }
          finalPool = customNames;
      } else {
          // Clients already set in handleStartClients
          finalPool = Array.from(new Set(pool)) as string[];
      }

      // Validation for winners count
      if (targetWinners < 1) {
          alert("Defina pelo menos 1 ganhador.");
          return;
      }
      if (targetWinners > finalPool.length) {
          alert(`Você definiu ${targetWinners} ganhadores, mas só existem ${finalPool.length} participantes.`);
          return;
      }

      setPool(finalPool);
      setCurrentRound(1);
      setSessionWinners([]); // Ensure empty start
      setView('animation');
  };

  const handleNextDraw = () => {
      // Logic handled in Result Screen, just switch view to animation
      setView('animation');
  };

  const handleFinalizeSession = () => {
      // Create ONE record for the entire session
      let details = '';
      if (poolType === 'numbers') details = `Números (1-${maxNumber})`;
      else if (poolType === 'names') details = `Nomes Avulsos (${pool.length + sessionWinners.length} total)`;
      else details = `Clientes (${pool.length + sessionWinners.length} total)`;

      addRaffle({
          id: Date.now().toString(),
          type: poolType,
          title: raffleTitle || getPoolTypeName(poolType), // SAVE CUSTOM TITLE OR DEFAULT
          date: new Date().toISOString(),
          winners: sessionWinners, // Save the array
          details: details
      });

      setView('menu');
  };

  // --- ANIMATION LOGIC ---
  useEffect(() => {
      if (view === 'animation') {
          let interval: any;
          let counter = 0;
          const duration = 3000; // 3 seconds
          const speed = 50; // Update every 50ms

          const runAnimation = () => {
              if (pool.length === 0) return; // Safety check

              const randomIndex = Math.floor(Math.random() * pool.length);
              setAnimationValue(pool[randomIndex]);
              counter += speed;

              if (counter >= duration) {
                  clearInterval(interval);
                  const finalIndex = Math.floor(Math.random() * pool.length);
                  const win = pool[finalIndex];
                  
                  setCurrentWinnerVal(win);
                  setAnimationValue(win);
                  
                  // Add to session winners (Accumulate)
                  const newWinnerObj = { position: currentRound, text: win };
                  setSessionWinners(prev => [...prev, newWinnerObj]);

                  // Remove winner from pool for next round (to avoid duplicates in same session)
                  const newPool = [...pool];
                  newPool.splice(finalIndex, 1);
                  setPool(newPool);

                  setTimeout(() => {
                      setView('result');
                  }, 500); 
              }
          };

          interval = setInterval(runAnimation, speed);
          return () => clearInterval(interval);
      }
  }, [view, poolType, maxNumber, currentRound]); // Removed 'pool' dependency to avoid loop

  const saveImage = async () => {
      // Changed target from resultRef to fullListRef to capture the list
      const targetRef = fullListRef.current; 
      if (!targetRef) return;
      
      try {
          const canvas = await html2canvas(targetRef, {
              backgroundColor: '#ffffff',
              scale: 2
          });
          const image = canvas.toDataURL("image/png");
          const link = document.createElement('a');
          link.href = image;
          link.download = `resultado_sorteio_${Date.now()}.png`;
          link.click();
      } catch (e) {
          alert("Erro ao salvar imagem.");
      }
  };

  const getPoolTypeName = (type: string) => {
      switch(type) {
          case 'clients': return 'Clientes';
          case 'numbers': return 'Números';
          case 'names': return 'Nomes';
          default: return 'Sorteio';
      }
  };

  // --- RENDER ---

  if (view === 'animation') {
      return (
          <div className="fixed inset-0 z-[100] bg-slate-900 flex flex-col items-center justify-center animate-fade-in text-white cursor-none select-none">
              <div className="text-slate-400 text-sm font-bold tracking-widest uppercase mb-8 animate-pulse">
                  Sorteando {currentRound}º Ganhador...
              </div>
              <div className="text-6xl md:text-8xl font-bold bg-gradient-to-r from-orange-400 to-yellow-400 bg-clip-text text-transparent text-center px-4 leading-tight">
                  {animationValue}
              </div>
              <div className="mt-12 text-slate-500 text-sm">
                  Aguarde o resultado...
              </div>
          </div>
      );
  }

  if (view === 'result') {
      const hasMoreWinners = currentRound < targetWinners;

      return (
          <div className="flex flex-col md:flex-row h-screen bg-slate-50 overflow-hidden">
              
              {/* --- HIDDEN CONTAINER FOR SCREENSHOT GENERATION --- */}
              <div 
                  ref={fullListRef} 
                  className="fixed left-[-9999px] top-0 w-[600px] bg-white p-10 rounded-none z-[-1] flex flex-col items-center border border-slate-200"
              >
                  <div className="text-center mb-8 w-full border-b border-slate-100 pb-6">
                      <Trophy size={64} className="text-yellow-500 mx-auto mb-4" />
                      <h1 className="text-3xl font-black text-slate-800 uppercase tracking-wide">{raffleTitle || 'Resultado do Sorteio'}</h1>
                      <p className="text-slate-500 mt-2 font-medium">{new Date().toLocaleDateString('pt-BR')} • {new Date().toLocaleTimeString('pt-BR')}</p>
                      <div className="mt-2 text-sm text-slate-400 bg-slate-50 inline-block px-3 py-1 rounded-full">
                          Modalidade: {getPoolTypeName(poolType)}
                      </div>
                  </div>

                  <div className="w-full space-y-4">
                      {sessionWinners.sort((a,b) => a.position - b.position).map((w, idx) => (
                          <div key={idx} className="flex items-center gap-6 p-4 rounded-2xl border-2 border-slate-100 bg-slate-50/50">
                              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 text-white flex items-center justify-center font-black text-2xl shadow-lg shadow-orange-200">
                                  {w.position}º
                              </div>
                              <div className="flex-1">
                                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Ganhador</p>
                                  <p className="text-3xl font-bold text-slate-800 leading-tight">{w.text}</p>
                              </div>
                          </div>
                      ))}
                  </div>

                  <div className="mt-10 pt-6 border-t border-slate-100 w-full text-center">
                      <p className="text-slate-400 font-bold text-sm">Realizado via SmartPDV Pró</p>
                  </div>
              </div>
              {/* -------------------------------------------------- */}

              {/* Sidebar Result Actions */}
              <div className="w-full md:w-96 bg-white border-b md:border-r border-slate-200 p-6 flex flex-col justify-between shrink-0 h-auto md:h-full z-10 shadow-lg overflow-hidden">
                  <div className="flex flex-col h-full">
                      <div className="flex items-center gap-2 mb-6 shrink-0">
                          <Trophy className="text-yellow-500" size={24} />
                          <h2 className="text-xl font-bold text-slate-800">Resultados da Sessão</h2>
                      </div>
                      
                      {/* LIST OF ALL WINNERS IN SESSION */}
                      <div className="flex-1 overflow-y-auto pr-2 space-y-2 mb-4">
                          {sessionWinners.sort((a,b) => b.position - a.position).map((winner, idx) => (
                              <div key={idx} className={`p-3 rounded-lg border flex items-center gap-3 ${winner.position === currentRound ? 'bg-yellow-50 border-yellow-200 shadow-sm' : 'bg-slate-50 border-slate-100 opacity-70'}`}>
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${winner.position === currentRound ? 'bg-yellow-200 text-yellow-800' : 'bg-slate-200 text-slate-600'}`}>
                                      {winner.position}º
                                  </div>
                                  <div className="font-bold text-slate-800 line-clamp-1">{winner.text}</div>
                                  {winner.position === currentRound && <span className="ml-auto text-[10px] font-bold text-yellow-600 uppercase">Novo</span>}
                              </div>
                          ))}
                      </div>

                      <div className="shrink-0 mt-auto pt-4 border-t border-slate-100">
                          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-center mb-4">
                              <span className="text-xs text-slate-500 block mb-1">Progresso do Sorteio</span>
                              <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                                  <div className="h-full bg-green-500 transition-all duration-500" style={{ width: `${(currentRound / targetWinners) * 100}%` }}></div>
                              </div>
                              <p className="text-xs font-bold text-slate-600 mt-2">{currentRound} de {targetWinners} sorteados</p>
                          </div>

                          <div className="space-y-3">
                              <button onClick={saveImage} className="w-full bg-blue-100 hover:bg-blue-200 text-blue-700 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors">
                                  <Save size={18} /> Salvar Foto (Lista Completa)
                              </button>
                              
                              {hasMoreWinners ? (
                                  <button 
                                      onClick={() => {
                                          setCurrentRound(prev => prev + 1);
                                          handleNextDraw();
                                      }} 
                                      className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors shadow-lg hover:shadow-green-500/20 animate-pulse"
                                  >
                                      <RefreshCw size={20} /> Sortear Próximo ({targetWinners - currentRound})
                                  </button>
                              ) : (
                                  <button onClick={handleFinalizeSession} className="w-full bg-slate-800 hover:bg-slate-900 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors">
                                      <CheckCircle size={18} /> Finalizar Sorteio
                                  </button>
                              )}
                          </div>
                      </div>
                  </div>
              </div>

              {/* Main Result Display (Focus on Current Winner) */}
              <div ref={resultRef} className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50 relative">
                  <div className="absolute top-8 text-center opacity-30">
                      <h1 className="text-2xl font-bold text-slate-800 uppercase tracking-[0.2em]">{raffleTitle || 'Sorteio Oficial'}</h1>
                  </div>
                  
                  <div className="relative">
                      {/* Confetti / Decor */}
                      <div className="absolute -top-10 -left-10 text-yellow-400 animate-bounce" style={{animationDelay: '0s'}}>✨</div>
                      <div className="absolute -bottom-10 -right-10 text-yellow-400 animate-bounce" style={{animationDelay: '0.2s'}}>✨</div>
                      <div className="absolute top-1/2 -right-20 text-blue-400 animate-pulse">🎉</div>
                      <div className="absolute top-1/2 -left-20 text-purple-400 animate-pulse">🎉</div>

                      <div className="text-center">
                          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">
                              {currentRound}º Vencedor
                          </p>
                          <div className="text-6xl md:text-8xl font-black text-slate-800 drop-shadow-lg scale-110 transition-transform">
                              {currentWinnerVal}
                          </div>
                          <div className="mt-8 inline-block px-6 py-2 bg-gradient-to-r from-orange-500 to-pink-500 text-white rounded-full text-sm font-bold shadow-lg">
                              Parabéns!
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      );
  }

  // --- MENU & HISTORY ---
  return (
    <div className="p-4 md:p-8 bg-slate-50 min-h-screen animate-fade-in flex flex-col">
      {/* HEADER */}
      <div className="text-center mb-10 mt-4">
          <h2 className="text-3xl font-bold text-slate-800 mb-2">Central de Sorteios</h2>
          <p className="text-slate-500">Escolha uma modalidade para começar</p>
      </div>

      {view === 'menu' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto w-full mb-8">
                <button onClick={handleStartClients} className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-xl hover:border-blue-200 transition-all group text-center h-64 flex flex-col items-center justify-center">
                    <div className="bg-blue-50 p-4 rounded-full text-blue-600 mb-4 group-hover:scale-110 transition-transform">
                        <Users size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">Clientes Cadastrados</h3>
                    <p className="text-sm text-slate-500">Sorteie entre sua base ativa.</p>
                </button>

                <button onClick={handleStartNumbers} className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-xl hover:border-purple-200 transition-all group text-center h-64 flex flex-col items-center justify-center">
                    <div className="bg-purple-50 p-4 rounded-full text-purple-600 mb-4 group-hover:scale-110 transition-transform">
                        <Hash size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">Números</h3>
                    <p className="text-sm text-slate-500">Gere números aleatórios.</p>
                </button>

                <button onClick={handleStartNames} className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-xl hover:border-pink-200 transition-all group text-center h-64 flex flex-col items-center justify-center">
                    <div className="bg-pink-50 p-4 rounded-full text-pink-600 mb-4 group-hover:scale-110 transition-transform">
                        <Type size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">Nomes Avulsos</h3>
                    <p className="text-sm text-slate-500">Digite uma lista de nomes.</p>
                </button>
            </div>

            <div className="text-center">
                <button onClick={() => setView('history')} className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full text-sm font-bold transition-colors inline-flex items-center gap-2">
                    <History size={16} /> Sorteios Realizados
                </button>
            </div>
          </>
      )}

      {view === 'history' && (
          <div className="max-w-4xl mx-auto w-full">
              <div className="flex items-center gap-4 mb-6">
                  <button onClick={() => setView('menu')} className="text-slate-400 hover:text-slate-600"><ArrowLeft size={24}/></button>
                  <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2"><History size={24}/> Histórico</h3>
                  <div className="ml-auto text-sm text-slate-500">Voltar</div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left: List */}
                  <div className="space-y-3">
                      {raffles.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(raffle => {
                          const hasWinnersArray = raffle.winners && raffle.winners.length > 0;
                          const winnersCount = hasWinnersArray ? raffle.winners!.length : 1;
                          const firstWinner = hasWinnersArray ? raffle.winners![0].text : (raffle.winner || 'Desconhecido');
                          const displayTitle = raffle.title || getPoolTypeName(raffle.type);

                          return (
                              <div key={raffle.id} onClick={() => setSelectedRaffleDetails(raffle)} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-1 hover:border-blue-300 transition-colors cursor-pointer group">
                                  <div className="flex justify-between items-start">
                                      <div>
                                          <div className="text-sm font-bold text-slate-800">{displayTitle}</div>
                                          {raffle.title && <div className="text-xs text-slate-400">{getPoolTypeName(raffle.type)}</div>}
                                      </div>
                                      <span className="text-xs text-slate-400">{new Date(raffle.date).toLocaleString()}</span>
                                  </div>
                                  <div className="text-xs text-slate-500">{raffle.details}</div>
                                  
                                  <div className="mt-2 pt-2 border-t border-slate-50 flex items-center gap-2">
                                      <Trophy size={14} className="text-yellow-500" />
                                      {winnersCount > 1 ? (
                                          <span className="font-bold text-blue-600 text-sm flex items-center gap-1">
                                              {winnersCount} Ganhadores <span className="text-slate-400 font-normal text-xs">(Clique para ver)</span>
                                          </span>
                                      ) : (
                                          <span className="font-bold text-slate-800">{firstWinner}</span>
                                      )}
                                  </div>
                              </div>
                          );
                      })}
                      {raffles.length === 0 && <div className="text-center py-10 text-slate-400">Nenhum sorteio realizado.</div>}
                  </div>

                  {/* Right: Empty State or Details Placeholder */}
                  <div className="hidden md:flex bg-white rounded-xl border border-slate-200 shadow-sm items-center justify-center flex-col text-slate-300 h-96 p-6">
                      <Trophy size={48} className="mb-2 opacity-30" />
                      <p className="text-sm">Selecione um sorteio para ver os detalhes</p>
                  </div>
              </div>
          </div>
      )}

      {/* RAFFLE DETAILS MODAL (FOR HISTORY) */}
      {selectedRaffleDetails && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col max-h-[80vh]">
                  <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                      <div>
                          <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                              <Trophy size={18} className="text-yellow-500"/> {selectedRaffleDetails.title || 'Detalhes'}
                          </h3>
                          <p className="text-xs text-slate-500">{new Date(selectedRaffleDetails.date).toLocaleString()}</p>
                      </div>
                      <button onClick={() => setSelectedRaffleDetails(null)} className="text-slate-400 hover:text-slate-600 bg-white p-1 rounded-full"><X size={20}/></button>
                  </div>
                  <div className="p-4 overflow-y-auto bg-slate-50 flex-1">
                      <div className="mb-4">
                          <p className="text-xs font-bold text-slate-400 uppercase mb-1">Tipo</p>
                          <p className="text-sm font-medium text-slate-700">{getPoolTypeName(selectedRaffleDetails.type)} - {selectedRaffleDetails.details}</p>
                      </div>
                      
                      <p className="text-xs font-bold text-slate-400 uppercase mb-2">Lista de Ganhadores</p>
                      <div className="space-y-2">
                          {(selectedRaffleDetails.winners || [{position: 1, text: selectedRaffleDetails.winner || '?'}]).map((w, idx) => (
                              <div key={idx} className="bg-white p-3 rounded-lg border border-slate-200 flex items-center gap-3 shadow-sm">
                                  <div className="w-8 h-8 rounded-full bg-yellow-100 text-yellow-700 flex items-center justify-center font-bold text-sm border border-yellow-200">
                                      {w.position}º
                                  </div>
                                  <span className="font-bold text-slate-800 text-lg">{w.text}</span>
                              </div>
                          ))}
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* SETUP MODALS */}
      {(view === 'setup_clients' || view === 'setup_numbers' || view === 'setup_names') && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative">
                  <div className="p-6 pb-0 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${view === 'setup_clients' ? 'text-blue-600 bg-blue-50' : view === 'setup_numbers' ? 'text-purple-600 bg-purple-50' : 'text-pink-600 bg-pink-50'}`}>
                              {view === 'setup_clients' && <Users size={24}/>}
                              {view === 'setup_numbers' && <Hash size={24}/>}
                              {view === 'setup_names' && <Type size={24}/>}
                          </div>
                          <div>
                              <h3 className="text-xl font-bold text-slate-800">
                                  {view === 'setup_clients' && 'Sorteio de Clientes'}
                                  {view === 'setup_numbers' && 'Sorteio de Números'}
                                  {view === 'setup_names' && 'Sorteio de Nomes'}
                              </h3>
                              <p className="text-xs text-slate-500">Configuração</p>
                          </div>
                      </div>
                      <button onClick={() => setView('menu')} className="text-slate-400 hover:text-slate-600"><X size={24}/></button>
                  </div>

                  <div className="p-6 space-y-4">
                      {/* NEW: TITLE INPUT (COMMON) */}
                      <div>
                          <label className="block text-sm font-bold text-slate-700 mb-2">Nome do Sorteio (Opcional)</label>
                          <div className="relative">
                              <PenLine className="absolute left-3 top-3 text-slate-400" size={18} />
                              <input 
                                  type="text" 
                                  className="w-full pl-10 p-3 border border-slate-300 rounded-xl outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-700"
                                  placeholder="Ex: Dia dos Pais"
                                  value={raffleTitle}
                                  onChange={(e) => setRaffleTitle(e.target.value)}
                              />
                          </div>
                      </div>

                      {/* CLIENTS SETUP */}
                      {view === 'setup_clients' && (
                          <div className="text-center py-2 bg-blue-50 rounded-lg border border-blue-100">
                              <p className="font-bold text-blue-600">Total disponível: {pool.length} clientes.</p>
                          </div>
                      )}

                      {/* NUMBERS SETUP */}
                      {view === 'setup_numbers' && (
                          <div>
                              <label className="block text-sm font-bold text-slate-700 mb-2">Quantidade de Números</label>
                              <p className="text-xs text-slate-500 mb-3">Serão gerados números de 1 até o valor escolhido.</p>
                              <input 
                                  type="number" 
                                  className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                                  value={maxNumber}
                                  onChange={(e) => setMaxNumber(parseInt(e.target.value) || 0)}
                              />
                          </div>
                      )}

                      {/* NAMES SETUP */}
                      {view === 'setup_names' && (
                          <div className="h-[200px] flex flex-col">
                              <label className="block text-sm font-bold text-slate-700 mb-2">Adicionar Participantes</label>
                              <div className="flex gap-2 mb-4">
                                  <input 
                                      type="text" 
                                      className="flex-1 p-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-pink-500"
                                      placeholder="Digite um nome..."
                                      value={newNameInput}
                                      onChange={(e) => setNewNameInput(e.target.value)}
                                      onKeyDown={(e) => e.key === 'Enter' && addCustomName()}
                                  />
                                  <button onClick={addCustomName} className="bg-slate-900 text-white p-3 rounded-xl hover:bg-slate-800"><Plus size={20} /></button>
                              </div>
                              <div className="flex-1 overflow-y-auto border border-slate-100 rounded-xl p-2 space-y-2 bg-slate-50">
                                  {customNames.map((name, idx) => (
                                      <div key={idx} className="bg-white p-3 rounded-lg border border-slate-200 flex justify-between items-center shadow-sm">
                                          <span className="font-medium text-slate-700">{name}</span>
                                          <button onClick={() => removeCustomName(idx)} className="text-red-400 hover:text-red-600"><Trash2 size={16} /></button>
                                      </div>
                                  ))}
                                  {customNames.length === 0 && <p className="text-center text-slate-400 text-sm py-10">Adicione nomes à lista.</p>}
                              </div>
                              <div className="text-right text-xs text-slate-400 mt-2">Total: {customNames.length}</div>
                          </div>
                      )}

                      {/* WINNERS COUNT (ALL MODES) */}
                      <div>
                          <label className="block text-sm font-bold text-slate-700 mb-2">Quantos Ganhadores?</label>
                          <div className="relative">
                              <Layers className="absolute left-3 top-3 text-slate-400" size={18} />
                              <input 
                                  type="number" 
                                  min="1"
                                  className="w-full pl-10 p-3 border border-slate-300 rounded-xl outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-bold text-slate-700"
                                  value={targetWinners}
                                  onChange={(e) => setTargetWinners(parseInt(e.target.value) || 1)}
                              />
                          </div>
                      </div>

                      <div className="pt-4 border-t border-slate-100">
                          <button 
                              onClick={confirmSetup}
                              className={`w-full py-4 rounded-xl font-bold text-white text-lg shadow-lg transition-transform active:scale-95 ${
                                  view === 'setup_numbers' ? 'bg-gradient-to-r from-purple-500 to-indigo-600 hover:to-indigo-700' :
                                  view === 'setup_names' ? 'bg-gradient-to-r from-pink-500 to-rose-600 hover:to-rose-700' :
                                  'bg-gradient-to-r from-blue-500 to-blue-600 hover:to-blue-700'
                              }`}
                          >
                              Iniciar Sorteio
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

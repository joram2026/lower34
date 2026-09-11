import React, { useState, useEffect } from 'react';
import { CopyTraderLead, UserCopyTrade } from '../types';
import { ExpertAvatar } from './ExpertAvatar';
import { getLeadDailyProfitRange } from '../data/copyTraders';
import { 
  X, ArrowRight, Sparkles, Lock, Unlock, ShieldCheck, 
  AlertCircle, CheckCircle2, ChevronRight, Zap, RefreshCw 
} from 'lucide-react';

interface UpgradeRolloverModalProps {
  isOpen: boolean;
  onClose: () => void;
  oldContract: UserCopyTrade;
  targetLead: CopyTraderLead;
  availableLeads: CopyTraderLead[];
  onSelectTargetLead: (lead: CopyTraderLead) => void;
  freeTradeBalance: number;
  isLightTheme: boolean;
  onConfirmUpgrade: (
    oldContract: UserCopyTrade, 
    targetLead: CopyTraderLead, 
    newCapital: number, 
    tradingPair: string
  ) => Promise<void>;
  isSubmitting: boolean;
}

export const UpgradeRolloverModal: React.FC<UpgradeRolloverModalProps> = ({
  isOpen,
  onClose,
  oldContract,
  targetLead,
  availableLeads,
  onSelectTargetLead,
  freeTradeBalance,
  isLightTheme,
  onConfirmUpgrade,
  isSubmitting
}) => {
  const oldPrincipal = oldContract.contractCapital || oldContract.amount || 0;
  const targetMin = targetLead.minCapital ?? 50;
  const targetMax = targetLead.maxCapital ?? 10000;
  const combinedAvailable = Math.max(0, oldPrincipal + freeTradeBalance);

  const defaultInitialAmount = Math.max(targetMin, oldPrincipal);
  const [capitalInput, setCapitalInput] = useState<string>(defaultInitialAmount.toString());
  const [selectedPair, setSelectedPair] = useState<string>(
    targetLead.tradingPairs && targetLead.tradingPairs.length > 0 
      ? targetLead.tradingPairs[0] 
      : 'BTC/USDT'
  );
  const [isChangingTarget, setIsChangingTarget] = useState<boolean>(false);

  // Update defaults when targetLead changes
  useEffect(() => {
    const minCap = targetLead.minCapital ?? 50;
    const initial = Math.max(minCap, oldPrincipal);
    setCapitalInput(initial.toString());
    if (targetLead.tradingPairs && targetLead.tradingPairs.length > 0) {
      setSelectedPair(targetLead.tradingPairs[0]);
    } else {
      setSelectedPair('BTC/USDT');
    }
  }, [targetLead.id, oldPrincipal]);

  if (!isOpen) return null;

  const parsedCapital = parseFloat(capitalInput) || 0;
  const additionalFromFree = Math.max(0, parsedCapital - oldPrincipal);

  // Validation
  let validationError: string | null = null;
  if (parsedCapital < targetMin) {
    validationError = `Minimum capital for ${targetLead.name} is $${targetMin.toFixed(2)} USD.`;
  } else if (parsedCapital > targetMax) {
    validationError = `Maximum allowed capital for ${targetLead.name} is $${targetMax.toFixed(2)} USD.`;
  } else if (parsedCapital > combinedAvailable) {
    const needed = parsedCapital - combinedAvailable;
    validationError = `Insufficient balance. You need an additional $${needed.toFixed(2)} in your Trade Balance.`;
  }

  const isValid = !validationError && parsedCapital >= targetMin && parsedCapital <= combinedAvailable;

  const handleExecute = async () => {
    if (!isValid || isSubmitting) return;
    await onConfirmUpgrade(oldContract, targetLead, parsedCapital, selectedPair);
  };

  // Other eligible target leads (excluding the old contract's expert)
  const otherLeads = availableLeads.filter(
    l => l.id !== oldContract.leadId && l.name !== oldContract.leadName
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div 
        className={`w-full max-w-xl rounded-3xl border shadow-2xl overflow-hidden transition-all duration-300 ${
          isLightTheme 
            ? 'bg-white border-emerald-200/90 text-zinc-900 shadow-emerald-950/10' 
            : 'bg-slate-900 border-slate-800 text-white shadow-black/40'
        }`}
      >
        {/* Header Bar */}
        <div className={`px-5 py-4 border-b flex items-center justify-between gap-3 ${
          isLightTheme ? 'bg-[#F4FBF6] border-emerald-200/80' : 'bg-slate-950/80 border-slate-800'
        }`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
              isLightTheme ? 'bg-amber-500 text-slate-950' : 'bg-amber-500/20 text-amber-400'
            }`}>
              <Sparkles size={16} />
            </div>
            <div className="min-w-0">
              <h3 className={`text-sm sm:text-base font-black tracking-tight truncate ${
                isLightTheme ? 'text-zinc-950' : 'text-white'
              }`}>
                Upgrade Expert & Rollover Principal
              </h3>
              <p className={`text-[10.5px] font-medium truncate ${
                isLightTheme ? 'text-zinc-600' : 'text-zinc-400'
              }`}>
                Seamlessly migrate locked principal to a higher tier expert
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className={`p-1.5 rounded-xl border transition-all cursor-pointer shadow-2xs shrink-0 ${
              isLightTheme 
                ? 'bg-amber-100 hover:bg-amber-200 text-amber-950 border-amber-300' 
                : 'bg-slate-800 hover:bg-slate-700 text-zinc-300 border-slate-700'
            }`}
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          
          {/* Visual Migration Flow Card */}
          <div className={`p-4 rounded-2xl border ${
            isLightTheme ? 'bg-white border-amber-200/90 shadow-xs' : 'bg-slate-950 border-slate-800'
          }`}>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr,auto,1fr] items-center gap-3">
              
              {/* From: Current Active Contract */}
              <div className={`p-3 rounded-xl border space-y-1.5 ${
                isLightTheme ? 'bg-[#F4FBF6] border-emerald-200/70' : 'bg-slate-900/80 border-slate-800'
              }`}>
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider">
                  <span className={isLightTheme ? 'text-zinc-500' : 'text-zinc-400'}>Current Expert</span>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono ${
                    isLightTheme ? 'bg-amber-100 text-amber-900' : 'bg-amber-500/10 text-amber-400'
                  }`}>
                    Closing
                  </span>
                </div>
                <div className="flex items-center gap-2 min-w-0">
                  <ExpertAvatar 
                    photoUrl={oldContract.leadPhotoUrl} 
                    name={oldContract.leadName} 
                    className="w-8 h-8 shrink-0" 
                    size={80} 
                    roundedClassName="rounded-full" 
                    borderClassName="border border-amber-400" 
                  />
                  <div className="min-w-0">
                    <h5 className={`font-black text-xs truncate ${isLightTheme ? 'text-zinc-950' : 'text-white'}`}>
                      {oldContract.leadName}
                    </h5>
                    <p className={`text-[10px] font-mono font-bold ${isLightTheme ? 'text-amber-800' : 'text-amber-400'}`}>
                      Locked: ${oldPrincipal.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Transfer Connector */}
              <div className="flex flex-col items-center justify-center gap-0.5 py-1 sm:py-0">
                <div className={`p-1.5 rounded-full border shadow-2xs ${
                  isLightTheme ? 'bg-amber-500 text-slate-950 border-amber-400' : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                }`}>
                  <ArrowRight size={14} className="hidden sm:block" />
                  <Zap size={14} className="block sm:hidden" />
                </div>
                <span className="text-[9px] font-black uppercase font-mono tracking-wider text-amber-700 dark:text-amber-400 text-center">
                  Rollover
                </span>
              </div>

              {/* To: New Target Expert */}
              <div className={`p-3 rounded-xl border space-y-1.5 ${
                isLightTheme ? 'bg-emerald-50/70 border-emerald-300' : 'bg-emerald-950/20 border-emerald-800/40'
              }`}>
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider">
                  <span className={isLightTheme ? 'text-emerald-900' : 'text-emerald-400'}>Target Expert</span>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono ${
                    isLightTheme ? 'bg-emerald-100 text-emerald-950' : 'bg-emerald-500/20 text-emerald-300'
                  }`}>
                    New Contract
                  </span>
                </div>
                <div className="flex items-center gap-2 min-w-0">
                  <ExpertAvatar 
                    photoUrl={targetLead.photoUrl} 
                    name={targetLead.name} 
                    className="w-8 h-8 shrink-0" 
                    size={80} 
                    roundedClassName="rounded-full" 
                    borderClassName="border border-emerald-400" 
                  />
                  <div className="min-w-0">
                    <h5 className={`font-black text-xs truncate ${isLightTheme ? 'text-zinc-950' : 'text-white'}`}>
                      {targetLead.name}
                    </h5>
                    <p className="text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-400">
                      {getLeadDailyProfitRange(targetLead)}/day (Min ${targetMin})
                    </p>
                  </div>
                </div>
              </div>

            </div>

            {/* Change Target Lead Selector Accordion */}
            {otherLeads.length > 1 && (
              <div className="mt-3 pt-2.5 border-t border-zinc-200/80 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsChangingTarget(!isChangingTarget)}
                  className={`text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                    isLightTheme ? 'text-amber-800 hover:text-amber-900' : 'text-amber-400 hover:text-amber-300'
                  }`}
                >
                  <RefreshCw size={11} className={isChangingTarget ? 'rotate-180 transition-transform' : ''} />
                  <span>{isChangingTarget ? 'Close expert selection' : 'Select a different target expert'}</span>
                </button>

                {isChangingTarget && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 pt-1 animate-fade-in">
                    {otherLeads.map(lead => {
                      const isSelected = lead.id === targetLead.id;
                      return (
                        <div
                          key={lead.id}
                          onClick={() => {
                            onSelectTargetLead(lead);
                            setIsChangingTarget(false);
                          }}
                          className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 cursor-pointer transition-all ${
                            isSelected
                              ? isLightTheme
                                ? 'bg-amber-100 border-amber-400 text-amber-950 shadow-xs'
                                : 'bg-amber-500/20 border-amber-500 text-amber-200'
                              : isLightTheme
                              ? 'bg-zinc-50 hover:bg-amber-50/50 border-zinc-200 text-zinc-800'
                              : 'bg-slate-900 hover:bg-slate-850 border-slate-800 text-zinc-300'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <ExpertAvatar 
                              photoUrl={lead.photoUrl} 
                              name={lead.name} 
                              className="w-7 h-7 shrink-0" 
                              size={60} 
                              roundedClassName="rounded-full" 
                            />
                            <div className="min-w-0">
                              <p className="font-bold text-xs truncate">{lead.name}</p>
                              <p className="text-[9.5px] font-mono text-zinc-500">Min: ${lead.minCapital ?? 50}</p>
                            </div>
                          </div>
                          <span className="text-[10px] font-mono font-black text-emerald-700 dark:text-emerald-400 shrink-0">
                            {getLeadDailyProfitRange(lead)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Rollover Balance Math Breakdown */}
          <div className={`p-3.5 rounded-2xl border space-y-2 text-xs font-mono ${
            isLightTheme ? 'bg-[#F4FBF6] border-emerald-200/80' : 'bg-slate-950/80 border-slate-800'
          }`}>
            <div className="flex justify-between items-center text-[11px]">
              <span className={`font-medium flex items-center gap-1 ${isLightTheme ? 'text-zinc-600' : 'text-zinc-400'}`}>
                <Lock size={11} className="text-amber-600" />
                <span>Locked Principal from {oldContract.leadName}:</span>
              </span>
              <span className={`font-bold ${isLightTheme ? 'text-zinc-950' : 'text-white'}`}>
                ${oldPrincipal.toFixed(2)} USD
              </span>
            </div>

            <div className="flex justify-between items-center text-[11px]">
              <span className={`font-medium flex items-center gap-1 ${isLightTheme ? 'text-zinc-600' : 'text-zinc-400'}`}>
                <Unlock size={11} className="text-emerald-600" />
                <span>Available Free Trade Balance:</span>
              </span>
              <span className="font-bold text-emerald-700 dark:text-emerald-400">
                +${freeTradeBalance.toFixed(2)} USD
              </span>
            </div>

            <div className="border-t border-zinc-200/80 dark:border-slate-800 pt-1.5 flex justify-between items-center font-bold">
              <span className={`text-[11.5px] ${isLightTheme ? 'text-zinc-800' : 'text-zinc-300'}`}>
                Total Combined Available:
              </span>
              <span className="text-sm font-black font-mono text-amber-800 dark:text-amber-400">
                ${combinedAvailable.toFixed(2)} USD
              </span>
            </div>
          </div>

          {/* New Contract Capital Configuration */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <label className={`font-black uppercase tracking-wider text-[10.5px] ${isLightTheme ? 'text-zinc-800' : 'text-zinc-300'}`}>
                New Contract Capital
              </label>
              <span className={`text-[10px] font-mono ${isLightTheme ? 'text-zinc-500' : 'text-zinc-400'}`}>
                Min: ${targetMin.toFixed(0)} • Max: ${targetMax.toFixed(0)}
              </span>
            </div>

            <div className={`relative flex items-center border rounded-xl px-3.5 py-2 transition-all gap-1.5 ${
              isLightTheme 
                ? 'bg-white border-zinc-300 focus-within:border-amber-500 shadow-2xs' 
                : 'bg-slate-950 border-slate-800 focus-within:border-amber-500'
            }`}>
              <span className={`text-base font-black font-mono mr-1 ${isLightTheme ? 'text-zinc-600' : 'text-zinc-400'}`}>$</span>
              <input
                type="number"
                step="any"
                min={targetMin}
                max={Math.min(combinedAvailable, targetMax)}
                placeholder={`Min $${targetMin}`}
                value={capitalInput}
                onChange={(e) => setCapitalInput(e.target.value)}
                disabled={isSubmitting}
                className={`w-full bg-transparent font-mono text-base font-black outline-none ${
                  isLightTheme ? 'text-zinc-950 placeholder:text-zinc-400' : 'text-white placeholder:text-zinc-600'
                }`}
              />
              <span className={`text-[11px] font-black font-mono uppercase ${isLightTheme ? 'text-zinc-500' : 'text-zinc-400'}`}>USD</span>
            </div>

            {/* Quick Chips */}
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
              {oldPrincipal >= targetMin && (
                <button
                  type="button"
                  onClick={() => setCapitalInput(oldPrincipal.toFixed(2))}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold border cursor-pointer transition-all ${
                    parsedCapital === oldPrincipal
                      ? isLightTheme ? 'bg-amber-200 border-amber-400 text-amber-950' : 'bg-amber-500/20 border-amber-500 text-amber-300'
                      : isLightTheme ? 'bg-zinc-100 hover:bg-zinc-200 border-zinc-200 text-zinc-700' : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-zinc-300'
                  }`}
                >
                  Rollover Principal Only (${oldPrincipal.toFixed(0)})
                </button>
              )}

              {targetMin > oldPrincipal && (
                <button
                  type="button"
                  onClick={() => setCapitalInput(targetMin.toFixed(2))}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold border cursor-pointer transition-all ${
                    parsedCapital === targetMin
                      ? isLightTheme ? 'bg-amber-200 border-amber-400 text-amber-950' : 'bg-amber-500/20 border-amber-500 text-amber-300'
                      : isLightTheme ? 'bg-zinc-100 hover:bg-zinc-200 border-zinc-200 text-zinc-700' : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-zinc-300'
                  }`}
                >
                  Min Required (${targetMin.toFixed(0)})
                </button>
              )}

              {combinedAvailable > oldPrincipal && (
                <button
                  type="button"
                  onClick={() => setCapitalInput(Math.min(combinedAvailable, targetMax).toFixed(2))}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold border cursor-pointer transition-all ${
                    parsedCapital === Math.min(combinedAvailable, targetMax)
                      ? isLightTheme ? 'bg-amber-200 border-amber-400 text-amber-950' : 'bg-amber-500/20 border-amber-500 text-amber-300'
                      : isLightTheme ? 'bg-zinc-100 hover:bg-zinc-200 border-zinc-200 text-zinc-700' : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-zinc-300'
                  }`}
                >
                  Max Combined (${Math.min(combinedAvailable, targetMax).toFixed(0)})
                </button>
              )}
            </div>

            {additionalFromFree > 0 && (
              <p className={`text-[10px] font-medium flex items-center gap-1 ${
                isLightTheme ? 'text-zinc-600' : 'text-zinc-400'
              }`}>
                <CheckCircle2 size={11} className="text-emerald-600 shrink-0" />
                <span>
                  Using <strong>${oldPrincipal.toFixed(2)}</strong> rolled-over principal + <strong>${additionalFromFree.toFixed(2)}</strong> from free trade balance.
                </span>
              </p>
            )}

            {validationError && (
              <div className={`p-2.5 rounded-xl border text-xs flex items-center gap-1.5 font-bold ${
                isLightTheme ? 'bg-amber-50 border-amber-300 text-amber-900' : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
              }`}>
                <AlertCircle size={13} className="shrink-0 text-amber-600" />
                <span>{validationError}</span>
              </div>
            )}
          </div>

          {/* Trading Pair Selection */}
          <div className="space-y-1.5">
            <label className={`font-black uppercase tracking-wider text-[10.5px] block ${isLightTheme ? 'text-zinc-800' : 'text-zinc-300'}`}>
              Initial Trading Pair
            </label>
            <div className="flex gap-2 flex-wrap">
              {(targetLead.tradingPairs && targetLead.tradingPairs.length > 0
                ? targetLead.tradingPairs
                : ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'XRP/USDT']
              ).map(pair => (
                <button
                  key={pair}
                  type="button"
                  onClick={() => setSelectedPair(pair)}
                  className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold border transition-all cursor-pointer ${
                    selectedPair === pair
                      ? isLightTheme
                        ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-xs'
                        : 'bg-amber-500 text-slate-950 border-amber-400 font-black'
                      : isLightTheme
                      ? 'bg-white hover:bg-zinc-100 border-zinc-200 text-zinc-700'
                      : 'bg-slate-950 hover:bg-slate-850 border-slate-800 text-zinc-300'
                  }`}
                >
                  {pair}
                </button>
              ))}
            </div>
          </div>

          {/* Contract Transition Summary Terms */}
          <div className={`p-3.5 rounded-2xl border text-xs space-y-1.5 ${
            isLightTheme ? 'bg-[#F4FBF6] border-emerald-200/90 text-zinc-800' : 'bg-slate-950/60 border-slate-800 text-zinc-300'
          }`}>
            <div className="flex items-center gap-1.5 font-bold text-emerald-900 dark:text-emerald-400">
              <ShieldCheck size={14} className="shrink-0" />
              <span>Contract Migration Guarantee:</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-[11px] leading-relaxed">
              <li>
                Old contract with <strong>{oldContract.leadName}</strong> will be marked as <strong>UPGRADED</strong> (closed) and will no longer lock funds.
              </li>
              <li>
                Your <strong>${oldPrincipal.toFixed(2)} USD</strong> locked principal rolls over instantly into <strong>{targetLead.name}</strong>.
              </li>
              <li>
                All previously accrued profits remain safely in your Trade Balance.
              </li>
            </ul>
          </div>

        </div>

        {/* Modal Actions */}
        <div className={`p-4 border-t flex gap-2.5 ${
          isLightTheme ? 'bg-[#F4FBF6] border-emerald-200/80' : 'bg-slate-950 border-slate-800'
        }`}>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className={`flex-1 py-2.5 px-4 rounded-xl border text-xs font-bold cursor-pointer transition-all flex items-center justify-center active:scale-[0.98] ${
              isLightTheme 
                ? 'bg-zinc-100 hover:bg-zinc-200 border-zinc-200 text-zinc-700' 
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-zinc-200'
            }`}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleExecute}
            disabled={!isValid || isSubmitting}
            className="flex-1 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-xs border border-amber-400 cursor-pointer transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider"
          >
            {isSubmitting ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <Sparkles size={14} />
                <span>CONFIRM</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};

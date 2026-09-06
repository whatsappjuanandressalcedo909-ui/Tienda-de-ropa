import React, { useState } from 'react';
import { Download, Smartphone, X, Check, Share2, PlusSquare } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'compact' | 'full' | 'banner';
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ 
  variant = 'compact',
  className = ''
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [justInstalled, setJustInstalled] = useState(false);

  // If already running as an installed standalone PWA, do not show install prompt
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      const ok = await install();
      if (ok) {
        setJustInstalled(true);
        setTimeout(() => setJustInstalled(false), 4000);
      }
    } else if (isIOS) {
      setShowIOSGuide(true);
    } else {
      // Fallback guide if browser does not emit beforeinstallprompt
      setShowIOSGuide(true);
    }
  };

  if (justInstalled) {
    return (
      <div className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200">
        <Check className="w-4 h-4 text-emerald-600" />
        ¡App instalada con éxito!
      </div>
    );
  }

  // Variant: full width card/banner for mobile settings or dashboard
  if (variant === 'full') {
    return (
      <>
        <div className={`p-4 bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-3xl shadow-lg relative overflow-hidden ${className}`}>
          <div className="flex items-start justify-between gap-3 relative z-10">
            <div className="space-y-1">
              <span className="text-[11px] uppercase tracking-wider font-bold text-indigo-200 flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5" />
                Aplicación Móvil PWA
              </span>
              <h4 className="text-base font-extrabold text-white">
                Instalar en tu Pantalla de Inicio
              </h4>
              <p className="text-xs text-indigo-100/90 leading-relaxed max-w-xs">
                Úsala a pantalla completa, más rápido y con acceso sin conexión en tu celular.
              </p>
            </div>
          </div>

          <div className="mt-3.5 relative z-10">
            <button
              type="button"
              onClick={handleInstallClick}
              className="w-full min-h-[44px] flex items-center justify-center gap-2 bg-white text-indigo-700 hover:bg-indigo-50 active:scale-98 font-bold text-sm px-4 py-2.5 rounded-2xl shadow-sm transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              {isIOS ? 'Cómo instalar en iPhone / iPad' : 'Instalar App en el Celular'}
            </button>
          </div>
        </div>

        {/* iOS / General Safari instructions modal */}
        {showIOSGuide && (
          <div 
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200"
            onClick={() => setShowIOSGuide(false)}
          >
            <div 
              className="bg-white rounded-t-[2rem] sm:rounded-3xl p-6 shadow-2xl w-full max-w-sm space-y-4 animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-4 duration-300"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">Instalar en tu Celular</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="p-2 text-slate-400 hover:text-slate-700 rounded-full cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-slate-600">
                <p className="font-semibold text-slate-800">
                  Sigue estos 2 sencillos pasos en tu navegador:
                </p>

                <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="p-2 bg-white text-indigo-600 rounded-xl shadow-2xs shrink-0">
                    <Share2 className="w-4 h-4" />
                  </div>
                  <div>
                    <strong className="block text-slate-800 mb-0.5">1. Toca "Compartir"</strong>
                    En Safari o Chrome, pulsa el botón de opciones o compartir en la barra del navegador.
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="p-2 bg-white text-indigo-600 rounded-xl shadow-2xs shrink-0">
                    <PlusSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <strong className="block text-slate-800 mb-0.5">2. "Añadir a pantalla de inicio"</strong>
                    Desplázate hacia abajo y selecciona la opción de añadir a pantalla de inicio.
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full min-h-[44px] bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl transition-colors cursor-pointer text-sm"
              >
                Entendido
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Variant: compact button for header / navigation
  return (
    <>
      <button
        type="button"
        onClick={handleInstallClick}
        className={`min-h-[40px] px-3.5 py-2 inline-flex items-center gap-1.5 rounded-xl font-bold text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 active:scale-95 transition-all cursor-pointer shadow-2xs ${className}`}
        title="Instalar esta app en tu dispositivo móvil"
      >
        <Download className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
        <span className="hidden sm:inline">Instalar App</span>
        <span className="sm:hidden">Instalar</span>
      </button>

      {/* iOS / General Safari instructions modal */}
      {showIOSGuide && (
        <div 
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200"
          onClick={() => setShowIOSGuide(false)}
        >
          <div 
            className="bg-white rounded-t-[2rem] sm:rounded-3xl p-6 shadow-2xl w-full max-w-sm space-y-4 animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-4 duration-300"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Smartphone className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Instalar en tu Celular</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600">
              <p className="font-semibold text-slate-800">
                Sigue estos 2 sencillos pasos en tu navegador móvil:
              </p>

              <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="p-2 bg-white text-indigo-600 rounded-xl shadow-2xs shrink-0">
                  <Share2 className="w-4 h-4" />
                </div>
                <div>
                  <strong className="block text-slate-800 mb-0.5">1. Toca "Compartir"</strong>
                  En la barra inferior de Safari o menú de Chrome, pulsa el botón Compartir / Más opciones.
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="p-2 bg-white text-indigo-600 rounded-xl shadow-2xs shrink-0">
                  <PlusSquare className="w-4 h-4" />
                </div>
                <div>
                  <strong className="block text-slate-800 mb-0.5">2. "Añadir a pantalla de inicio"</strong>
                  Selecciona la opción para tener el icono de la tienda en tu pantalla como una app instalada.
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="w-full min-h-[44px] bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl transition-colors cursor-pointer text-sm active:scale-98"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
};

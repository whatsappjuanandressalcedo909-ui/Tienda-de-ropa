import React, { useState, useRef } from 'react';
import { 
  X, 
  Download, 
  Upload, 
  Database, 
  CheckCircle2, 
  AlertCircle, 
  FileJson, 
  Layers, 
  HelpCircle,
  RefreshCw,
  Eye,
  EyeOff
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { 
  downloadJsonFile, 
  validateAndParseBackupJson, 
  ParsedBackupResult,
  BACKUP_SCHEMA_DEFINITION 
} from '../utils/backup';

interface BackupManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BackupManagerModal: React.FC<BackupManagerModalProps> = ({ isOpen, onClose }) => {
  const { 
    inventory, 
    customers, 
    sales, 
    categories, 
    sizes, 
    getBackupData, 
    restoreBackupData 
  } = useInventory();

  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  const [showSchemaPreview, setShowSchemaPreview] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [importedFile, setImportedFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<ParsedBackupResult | null>(null);
  const [restoreMode, setRestoreMode] = useState<'overwrite' | 'merge'>('overwrite');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleExport = () => {
    try {
      const backup = getBackupData();
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `backup-tienda-ropa-${dateStr}.json`;
      downloadJsonFile(backup, filename);
      setStatusMessage({
        type: 'success',
        text: `Copia de seguridad exportada exitosamente como "${filename}".`
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: `Error al generar la copia: ${err.message || 'Ocurrió un error inesperado'}`
      });
    }
  };

  const handleFileSelect = (file: File) => {
    if (!file.name.endsWith('.json') && file.type !== 'application/json') {
      setStatusMessage({
        type: 'error',
        text: 'Por favor selecciona un archivo con extensión .json.'
      });
      return;
    }

    setImportedFile(file);
    setStatusMessage(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const result = validateAndParseBackupJson(content);
      setParseResult(result);

      if (!result.valid) {
        setStatusMessage({
          type: 'error',
          text: result.error || 'El archivo seleccionado no tiene un formato válido.'
        });
      }
    };
    reader.onerror = () => {
      setStatusMessage({
        type: 'error',
        text: 'No se pudo leer el archivo seleccionado.'
      });
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleExecuteRestore = () => {
    if (!parseResult || !parseResult.valid) return;

    const confirmText = restoreMode === 'overwrite'
      ? '¿Estás seguro de que deseas SOBRESCRIBIR la base de datos actual con este respaldo? Los datos actuales serán reemplazados.'
      : '¿Deseas COMBINAR los datos de este respaldo con la base de datos actual?';

    if (!window.confirm(confirmText)) {
      return;
    }

    setIsProcessing(true);
    try {
      restoreBackupData(parseResult.data, restoreMode);
      setStatusMessage({
        type: 'success',
        text: `¡Restauración exitosa! Se procesaron ${parseResult.counts.products} productos, ${parseResult.counts.customers} clientes y ${parseResult.counts.sales} ventas.`
      });
      // reset file input
      setImportedFile(null);
      setParseResult(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: `Error al restaurar los datos: ${err.message || 'Error desconocido'}`
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-2xl shadow-xs">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">
                Copia de Seguridad (Backup)
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Importación y exportación de la base de datos en formato JSON
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-100 px-5 sm:px-6 pt-3 bg-white gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveTab('export');
              setStatusMessage(null);
            }}
            className={`flex items-center gap-2 pb-3 px-3 border-b-2 text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'export'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Exportar Sistema (.json)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('import');
              setStatusMessage(null);
            }}
            className={`flex items-center gap-2 pb-3 px-3 border-b-2 text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'import'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Importar / Restaurar (.json)</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {/* Status notification */}
          {statusMessage && (
            <div className={`p-3.5 rounded-2xl text-xs flex items-start gap-2.5 animate-in fade-in ${
              statusMessage.type === 'success' 
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold' 
                : 'bg-rose-50 border border-rose-200 text-rose-800 font-semibold'
            }`}>
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">{statusMessage.text}</div>
            </div>
          )}

          {/* EXPORT TAB */}
          {activeTab === 'export' && (
            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/70 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                    Contenido Actual de la Base de Datos
                  </span>
                  <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                    Esquema v1.0
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  <div className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-2xs">
                    <p className="text-slate-400 font-medium text-[11px]">Productos / Prendas</p>
                    <p className="text-base font-black text-slate-900 mt-0.5">{inventory.length}</p>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-2xs">
                    <p className="text-slate-400 font-medium text-[11px]">Clientes Registrados</p>
                    <p className="text-base font-black text-slate-900 mt-0.5">{customers.length}</p>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-2xs">
                    <p className="text-slate-400 font-medium text-[11px]">Ventas y Cuotas</p>
                    <p className="text-base font-black text-slate-900 mt-0.5">{sales.length}</p>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-2xs">
                    <p className="text-slate-400 font-medium text-[11px]">Categorías</p>
                    <p className="text-base font-black text-slate-900 mt-0.5">{categories.length}</p>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-2xs">
                    <p className="text-slate-400 font-medium text-[11px]">Tallas Activas</p>
                    <p className="text-base font-black text-slate-900 mt-0.5">{sizes.length}</p>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-2xs">
                    <p className="text-slate-400 font-medium text-[11px]">Formato de Salida</p>
                    <p className="text-base font-black text-indigo-600 mt-0.5">JSON Estructurado</p>
                  </div>
                </div>
              </div>

              {/* Schema Definition Collapsible */}
              <div className="border border-slate-200/80 rounded-2xl p-3 bg-white space-y-2">
                <button
                  type="button"
                  onClick={() => setShowSchemaPreview(!showSchemaPreview)}
                  className="w-full flex items-center justify-between text-xs font-bold text-slate-700 hover:text-indigo-600 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-600" />
                    <span>Estructura formal de la base de datos incluida en el JSON</span>
                  </div>
                  <span className="text-[11px] text-indigo-600 flex items-center gap-1">
                    {showSchemaPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    {showSchemaPreview ? 'Ocultar' : 'Ver definición'}
                  </span>
                </button>

                {showSchemaPreview && (
                  <div className="p-3 bg-slate-900 text-slate-200 rounded-xl text-[11px] font-mono overflow-x-auto max-h-48 scrollbar-thin">
                    <pre>{JSON.stringify(BACKUP_SCHEMA_DEFINITION, null, 2)}</pre>
                  </div>
                )}
              </div>

              <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-2xl flex items-start gap-2.5">
                <HelpCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800">
                  El archivo descargado contiene la estructura de tablas, tipos de columnas y todos los registros para su posterior restauración o migración.
                </p>
              </div>

              <button
                type="button"
                onClick={handleExport}
                className="w-full min-h-[48px] flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-sm px-4 py-3 rounded-2xl shadow-md shadow-indigo-600/20 transition-all cursor-pointer active:scale-98 select-none"
              >
                <Download className="w-4 h-4" />
                <span>Descargar Copia de Seguridad Completa (.json)</span>
              </button>
            </div>
          )}

          {/* IMPORT TAB */}
          {activeTab === 'import' && (
            <div className="space-y-4">
              {/* Drag and Drop Zone */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-3xl p-6 text-center transition-all cursor-pointer select-none ${
                  isDragging 
                    ? 'border-indigo-600 bg-indigo-50/60 scale-[0.99]' 
                    : 'border-slate-200 hover:border-indigo-400 bg-slate-50/50 hover:bg-slate-50'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".json,application/json"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleFileSelect(e.target.files[0]);
                    }
                  }}
                />

                <div className="w-12 h-12 bg-white rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-center mx-auto text-indigo-600 mb-3">
                  <FileJson className="w-6 h-6" />
                </div>

                <p className="text-xs font-bold text-slate-800">
                  {importedFile ? importedFile.name : 'Haz clic o arrastra tu archivo de backup (.json)'}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Formatos compatibles: Backup del sistema con estructura o colecciones JSON
                </p>
              </div>

              {/* Parsed backup info preview */}
              {parseResult && parseResult.valid && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-extrabold text-slate-700 uppercase tracking-wider">
                      Datos Detectados en el Archivo
                    </span>
                    {parseResult.metadata?.exportedAt && (
                      <span className="text-slate-400">
                        {new Date(parseResult.metadata.exportedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                    <div className="bg-white p-2 rounded-xl border border-slate-100">
                      <span className="text-slate-400 block text-[10px]">Prendas:</span>
                      <strong className="text-slate-800 font-bold text-sm">{parseResult.counts.products}</strong>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-slate-100">
                      <span className="text-slate-400 block text-[10px]">Clientes:</span>
                      <strong className="text-slate-800 font-bold text-sm">{parseResult.counts.customers}</strong>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-slate-100">
                      <span className="text-slate-400 block text-[10px]">Ventas:</span>
                      <strong className="text-slate-800 font-bold text-sm">{parseResult.counts.sales}</strong>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-slate-100">
                      <span className="text-slate-400 block text-[10px]">Categorías:</span>
                      <strong className="text-slate-800 font-bold text-sm">{parseResult.counts.categories}</strong>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-slate-100">
                      <span className="text-slate-400 block text-[10px]">Tallas:</span>
                      <strong className="text-slate-800 font-bold text-sm">{parseResult.counts.sizes}</strong>
                    </div>
                  </div>

                  {/* Mode Selector */}
                  <div className="pt-2 border-t border-slate-200/60 space-y-2">
                    <label className="block text-xs font-bold text-slate-700">
                      Método de Restauración:
                    </label>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => setRestoreMode('overwrite')}
                        className={`p-2.5 rounded-xl border font-bold text-left transition-all cursor-pointer ${
                          restoreMode === 'overwrite'
                            ? 'bg-indigo-50 border-indigo-600 text-indigo-900 shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <p className="text-xs">Sobrescribir Todo</p>
                        <p className="text-[10px] text-slate-500 font-normal mt-0.5">Reemplaza los datos actuales</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setRestoreMode('merge')}
                        className={`p-2.5 rounded-xl border font-bold text-left transition-all cursor-pointer ${
                          restoreMode === 'merge'
                            ? 'bg-indigo-50 border-indigo-600 text-indigo-900 shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <p className="text-xs">Combinar (Merge)</p>
                        <p className="text-[10px] text-slate-500 font-normal mt-0.5">Agrega registros sin borrar</p>
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={handleExecuteRestore}
                    className="w-full min-h-[48px] flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-60 text-white font-bold text-sm px-4 py-3 rounded-2xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer active:scale-98 select-none mt-2"
                  >
                    <RefreshCw className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
                    <span>{restoreMode === 'overwrite' ? 'Restaurar y Sobrescribir Base de Datos' : 'Combinar con la Base de Datos'}</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/70 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-5 py-2.5 bg-slate-200/80 hover:bg-slate-200 active:bg-slate-300 text-slate-800 font-bold text-xs rounded-2xl transition-all cursor-pointer active:scale-95"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

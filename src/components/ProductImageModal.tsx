import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Edit2, Check, Image as ImageIcon, Camera, Upload, Trash2, ArrowLeft, AlertCircle } from 'lucide-react';
import { Material } from '../types';
import { apiFetch } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

interface ProductImageModalProps {
  material: Material | null;
  onClose: () => void;
  onUpdate?: () => void;
}

export const ProductImageModal = ({ material, onClose, onUpdate }: ProductImageModalProps) => {
  const { token, isManager } = useAuth();
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Estados para upload de arquivos e captura de câmera
  const [mode, setMode] = useState<'view' | 'options' | 'camera' | 'preview'>('view');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (material) {
      setImageUrl(material.imageUrl || '');
      setMode('view');
    }
    return () => {
      // Limpar stream da câmera ao desmontar
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [material]);

  // Adiciona um useEffect para atualizar o srcObject do vídeo quando o modo for 'camera' e o stream estiver disponível
  useEffect(() => {
    if (mode === 'camera' && stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [mode, stream]);

  if (!material) return null;

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  const startCamera = async () => {
    setCameraError('');
    setMode('camera');
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1080 }, height: { ideal: 1080 } },
        audio: false
      });
      setStream(mediaStream);
    } catch (err) {
      console.error('Erro ao acessar a câmera:', err);
      setCameraError('Não foi possível acessar a câmera. Verifique se o navegador possui permissão de acesso à câmera.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const base64 = canvas.toDataURL('image/jpeg', 0.85); // Compressão JPEG para reduzir o tamanho do arquivo
        setImageUrl(base64);
        stopCamera();
        setMode('preview');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione um arquivo de imagem válido (PNG, JPG, JPEG).');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setImageUrl(reader.result as string);
      setMode('preview');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = async () => {
    if (!confirm('Deseja realmente remover a foto ilustrativa deste produto?')) return;
    setLoading(true);
    try {
      await apiFetch(`/api/materials/${material.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: material.name,
          code: material.code,
          codigoBarras: material.codigoBarras,
          quantity: material.quantity,
          estoqueMinimo: material.estoqueMinimo,
          unit: material.unit,
          sectorId: material.sectorId,
          supplierId: material.supplierId,
          origin: material.origin,
          imageUrl: null,
        }),
      }, token);
      setImageUrl('');
      setMode('view');
      if (onUpdate) onUpdate();
    } catch (err) {
      alert('Erro ao remover imagem do produto.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await apiFetch(`/api/materials/${material.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: material.name,
          code: material.code,
          codigoBarras: material.codigoBarras,
          quantity: material.quantity,
          estoqueMinimo: material.estoqueMinimo,
          unit: material.unit,
          sectorId: material.sectorId,
          supplierId: material.supplierId,
          origin: material.origin,
          imageUrl: imageUrl || null,
        }),
      }, token);
      setMode('view');
      if (onUpdate) onUpdate();
    } catch (err) {
      alert('Erro ao salvar imagem do produto.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-background/80 backdrop-blur-sm"
          onClick={handleClose}
        />
        <motion.div
          initial={{ scale: 0.95, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 20 }}
          className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl p-6 relative overflow-hidden z-10 flex flex-col"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />

          <div className="flex justify-between items-start mb-4 mt-2">
            <div>
              <h3 className="text-xl font-bold text-foreground">Visualização do Produto</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {material.name} ({material.code})
              </p>
            </div>
            <button
              onClick={handleClose}
              className="p-1.5 text-muted-foreground hover:bg-secondary rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Área principal do visualizador*/}
          <div className="w-full aspect-[4/3] bg-secondary/10 rounded-xl border border-border/80 relative overflow-hidden shadow-inner flex flex-col items-center justify-center mb-4 group">
            {mode === 'view' && (
              imageUrl ? (
                <img
                  src={imageUrl}
                  alt={material.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-contain rounded-lg shadow-sm"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?q=80&w=400&auto=format&fit=crop';
                  }}
                />
              ) : (
                <div className="flex flex-col items-center text-muted-foreground p-6 text-center">
                  <ImageIcon className="w-16 h-16 opacity-30 mb-3" />
                  <span className="text-sm font-medium">Sem imagem cadastrada</span>
                  <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">Adicione uma foto tirada na câmera ou carregando um arquivo local.</p>
                </div>
              )
            )}

            {mode === 'options' && (
              <div className="flex flex-col gap-3 w-full max-w-[280px] p-4">
                <button
                  type="button"
                  onClick={startCamera}
                  className="flex items-center gap-3 w-full p-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition-colors shadow-sm shadow-blue-500/10 justify-center"
                >
                  <Camera className="w-5 h-5" />
                  Tirar Foto (Câmera)
                </button>
                
                <label className="flex items-center gap-3 w-full p-3.5 bg-secondary hover:bg-secondary/80 border border-border text-foreground font-semibold rounded-xl text-sm transition-colors justify-center cursor-pointer">
                  <Upload className="w-5 h-5 text-muted-foreground" />
                  <span>Escolher Arquivo</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>

                {material.imageUrl && (
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    disabled={loading}
                    className="flex items-center gap-3 w-full p-3.5 bg-destructive/10 hover:bg-destructive/20 text-destructive font-semibold rounded-xl text-sm transition-colors justify-center border border-destructive/20"
                  >
                    <Trash2 className="w-5 h-5" />
                    Remover Foto Atual
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setMode('view')}
                  className="flex items-center gap-3 w-full p-2.5 text-muted-foreground hover:text-foreground font-medium rounded-xl text-xs transition-colors justify-center"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Voltar para Visualização
                </button>
              </div>
            )}

            {mode === 'camera' && (
              <div className="absolute inset-0 flex flex-col bg-black">
                {cameraError ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-red-500 p-6 text-center">
                    <AlertCircle className="w-12 h-12 mb-3" />
                    <p className="text-sm font-semibold">{cameraError}</p>
                    <button
                      type="button"
                      onClick={() => {
                        setCameraError('');
                        setMode('options');
                      }}
                      className="mt-4 px-4 py-2 bg-zinc-800 text-white rounded-lg text-xs hover:bg-zinc-700 transition-colors"
                    >
                      Voltar para Opções
                    </button>
                  </div>
                ) : (
                  <>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="flex-1 w-full h-full object-cover"
                    />
                    <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4 px-4">
                      <button
                        type="button"
                        onClick={() => {
                          stopCamera();
                          setMode('options');
                        }}
                        className="px-4 py-2 bg-black/60 backdrop-blur-md text-white border border-white/20 rounded-xl text-xs font-semibold hover:bg-black/80 transition-all"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={capturePhoto}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg flex items-center gap-1.5"
                      >
                        <Camera className="w-4 h-4" />
                        Tirar Foto
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {mode === 'preview' && (
              <div className="absolute inset-0 flex flex-col bg-zinc-950">
                <img
                  src={imageUrl}
                  alt="Prévia capturada"
                  className="flex-1 w-full h-full object-contain"
                />
                <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-3 px-4">
                  <button
                    type="button"
                    onClick={() => {
                      setImageUrl(material.imageUrl || '');
                      setMode('options');
                    }}
                    className="px-4 py-2 bg-black/60 backdrop-blur-md text-white border border-white/20 rounded-xl text-xs font-semibold hover:bg-black/80 transition-all"
                  >
                    Descartar
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={loading}
                    className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    {loading ? 'Salvando...' : 'Salvar Foto'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {isManager && mode === 'view' && (
            <div className="mt-2 border-t border-border/60 pt-4">
              <button
                onClick={() => setMode('options')}
                className="w-full py-2 border border-dashed border-border hover:border-blue-500/50 text-muted-foreground hover:text-blue-500 font-medium rounded-xl text-xs transition-all inline-flex items-center justify-center gap-1.5"
              >
                <Edit2 className="w-3.5 h-3.5" />
                {imageUrl ? 'Alterar Foto Ilustrativa' : 'Adicionar Foto Ilustrativa'}
              </button>
            </div>
          )}

          {mode === 'view' && (
            <button
              onClick={handleClose}
              className="mt-4 w-full px-4 py-2.5 bg-secondary text-foreground font-medium rounded-xl hover:bg-secondary/80 transition-colors text-sm border border-border"
            >
              Fechar
            </button>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

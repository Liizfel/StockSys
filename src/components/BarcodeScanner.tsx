import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Camera, QrCode, Barcode, Maximize, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface BarcodeScannerProps {
  onResult: (result: string) => void;
  onClose: () => void;
}

export function BarcodeScanner({ onResult, onClose }: BarcodeScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [scanMode, setScanMode] = useState<'barcode' | 'qr' | 'full'>('barcode');
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [activeCameraIndex, setActiveCameraIndex] = useState<number>(0);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  // Função para tocar som de bipe de sucesso usando a Web Audio API (funciona offline e sem arquivos externos)
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(950, audioCtx.currentTime); // 950Hz
      
      gainNode.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.12);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.12);
    } catch (err) {
      console.warn("Audio Context não pôde ser iniciado ou está bloqueado pelo navegador", err);
    }
  };

  // Buscar câmeras disponíveis no dispositivo
  useEffect(() => {
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length > 0) {
          const mappedDevices = devices.map((d, index) => ({
            id: d.id,
            label: d.label || `Câmera ${index + 1}`
          }));
          setCameras(mappedDevices);
          
          // Tentar pré-selecionar uma câmera traseira padrão
          const backCamIndex = mappedDevices.findIndex(d => 
            d.label.toLowerCase().includes('back') || 
            d.label.toLowerCase().includes('traseira') ||
            d.label.toLowerCase().includes('ambiente')
          );
          if (backCamIndex !== -1) {
            setActiveCameraIndex(backCamIndex);
          }
        }
      })
      .catch((err) => {
        console.warn("Erro ao detectar dispositivos de câmera:", err);
      });
  }, []);

  // Inicializar e controlar ciclo de vida do scanner
  useEffect(() => {
    let isMounted = true;
    const elementId = "reader";
    
    // Pequeno atraso para garantir renderização do container no DOM
    const initTimeout = setTimeout(() => {
      if (!isMounted) return;

      const container = document.getElementById(elementId);
      if (!container) return;

      try {
        const scanner = new Html5Qrcode(elementId, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.ITF,
            Html5QrcodeSupportedFormats.CODABAR,
            Html5QrcodeSupportedFormats.DATA_MATRIX
          ],
          verbose: false
        });
        scannerRef.current = scanner;

        // Configurar dimensões da caixa de escaneamento visual
        let qrboxValue;
        if (scanMode === 'qr') {
          qrboxValue = { width: 220, height: 220 };
        } else if (scanMode === 'barcode') {
          qrboxValue = { width: 300, height: 130 };
        } else {
          // No modo Tela Cheia, desativar o qrbox para processar 100% da viewport da câmera
          qrboxValue = undefined;
        }

        // Definir fonte de vídeo: câmera selecionada ou padrão environment
        const cameraConfig = cameras.length > 0 && cameras[activeCameraIndex]
          ? { deviceId: { exact: cameras[activeCameraIndex].id } }
          : { facingMode: "environment" };

        scanner.start(
          cameraConfig,
          {
            fps: 15, // Aumentado para 15 para varredura em tempo real mais rápida
            qrbox: qrboxValue,
            aspectRatio: 1.333333, // 4:3 para dar campo de visão amplo
            experimentalFeatures: {
              useBarCodeDetectorIfSupported: true // Aproveitar acelerador nativo do Google Chrome/Android
            }
          },
          (decodedText) => {
            if (!isMounted) return;
            
            playBeep();
            
            scanner.stop().then(() => {
              onResult(decodedText);
            }).catch(err => {
              console.error("Erro ao parar câmera após sucesso:", err);
              onResult(decodedText);
            });
          },
          () => {
            // Callback vazio de erro contínuo de varredura
          }
        ).catch(err => {
          console.error("Erro ao iniciar câmera:", err);
          if (isMounted) {
            setError("Não foi possível acessar esta câmera. Por favor, certifique-se de dar as permissões de câmera.");
          }
        });
      } catch (e) {
        console.error("Falha na construção do scanner:", e);
      }
    }, 150);

    return () => {
      isMounted = false;
      clearTimeout(initTimeout);
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(err => console.error("Erro ao parar câmera:", err));
      }
    };
  }, [onResult, scanMode, cameras, activeCameraIndex]);

  // Alternar para a próxima câmera disponível
  const handleToggleCamera = () => {
    if (cameras.length <= 1) return;
    setError(null);
    setActiveCameraIndex((prev) => (prev + 1) % cameras.length);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Background overlay */}
      <motion.div 
         initial={{ opacity: 0 }} 
         animate={{ opacity: 1 }} 
         exit={{ opacity: 0 }}
         className="absolute inset-0 bg-background/90 backdrop-blur-md"
         onClick={onClose}
      />
      
      {/* Modal Container */}
      <motion.div 
         initial={{ scale: 0.95, y: 20 }}
         animate={{ scale: 1, y: 0 }}
         exit={{ scale: 0.95, y: 20 }}
         className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl p-5 relative overflow-hidden z-10 flex flex-col max-h-[90vh]"
      >
         {/* Cabeçalho */}
         <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-lg font-bold text-foreground">Leitor de Códigos</h3>
              <p className="text-xs text-muted-foreground">Posicione a câmera sobre o código</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-secondary rounded-lg transition-colors text-muted-foreground hover:text-foreground">
               <X className="w-5 h-5" />
            </button>
         </div>

         {/* Seletores de Modo de Leitura */}
         <div className="grid grid-cols-3 gap-1 p-1 bg-secondary/60 rounded-xl mb-4 border border-border/30">
           <button 
             onClick={() => { setError(null); setScanMode('barcode'); }}
             className={`flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg transition-all ${scanMode === 'barcode' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
           >
             <Barcode className="w-3.5 h-3.5" />
             <span>Barras</span>
           </button>
           <button 
             onClick={() => { setError(null); setScanMode('qr'); }}
             className={`flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg transition-all ${scanMode === 'qr' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
           >
             <QrCode className="w-3.5 h-3.5" />
             <span>QR Code</span>
           </button>
           <button 
             onClick={() => { setError(null); setScanMode('full'); }}
             className={`flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg transition-all ${scanMode === 'full' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
           >
             <Maximize className="w-3.5 h-3.5" />
             <span>Tela Cheia</span>
           </button>
         </div>
         
         {/* Área da Câmera / Feed de Varredura */}
         <div className="relative rounded-2xl overflow-hidden bg-black/95 aspect-square border border-border/50 shadow-inner flex items-center justify-center">
           {error ? (
             <div className="p-6 text-center max-w-[85%]">
               <div className="p-3 bg-red-500/10 text-red-500 rounded-full w-fit mx-auto mb-3">
                 <Info className="w-6 h-6" />
               </div>
               <p className="text-sm text-foreground font-semibold mb-1">Acesso à câmera indisponível</p>
               <p className="text-xs text-muted-foreground">{error}</p>
             </div>
           ) : (
             <>
               {/* Container do Html5Qrcode */}
               <div id="reader" className="w-full h-full [&_video]:object-cover [&_video]:w-full [&_video]:h-full" />

               {/* Overlay do laser e visor de escaneamento visual personalizado */}
               {scanMode !== 'full' && (
                 <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                   {scanMode === 'barcode' ? (
                     <div className="relative w-[300px] h-[130px] border border-white/20 rounded-lg overflow-hidden shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                       {/* Linha laser de scan */}
                       <motion.div 
                         animate={{ y: [0, 130, 0] }}
                         transition={{ repeat: Infinity, duration: 2.2, ease: "linear" }}
                         className="absolute left-0 right-0 h-0.5 bg-red-500 shadow-[0_0_10px_#ef4444,0_0_4px_#ef4444]"
                       />
                       {/* Cantos guias em estilo câmera real */}
                       <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-emerald-500 rounded-tl"></div>
                       <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-emerald-500 rounded-tr"></div>
                       <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-emerald-500 rounded-bl"></div>
                       <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-emerald-500 rounded-br"></div>
                     </div>
                   ) : (
                     <div className="relative w-[220px] h-[220px] border border-white/20 rounded-lg overflow-hidden shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                       {/* Linha laser de scan */}
                       <motion.div 
                         animate={{ y: [0, 220, 0] }}
                         transition={{ repeat: Infinity, duration: 2.2, ease: "linear" }}
                         className="absolute left-0 right-0 h-0.5 bg-red-500 shadow-[0_0_10px_#ef4444,0_0_4px_#ef4444]"
                       />
                       {/* Cantos guias */}
                       <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-emerald-500 rounded-tl"></div>
                       <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-emerald-500 rounded-tr"></div>
                       <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-emerald-500 rounded-bl"></div>
                       <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-emerald-500 rounded-br"></div>
                     </div>
                   )}
                 </div>
               )}

               {/* Laser mais sutil em tela cheia */}
               {scanMode === 'full' && (
                 <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden bg-black/10">
                   <motion.div 
                     animate={{ y: ['0%', '100%', '0%'] }}
                     transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                     className="absolute left-0 right-0 h-0.5 bg-red-500/60 shadow-[0_0_6px_rgba(239,68,68,0.5)]"
                   />
                   <div className="absolute top-4 left-4 right-4 text-center bg-black/40 backdrop-blur-sm py-1 px-3 rounded-full border border-white/10 text-[10px] text-white font-medium tracking-wider uppercase">
                     Modo de Varredura Ampla Ativado
                   </div>
                 </div>
               )}
             </>
           )}
         </div>

         {/* Controles do Rodapé */}
         <div className="mt-4 flex flex-col gap-3">
           {cameras.length > 1 && !error && (
             <button 
               onClick={handleToggleCamera}
               className="flex items-center justify-center gap-2 w-full py-2.5 px-4 border border-border bg-card hover:bg-secondary rounded-xl font-medium text-sm transition-colors text-foreground shadow-sm"
             >
               <Camera className="w-4 h-4 text-muted-foreground" />
               <span>Alternar Câmera ({activeCameraIndex + 1}/{cameras.length})</span>
             </button>
           )}

           <div className="flex items-start gap-2 p-3 bg-secondary/40 rounded-xl border border-border/30">
             <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
             <p className="text-[11px] text-muted-foreground leading-relaxed">
               {scanMode === 'barcode' && "Ideal para códigos de barra horizontais (EAN, UPC, Code 128). Mantenha o código deitado na horizontal."}
               {scanMode === 'qr' && "Perfeito para QR Codes quadrados. Aproxime o visor e garanta que haja boa iluminação."}
               {scanMode === 'full' && "Varre a tela inteira. Excelente se o código for difícil de alinhar ou estiver muito longe."}
             </p>
           </div>
         </div>
      </motion.div>
    </div>
  );
}

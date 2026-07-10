import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface BarcodeScannerProps {
  onResult: (result: string) => void;
  onClose: () => void;
}

export function BarcodeScanner({ onResult, onClose }: BarcodeScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    const scanner = new Html5Qrcode("reader");
    scannerRef.current = scanner;

    scanner.start(
      { facingMode: "environment" },
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
      },
      (decodedText) => {
        // Código de barras ou QR code decodificado com sucesso
        scanner.stop().then(() => {
          onResult(decodedText);
        }).catch(err => {
           console.error("Failed to stop scanner", err);
           onResult(decodedText); // Prossiga assim mesmo
        });
      },
      (errorMessage) => {
        // Apenas erros de parsing, ignore para continuar a varredura
      }
    ).catch(err => {
      setError("Não foi possível acessar a câmera. Verifique as permissões.");
    });

    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, [onResult]);

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
      <motion.div 
         initial={{ opacity: 0 }} 
         animate={{ opacity: 1 }} 
         exit={{ opacity: 0 }}
         className="absolute inset-0 bg-background/90 backdrop-blur-sm"
         onClick={onClose}
      />
      <motion.div 
         initial={{ scale: 0.95, y: 20 }}
         animate={{ scale: 1, y: 0 }}
         exit={{ scale: 0.95, y: 20 }}
         className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl p-6 relative overflow-hidden z-10"
      >
         <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-foreground">Ler Código</h3>
            <button onClick={onClose} className="p-2 hover:bg-secondary rounded-lg">
               <X className="w-5 h-5" />
            </button>
         </div>
         
         {error ? (
           <div className="p-4 bg-red-500/10 text-red-500 rounded-xl text-center text-sm">
             {error}
           </div>
         ) : (
           <div className="rounded-xl overflow-hidden bg-black/5 border border-border">
             <div id="reader" className="w-full" />
           </div>
         )}
         <p className="text-sm text-muted-foreground text-center mt-4">
           Aponte a câmera para o código de barras ou QR code do produto.
         </p>
      </motion.div>
    </div>
  );
}

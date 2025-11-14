import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import astronautSwimming from "@/assets/astronaut-swimming.png";

interface LoadingMonkeyProps {
  message?: string;
}

/**
 * LoadingMonkey.tsx
 * Componente de loading com design espacial inspirado em upgrade de firmware.
 *
 * Requisitos: Tailwind CSS + framer-motion
 */

export default function LoadingMonkey({ message = "Gerando seu plano de estudos personalizado..." }: LoadingMonkeyProps) {
  const [progress, setProgress] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(15);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) return 100;
        return prev + 2;
      });
      
      setTimeRemaining(prev => {
        if (prev <= 0) return 0;
        return prev - 0.3;
      });
    }, 300);

    return () => clearInterval(interval);
  }, []);

  // Floating particles component
  const FloatingParticles = () => (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(8)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 bg-white/30 rounded-full"
          initial={{
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
          }}
          animate={{
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
          }}
          transition={{
            duration: 3 + Math.random() * 2,
            repeat: Infinity,
            repeatType: "reverse",
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );

  return (
    <div
      role="status"
      aria-live="polite"
      className="relative flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 overflow-hidden"
    >
      <FloatingParticles />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
        className="flex flex-col items-center z-10 text-center px-6 max-w-md"
      >
        {/* Astronaut Swimming */}
        <motion.div
          animate={{ 
            x: [0, 10, 0, -10, 0],
            y: [0, -8, 0, -5, 0],
            rotate: [0, 3, 0, -3, 0]
          }}
          transition={{ 
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="mb-8"
        >
          <img 
            src={astronautSwimming} 
            alt="Astronauta nadando na lua" 
            className="w-36 h-36 drop-shadow-lg"
          />
        </motion.div>
        
        {/* Loading Message */}
        <h2 className="text-white text-xl font-semibold mb-2">
          Processando seu plano
        </h2>
        <p className="text-white/80 text-sm mb-12 leading-relaxed">
          {message}
        </p>
        
        {/* Progress Bar */}
        <div className="w-full max-w-xs">
          <div className="bg-white/20 rounded-full h-2 mb-4">
            <motion.div 
              className="bg-gradient-to-r from-yellow-400 to-yellow-500 h-2 rounded-full"
              initial={{ width: "0%" }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          
          {/* Progress Text */}
          <div className="flex justify-between items-center text-white/70 text-sm">
            <span>—</span>
            <span>{Math.round(progress)}%</span>
            <span>—</span>
          </div>
          <p className="text-white/60 text-xs mt-2">
            restam {Math.max(0, Math.round(timeRemaining))} segundos
          </p>
        </div>
      </motion.div>
    </div>
  );
}
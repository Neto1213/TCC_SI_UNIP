import { motion } from "framer-motion";
import { useEffect } from "react";
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
  useEffect(() => {
    document.documentElement.classList.add("hide-accessibility-toggle");
    return () => document.documentElement.classList.remove("hide-accessibility-toggle");
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

  const BufferSpinner = () => (
    <div className="relative flex items-center justify-center">
      <div className="h-16 w-16 rounded-full border-2 border-white/10" aria-hidden="true" />
      <motion.div
        className="absolute h-16 w-16 rounded-full border-[6px] border-white/35 border-t-transparent border-r-transparent"
        animate={{ rotate: 360 }}
        transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
      />
      <motion.div
        className="absolute h-10 w-10 rounded-full border-[5px] border-white/25 border-b-transparent border-l-transparent"
        animate={{ rotate: -360 }}
        transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
      />
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
        
        <BufferSpinner />
      </motion.div>
    </div>
  );
}

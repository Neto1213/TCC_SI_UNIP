import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import LoadingMonkey from "@/components/LoadingMonkey";
import { useAuth } from "@/context/AuthProvider";

type Props = {
  children: ReactNode;
};

export const PublicOnlyRoute = ({ children }: Props) => {
  const { isAuthenticated, isLoading } = useAuth();

  // Evita flicker enquanto confirmamos se há sessão válida.
  if (isLoading) {
    return <LoadingMonkey message="Carregando..." />;
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import LoadingMonkey from "@/components/LoadingMonkey";
import { useAuth } from "@/context/AuthProvider";

type Props = {
  children: ReactNode;
};

export const PrivateRoute = ({ children }: Props) => {
  const { isAuthenticated, isLoading } = useAuth();

  // Mantemos um loader amigável enquanto validamos o token com o backend.
  if (isLoading) {
    return <LoadingMonkey message="Validando sua sessão..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

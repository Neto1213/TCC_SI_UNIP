from abc import ABC, abstractmethod
from typing import Any, Dict


class ContentProvider(ABC):
    @abstractmethod
    def generate_content(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Recebe um payload (tema, perfil, etc.) e retorna o conteúdo bruto
        necessário para o core montar o plano.
        """
        raise NotImplementedError

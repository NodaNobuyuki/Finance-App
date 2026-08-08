import React, { createContext, useContext, useMemo, useState } from 'react';
import { Paleta, PaletaId, paletaPadrao, paletas, Tokens } from './paletas';

type TemaContexto = {
  paleta: Paleta;
  paletaId: PaletaId;
  t: Tokens;
  trocarPaleta: (id: PaletaId) => void;
};

const Contexto = createContext<TemaContexto | null>(null);

export function TemaProvider({
  children,
  inicial = paletaPadrao,
}: {
  children: React.ReactNode;
  inicial?: PaletaId;
}) {
  const [paletaId, setPaletaId] = useState<PaletaId>(inicial);

  const valor = useMemo<TemaContexto>(() => {
    const paleta = paletas[paletaId] ?? paletas[paletaPadrao];
    return { paleta, paletaId, t: paleta.tokens, trocarPaleta: setPaletaId };
  }, [paletaId]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useTema(): TemaContexto {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('useTema precisa estar dentro de <TemaProvider>');
  return ctx;
}

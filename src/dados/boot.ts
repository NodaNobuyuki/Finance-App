import { useEffect, useState } from 'react';
import { hojeReal } from '../dominio/datas';
import { criarEstadoVazio, Estado } from '../estado/store';
import { abrirMotorExpo } from './motorExpo';
import { hidratar } from './persistido';
import { RepositorioLocal } from './repositorio';
import { criarRepositorioMemoria } from './repositorioMemoria';
import { criarRepositorioSQL } from './repositorioSQL';

export type Boot = {
  repositorio: RepositorioLocal;
  inicial: Estado;
  /** O banco não abriu e o app está rodando só em memória, sem gravar nada. */
  semDisco: boolean;
};

/**
 * Abre o banco, aplica as migrations e hidrata o estado.
 *
 * Banco vazio significa app recém-instalado: o estado começa vazio e o
 * onboarding assume. Nada é gravado até a pessoa concluir o primeiro uso — o
 * disco não deve conter dado que ela não criou.
 */
export async function abrirBanco(): Promise<Boot> {
  const hoje = hojeReal();

  let repositorio: RepositorioLocal;
  let semDisco = false;
  try {
    repositorio = criarRepositorioSQL(await abrirMotorExpo());
    await repositorio.iniciar();
  } catch {
    // Banco indisponível é falha de infra: degrada para memória em vez de
    // impedir o uso. A sessão funciona inteira; só não sobrevive ao fechamento.
    repositorio = criarRepositorioMemoria();
    await repositorio.iniciar();
    semDisco = true;
  }

  const salvo = await repositorio.carregar();
  const vazio = criarEstadoVazio(hoje);

  // `hoje` vem do relógio, nunca do disco — reabrir no dia gravado colocaria o
  // lançamento na data errada.
  const inicial = salvo ? hidratar(vazio, salvo, hoje) : vazio;
  return { repositorio, inicial, semDisco };
}

/** Versão em hook, para o `App`. `null` enquanto abre. */
export function useBanco(): Boot | null {
  const [boot, setBoot] = useState<Boot | null>(null);

  useEffect(() => {
    let vivo = true;
    abrirBanco().then((b) => {
      if (vivo) setBoot(b);
    });
    return () => {
      vivo = false;
    };
  }, []);

  return boot;
}

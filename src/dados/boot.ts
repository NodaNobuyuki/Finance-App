import { useCallback, useEffect, useState } from 'react';
import { DiaISO, hojeReal } from '../dominio/datas';
import { criarEstadoVazio, Estado } from '../estado/store';
import { abrirMotorExpo } from './motorExpo';
import { hidratar } from './persistido';
import { RepositorioLocal } from './repositorio';
import { criarRepositorioMemoria } from './repositorioMemoria';
import { criarRepositorioSQL } from './repositorioSQL';

export type Boot =
  | {
      tipo: 'pronto';
      repositorio: RepositorioLocal;
      inicial: Estado;
      /** A pessoa escolheu seguir sem banco: nada desta sessão é gravado. */
      semDisco: boolean;
    }
  /**
   * O banco não abriu, as migrations falharam ou o que estava gravado não pôde
   * ser lido. Nada foi apagado — os dados continuam no disco, inacessíveis.
   */
  | { tipo: 'falhou'; erro: unknown };

const abrirSQLite = async (): Promise<RepositorioLocal> =>
  criarRepositorioSQL(await abrirMotorExpo());

/**
 * Abre o banco, aplica as migrations e hidrata o estado.
 *
 * Banco vazio significa app recém-instalado: o estado começa vazio e o
 * onboarding assume. Nada é gravado até a pessoa concluir o primeiro uso — o
 * disco não deve conter dado que ela não criou.
 *
 * Nunca lança. Falha em qualquer etapa devolve `falhou`, e quem decide o
 * próximo passo é a pessoa. Antes a queda ia calada para a memória — e para
 * quem já tinha dados, banco que não abre em memória vazia é o ONBOARDING DE
 * NOVO, como se tudo tivesse sumido; o que ela registrasse dali em diante
 * morria ao fechar o app. Já a falha de leitura nem caía: a promessa rejeitava
 * sem ninguém ouvir e o app ficava em branco para sempre.
 */
export async function abrirBanco(
  abrir: () => Promise<RepositorioLocal> = abrirSQLite,
  hoje: DiaISO = hojeReal(),
): Promise<Boot> {
  let repositorio: RepositorioLocal | null = null;
  try {
    repositorio = await abrir();
    await repositorio.iniciar();
    const salvo = await repositorio.carregar();
    const vazio = criarEstadoVazio(hoje);

    // `hoje` vem do relógio, nunca do disco — reabrir no dia gravado colocaria
    // o lançamento na data errada.
    const inicial = salvo ? hidratar(vazio, salvo, hoje) : vazio;
    return { tipo: 'pronto', repositorio, inicial, semDisco: false };
  } catch (erro) {
    // Conexão aberta que não serve para nada seria a segunda de um "tentar de
    // novo" disputando o mesmo arquivo.
    await repositorio?.fechar().catch(() => undefined);
    return { tipo: 'falhou', erro };
  }
}

/**
 * Sessão sem banco, por escolha explícita depois de uma falha.
 *
 * O disco não é tocado: a próxima abertura do app tenta o banco de novo, e os
 * dados que estão lá continuam lá.
 */
export function abrirSemDisco(hoje: DiaISO = hojeReal()): Boot {
  return {
    tipo: 'pronto',
    repositorio: criarRepositorioMemoria(),
    inicial: criarEstadoVazio(hoje),
    semDisco: true,
  };
}

/** Versão em hook, para o `App`. `boot` é `null` enquanto abre. */
export function useBanco(): {
  boot: Boot | null;
  tentarDeNovo: () => void;
  usarSemSalvar: () => void;
} {
  const [boot, setBoot] = useState<Boot | null>(null);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let vivo = true;
    abrirBanco().then((b) => {
      if (vivo) setBoot(b);
    });
    return () => {
      vivo = false;
    };
  }, [tentativa]);

  const tentarDeNovo = useCallback(() => {
    setBoot(null);
    setTentativa((n) => n + 1);
  }, []);

  const usarSemSalvar = useCallback(() => setBoot(abrirSemDisco()), []);

  return { boot, tentarDeNovo, usarSemSalvar };
}

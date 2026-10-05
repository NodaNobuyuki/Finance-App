import { DiaISO } from '../../dominio/datas';
import { Transacao } from '../../dominio/tipos';
import { EstadoPersistido, hidratar, recortePersistido } from '../../dados/persistido';
import {
  DIAS_ENTRE_BACKUPS,
  LANCAMENTOS_SEM_BACKUP,
  lembreteDeBackup,
  rotuloDoUltimoBackup,
} from '../derivados';
import { criarReducer, dependenciasDeTeste, estadoVazio } from '../store';

/**
 * O app é só local, e o aviso de backup é o que fica entre a pessoa e perder o
 * histórico ao trocar de celular. Ele erra para os dois lados: calado com tudo
 * só no aparelho, ou insistindo quando não há nada de novo a guardar.
 */

const HOJE: DiaISO = '2026-10-02';
/** Meio-dia, no fuso de quem roda o teste: o dia não muda com o fuso. */
const meioDia = (dia: DiaISO) => {
  const [a, m, d] = dia.split('-').map(Number);
  return new Date(a, m - 1, d, 12).getTime();
};

const tx = (i: number, criadoEm: number): Transacao => ({
  id: `t${i}`,
  contaId: 'c',
  categoriaId: 'mercado',
  valorCentavos: -100,
  ocorridoEm: HOJE,
  descricao: 'x',
  origem: 'manual',
  criadoEm,
});
const varias = (n: number, criadoEm: number) =>
  Array.from({ length: n }, (_, i) => tx(i, criadoEm));

describe('sem backup nenhum', () => {
  it('cala enquanto há pouco a perder', () => {
    const e = {
      transacoes: varias(LANCAMENTOS_SEM_BACKUP - 1, 1),
      ultimoBackupEm: null,
      hoje: HOJE,
    };
    expect(lembreteDeBackup(e)).toBeNull();
  });

  it('avisa quando o histórico já pesa — um extrato importado basta', () => {
    const e = { transacoes: varias(LANCAMENTOS_SEM_BACKUP, 1), ultimoBackupEm: null, hoje: HOJE };
    expect(lembreteDeBackup(e)).toEqual({
      nunca: true,
      dias: 0,
      pendentes: LANCAMENTOS_SEM_BACKUP,
    });
  });
});

describe('com backup', () => {
  const ha = (dias: number) => meioDia(HOJE) - dias * 86_400_000;

  it('backup recente não pede outro', () => {
    const backup = ha(DIAS_ENTRE_BACKUPS - 1);
    const e = { transacoes: varias(50, backup + 1), ultimoBackupEm: backup, hoje: HOJE };
    expect(lembreteDeBackup(e)).toBeNull();
  });

  it('backup velho com lançamento novo depois dele avisa, contando só os novos', () => {
    const backup = ha(DIAS_ENTRE_BACKUPS);
    const e = {
      transacoes: [...varias(20, backup - 1), tx(99, backup + 1)],
      ultimoBackupEm: backup,
      hoje: HOJE,
    };
    expect(lembreteDeBackup(e)).toEqual({ nunca: false, dias: DIAS_ENTRE_BACKUPS, pendentes: 1 });
  });

  it('backup velho sem nada novo depois não insiste — não há o que guardar', () => {
    const backup = ha(90);
    const e = { transacoes: varias(20, backup - 1), ultimoBackupEm: backup, hoje: HOJE };
    expect(lembreteDeBackup(e)).toBeNull();
  });
});

describe('o status em Hábitos', () => {
  it.each([
    [null, 'Nenhum backup feito ainda.'],
    [meioDia(HOJE), 'Último backup hoje.'],
    [meioDia('2026-10-01'), 'Último backup ontem.'],
    [meioDia('2026-09-20'), 'Último backup há 12 dias.'],
  ])('%p → %s', (ultimoBackupEm, rotulo) => {
    expect(rotuloDoUltimoBackup({ ultimoBackupEm, hoje: HOJE })).toBe(rotulo);
  });
});

describe('no estado', () => {
  it('exportar grava o instante, e o aviso some', () => {
    const cheio = { ...estadoVazio, hoje: HOJE, transacoes: varias(15, 1) };
    expect(lembreteDeBackup(cheio)).not.toBeNull();

    const depois = criarReducer(dependenciasDeTeste())(cheio, {
      tipo: 'BACKUP_EXPORTADO',
      emMs: meioDia(HOJE),
    });
    expect(depois.ultimoBackupEm).toBe(meioDia(HOJE));
    expect(lembreteDeBackup(depois)).toBeNull();
  });

  it('banco anterior ao lembrete, sem a preferência, abre como "nunca"', () => {
    // O que `carregar()` devolve de um banco que nunca gravou a chave: o tipo
    // promete o campo, o disco não tem.
    const { ultimoBackupEm: _, ...semCampo } = recortePersistido(estadoVazio);
    const reaberto = hidratar(estadoVazio, semCampo as EstadoPersistido, HOJE);
    expect(reaberto.ultimoBackupEm).toBeNull();
  });
});

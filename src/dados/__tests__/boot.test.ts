import { AGORA } from '../../dominio/datas';
import { LeituraFalhou, MigracaoFalhou } from '../../dominio/erros';
import { criarEstadoDemo } from '../../estado/store';
import { abrirBanco, abrirSemDisco } from '../boot';
import { recortePersistido } from '../persistido';
import { RepositorioLocal } from '../repositorio';
import { criarRepositorioMemoria } from '../repositorioMemoria';

// `expo-sqlite` é nativo e não carrega no Jest. Todo teste aqui injeta o
// repositório, então o padrão de produção nunca é chamado.
jest.mock('../motorExpo', () => ({ abrirMotorExpo: jest.fn() }));

/**
 * O boot nunca lança: toda falha vira `falhou`, e quem decide é a pessoa.
 *
 * Os dois defeitos que isto trava: a leitura que falhava rejeitava a promessa
 * sem ninguém ouvir (app em branco para sempre), e o banco que não abria caía
 * calado para a memória — para quem já tinha dados, o onboarding de novo.
 */

function repositorioQue(
  sobrescrever: Partial<RepositorioLocal>,
): { repo: RepositorioLocal; fechado: () => boolean } {
  let fechou = false;
  const repo: RepositorioLocal = {
    ...criarRepositorioMemoria(),
    async fechar() {
      fechou = true;
    },
    ...sobrescrever,
  };
  return { repo, fechado: () => fechou };
}

describe('abrirBanco', () => {
  it('banco novo abre vazio, pronto para o onboarding', async () => {
    const boot = await abrirBanco(async () => criarRepositorioMemoria(), AGORA);

    expect(boot.tipo).toBe('pronto');
    if (boot.tipo !== 'pronto') return;
    expect(boot.semDisco).toBe(false);
    expect(boot.inicial.onboardingConcluido).toBe(false);
    expect(boot.inicial.hoje).toBe(AGORA);
  });

  it('banco com dados abre com os dados', async () => {
    const repo = criarRepositorioMemoria();
    const demo = recortePersistido(criarEstadoDemo(AGORA));
    await repo.salvar(null, demo);

    const boot = await abrirBanco(async () => repo, AGORA);

    expect(boot.tipo).toBe('pronto');
    if (boot.tipo !== 'pronto') return;
    expect(boot.inicial.onboardingConcluido).toBe(true);
    expect(boot.inicial.transacoes).toHaveLength(demo.transacoes.length);
  });

  it('leitura que falha vira `falhou`, não promessa rejeitada', async () => {
    const erro = new LeituraFalhou('o estado salvo');
    const { repo, fechado } = repositorioQue({
      carregar: () => Promise.reject(erro),
    });

    const boot = await abrirBanco(async () => repo, AGORA);

    expect(boot).toEqual({ tipo: 'falhou', erro });
    // A conexão inútil não pode ficar aberta disputando o arquivo com a
    // próxima tentativa.
    expect(fechado()).toBe(true);
  });

  it('migration que falha NÃO cai calada para a memória', async () => {
    const erro = new MigracaoFalhou(9, 'qualquer');
    const { repo } = repositorioQue({ iniciar: () => Promise.reject(erro) });

    const boot = await abrirBanco(async () => repo, AGORA);

    // Antes, isto virava um app vazio em memória: o onboarding de novo para
    // quem já tinha dados, e tudo o que registrasse sumia ao fechar.
    expect(boot.tipo).toBe('falhou');
  });

  it('banco que nem abre também vira `falhou`', async () => {
    const boot = await abrirBanco(() => Promise.reject(new Error('sem disco')), AGORA);
    expect(boot.tipo).toBe('falhou');
  });

  it('fechar que também falha não esconde a falha original', async () => {
    const erro = new LeituraFalhou('o estado salvo');
    const { repo } = repositorioQue({
      carregar: () => Promise.reject(erro),
      fechar: () => Promise.reject(new Error('já fechado')),
    });

    expect(await abrirBanco(async () => repo, AGORA)).toEqual({ tipo: 'falhou', erro });
  });
});

describe('abrirSemDisco', () => {
  it('é escolha explícita, e diz que é', () => {
    const boot = abrirSemDisco(AGORA);

    expect(boot.tipo).toBe('pronto');
    if (boot.tipo !== 'pronto') return;
    expect(boot.semDisco).toBe(true);
    expect(boot.inicial.transacoes).toHaveLength(0);
  });
});

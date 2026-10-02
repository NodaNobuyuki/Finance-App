import { DiaISO } from '../dominio/datas';
import { Centavos } from '../dominio/dinheiro';
import { ErroDeDominio } from '../dominio/erros';
import { Origem } from '../dominio/tipos';

/**
 * O que um adapter devolve: lançamentos ainda sem conta nem categoria no app.
 *
 * Nenhum formato de banco passa daqui. Regex do Nubank, quirk do Itaú, sinal
 * invertido de fatura — tudo fica no adapter, e o resto do app só vê isto.
 */
export type TransacaoBruta = {
  /** FITID do OFX; hash estável quando o banco não manda. Base do dedupe. */
  idExterno: string;
  /** Inteiro, negativo = saída — já na convenção do app. */
  valorCentavos: Centavos;
  ocorridoEm: DiaISO;
  /** O texto do banco, intacto. Preservar sempre: é a prova de onde veio. */
  descricaoOriginal: string;
  origem: Origem;
};

/**
 * Um extrato lido.
 *
 * A pista de conta mora aqui, e não em cada linha como no rascunho do
 * CLAUDE.md: num OFX ela é do arquivo inteiro, e repeti-la por linha só
 * convidaria duas linhas do mesmo extrato a discordarem.
 */
export type ExtratoLido = {
  /** Fatura de cartão ou conta — sugere o tipo de conta de destino no app. */
  tipoDeConta: 'cartao' | 'conta';
  /** Nome da instituição como o arquivo diz (`<ORG>`). */
  banco?: string;
  /** Identificador da conta no banco (`<ACCTID>`). Nunca exibido inteiro. */
  contaExterna?: string;
  inicio?: DiaISO;
  fim?: DiaISO;
  transacoes: TransacaoBruta[];
  /**
   * Linhas que não deu para ler. Não derrubam a importação — entrada suja é
   * esperada —, mas a pessoa precisa saber que algo ficou de fora.
   */
  ignoradas: number;
};

/**
 * Uma fonte de lançamentos. Adicionar um banco novo é escrever um destes; se
 * precisou tocar em qualquer outro arquivo, a abstração vazou.
 */
export interface AdapterDeFonte<Entrada> {
  /** `'ofx-generico'`, `'nubank-notificacao'`… Estável: vai para log. */
  id: string;
  ler(entrada: Entrada): ExtratoLido;
}

/** O arquivo inteiro não serve. Explicável, e tentar de novo não muda nada. */
export class ExtratoInvalido extends ErroDeDominio {
  constructor(mensagem: string, causa?: unknown) {
    super('extrato-invalido', mensagem, causa);
  }
}

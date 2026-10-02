import React, { useMemo } from 'react';
import { FlatList, View } from 'react-native';
import { BotaoPrincipal, Chip, Txt } from '../../componentes/basicos';
import { Categoria, categoria } from '../../dominio/categorias';
import { rotuloDataCurta } from '../../dominio/datas';
import { comSinal } from '../../dominio/dinheiro';
import { Conta } from '../../dominio/tipos';
import { useDespachar, useRecorte } from '../../estado/store';
import { Escolha, LinhaDaPrevia, montarPrevia } from '../../ingestao/previa';
import { useTema } from '../../tema/TemaContext';
import { Folha } from './Folha';
import { Pilulas } from './PilulasDeConta';

/** O que esta tela lê do estado — e só isto a acorda. */
const CHAVES = ['importacao', 'transacoes', 'contas', 'categorias'] as const;

/**
 * A prévia de um extrato antes de qualquer coisa entrar.
 *
 * Automático só merece confiança se dá para ver o que ele fez: cada linha diz
 * de onde veio e o que vai acontecer com ela, e o que é dúvida — possível
 * duplicata, transferência entre contas — vem com a escolha à mão. Nada é
 * resolvido em silêncio.
 */
export function ImportarExtrato() {
  const estado = useRecorte(CHAVES);
  const despachar = useDespachar();
  const { t } = useTema();

  const { importacao, transacoes, contas, categorias } = estado;
  const previa = useMemo(
    () =>
      importacao
        ? montarPrevia(importacao.extrato, importacao.contaId, importacao.escolhas, {
            transacoes,
            contas,
            categorias,
          })
        : null,
    [importacao, transacoes, contas, categorias],
  );
  if (!importacao || !previa) return null;

  const { extrato } = importacao;
  const periodo =
    extrato.inicio && extrato.fim
      ? `${rotuloDataCurta(extrato.inicio)} a ${rotuloDataCurta(extrato.fim)}`
      : null;
  const resumo = [
    previa.aImportar === 1 ? '1 para importar' : `${previa.aImportar} para importar`,
    previa.jaImportadas > 0
      ? `${previa.jaImportadas} já ${previa.jaImportadas === 1 ? 'importado' : 'importados'}`
      : '',
    previa.ignoradas > 0
      ? `${previa.ignoradas} ${previa.ignoradas === 1 ? 'linha ilegível' : 'linhas ilegíveis'}`
      : '',
  ].filter(Boolean);

  const cabecalho = (
    <View style={{ gap: 18, paddingBottom: 8 }}>
      <View style={{ alignItems: 'center', gap: 4 }}>
        <Txt tamanho={15} peso={600} alinhamento="center">
          {extrato.tipoDeConta === 'cartao' ? 'Fatura de cartão' : 'Extrato de conta'}
          {extrato.banco ? ` · ${extrato.banco}` : ''}
        </Txt>
        {periodo ? (
          <Txt tamanho={12} cor={t.inkSoft}>
            {periodo}
          </Txt>
        ) : null}
      </View>

      <Pilulas
        rotulo="PARA A CONTA"
        itens={contas}
        selecionado={importacao.contaId}
        aoEscolher={(contaId) => despachar({ tipo: 'IMPORTACAO_CONTA', contaId })}
      />

      <Txt tamanho={12} peso={600} cor={t.inkMuted} alinhamento="center">
        {resumo.join(' · ')}
      </Txt>
    </View>
  );

  return (
    <Folha titulo="Importar extrato" aoFechar={() => despachar({ tipo: 'FECHAR_FOLHA' })}>
      <FlatList
        data={previa.linhas}
        keyExtractor={(l) => l.bruta.idExterno}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
        ListHeaderComponent={cabecalho}
        ListEmptyComponent={
          <Txt tamanho={12.5} cor={t.inkSoft} alinhamento="center" estilo={{ paddingTop: 24 }}>
            Tudo neste extrato já está no app.
          </Txt>
        }
        renderItem={({ item }) => (
          <Linha
            linha={item}
            contas={contas}
            categorias={categorias}
            contaId={importacao.contaId}
          />
        )}
      />

      <View
        style={{
          backgroundColor: t.surface,
          borderTopWidth: 1,
          borderTopColor: t.line,
          padding: 16,
        }}
      >
        <BotaoPrincipal
          rotulo={
            previa.linhas.length === 0
              ? 'Nada novo neste extrato'
              : previa.aImportar === 0
                ? 'Confirmar'
                : previa.aImportar === 1
                  ? 'Importar 1 lançamento'
                  : `Importar ${previa.aImportar} lançamentos`
          }
          aoTocar={() => despachar({ tipo: 'CONFIRMAR_IMPORTACAO' })}
        />
      </View>
    </Folha>
  );
}

function Linha({
  linha,
  contas,
  categorias,
  contaId,
}: {
  linha: LinhaDaPrevia;
  contas: Conta[];
  categorias: Categoria[];
  contaId: string;
}) {
  const despachar = useDespachar();
  const { t } = useTema();
  const { bruta } = linha;
  const escolher = (escolha: Escolha) =>
    despachar({ tipo: 'IMPORTACAO_ESCOLHA', idExterno: bruta.idExterno, escolha });

  const nomeDaConta = (id: string) => contas.find((c) => c.id === id)?.nome ?? '';
  const legenda =
    linha.situacao === 'transferencia'
      ? bruta.valorCentavos < 0
        ? `Transferência para ${nomeDaConta(linha.contraparteId)}`
        : `Transferência de ${nomeDaConta(linha.contraparteId)}`
      : linha.situacao === 'duplicata' && linha.mesma
        ? 'Não entra — já está no app'
        : categoria(categorias, linha.categoriaId).nome;

  return (
    <View
      style={{
        gap: 8,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: t.lineSoft,
        opacity: linha.situacao === 'duplicata' && linha.mesma ? 0.6 : 1,
      }}
    >
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Txt tamanho={13} peso={600} linhas={2}>
            {bruta.descricaoOriginal}
          </Txt>
          <Txt tamanho={11.5} cor={t.inkSoft}>
            {rotuloDataCurta(bruta.ocorridoEm)} · {legenda}
          </Txt>
        </View>
        <Txt tamanho={13.5} peso={600} numerico cor={bruta.valorCentavos < 0 ? t.ink : t.up}>
          {comSinal(bruta.valorCentavos)}
        </Txt>
      </View>

      {linha.situacao === 'duplicata' ? (
        <View style={{ gap: 6 }}>
          <Txt tamanho={11.5} cor={t.inkMuted}>
            Parece ser “{linha.existente.descricao}” de{' '}
            {rotuloDataCurta(linha.existente.ocorridoEm)}.
          </Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            <Chip
              rotulo="É a mesma"
              ativo={linha.mesma}
              aoTocar={() => escolher({ mesma: true })}
            />
            <Chip
              rotulo="São diferentes"
              ativo={!linha.mesma}
              aoTocar={() => escolher({ mesma: false })}
            />
          </View>
        </View>
      ) : null}

      {linha.situacao === 'transferencia' ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {contas
            .filter((c) => c.id !== contaId)
            .map((c) => (
              <Chip
                key={c.id}
                rotulo={c.nome}
                ativo={c.id === linha.contraparteId}
                aoTocar={() => escolher({ contraparteId: c.id })}
              />
            ))}
          <Chip
            rotulo="Não é transferência"
            ativo={false}
            aoTocar={() => escolher({ transferencia: false })}
          />
        </View>
      ) : null}

      {/* A pista do adapter foi desligada: o caminho de volta fica à mão. */}
      {linha.situacao === 'nova' && bruta.natureza === 'transferencia' ? (
        <View style={{ flexDirection: 'row' }}>
          <Chip
            rotulo="É transferência"
            ativo={false}
            aoTocar={() => escolher({ transferencia: true })}
          />
        </View>
      ) : null}
    </View>
  );
}

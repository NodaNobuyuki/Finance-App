import React from 'react';
import { Pressable, StyleProp, Text, TextStyle, View, ViewStyle } from 'react-native';
import { comAlfa } from '../tema/paletas';
import { useTema } from '../tema/TemaContext';
import { mono, Peso, sans } from '../tema/fontes';
import { Icone } from './Icone';

/* ── Texto ───────────────────────────────────────────────────── */

type TxtProps = {
  children: React.ReactNode;
  tamanho?: number;
  peso?: Peso;
  cor?: string;
  /** Família mono — obrigatória para qualquer valor em dinheiro. */
  numerico?: boolean;
  alinhamento?: TextStyle['textAlign'];
  entrelinha?: number;
  espacamento?: number;
  maiusculas?: boolean;
  linhas?: number;
  estilo?: StyleProp<TextStyle>;
};

export function Txt({
  children,
  tamanho = 13,
  peso = 400,
  cor,
  numerico = false,
  alinhamento,
  entrelinha,
  espacamento,
  maiusculas = false,
  linhas,
  estilo,
}: TxtProps) {
  const { t } = useTema();
  return (
    <Text
      numberOfLines={linhas}
      style={[
        numerico ? mono(peso) : sans(peso),
        {
          fontSize: tamanho,
          color: cor ?? t.ink,
          textAlign: alinhamento,
          lineHeight: entrelinha ? tamanho * entrelinha : undefined,
          letterSpacing: espacamento,
          textTransform: maiusculas ? 'uppercase' : undefined,
        },
        estilo,
      ]}
    >
      {children}
    </Text>
  );
}

/** Rótulo de seção: minúsculo, espaçado, em caixa alta. */
export function Rotulo({ children, cor }: { children: React.ReactNode; cor?: string }) {
  const { t } = useTema();
  return (
    <Txt tamanho={10.5} peso={600} maiusculas espacamento={0.9} cor={cor ?? t.inkFaint}>
      {children}
    </Txt>
  );
}

/* ── Toque ───────────────────────────────────────────────────── */

/**
 * Área tocável padrão. Feedback imediato é regra de UX: toda ação responde
 * visualmente, aqui pelo esmaecimento no toque.
 */
export function Toque({
  children,
  aoTocar,
  estilo,
  desabilitado = false,
  rotuloAcessivel,
}: {
  children: React.ReactNode;
  aoTocar?: () => void;
  estilo?: StyleProp<ViewStyle>;
  desabilitado?: boolean;
  rotuloAcessivel?: string;
}) {
  return (
    <Pressable
      onPress={aoTocar}
      disabled={desabilitado || !aoTocar}
      accessibilityRole="button"
      accessibilityLabel={rotuloAcessivel}
      style={({ pressed }) => [estilo, pressed && !desabilitado ? { opacity: 0.62 } : null]}
    >
      {children}
    </Pressable>
  );
}

/* ── Blocos ──────────────────────────────────────────────────── */

/** Faixa colorida do topo de cada tela. */
export function Hero({
  children,
  estilo,
}: {
  children: React.ReactNode;
  estilo?: StyleProp<ViewStyle>;
}) {
  const { t } = useTema();
  return (
    <View
      style={[
        { backgroundColor: t.hero, paddingHorizontal: 22, paddingTop: 20, paddingBottom: 24 },
        estilo,
      ]}
    >
      {children}
    </View>
  );
}

export function BotaoVoltar({ aoTocar }: { aoTocar: () => void }) {
  const { t } = useTema();
  return (
    <Toque aoTocar={aoTocar} rotuloAcessivel="Voltar">
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: t.heroLine,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icone path="M15 5l-7 7 7 7" tamanho={16} cor={t.onHero} espessura={1.8} />
      </View>
    </Toque>
  );
}

/** Botão principal de tela — o único de largura cheia. */
export function BotaoPrincipal({
  rotulo,
  aoTocar,
  fundo,
  desabilitado = false,
}: {
  rotulo: string;
  aoTocar: () => void;
  fundo?: string;
  desabilitado?: boolean;
}) {
  const { t } = useTema();
  return (
    <Toque aoTocar={desabilitado ? undefined : aoTocar} rotuloAcessivel={rotulo}>
      <View
        style={{
          borderRadius: 14,
          paddingVertical: 15,
          alignItems: 'center',
          backgroundColor: fundo ?? (desabilitado ? t.lineInput : t.accent),
        }}
      >
        <Txt tamanho={14.5} peso={600} cor={t.onAccent}>
          {rotulo}
        </Txt>
      </View>
    </Toque>
  );
}

/** Barra de progresso. `pct` é 0–100. */
export function Barra({
  pct,
  cor,
  altura = 8,
  fundo,
}: {
  pct: number;
  cor: string;
  altura?: number;
  fundo?: string;
}) {
  const { t } = useTema();
  return (
    <View
      style={{
        height: altura,
        borderRadius: 999,
        backgroundColor: fundo ?? t.segment,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          height: '100%',
          borderRadius: 999,
          backgroundColor: cor,
          width: `${Math.max(0, Math.min(100, pct))}%`,
        }}
      />
    </View>
  );
}

/** Chip selecionável (filtros, contas, categorias). */
export function Chip({
  rotulo,
  ativo,
  aoTocar,
  ponto,
}: {
  rotulo: string;
  ativo: boolean;
  aoTocar: () => void;
  /** Cor do marcador à esquerda; ausente = chip sem ponto. */
  ponto?: string;
}) {
  const { t } = useTema();
  return (
    <Toque aoTocar={aoTocar} rotuloAcessivel={rotulo}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          borderRadius: 999,
          paddingVertical: 7,
          paddingHorizontal: 13,
          borderWidth: 1,
          borderColor: ativo ? t.accent : t.line,
          backgroundColor: ativo ? t.accent : t.surface,
        }}
      >
        {ponto ? (
          <View
            style={{
              width: 7,
              height: 7,
              borderRadius: 999,
              backgroundColor: ativo ? t.onAccent : ponto,
            }}
          />
        ) : null}
        <Txt tamanho={12.5} peso={ativo ? 600 : 500} cor={ativo ? t.onAccent : t.inkMuted}>
          {rotulo}
        </Txt>
      </View>
    </Toque>
  );
}

/** Disco com ícone — usado em transações, metas e desafios. */
export function Disco({
  path,
  cor,
  fundo,
  tamanho = 38,
  icone = 18,
}: {
  path: string;
  cor: string;
  fundo?: string;
  tamanho?: number;
  icone?: number;
}) {
  return (
    <View
      style={{
        width: tamanho,
        height: tamanho,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: fundo ?? comAlfa(cor, 14),
      }}
    >
      <Icone path={path} tamanho={icone} cor={cor} />
    </View>
  );
}

/** Cartão de número curto (2 por linha). */
export function CartaoNumero({
  rotulo,
  valor,
  nota,
  corValor,
}: {
  rotulo: string;
  valor: string;
  nota?: string;
  corValor?: string;
}) {
  const { t } = useTema();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: t.surfaceMuted,
        borderRadius: 16,
        padding: 14,
        gap: 4,
      }}
    >
      <Txt tamanho={11.5} cor={t.inkSoft} entrelinha={1.3}>
        {rotulo}
      </Txt>
      <Txt tamanho={20} peso={600} numerico cor={corValor} espacamento={-0.4}>
        {valor}
      </Txt>
      {nota ? (
        <Txt tamanho={11} cor={t.inkFaint}>
          {nota}
        </Txt>
      ) : null}
    </View>
  );
}

export function Separador() {
  const { t } = useTema();
  return <View style={{ height: 1, backgroundColor: t.lineSoft }} />;
}

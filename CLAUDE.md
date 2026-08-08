# Poupa Bloco

App de finanças pessoais focado em **mudança de comportamento financeiro**, não apenas em registro de gastos. Android-first, iOS depois.

O diferencial do produto é o loop de custo de oportunidade: ao lançar uma despesa, o usuário pode simular quanto aquele valor renderia investido e transformar o gasto em aporte para uma meta. Streaks e desafios reforçam o hábito. Features novas devem servir a esse posicionamento — não buscar paridade com Mobills/Organizze.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Mobile | React Native + Expo, TypeScript |
| Backend | Node.js + Express, TypeScript |
| Banco | PostgreSQL + Drizzle ORM |
| Local (offline) | SQLite (expo-sqlite) |
| Auth | JWT |

---

## Regras invioláveis

Estas não são preferências. Quebrar qualquer uma delas é bug.

### 1. Dinheiro é sempre inteiro em centavos

```ts
// ✅ correto
const amountCents = 28790;        // R$ 287,90
type Money = number;              // sempre centavos, sempre inteiro

// ❌ nunca
const amount = 287.90;            // float em dinheiro = bug de arredondamento
```

Conversão para exibição acontece **apenas na camada de apresentação**. Nunca armazene, transmita ou calcule com float. No banco, use `integer` ou `bigint` — nunca `float`/`real`/`double`.

### 2. Toda transação tem origem rastreável

Todo lançamento carrega `source` (`manual`, `ofx`, `notification`, `email`, `csv`). O usuário precisa saber de onde veio cada dado para confiar no que é automático.

### 3. Nada de lógica de banco específico fora dos adapters

Regex do Nubank, formato do Itaú, quirk do Inter — tudo isolado em adapters. Ver seção "Ingestão".

### 4. Sem chamada de rede no caminho crítico de lançamento

O usuário registra gasto no ônibus, sem sinal. Escrita local primeiro, sync depois. Sempre.

### 5. Respostas e código em português brasileiro

Nomes de variáveis, comentários, mensagens de commit e strings de UI em pt-BR. Termos técnicos consagrados (`adapter`, `dedupe`, `sync`) podem ficar em inglês.

---

## Modelo de dados (núcleo)

```
users            (id, email, password_hash, created_at)
accounts         (id, user_id, name, type, initial_balance_cents, currency)
categories       (id, user_id, name, type[income|expense], icon, color, is_default)
transactions     (id, account_id, category_id, amount_cents, occurred_at,
                  description, raw_description, external_id, source, created_at)
goals            (id, user_id, name, target_cents, current_cents, deadline)
budgets          (id, user_id, category_id, limit_cents, period)
recurring_rules  (id, user_id, template, frequency, next_occurrence)
challenges       (id, user_id, type, target, progress, started_at, completed_at)
```

**Saldo de conta é derivado**, nunca armazenado como valor mutável:

```
saldo = initial_balance_cents + SUM(transactions.amount_cents WHERE account_id = ?)
```

Isso evita o bug clássico de saldo dessincronizado. Se performance exigir, use materialized view ou cache invalidável — nunca uma coluna atualizada por trigger espalhada pelo código.

**Dedupe:** `UNIQUE (account_id, external_id)` quando houver `external_id` (FITID do OFX). Para colisão manual × importado (mesma conta, valor idêntico, data ±2 dias), **não resolva automaticamente** — apresente ao usuário uma tela de "possíveis duplicatas" e deixe ele decidir.

---

## Ingestão de dados

O ponto mais crítico da arquitetura. Cada banco tem formato próprio, então **nunca** trate formato de banco fora de um adapter.

```
[Notificação Android] ┐
[OFX / CSV]           ├→ SourceAdapter → RawTransaction → Normalizer → Transaction
[E-mail]              │                                        ↓
[Share sheet]         │                              [Dedupe + Categorização]
[Manual]              ┘
```

```ts
interface SourceAdapter {
  id: string;                    // 'nubank-notification' | 'ofx-generic'
  parse(input: unknown): RawTransaction[];
}

interface RawTransaction {
  externalId?: string;           // FITID; hash estável quando não houver
  amountCents: number;           // inteiro, negativo = saída
  occurredAt: Date;
  rawDescription: string;        // preservar sempre o texto original
  accountHint?: string;          // "final 1234"
  source: string;
}
```

**Adicionar um banco novo = escrever um adapter novo.** Se você precisou tocar em qualquer outro arquivo, a abstração vazou — pare e corrija.

### Armadilhas conhecidas

**OFX**
- OFX 1.x é SGML, não XML — tags sem fechamento. Parser XML padrão quebra.
- Encoding costuma ser `cp1252`/`ISO-8859-1`, não UTF-8. Ler como UTF-8 corrompe acentuação.
- Cartão de crédito usa `CREDITCARDMSGSRSV1`; conta usa `BANKMSGSRSV1`. Caminhos distintos.
- Data no formato `YYYYMMDDHHMMSS[-3:BRT]`.
- Alguns bancos invertem a convenção de sinal em fatura de cartão.

**Notificações Android**
- `NotificationListenerService` é permissão sensível na Play Store. Exige justificativa na publicação e tela de consentimento explícita.
- Formatos de texto mudam sem aviso — parsers precisam falhar silenciosamente e logar, nunca derrubar o app.
- Não existe equivalente no iOS. Planejar canal alternativo (e-mail) para paridade.

### Ordem de implementação

1. Manual rápido — ✅ pronto
2. OFX/CSV + share sheet do Android
3. Notificações Android
4. Recorrência inferida (elimina ingestão do que é previsível)
5. E-mail via OAuth (cobre iOS)
6. Open Finance via agregador — só quando houver receita, é custo recorrente por usuário

---

## Convenções de código

**Backend — arquitetura em camadas, sem atalho:**

```
routes → controllers → services → repositories → db
```

Controller não acessa banco. Service não conhece HTTP. Repository não contém regra de negócio.

**Estrutura:**

```
src/
  modules/<dominio>/     # transactions, goals, accounts, challenges
    *.routes.ts
    *.controller.ts
    *.service.ts
    *.repository.ts
    *.schema.ts          # Drizzle + Zod
  ingestion/
    adapters/            # um arquivo por fonte
    normalizer.ts
    dedupe.ts
  shared/
```

**Validação:** Zod em toda fronteira de entrada (body, params, query, payload de adapter).

**Erros:** classes de erro tipadas, nunca `throw new Error('deu ruim')`. Erro de domínio ≠ erro de infra.

**Testes:** obrigatórios para adapters (com fixtures de extratos reais anonimizados), cálculo de saldo e dedupe. Essas três áreas concentram os bugs que corrompem dados do usuário.

---

## UX — princípios não negociáveis

- **Ação destrutiva usa undo, não confirmação.** Deletar mostra toast com "Desfazer" por ~3s. Modal de confirmação é fricção pior.
- **Feedback imediato.** Toda ação confirma visualmente (animação de saldo, haptic, toast).
- **Empty state nunca é texto seco.** Ilustração + call-to-action.
- **Tema por CSS variables.** Paletas trocáveis, com tons alternativos para modo escuro. Nunca hardcode cor em componente.
- **Nenhuma tela morta.** Se uma tela só exibe totais sem interação, ela é candidata a virar outra coisa ou sumir.

---

## Estado atual

**Protótipo (Claude Design):** 6 telas funcionais — Início, Extrato, Metas, Categorias, Hábitos, Simulador. Sistema de paletas completo, teclado numérico customizado, toasts, filtros por conta/categoria, streaks e desafios com progresso.

**Pendências conhecidas do protótipo:**
- Saldos de conta são estáticos (`contasBase`) — não refletem transações novas
- Toast não tem "Desfazer"
- Tela Categorias é só grid de totais, sem interação — candidata a virar tela de orçamento
- Data hardcoded (`'2026-08-03'`)
- Meta aceita apenas aporte fixo de R$ 100

**Próximo ciclo:** saldo derivado, undo no toast, barra de orçamento com cor progressiva (verde → amarelo → vermelho), card de insight automático na Home.

---

## Ao trabalhar neste projeto

- Antes de propor feature nova, pergunte se ela reforça o loop comportamental. Se não reforça, provavelmente não entra.
- Ao mexer em ingestão, assuma que a entrada é suja, mal-encodada e potencialmente duplicada.
- Ao mexer em dinheiro, confirme que tudo é centavo inteiro do começo ao fim da chamada.
- Prefira corrigir a pendência conhecida mais próxima do que está sendo tocado a abrir frente nova.

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
2. OFX/CSV + share sheet do Android — exige development build (EAS)
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

**App Expo rodando** (`src/`), portado do protótipo `design/Poupa Hábitos.dc.html`. 9 telas — Início, Extrato, Metas, Categorias, Hábitos, Simulador, Lote, Resumo, Fechar semana — mais 3 folhas: Nova transação, Aporte e Ritual. 13 paletas, teclado numérico próprio, toast com undo.

```
src/dominio/    dinheiro (centavos), saldo derivado, guardado das metas,
                categorias, taxas, datas, ids, erros, seed
src/dados/      persistência: motor SQL, migrations, repositórios
src/estado/     store (reducer + context) e derivados (seleções)
src/componentes/ primitivos que leem tokens do tema
src/telas/      uma tela por arquivo, folhas em telas/folhas/, primeiro uso em Onboarding
src/tema/       paletas como tokens + provider
```

Verificação: `npm run verificar` = lint + tipos + 261 testes + expo-doctor + bundle. Mesma bateria roda no CI.

### Erros: domínio ≠ infra

`ErroDeDominio` é regra violada — explicável ao usuário, repetir não adianta. `ErroDeInfra` é o mundo falhando — disco cheio, migration quebrada — e costuma valer retentar. A distinção decide a interface, e `mensagemParaOUsuario()` nunca vaza detalhe técnico de infra.

`categoria(id)` **não lança**: id fora do catálogo devolve uma categoria órfã que preserva o id. Com dado em disco, uma linha apontando para categoria removida derrubaria o Extrato inteiro.

### Persistência

```
Estado (memória, sempre a fonte)
  └─ usePersistencia  → compara referências, O(1)
       └─ RepositorioLocal   ← contrato, duas implementações
            ├─ repositorioSQL(MotorSQL)   → motorExpo (aparelho)
            │                             → motorNode (teste, SQLite real)
            └─ repositorioMemoria
```

**Nada é aguardado pela interface.** A gravação é efeito pós-render; o usuário vê saldo e toast na hora. O gatilho é comparação por referência — como o reducer é imutável, digitar no teclado numérico não encosta no banco.

**A escrita é diff por id**, não reescrita de tabela: registrar um gasto grava uma linha. Falha de gravação devolve o ponto de comparação para trás, então a próxima escrita reenvia o que se perdeu.

**`MotorSQL` existe para o SQL ser testável.** `expo-sqlite` é nativo e não roda no Jest; sem esse seam, migrations só seriam exercitadas no aparelho. A mesma suíte de contrato roda contra memória e contra SQLite de verdade (`node:sqlite`, embutido no Node 24). Sem cobertura sobra só `motorExpo.ts`, que é repasse puro.

**Migration publicada nunca é editada** — entra versão nova no fim da lista. Editar a v1 depois que alguém instalou deixa o banco daquela pessoa no esquema antigo com `user_version` já avançado. Cada uma roda na própria transação: falhou, o banco fica íntegro na versão anterior.

### O reducer é puro; id e relógio entram por injeção

`criarReducer(deps)` recebe `{ gerarId, agoraMs }`. São as duas únicas fontes de não-determinismo em toda a escrita, e chamá-las dentro do reducer tornaria os testes irreproduzíveis. `dependenciasReais` usa UUID v7 e `Date.now()`; `dependenciasDeTeste()` usa contadores. **É este o mesmo ponto onde o repositório vai se plugar** — não abra um segundo.

Ids são UUID v7 (`src/dominio/ids.ts`), sem dependência nova: `crypto.getRandomValues` quando existir, `Math.random` como fallback. Sequencial colidiria entre reinstalações e entre aparelhos, e id de linha gravada não se troca sem migração de dado vivo.

**A data real está ligada.** `AGORA` continua existindo só como âncora dos testes; o app monta com `criarEstadoInicial(hojeReal())` e `useSincronizarDia` reconfere quando o app volta do segundo plano. Por isso a semente é função do dia: data cravada envelheceria e a demo abriria num mês vazio.

`semanaFechada` é `DiaISO | null` — guarda **qual** semana foi fechada, e `semanaEstaFechada()` compara com a semana corrente. Era `boolean`, o que sob persistência congelaria o ritual fechado para sempre.

### Primeiro uso

O app abre **vazio**. Banco sem nada é sinal de instalação nova: `criarEstadoVazio` + onboarding de 3 passos (nome, primeira conta com saldo de abertura, meta opcional). Nada é gravado antes de a pessoa concluir — o disco não deve conter dado que ela não criou.

A demo virou modo explícito (`criarEstadoDemo`), alcançável pelo onboarding e por Hábitos. **`estadoVazio` é o par de `estadoInicial` nos testes**, e as telas são montadas contra os dois.

Os números de `contexto` (`semanasEmDia`, `lancamentosMesAnterior`) são placeholders da demo e vão a **zero** no estado vazio: anunciar "5 semanas seguidas em dia" para quem instalou agora é mentira, não valor de partida.

### Desafio: definição é catálogo, progresso é do usuário

`src/dominio/desafios.ts` guarda nome, alvo e ação; `Estado.progressoDesafios` guarda só `{ id, aceito, progresso }`, e a ausência de linha faz valer o padrão da definição.

Isso não desfaz a regra abaixo — é a mesma divisão de categoria × transação. O motivo é atualização: com a definição gravada no banco de cada pessoa, **desafio novo publicado numa versão seguinte nunca apareceria** para quem já instalou, porque o app leria a lista do disco. Foi por isso que entrou a migration v2.

### `seed` é semente do estado, não fonte de consulta

Todo dado do usuário — transações, contas, metas, aportes, desafios, orçamento — mora em `Estado`. `src/dominio/seed.ts` só alimenta `estadoInicial`; tela, componente e derivado leem sempre de `estado.*`. Um `no-restricted-imports` no ESLint segura a regra.

O motivo é persistência: **o que não está no `Estado` não tem como ser gravado nem recarregado.** Enquanto metas e desafios eram constantes de módulo, eram imutáveis por construção, e os contadores paralelos (`aportes: Record<metaId, número>`) só existiam para contornar isso.

`categorias` e `taxas` continuam sendo constantes de módulo de propósito: são catálogo, não dado de quem usa o app.

**Guardado da meta é derivado, igual ao saldo:** `guardadoInicialCentavos + soma dos aportes daquela meta` (`src/dominio/metas.ts`). Como a soma filtra por `metaId`, aporte que aponta para meta apagada não entra em total nenhum.

**Resolvido do protótipo:** saldo derivado (com teste travando os valores), undo no toast, orçamento com cor progressiva, insight na Home, aporte de valor livre.

**Pendências abertas:**
- Aporte não move dinheiro: guardar R$ 500 numa meta não altera saldo nenhum. Modelar como transferência exige o conceito de par de transações — decisão à parte, ainda não tomada
- Conta e meta só nascem no onboarding. Falta "nova conta" e "nova meta" no app já rodando — hoje quem apaga tudo fica sem caminho para recriar
- Categoria órfã aparece como "Sem categoria" mas não há como recategorizar o lançamento
- `Meta.prazo` é string pré-formatada (`'faltam 134 dias · 15 dez 2026'`), então envelhece sozinha. Vira `DiaISO` quando metas forem criadas pelo usuário
- Tela Categorias abre o extrato filtrado, mas não virou tela de orçamento
- Setas de mês no Extrato e "Nova categoria" são decorativas
- Categorias ainda são catálogo fixo. Viram dado do usuário (e vão para o `Estado` e para o banco) quando "Nova categoria" funcionar
- Sem retentativa ativa de gravação: o reenvio pega carona na próxima mudança. Um outbox resolve, se virar problema
- Nenhuma tela lê do banco sob demanda — o estado inteiro é carregado no boot. Aguenta bem os primeiros anos; a saída é paginar por período no repositório

**Próximo ciclo:** criação de conta e meta fora do onboarding, categorias como dado do usuário (destrava "Nova categoria" e a tela Categorias virar orçamento) e recategorizar lançamento. Depois: `SectionList` no Extrato (o agrupamento em `agruparPorDia` já encaixa, e ele hoje é O(n·dias)) e memoização dos derivados.

**Decisão em aberto:** a v1 vale ser 100% local, sem backend. Não perde o loop comportamental, dispensa auth e infra, e encurta muito o caminho até a loja. Backend entra quando houver sync entre aparelhos ou receita — mesmo critério já aplicado ao Open Finance.

---

## SDK do Expo está fixado em 54 de propósito

**Não atualize sem ler isto.** A App Store publica o Expo Go **54.0.2** desde setembro de 2025, e o Expo Go roda só um SDK por vez. Subir o projeto para 55+ quebra o teste em iPhone — que hoje é o único aparelho disponível.

O acoplamento acaba quando o projeto migrar para **development build** (EAS). Aí o cliente é compilado por nós e o SDK volta a ser escolha livre. Isso vai acontecer de qualquer forma no item 2 da ordem de implementação: share sheet e `NotificationListenerService` são código nativo e **não rodam no Expo Go, em SDK nenhum**.

Ao subir de SDK, depois do dev build:

```
npx expo install expo@^NN
npx expo install --fix      # runtime + jest-expo + typescript
# manual — o Expo não vigia estes: @types/react, react-test-renderer
# (versão exata do react), @testing-library/react-native
npm run verificar
```

Dois detalhes que já custaram tempo: `expo install --check` lê o `node_modules`, não o `package.json` — editar o manifesto sem instalar dá falso "tudo certo". E numa troca grande, apague `node_modules` e `package-lock.json` antes do install.

Se o `verificar` quebrar depois de subir SDK, olhe qual arquivo falhou. Os testes de domínio e estado não importam nada externo: se eles quebram, é regressão real. Já `telas.test.tsx` depende de `react` e do RNTL — quando os 30 testes dele caem juntos com a mesma mensagem, quase sempre é mudança de API da biblioteca, não bug do app.

---

## Ao trabalhar neste projeto

- Antes de propor feature nova, pergunte se ela reforça o loop comportamental. Se não reforça, provavelmente não entra.
- Ao mexer em ingestão, assuma que a entrada é suja, mal-encodada e potencialmente duplicada.
- Ao mexer em dinheiro, confirme que tudo é centavo inteiro do começo ao fim da chamada.
- Prefira corrigir a pendência conhecida mais próxima do que está sendo tocado a abrir frente nova.
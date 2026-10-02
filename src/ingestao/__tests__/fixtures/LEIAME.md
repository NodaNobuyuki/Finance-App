# Fixtures de extrato

Extratos reais, anonimizados. **Nunca entra aqui arquivo sem anonimizar** — nome, CPF, CNPJ, número de conta e valor de salário são dado pessoal.

| arquivo | origem | o que exercita |
|---|---|---|
| `nubank-cartao.ofx` | fatura de cartão Nubank, exportada em set/2026 | `CREDITCARDMSGSRSV1`; cabeçalho diz `CHARSET:1252` e o conteúdo é ASCII; `IOF de "…"` como linha própria; `- Parcela n/m`; `Pagamento recebido` positivo |
| `nubank-conta.ofx` | conta corrente Nubank, set/2026 | `BANKMSGSRSV1`; **UTF-8** com acento e `•` na máscara de CPF; transferência recebida e Pix enviado |
| `sgml-cp1252-sem-fechamento.ofx` | **derivado** de `nubank-conta.ofx` | o formato clássico de banco brasileiro: cp1252, CRLF, folhas sem tag de fechamento. Tem de produzir exatamente o mesmo extrato que o original |

O que foi trocado: estabelecimentos por nomes inventados preservando a forma (`Shopee *Loja…`, `Servico* Assinatura`), FITIDs e `ACCTID` por UUIDs aleatórios, valores do cartão multiplicados por um fator aleatório (mesmo sinal, mesma ordem de grandeza), e na conta: nome, CPF, CNPJ, agência, conta e valor. Datas, estrutura, cabeçalho, quebras de linha e encoding são os originais — é deles que os bugs vêm.

Os `.ofx` são `binary` no `.gitattributes`: normalizar fim de linha apagaria o CRLF que o derivado existe para testar.

/**
 * Raio-x de extratos OFX, sem dado pessoal na saída.
 *
 *   npm run diagnosticar-ofx -- extrato.ofx [outro.ofx …]
 *
 * Para quem tem conta num banco que o app ainda não conhece: roda no próprio
 * computador e manda só o que aparece na tela. Número de conta, valores,
 * FITIDs e descrições não saem — só a forma deles, e nos alertas as duas
 * primeiras palavras do texto do banco. Vale dar uma olhada antes de mandar.
 *
 * A lógica mora em `src/ingestao/adapters/ofxDiagnostico.ts`, testada; isto é
 * só a porta de entrada.
 */
import { readFileSync } from 'node:fs';
import { diagnosticarOFX, relatorioDoDiagnostico } from '../src/ingestao/adapters/ofxDiagnostico';

const arquivos = process.argv.slice(2);
if (arquivos.length === 0) {
  console.error('uso: npm run diagnosticar-ofx -- extrato.ofx [outro.ofx …]');
  process.exit(1);
}

arquivos.forEach((caminho, i) => {
  // O nome do arquivo fica de fora: o do Nubank, por exemplo, traz o id da conta.
  console.log(`\n═══ Arquivo ${i + 1} de ${arquivos.length}`);
  try {
    console.log(relatorioDoDiagnostico(diagnosticarOFX(new Uint8Array(readFileSync(caminho)))));
  } catch (erro) {
    console.log(`   não deu para ler: ${erro instanceof Error ? erro.message : String(erro)}`);
  }
});

import { useEffect, useRef } from 'react';
import { useLoja } from '../estado/store';
import { EstadoPersistido, mudouAlgoPersistido, recortePersistido } from './persistido';
import { RepositorioLocal } from './repositorio';

/**
 * Liga o estado ao disco.
 *
 * A regra 4 do projeto manda que o caminho crítico de lançamento não espere
 * por I/O. Por isso a gravação acontece DEPOIS do render, e nada aqui é
 * aguardado pela interface: o usuário vê o saldo mudar e o toast aparecer;
 * o disco corre atrás.
 *
 * O gatilho é comparação por referência (`mudouAlgoPersistido`), não igualdade
 * profunda. Como o reducer é imutável, isso é O(1) e ainda tem o efeito de
 * ignorar sozinho tudo que é estado de sessão — digitar no teclado numérico
 * troca `rascunho` a cada toque e não encosta no banco.
 *
 * As escritas são serializadas numa fila de uma posição só. Dois toques
 * rápidos não podem virar duas transações SQL concorrentes gravando diffs
 * calculados a partir do mesmo ponto de partida.
 */
export function usePersistencia(
  repositorio: RepositorioLocal | null,
  aoFalhar?: (erro: unknown) => void,
) {
  const { estado } = useLoja();
  const ultimoGravado = useRef<EstadoPersistido | null>(null);
  const fila = useRef<Promise<void>>(Promise.resolve());
  const falhar = useRef(aoFalhar);

  // O callback mais recente sem entrar nas dependências do efeito de gravação:
  // trocar `aoFalhar` a cada render não pode reagendar uma escrita. A escrita
  // vai para um efeito porque mexer em ref durante o render é o que a regra
  // `react-hooks/refs` proíbe; quem lê `falhar.current` é o `catch`, muito
  // depois do commit.
  useEffect(() => {
    falhar.current = aoFalhar;
  }, [aoFalhar]);

  useEffect(() => {
    if (!repositorio) return;

    const atual = recortePersistido(estado);
    const anterior = ultimoGravado.current;

    // Primeira passada: este estado acabou de vir do banco (ou é a semente que
    // o boot já gravou). Serve só para estabelecer o ponto de comparação.
    if (anterior === null) {
      ultimoGravado.current = atual;
      return;
    }

    if (!mudouAlgoPersistido(anterior, atual)) return;
    ultimoGravado.current = atual;

    fila.current = fila.current
      .then(() => repositorio.salvar(anterior, atual))
      .catch((erro) => {
        // Falha de gravação não derruba a tela — o estado em memória segue
        // correto e o app continua usável. Mas o ponto de comparação volta
        // atrás: assim a próxima escrita recalcula o diff desde o último
        // estado que REALMENTE chegou ao disco e reenvia o que se perdeu.
        // Não há retentativa ativa; o reenvio pega carona na próxima mudança.
        ultimoGravado.current = anterior;
        falhar.current?.(erro);
      });
  }, [estado, repositorio]);
}

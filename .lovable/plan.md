

## Melhorar Layout da Seção Final do Dashboard

O problema visível na screenshot: a seção de 3 colunas (Top 5 Latência, Serviços, Alertas) está desalinhada — as colunas têm alturas diferentes, os cards de serviço ocupam muito espaço vertical, e os filtros de categoria quebram a linha.

### Correções em `src/pages/Index.tsx`

1. **Reorganizar layout geral** — mover a seção Top 5 + Serviços + Alertas para um grid `lg:grid-cols-3` com alturas alinhadas (`items-start`) e limitar altura máxima de cada coluna com scroll interno

2. **Top 5 Latência** — manter compacto, reduzir padding dos cards para `p-2.5`

3. **Serviços** — mover filtros de categoria para uma linha horizontal com scroll (`overflow-x-auto whitespace-nowrap`), limitar `max-h-[400px]` com scroll

4. **Alertas** — limitar `max-h-[400px]` com scroll, manter mesmo tamanho visual das outras colunas

5. **Equalizar visualmente** — cada coluna dentro de um container `glass-card rounded-lg p-4` para dar consistência visual entre as 3 seções, todas com a mesma altura máxima

### Arquivo
| Arquivo | Ação |
|---------|------|
| `src/pages/Index.tsx` | Refatorar seção final (linhas 229-356) com containers uniformes e scroll interno |


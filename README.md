# TCC — Escalonamento em Nuvem com Cache

Repositório de apoio ao TCC sobre estratégias de escalonamento em nuvem combinadas
com cache em múltiplas camadas.

Contém a configuração reprodutível descrita no anexo do trabalho: uma stack local
composta por uma aplicação Node.js (padrão *Cache-Aside*), um Redis para
armazenamento temporário de dados e um Nginx atuando como *proxy* reverso com
*cache* HTTP.

## Estrutura

```
anexos/stack-cache/
├── docker-compose.yml       # Orquestração com healthchecks
├── nginx/
│   └── nginx.conf           # Proxy reverso com cache HTTP
└── app/
    ├── Dockerfile
    ├── package.json
    └── server.js            # App Node.js com Cache-Aside
```

## Componentes

- **Redis** (`tcc-redis`): Armazenamento temporário com TTL de 90 segundos.
  - Porta: `6379`
  - Padrão: *Cache-Aside* (a aplicação controla leitura e escrita)

- **App Node.js** (`tcc-node-app`): API que implementa o padrão *Cache-Aside*.
  - Porta: `3000` (interna, não exposta)
  - Delay simulado: 1.2s (representa consulta a APIs externas)
  - Endpoints:
    - `GET /` — informações da API
    - `GET /health` — healthcheck
    - `GET /api/v1/odds/:matchId` — endpoint de odds com cache

- **Nginx** (`tcc-nginx`): *Proxy* reverso com *cache* HTTP.
  - Porta: `8080` (entrada pública)
  - Cache HTTP: TTL de 10 segundos
  - Expõe: cabeçalho `X-Cache-Status` com valores `HIT`, `MISS`, `EXPIRED`

## Execução Rápida

```bash
cd anexos/stack-cache
docker compose up --build
```

Aguarde até que os três containers estejam `healthy`:

```bash
docker compose ps
```

Quando todos mostrarem `Up` e healthcheck OK, a stack está pronta.

## Validação do Comportamento de Cache

### Requisição 1 (espera MISS do Nginx)

```bash
curl -i http://localhost:8080/api/v1/odds/10
```

Esperado:
- `X-Cache-Status: MISS` (primeira requisição, cache vazio)
- `"source": "upstream"` (a app consultou Redis → nenhum, chamou a simulação externa)
- Latência: ~1.2s (simulação de delay)

### Requisição 2 (espera HIT do Nginx)

```bash
curl -i http://localhost:8080/api/v1/odds/10
```

Esperado:
- `X-Cache-Status: HIT` (Nginx serviu direto, sem chamar a app)
- `"source": "redis"` (se a app fosse chamada, viria do Redis)
- Latência: ~20ms (resposta do cache)

## Visualizar o Fluxo de Cache

Fazer múltiplas requisições e observar o padrão:

```bash
for i in {1..5}; do
  echo "=== Requisição $i ==="
  curl -s -i http://localhost:8080/api/v1/odds/10 | grep -E "^HTTP|X-Cache-Status"
  sleep 2
done
```

Comportamento esperado:
- Requisições dentro de 10s: `HIT`
- Após 10s (TTL do Nginx expirar): `MISS`, depois novamente `HIT`
- TTL do Redis (90s) permite que novas requisições sempre reencontrem os dados se dentro dessa janela

## Logs

Ver logs de um serviço:

```bash
docker compose logs app
docker compose logs nginx
docker compose logs redis
```

Ver logs em tempo real:

```bash
docker compose logs -f app
```

## Parar e Limpar

```bash
# Parar os containers
docker compose down

# Parar e remover volumes (limpa Redis)
docker compose down -v
```

## Exemplo de Teste com curl

```bash
# Inicia a stack
docker compose up -d --build

# Aguarda saúde
sleep 10

# Teste HIT/MISS
echo "1ª requisição (MISS esperado):"
curl -s -i http://localhost:8080/api/v1/odds/1 | head -15

echo -e "\n2ª requisição imediata (HIT esperado):"
curl -s -i http://localhost:8080/api/v1/odds/1 | grep X-Cache-Status

echo -e "\nCorpo da resposta:"
curl -s http://localhost:8080/api/v1/odds/1 | jq .

# Limpeza
docker compose down
```

## Estrutura de Resposta

```json
{
  "source": "upstream|redis",
  "data": {
    "matchId": "10",
    "home": "1.50",
    "draw": "2.80",
    "away": "3.20",
    "generatedAt": "2026-07-22T14:30:00.000Z"
  }
}
```

- `source: "upstream"`: dados vieram de uma simulação (Redis estava vazio)
- `source: "redis"`: dados foram recuperados do Redis (não precisou da simulação)
- `X-Cache-Status: HIT`: Nginx atendeu direto (não chamou a app)
- `X-Cache-Status: MISS`: Nginx não tinha, chamou a app

## Configuração

Variáveis de ambiente (em `docker-compose.yml`):

```yaml
environment:
  - PORT=3000                   # Porta da app
  - REDIS_URL=redis://redis:6379  # URL do Redis
  - CACHE_TTL_SECONDS=90        # TTL Redis em segundos
```

Altere em `docker-compose.yml` e suba novamente com `docker compose up --build`.

## Notas

- O código da aplicação é **ilustrativo e didático**. A etapa de consolidação de
  dados (que no sistema real seria via APIs externas) foi simplificada com um
  delay simulado de 1.2 segundos.
- Os healthchecks garantem que os containers iniciam na ordem correta e que o
  Nginx só trata requisições quando a app está saudável.
- O arquivo `nginx.conf` configura a cache com `proxy_cache_lock on`, evitando
  o efeito de "thundering herd" (múltiplas requisições simultâneas para a mesma
  chave durante um *miss*).

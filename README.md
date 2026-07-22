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
├── docker-compose.yml
├── nginx/
│   └── nginx.conf
└── app/
    ├── Dockerfile
    ├── package.json
    └── server.js
```

## Componentes

- **Redis**: armazenamento temporário de dados com TTL de 90 segundos.
- **Nginx**: *cache* HTTP com TTL de 10 segundos, expondo o cabeçalho
  `X-Cache-Status` para inspeção de `HIT` e `MISS`.
- **App Node.js**: implementa o padrão *Cache-Aside*. O código é ilustrativo e
  didático; a etapa de consulta a fontes externas foi simplificada por uma função
  simulada.

## Execução

```bash
cd anexos/stack-cache
docker compose up -d --build
```

## Validação do cache HTTP

```bash
curl -i http://localhost:8080/api/v1/odds/10
curl -i http://localhost:8080/api/v1/odds/10
```

Na segunda requisição, espera-se `X-Cache-Status: HIT`, indicando atendimento pela
camada de *cache* do Nginx. Na primeira execução, como o Redis está vazio, a
primeira chamada tende a ser `MISS`.

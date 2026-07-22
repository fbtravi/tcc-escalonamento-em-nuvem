#!/usr/bin/env bash
set -uo pipefail
cd /tmp/tcc-escalonamento-em-nuvem/anexos/stack-cache

echo "== aguardando daemon do docker =="
for i in $(seq 1 60); do
  if docker info >/dev/null 2>&1; then
    echo "docker pronto (tentativa $i)"; break
  fi
  sleep 3
done
if ! docker info >/dev/null 2>&1; then
  echo "ERRO: docker daemon nao ficou pronto"; exit 1
fi

echo "== subindo a stack =="
docker compose up --build -d || { echo "ERRO no compose up"; docker compose logs --tail=50; exit 1; }

echo "== aguardando nginx saudavel =="
for i in $(seq 1 40); do
  st=$(docker inspect -f '{{.State.Health.Status}}' tcc-nginx 2>/dev/null || echo "n/a")
  echo "nginx health: $st"
  [ "$st" = "healthy" ] && break
  sleep 3
done

echo "== requisicao 1 (espera MISS) =="
curl -s -i http://localhost:8080/api/v1/odds/10 | grep -iE "^HTTP|X-Cache-Status|\"source\"" || curl -s -i http://localhost:8080/api/v1/odds/10 | head -20
echo
echo "== requisicao 2 (espera HIT) =="
curl -s -i http://localhost:8080/api/v1/odds/10 | grep -iE "^HTTP|X-Cache-Status"
echo
echo "== corpo da resposta =="
curl -s http://localhost:8080/api/v1/odds/10
echo
echo "== status dos containers =="
docker compose ps
echo "== FIM =="

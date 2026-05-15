#!/usr/bin/env bash
# OVH Cloud Web : npm/node ne sont pas dans le PATH par défaut.
# Sur le serveur SSH :
#   cd ~/apps/le-repasseur-next
#   source scripts/ovh-node-path.sh
#   npm ci && npm run build

_ovh_setup_node() {
  for ver in 22 20 18 16 14 12 10 8; do
    if [ -x "/usr/local/nodejs${ver}/bin/npm" ]; then
      export PATH="/usr/local/nodejs${ver}/bin:$PATH"
      echo "Node $(node -v) — npm $(npm -v)"
      return 0
    fi
  done

  for cmd in npm-node22 npm-node20 npm-node18 npm-node16 npm-node14 npm-node12 npm-node10 npm-node8; do
    if command -v "$cmd" >/dev/null 2>&1; then
      ver="${cmd#npm-node}"
      if [ -d "/usr/local/nodejs${ver}/bin" ]; then
        export PATH="/usr/local/nodejs${ver}/bin:$PATH"
      fi
      echo "Trouvé $cmd — Node $(node -v 2>/dev/null || echo '?') — npm $(npm -v 2>/dev/null || echo '?')"
      return 0
    fi
  done

  echo "Aucun Node.js OVH détecté."
  echo "Panneau OVH → Hébergement → Moteurs d'exécution → nodejs-20 (ou 18) + script server.js"
  return 1
}

_ovh_setup_node

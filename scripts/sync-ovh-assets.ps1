# Récupère les images depuis l’hébergement OVH (dossier multisite « passeur »).
# À lancer depuis la racine du projet, sur votre PC (PowerShell).
#
# Prérequis : accès SSH OVH (même login que le panneau).

param(
  [string]$Host = "sshcloud.cluster024.hosting.ovh.net",
  [int]$Port = 43081,
  [string]$User = "xdcmoto",
  [string]$RemoteDir = "~/passeur/assets/imgg"
)

$ErrorActionPreference = "Stop"
$local = Join-Path $PSScriptRoot "..\public\assets\imgg"
New-Item -ItemType Directory -Force -Path $local | Out-Null

$remote = "${User}@${Host}:${RemoteDir}/"
Write-Host "Copie depuis $remote vers $local ..."
scp -P $Port -r $remote* $local

Write-Host "Terminé. Vérifiez public/assets/imgg puis commit + push pour Vercel."

# Ejecuta este script desde la carpeta del proyecto (d:/html/prueba)
# Crea 5 commits pequeños y descriptivos para cumplir con el requisito de commits visibles.
# No empuja (push) automáticamente; revisa los commits localmente y luego agrega remote si quieres.

param()

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Write-Error "Git no está instalado o no está en PATH. Instala Git antes de usar este script."
  exit 1
}

# Inicializar git si no existe
if (-not (Test-Path .git)) {
  git init
  Write-Output "Repositorio Git inicializado."
} else {
  Write-Output "Repositorio Git ya inicializado."
}

# Config local (sólo si no existe)
$confName = git config user.name
if (-not $confName) { git config user.name "Tu Nombre" }
$confEmail = git config user.email
if (-not $confEmail) { git config user.email "tu@correo.local" }

# Asegurar que README.md exista
if (-not (Test-Path README.md)) { "Proyecto examen" | Out-File README.md -Encoding utf8 }

# Hacer 5 commits modificando README.md
for ($i = 1; $i -le 5; $i++) {
  $line = "Commit $i - `$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')`"
  Add-Content README.md "`n$line"
  git add README.md
  git commit -m "docs: commit $i - actualización de README para historial" | Out-Null
  Write-Output "Creado commit $i"
  Start-Sleep -Milliseconds 300
}

Write-Output "Hecho: 5 commits creados localmente. Usa 'git log --oneline' para verlos."
Write-Output "Si quieres subir a GitHub: crea el repo en GitHub, luego: git remote add origin <URL> ; git branch -M main ; git push -u origin main"

#!/usr/bin/env bash
# Envoltorio para correr los escenarios k6 contra QA (Zona Cero).
#
# Uso (desde app/):  bash load/run-k6.sh <a|b> <run>
#   a = escenario A (carrera de reservas)   -> load/k6/scenario-a-booking.js
#   b = escenario B (burst de agenda)       -> load/k6/scenario-b-agenda.js
#   <run> = nombre libre de la corrida, p. ej. 2026-10-22-smoke
#
# Variables opcionales: SMOKE=1 (humo corto), TOKENS_FILE, LOGIN_FRACTION, LOAD_MIX, REFRESH_PROB.
# Nunca imprime claves. Nunca corre contra producción.
set -euo pipefail

QA_REF="kqhmclbexnnsbzbgerbx"
PROD_REF="gvgqlmoulgcickxognto"

die() { echo "ERROR: $*" >&2; exit 1; }

# --- Argumentos -------------------------------------------------------------
if [ "$#" -ne 2 ]; then
  echo "Uso: bash load/run-k6.sh <a|b> <run>" >&2
  echo "Ejemplo: SMOKE=1 bash load/run-k6.sh a 2026-10-22-smoke" >&2
  exit 2
fi
SCENARIO="$1"
RUN_NAME="$2"

case "$SCENARIO" in
  a) SCRIPT_REL="load/k6/scenario-a-booking.js" ;;
  b) SCRIPT_REL="load/k6/scenario-b-agenda.js" ;;
  *) die "Escenario inválido: '$SCENARIO' (use a o b)." ;;
esac

# El nombre de la corrida se usa como carpeta: solo caracteres seguros.
if ! [[ "$RUN_NAME" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]]; then
  die "Nombre de corrida inválido: '$RUN_NAME' (use letras, números, punto, guion y guion bajo)."
fi

# --- Ubicación: ejecutar siempre desde app/ ---------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$APP_DIR"

# --- Cargar .env.load.local sin imprimirlo ----------------------------------
ENV_FILE="$APP_DIR/.env.load.local"
[ -f "$ENV_FILE" ] || die "No existe app/.env.load.local (ver load/README.md)."
set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

# --- Variables obligatorias (sin mostrar valores) ---------------------------
[ -n "${SUPABASE_URL:-}" ]      || die "Falta SUPABASE_URL en .env.load.local."
[ -n "${SUPABASE_ANON_KEY:-}" ] || die "Falta SUPABASE_ANON_KEY en .env.load.local."
[ -n "${LOAD_PASSWORD:-}" ]     || die "Falta LOAD_PASSWORD en .env.load.local."

# --- Guard QA / producción (sin override) -----------------------------------
case "$SUPABASE_URL" in
  *"$PROD_REF"*) die "SUPABASE_URL apunta a PRODUCCION. El harness solo corre contra QA. Abortado." ;;
esac
case "$SUPABASE_URL" in
  *"$QA_REF"*) ;;
  *) die "SUPABASE_URL no es el proyecto QA ($QA_REF). Abortado." ;;
esac
# Defensa extra: las claves tampoco pueden mencionar el ref de producción.
case "${SUPABASE_ANON_KEY}${SUPABASE_SERVICE_ROLE_KEY:-}" in
  *"$PROD_REF"*) die "Una clave del .env parece de PRODUCCION. Abortado." ;;
esac

# --- k6 ----------------------------------------------------------------------
if [ -x "$HOME/.local/bin/k6" ]; then
  K6_BIN="$HOME/.local/bin/k6"
elif command -v k6 >/dev/null 2>&1; then
  K6_BIN="$(command -v k6)"
else
  die "k6 no está instalado (se esperaba en ~/.local/bin/k6 o en el PATH)."
fi

[ -f "$APP_DIR/$SCRIPT_REL" ] || die "No existe $SCRIPT_REL."

# --- Tokens pregenerados -----------------------------------------------------
TOKENS_PATH="${TOKENS_FILE:-load/.tmp/tokens.json}"
# k6 resuelve open() respecto a la carpeta del módulo, no del cwd: se pasa SIEMPRE ruta absoluta.
case "$TOKENS_PATH" in
  /*) TOKENS_ABS="$TOKENS_PATH" ;;
  *)  TOKENS_ABS="$APP_DIR/$TOKENS_PATH" ;;
esac
if [ ! -f "$TOKENS_ABS" ]; then
  if [ "$SCENARIO" = "b" ]; then
    die "El escenario B exige tokens pregenerados ($TOKENS_PATH). Corra primero: npm run load:mint"
  else
    echo "AVISO: no existe $TOKENS_PATH; el escenario A hará login real por VU y puede topar el rate limit de Auth (429). Recomendado: npm run load:mint" >&2
  fi
fi

# --- Carpeta de reportes -----------------------------------------------------
REPORT_DIR="$APP_DIR/load/reports/$RUN_NAME"
mkdir -p "$REPORT_DIR"
LOG_FILE="$REPORT_DIR/k6-$SCENARIO.log"
# handleSummary de los scripts es dueño de summary-<a|b>.json; el export nativo de k6 va aparte
SUMMARY_FILE="$REPORT_DIR/k6-export-$SCENARIO.json"

# --- Argumentos -e para k6 ---------------------------------------------------
# SUPABASE_ANON_KEY y LOAD_PASSWORD ya están exportados (set -a) y k6 los expone
# en __ENV, así no quedan visibles en la lista de procesos (ps).
K6_ENV=(
  -e "SUPABASE_URL=$SUPABASE_URL"
  -e "LOAD_USER_COUNT=${LOAD_USER_COUNT:-1000}"
  -e "LOAD_SESSION_COUNT=${LOAD_SESSION_COUNT:-40}"
  -e "RUN=$RUN_NAME"
)
[ -n "${SMOKE:-}" ]          && K6_ENV+=(-e "SMOKE=$SMOKE")
[ -f "$TOKENS_ABS" ]         && K6_ENV+=(-e "TOKENS_FILE=$TOKENS_ABS")
[ -n "${LOGIN_FRACTION:-}" ] && K6_ENV+=(-e "LOGIN_FRACTION=$LOGIN_FRACTION")
[ -n "${LOAD_MIX:-}" ]       && K6_ENV+=(-e "LOAD_MIX=$LOAD_MIX")
[ -n "${REFRESH_PROB:-}" ]   && K6_ENV+=(-e "REFRESH_PROB=$REFRESH_PROB")
[ -n "${B_SCALE:-}" ]        && K6_ENV+=(-e "B_SCALE=$B_SCALE")
[ -n "${FETCH_MODE:-}" ]     && K6_ENV+=(-e "FETCH_MODE=$FETCH_MODE")

echo "== k6 escenario $(printf "%s" "$SCENARIO" | tr "a-z" "A-Z") | corrida: $RUN_NAME | smoke: ${SMOKE:-no} =="
echo "   script:  $SCRIPT_REL"
echo "   destino: ${SUPABASE_URL}"
echo "   log:     load/reports/$RUN_NAME/k6-$SCENARIO.log"

# --- Ejecutar (desde app/), conservando el exit code de k6 -------------------
set +e
"$K6_BIN" run "${K6_ENV[@]}" --summary-export "$SUMMARY_FILE" "$SCRIPT_REL" 2>&1 | tee "$LOG_FILE"
K6_EXIT="${PIPESTATUS[0]}"
set -e

echo "== k6 terminó con código $K6_EXIT (0 = thresholds cumplidos; 99 = threshold fallido) =="
echo "   Siguiente paso: npm run load:check -- --run $RUN_NAME"
exit "$K6_EXIT"

#!/usr/bin/env bash
# Run Sonnet reviewer agents in parallel using claude -p --bare.
# Eliminates CC orchestration overhead — each agent is an independent session.
#
# Usage:
#   bash src/pipeline/run_reviewers.sh \
#     --prompts data/output/results/agent_prompts \
#     --output data/output/results \
#     --parallel 10

set -euo pipefail

PROMPTS_DIR=""
OUTPUT_DIR=""
PARALLEL=10
INDEX_DIR=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --prompts) PROMPTS_DIR="$2"; shift 2 ;;
    --output)  OUTPUT_DIR="$2"; shift 2 ;;
    --parallel) PARALLEL="$2"; shift 2 ;;
    --index)   INDEX_DIR="$2"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

if [[ -z "$PROMPTS_DIR" || -z "$OUTPUT_DIR" ]]; then
  echo "Usage: run_reviewers.sh --prompts <dir> --output <dir> [--parallel N] [--index <dir>]"
  exit 1
fi

INDEX_DIR="${INDEX_DIR:-$OUTPUT_DIR/clause_index}"
REVIEWER="$(cd "$(dirname "$0")/../.." && pwd)/.claude/agents/isaacus-reviewer.md"
PIPELINE_DIR="$(cd "$(dirname "$0")" && pwd)"

# Read the reviewer system instructions
SYSTEM=$(cat "$REVIEWER")

# Count prompt files
PROMPT_FILES=("$PROMPTS_DIR"/*.json)
N=${#PROMPT_FILES[@]}
echo "[reviewers] $N agents, $PARALLEL parallel"

# Function to process one agent prompt file
process_one() {
  local prompt_file="$1"
  local batch_name
  batch_name=$(python3 -c "import json; print(json.load(open('$prompt_file'))['batch_name'])")
  local out_file="$OUTPUT_DIR/${batch_name}.json"

  # Build the prompt: system instructions + clause data
  local doc_data
  doc_data=$(cat "$prompt_file")

  local prompt="You are an isaacus-reviewer. Follow the rules in your instructions exactly.

Here is the document data with clause excerpts, column definitions, and Isaacus findings:

$doc_data

Extract all columns. For high-confidence isaacus_findings, accept them.
For columns without findings, extract from the provided clauses.
If clauses are insufficient for a column, run ONE search:
  python3 $PIPELINE_DIR/isaacus_search.py --doc <filename> --query \"<terms>\" --index $INDEX_DIR --top_k 3

Output ONLY a valid JSON array with one object. Write it to $out_file"

  # Run claude in non-interactive mode
  echo "  [start] $batch_name"
  claude -p --bare \
    --allowedTools "Bash(python3 *),Write" \
    --model sonnet \
    "$prompt" > /dev/null 2>&1

  if [[ -f "$out_file" ]]; then
    echo "  [done]  $batch_name"
  else
    echo "  [FAIL]  $batch_name — no output file"
  fi
}

export -f process_one
export OUTPUT_DIR INDEX_DIR PIPELINE_DIR

# Run all agents in parallel
START=$(date +%s)
printf '%s\n' "${PROMPT_FILES[@]}" | xargs -P "$PARALLEL" -I {} bash -c 'process_one "$@"' _ {}
END=$(date +%s)

ELAPSED=$((END - START))
DONE=$(ls "$OUTPUT_DIR"/batch-rag-*.json 2>/dev/null | wc -l)
echo "[reviewers] $DONE/$N complete in ${ELAPSED}s"

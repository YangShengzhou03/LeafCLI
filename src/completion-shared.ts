/**
 * Shared constants and shell script generators for tab-completion.
 *
 * This module MUST remain lightweight (no registry, no discovery imports).
 * Both completion.ts (full path) and completion-fast.ts (manifest path) import from here.
 */

/**
 * Built-in (non-dynamic) top-level commands.
 */
export const BUILTIN_COMMANDS = [
  'list',
  'validate',
  'verify',
  'auth',
  'browser',
  'tab',
  'doctor',
  'plugin',
  'external',
  'completion',
];

// ── Shell script generators ────────────────────────────────────────────────

export function bashCompletionScript(): string {
  return `# Bash completion for leafcli
# Add to ~/.bashrc:  eval "$(leafcli completion bash)"
_leafcli_completions() {
  local cur words cword
  _get_comp_words_by_ref -n : cur words cword

  local completions
  completions=$(leafcli --get-completions --cursor "$cword" "\${words[@]:1}" 2>/dev/null)

  COMPREPLY=( $(compgen -W "$completions" -- "$cur") )
  __ltrim_colon_completions "$cur"
}
complete -F _leafcli_completions leafcli
`;
}

export function zshCompletionScript(): string {
  return `# Zsh completion for leafcli
# Add to ~/.zshrc:  eval "$(leafcli completion zsh)"
_leafcli() {
  local -a completions
  local cword=$((CURRENT - 1))
  completions=(\${(f)"$(leafcli --get-completions --cursor "$cword" "\${words[@]:1}" 2>/dev/null)"})
  compadd -a completions
}
compdef _leafcli leafcli
`;
}

export function fishCompletionScript(): string {
  return `# Fish completion for leafcli
# Add to ~/.config/fish/config.fish:  leafcli completion fish | source
complete -c leafcli -f -a '(
  set -l tokens (commandline -cop)
  set -l cursor (count (commandline -cop))
  leafcli --get-completions --cursor $cursor $tokens[2..] 2>/dev/null
)'
`;
}

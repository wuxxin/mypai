USE_POWERLINE="true"
# Source manjaro-zsh-configuration
if [[ -e /usr/share/zsh/manjaro-zsh-config ]]; then
    source /usr/share/zsh/manjaro-zsh-config
fi
# Use manjaro zsh prompt
if [[ -e /usr/share/zsh/manjaro-zsh-prompt ]]; then
    source /usr/share/zsh/manjaro-zsh-prompt
fi

typeset -g POWERLEVEL9K_OS_ICON_CONTENT_EXPANSION="[${SANDBOX_NAME}]"
# Foreground (text color): 15 = Bold White
typeset -g POWERLEVEL9K_OS_ICON_FOREGROUND=15
# Background color: 208 = Vibrant Orange (or pick any color below)
typeset -g POWERLEVEL9K_OS_ICON_BACKGROUND=208

if test -f $HOME/.config/agent-of-empires/serve.token; then
    AOE_DAEMON_TOKEN=$(cat $HOME/.config/agent-of-empires/serve.token)
    export AOE_DAEMON_TOKEN
fi

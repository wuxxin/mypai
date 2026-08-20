# TODO

i installed [vllm.cpp-git-hip](directory;file:///home/wuxxin/agent-shared/code/mypai/submodules/aur-packages/vllm.cpp-git-hip) , i want to test it as future second engine in [local-chat.sh](file;file:///home/wuxxin/agent-shared/code/mypai/submodules/agents-shared/assistants/local-chat.sh) . dont modify local-chat.sh for now, we want a speed test of the new engine. read the chat entries of [local-benchmark.md](file;file:///home/wuxxin/agent-shared/code/mypai/submodules/agents-shared/assistants/local-benchmark.md) , to get our baseline, and its json for the running parameter. 


consolidate all omp related prompt into a selection of prompt modules to be inserted in the specific locations when they are well defined.

research omp: where can we add ts, whats the eval ts runner doing, do we have tools available in any of them,

research oh-my-pi in scratch for answers: right now, we wan to begin adding first cronjobs and eval executions, 
 when a cron fires:

```txt
CRON: eval(type="py", """

# now we want eg. to inspect running session, is there a way?" eg.
if (100 * session.ctx / session.max_ctx) > 80:
    tools.retain()
    tools.snapcompact()
    session.new()

""")
```

+ research and add if fitting

+ look into
  https://github.com/RUC-NLPIR/DeepAgent
  https://github.com/google/mantis/
  https://github.com/simonucl/PolySkill
  https://github.com/itigges22/ATLAS
  https://github.com/router-for-me/CLIProxyAPI
  https://github.com/Arize-ai/phoenix
  https://github.com/davidwynter/HiVA

+ look into mcp and other interesting
  https://github.com/slettmayer/geosphere-mcp-server

  https://github.com/xberg-io/xberg
  https://github.com/lucasjinreal/Crane
  https://github.com/memvid/memvid

```
/plugin marketplace add anthropics/claude-plugins-official

https://github.com/cathrynlavery/diagram-design
/plugin marketplace add cathrynlavery/diagram-design
/plugin install diagram-design@diagram-design

https://github.com/garrytan/gbrain
```


+ look into
  + https://github.com/mvanhorn/printing-press-library/tree/main/library/commerce/amazon-orders
  + https://github.com/mvanhorn/printing-press-library/tree/main/library/media-and-entertainment/archive-is
  + https://github.com/mvanhorn/printing-press-library/tree/main/library/travel/booking-com
  + https://github.com/mvanhorn/printing-press-library/tree/main/library/developer-tools/domain-goat
  + https://github.com/mvanhorn/printing-press-library/tree/main/library/marketing/trendhunter
  + https://github.com/mvanhorn/printing-press-library/tree/main/library/media-and-entertainment/wikipedia
  + https://github.com/mvanhorn/last30days-skill


## External Models Speed Observed in OMP

```
model                                      TTFT   TPS      tokens  total
google-antigravity/tab_flash_lite_preview  355ms  274.7/s  512     1.9s
google-antigravity/gemini-3.6-flash        597ms  257.9/s  508     2.0s
google-antigravity/gemini-3-flash          719ms  250.3/s  651     2.6s
google-antigravity/gemini-2.5-flash        544ms  214.5/s  506     2.4s
deepseek/deepseek-v4-flash                 913ms  97.6/s   512     5.2s
deepseek/deepseek-v4-pro                   911ms  45.6/s   512     11.3s
google-antigravity/claude-opus-4-6         2.4s   37.0/s   2355    1m3s
```

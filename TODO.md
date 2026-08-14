# TODO


- reconsile and wright good memory banks, make the omp bank good for sw-dev
- get a grip what is auto retained recalled reflected, and how we can map this for mypai
- mypai: make the daemon inject system message that session is running as daemon.
- mypai: make the mypai agent the "default", research what that means, so on omp session in this dir, or daemon session it always reads mypai agent, and because daemon injects system message the mypai agent knows if its running as daemon main or as other session.
- [x] refactored mypai as an omp profile (`omp --profile mypai`) with isolated memory banks and settings
- [x] updated daemon, scheduler, webui, and REST API specs for profile refactoring and webui enhancements
- make some limits for the daemon to observe about how long a prompt or how much tool calls a prompt consomues.

- reconsile skills,roles,and commands for my omp installation
  + get all buildin omp skills, roles and commands
  + reconsile with the oh-myopencode-slim-agents profiles
  + reconsile roles and commands: eg. debugging, git-master, review-work, ulw-plan
  + reconsile with: https://github.com/obra/superpowers
/plugin marketplace add obra/superpowers
/plugin install superpowers@superpowers-marketplace
  + reconsile with:
https://athola.github.io/claude-night-market/plugins/domain-specialists.html
/plugin marketplace add athola/claude-night-market
/plugin install archetypes@claude-night-market
(archetypes parseltongue cartograph scribe tome scry pensive)

we want debugging, git control, review, really good plan, and beside the orchestrator agent, which is our main agent, other good definition. and all work with our hingsight plugin.


+ research and add if fitting: plugins
```
/plugin marketplace add anthropics/claude-plugins-official

https://github.com/cathrynlavery/diagram-design
/plugin marketplace add cathrynlavery/diagram-design
/plugin install diagram-design@diagram-design

https://github.com/obra/superpowers
/plugin marketplace add obra/superpowers
/plugin install superpowers@superpowers-marketplace

https://athola.github.io/claude-night-market/plugins/domain-specialists.html
/plugin marketplace add athola/claude-night-market
/plugin install archetypes@claude-night-market
(archetypes parseltongue cartograph scribe tome scry pensive)

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

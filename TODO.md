+ reconsile roles and commands: eg. debugging, git-master, review-work, ulw-plan
+ Agent Tools: AUR
    + `agent-browser camofox-browser-bin python-camoufox`

+ External Models Speed Observed in OMP

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

+ look into
  + https://github.com/mvanhorn/printing-press-library/tree/main/library/developer-tools/agent-desktop
  + https://github.com/mvanhorn/printing-press-library/tree/main/library/commerce/amazon-orders
  + https://github.com/mvanhorn/printing-press-library/tree/main/library/media-and-entertainment/archive-is
  + https://github.com/mvanhorn/printing-press-library/tree/main/library/travel/booking-com
  + https://github.com/mvanhorn/printing-press-library/tree/main/library/developer-tools/domain-goat
  + https://github.com/mvanhorn/printing-press-library/tree/main/library/payments/kalshi
  + https://github.com/mvanhorn/printing-press-library/tree/main/library/payments/robinhood
  + https://github.com/mvanhorn/printing-press-library/tree/main/library/marketing/trendhunter
  + https://github.com/mvanhorn/printing-press-library/tree/main/library/media-and-entertainment/wikipedia
  + https://github.com/mvanhorn/printing-press-library/tree/main/library/media-and-entertainment/youtube
  + https://github.com/mvanhorn/last30days-skill


+ look into
  https://github.com/RUC-NLPIR/DeepAgent
  https://github.com/google/mantis/
  https://github.com/simonucl/PolySkill
  https://github.com/itigges22/ATLAS
  https://github.com/router-for-me/CLIProxyAPI
  https://github.com/Arize-ai/phoenix

+ mcp and other interesting

  https://github.com/xberg-io/xberg
  https://github.com/lucasjinreal/Crane
  https://github.com/memvid/memvid



# Make MVP for mypai

+ make a research/mypai-MVP-plan.md

+ interactivly (ask me until im satisified) submodules/omp-mypai/plugin.json with me to make it a full filled plugin config.
+ explain and interactivly resolve how python packages needed for mypai_tools are default integrated into an venv for an agent-plugin
+ make all things interactivly with me more agent plugin conform.
+ make working omp.env setup for venv creation
+ interactivly with me: a merge of hindsight configs for our new mypai hindsight bank config. also check: can a project override the default omp hindsight config ? . we want a mixture of slim default omp hindsight config extended to 
+ extend om-mypai:focus on the cron features with the heartbeat daemon interactivly with me:
  + it needs to be very clean code, if splitting code in shared python files of mypai_tools helps do it.
  + describe heartbeat.md every function that heartbeat solves, a md that lists all features of hearbeat, as a rerceation requirement
  + add import export of json jobs to hearbeat.py as cmdline possibility.
  + change: job_type rpc: make the omp_python sdk rpc available here
      + action: one of prompt,steer,followup,abort_and_prompt,switch_session,branch
      + parameter: rpc parameter args
  + change: job_type http_get, http_post, http_put, ?other?
      + parameter: url, payload, ?other?
  + add: job_type shell, to call shell scripts, commands, and for output: either: ignore, or prompt (with additional prompt param), steer,followup,abort_and_prompt, and output_type: stdout (default), stderr, combined
  + if easy: job_type python, to call inside async hearbeat.py, no priority if complicated to get right.
  + add (if possible on heartbeat async task execution): last_start, last_stop, last_runtime, last_returncode, last_output, total_calls
  + check if heartbeat on a project sqlite db is running and a mcp server modifies the sqlite db, is this safe for single user mcp adds and modifies entries, heartbeat executes them, and sets results, make suggestions if that simple usecase is still not working, on alternative routes (postgres)
+ extend mypai: we want a mypai  to be able to re/install over and over with sandbox-ctl omp install and the envfile whe are bootstraping from.
+ interactivly search for all that is not agent plugin conform, and suggest moving parts to the plugin and or parts to the mypai base setup.
+ we want a omp.env that spawns a mypai project dir (maybe ~/agent-shared/mypai-workspace), and have the hearbeat as sidecar
+ and a script or readme example: on how to look readonly at the headless agent (omp share ...)  and (if possible) a read/write attachment to the running session. mvp target is that the mypai profile setup is running including heartbeat, and readonly and readwrite view to the headless agent, and the agent cann access the crontab using the mcp tools.

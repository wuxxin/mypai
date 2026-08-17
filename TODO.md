# TODO

# mypai daemon refactor spec

+ dont implement fallbacks, aliases, legacy code paths, make a clean refactor without legacy support.
+ implement specs first, be precise in specs, so eg. webui can be recreated from specs.

Big Parts:

+ refactor cron_mcp as host_tool
+ refactor daemon to use 
  + a turn queue where next omp_rpc commands are queued, with prior to abort, steer.
  + cron jobs
  + daemon incoming event queue
  + daemon currently running array

cron jobs and any other events that do not use omp_rpc can execute in parallel, but no duplicates of the same cronjob id.
every executor (http,python,shell) can execute in parallel, if the result_action (or result_error_action if that would be executed) is any other than log, it will enqueue a turn queue call with a flag indicating its a result call of job id, and can not in anyway spawn another event.

the rest session api just enqueues as any other source.

for the turn queue: 
for now to keep it easy, a job action of omp, may not have an active result.action error_action beside log, so no loops can be made.
all omp_rpc related command pile up there. After deciding the next entry to pick, and modifying the rest of the queue, it serialy calls out to omp_rpc.

for the next event to pick: it looks if there is any abort, abort_and_prompt in the queue, if so, delete whole queue, execute abort or abort_and_prompt.
if there is steer, take next (fifo) steer from queue, serially callout to omp_rpc.
then if there is followup, take next followup from queue, --,,--
then check if turn is currently running, if idle:
  pick first prompt from fifo, serially callout to omp_rpc

## refactor cron entry, see example_jobs.yaml, make a Pydantic Definition  Job Schema 
+ cron entry: all entries have opts kv:
  + opts:timeout_sec defaults different for "omp", "shell", "python", "http", "acp"
    + short timeout for omp and acp, because all functions should return quickly, because they are async, or abort running
    + shell should have a typical shellout timeout of a agentharness shell timeout, 
    + python should return quickly per default so 5sec
    + http can be different, default should be 30s
  + opts:timezone defaults to local timezone, can be set to UTC
  + opts on shell: can have env: k/v for additional env injected into shell command
+ action for http: should handle anycase "POST" or "post", and others
+ cron telemetry fields (in addition to created_at, and updated_at which are content creation/updates):
  total_runs, total_failures, next_run_at, last_run_at, last_runtime, last_returncode, last_httpcode, last_output, last_error

## refactor dameon queue's and execution


## Web UI Refactor Spec

### Main Screen

```
myPAI Console < * Connected (steady green or red)>[-STREAMING-(pulsing and color if streaming, grey if not)]          | <Session> | <Cron> | <Team> | <Refresh>

RPC Session Live Console             <Reload History> <Clear Console> <[]Show Stream Chunks> <[x}Show Events>]> Port: xxxx
+---------------------------------------------+
|                                             |
|                                             |
|                                             |
|                                             |
| [00:35:05] Queued run_once for              |
|  'Nightly Database Backup & Audit'          |
+---------------------------------------------+

Turn: [                                       ]               <Turn Abort>
      |                                       |             
      [..Type a prompt..                      ]   <Submit>  [<Create [v]>] 

[v]=can be (Create|Inject into|Append to|Abort and Create)
```

### Sidebar: Session

```
Harness:          [connected]
  Profile: mypai
  PID: 12345      <Reconnect>
  Runtime: 4h 14m
  Tasks (Queued/Running/Done)  [3] , [2] , [344]

Session:
  Name: mypai_daemon-running
  UUID: x-y-z-a-b
  Stearing: on-at-a-time
  Runtime: 2h 13m
  Messages (U/A):
  Tool Calls: 
  Token Total/In/Out: 
  Context Window: 58 471 / 128 000 (45.7%)
  [########################          ]

Turn:                [Running]
  Queued: 0 entries
  Status: Running/Inactive (show vals of last running if inactive)
  Last/Current: evt_0bbd1bd8@prompt
  Runtime: 6s
  Messages (U/A), ToolCalls:
  Token Total/In/Out:
  <first few characters>
```


### Sidebar: Cron

```
Cron Jobs:            [Enabled]
  Total/ Active Jobs: 4 Total (4 enabled, 0 disabled)
  
  Name | Cron     | Kind | Calls | <Run>
  +------------------------------------+

  < Disable /Enable Cron                >

```


### Sidebar: Team

```
Team (External Agents):     [Connected]
  Workers: 1
  Total / Active Tasks: 2 / 1
  Runtime: 12h 13m
  Workers:
  - [PID 2852442] /home/wuxxin/agent-shared/mypai-workspace (Runtime: 2s)[1]

  Tasks:
  - [PID 2852442[TASK 123] [*] asdlkjasd (Runtime: 4s) <view>
  - [PID 2852442[TASK 124] as21312123112sd (Runtime: 12s) <view>
  < Disable /Enable External Agents         >  
```


unsorted small things:  omp executor: dont support prompt_and_wait.

i maybe reinvented already present architecture, be smart what i mean and want.

please discuss our new architecture with me until no more question from my side.

first present me with what you understood, what this architecture enables and makes different if working from old architecture, 
and if the redesign is fitting for the wanted featureset. then i will ask questions, until i say its ok to proceed further.


- reconsile and wright good memory banks, make the oh-my-pi bank good for sw-dev, the mypai bank good for lifeos personal assistant
- get a grip what is auto retained recalled reflected, and how we can map this for mypai
- mypai: make the daemon inject system message that session is running as daemon.
- mypai: make the mypai agent the "default", research what that means, so on omp session in this dir, or daemon session it always reads mypai agent, and because daemon injects system message the mypai agent knows if its running as daemon main or as other session.
- make some limits for the daemon to observe about how long a prompt or how much cron executors, or tool calls a prompt consumes.

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

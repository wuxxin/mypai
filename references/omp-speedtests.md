# Models Speed Observed in OMP

## Unknown Date - Overview

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

## Unknown Date - Local LLM
```
❯ omp bench "llama.cpp/qwen3" --par=1
llama.cpp/qwen3
  ✓ run 1/9 chat       TTFT 224ms tok/s 90.2 gen 93.9/s in 71 out 512 total 5.7s
  ✓ run 2/9 prefill    TTFT 2.4s tok/s 21.8 gen 109.7/s in 6.1K out 64 total 2.9s
  ✓ run 3/9 generation TTFT 236ms tok/s 105.0 gen 106.3/s in 78 out 2K total 19.5s
  ✓ run 4/9 chat       TTFT 225ms tok/s 87.6 gen 91.1/s in 70 out 512 total 5.8s
  ✓ run 5/9 prefill    TTFT 2.4s tok/s 18.2 gen 120.9/s in 6.1K out 51 total 2.8s
  ✓ run 6/9 generation TTFT 235ms tok/s 102.0 gen 104.0/s in 78 out 1.2K total 12.1s
  ✓ run 7/9 chat       TTFT 216ms tok/s 91.0 gen 94.6/s in 71 out 512 total 5.6s
  ✓ run 8/9 prefill    TTFT 2.4s tok/s 19.6 gen 106.3/s in 6.1K out 57 total 2.9s
  ✓ run 9/9 generation TTFT 238ms tok/s 92.6 gen 93.6/s in 78 out 2K total 22.1s

  model            TTFT p50  p95    tok/s  decode  prefill  cost/run
  llama.cpp/qwen3  224ms     225ms  90.2   102.0   2577     -
```

## Unknown Date - Gemini 3.8 Flash
```
❯ omp bench "gemini-3.8-flash" --par=1
Warning: no credentials for "cursor"; benchmarking google-antigravity/gemini-3.8-flash instead. Pin "cursor/gemini-3.8-flash" to force it.
google-antigravity/gemini-3.8-flash (gemini-3.8-flash)
  ✓ run 1/9 chat       TTFT 1.6s tok/s 126.4 gen 209.8/s in 56 out 508 total 4.0s
  ✓ run 2/9 prefill    TTFT 1.6s tok/s 0.6 gen 89.3/s in 7K out 1 total 1.6s
  ✓ run 3/9 generation TTFT 1.2s tok/s 151.5 gen 166.2/s in 64 out 2K total 13.5s
  ✓ run 4/9 chat       TTFT 1.4s tok/s 137.6 gen 219.4/s in 59 out 508 total 3.7s
  ✓ run 5/9 prefill    TTFT 1.1s tok/s 0.9 gen 55.2/s in 7K out 1 total 1.1s
  ✓ run 6/9 generation TTFT 4.9s tok/s 121.3 gen 171.6/s in 64 out 2K total 16.9s
  ✓ run 7/9 chat       TTFT 4.3s tok/s 118.3 gen 16120.8/s in 57 out 508 total 4.3s
  ✓ run 8/9 prefill    TTFT 2.0s tok/s 0.5 gen 56.0/s in 7K out 1 total 2.0s
  ✓ run 9/9 generation TTFT 836ms tok/s 170.1 gen 182.8/s in 64 out 2K total 12.0s

model                                TTFT p50  p95   tok/s  decode  prefill  cost/run
google-antigravity/gemini-3.8-flash  1.6s      4.3s  126.4  151.5   4288     $0.0050
```

## So 01 Nov 2026 16:31:46 CET - Gemini 3.8 Flash

❯ omp bench "gemini-3.8-flash" --par=1
Executing sandbox using systemd-run: /usr/bin/omp bench gemini-3.8-flash --par=1
google-antigravity/gemini-3.8-flash (gemini-3.8-flash)
  ✓ run 1/10 TTFT 3.6s tok/s 70.4 gen 107.2/s in 55 out 739 total 10.5s
  ✓ run 2/10 TTFT 2.6s tok/s 73.6 gen 96.3/s in 57 out 826 total 11.2s
  ✓ run 3/10 TTFT 2.2s tok/s 85.8 gen 113.1/s in 56 out 768 total 9.0s
  ✓ run 4/10 TTFT 2.8s tok/s 75.5 gen 109.1/s in 55 out 682 total 9.0s
  ✓ run 5/10 TTFT 2.0s tok/s 75.0 gen 93.2/s in 58 out 758 total 10.1s
  ✓ run 6/10 TTFT 1.9s tok/s 73.3 gen 90.7/s in 58 out 723 total 9.9s
  ✓ run 7/10 TTFT 3.1s tok/s 70.0 gen 93.8/s in 59 out 852 total 12.2s
  ✓ run 8/10 TTFT 7.1s tok/s 91.9 gen 156.3/s in 57 out 1.6K total 17.1s
  ✓ run 9/10 TTFT 2.7s tok/s 71.1 gen 94.1/s in 55 out 793 total 11.2s
  ✓ run 10/10 TTFT 2.6s tok/s 78.5 gen 108.3/s in 56 out 740 total 9.4s

model                                TTFT p50  p95   tok/s  cost/run
google-antigravity/gemini-3.8-flash  2.6s      7.1s  73.6   $0.0032
❯ date

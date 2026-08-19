# Fitness & Health Tracker

## Current Goals
- Primary goal: [e.g. "Gain 10 lbs by end of Q2 (145 → 155 lbs)"]
- Secondary: [e.g. "Improve squat 1RM from 225 to 275"]

## Targets
- Calories: [e.g. 3,500 kcal/day]
- Protein: [e.g. 160g/day minimum]
- Training frequency: [e.g. 4x/week]

## File Structure
```
fitness/
├── CLAUDE.md               ← You are here
├── workout/
│   ├── program.md          # Current training program with baselines
│   ├── progress.md         # PRs and bodyweight tracker
│   ├── SESSION-LOG.md      # Log every workout here (append, never delete)
│   └── logs/               # One file per week for detailed notes
├── diet/
│   ├── meal-plan.md        # Current meal plan and grocery list
│   └── DAILY-LOG.md        # Log every meal and day here
└── reports/                # Weekly/monthly summaries Claude generates
```

## Logging Rules

### Workouts — log to `workout/SESSION-LOG.md`
Log immediately after each session. Format:
```
| DATE | Day N | Exercise | Weight | Sets | Reps (actual) | Notes |
```
- Record every set actually completed (not planned)
- Note any exercise swaps and why
- Include RPE (1–10) or energy level
- Flag if you hit top of rep range (= time to add weight)

### Diet — log to `diet/DAILY-LOG.md`
Log each meal as you eat it. Daily entry format:
```
## YYYY-MM-DD
| Meal | Food | Calories | Protein (g) |
| ---- | ---- | -------- | ----------- |
| ... | ... | ... | ... |
**Day total: X kcal / Yg protein** ✅/❌ target
```

## Progress Tracking
- Update `workout/progress.md` whenever you hit a new PR
- Weigh in weekly (same time, same conditions) and log to progress.md
- Claude generates a weekly summary every Sunday if asked

## Analysis Rules
- When asked "how am I doing?": compare recent logs to targets, flag missed sessions or under-eating days
- Suggest weight increases when top of rep range is hit on all sets for 2 consecutive sessions
- Never tell me to skip rest days or train more than the program calls for

## Program
See `workout/program.md` for the current training block.

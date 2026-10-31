# Revised timeline

The proposal feedback said: *"Milestone dates are also one week off in places
(Milestone 1 is Nov 2, but it is listed in week 3)."* This plan fixes the dates
and moves the week-3 work (Fruit Slice, onboarding, pretest) forward so that it
was finished for Milestone 1.

**Milestones:** M1 Nov 2 · M2 Nov 16 · M3 Nov 30 · Final Dec 14, 9:00 am

| Week | Dates | Work | Milestone |
|---|---|---|---|
| 1 | Oct 19 – 25 | Proposal submitted. | |
| 2 | Oct 26 – Nov 1 | **Done:** project setup and hosting; deck format + validator; Leitner schedule; mastery rule + map; event log + export; Lane Runner; Fruit Slice; onboarding with practice round; 10-question pretest; demo "skip a day"; accessibility settings. **In progress:** the ~60-question Module 1 deck. | **M1 · Nov 2**: two games, schedule and mastery working end to end |
| 3 | Nov 2 – 8 | Escape Room engine (four walls, arrows, zoomable objects, inventory), the three lock types (code, scenario, ordering), confidence ratings, hints that appear after a miss or 45 s and fade with mastery. Room 1 playable. Fold in M1 feedback. | |
| 4 | Nov 9 – 15 | Written last door with SOLO self-scoring. Rooms 2 and 3 reuse the same engine and are mostly data. Session recap with reflection question and confidence-vs-accuracy. A few classmates test. | **M2 · Nov 16**: all three games + recap |
| 5 | Nov 16 – 22 | Fix issues from testing. Accessibility pass (keyboard-only run-through, text size, reduced motion). Shareable results grid. | |
| 6 | Nov 23 – 29 | Thanksgiving, lighter week. Exit Run (15 unseen questions + 2 written explanations), rubric, final data export format. | **M3 · Nov 30**: complete experience incl. Exit Run |
| 7 | Nov 30 – Dec 6 | Upload mode only if everything else is done. Evaluation, Instructions and Assessments PDFs; start the report in Overleaf. | |
| 8 | Dec 7 – 13 | Record the video, finish the report, check every link in an incognito window, build the ZIP. Submit before 9 am Dec 14. | **Final · Dec 14** |

## Managing the "the work is large" risk

The scope stays the same: three games and three rooms. What keeps it
manageable is the architecture already built for M1:

- **One engine, many games.** The scheduler, mastery rule, logging, feedback
  card and results screen are shared. A new game is only a Phaser scene that
  takes a list of cards and reports answers. Lane Runner and Fruit Slice
  already run on the same engine.
- **Rooms are data.** The Escape Room will be one engine. Rooms 2 and 3 are
  mostly a list of walls, objects and which locks they hold, plus artwork.
- **Hardest part first.** Room 1 is scheduled for the week right after M1, so
  any problem with the Escape Room engine shows up with five weeks left.
- **Checkpoint.** If Room 1 isn't playable by **Nov 12**, rooms 2 and 3 switch
  to the proposal's fallback (one illustrated scene with clickable objects)
  so M2 still lands on time.

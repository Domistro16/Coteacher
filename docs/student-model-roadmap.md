# Student-model replacement roadmap

Batch 1, 1 November 2026. These are the proposed engineering gates accepted for
the Batch 1 plan, not evidence that a trained model is ready or permission to
collect real-child data. None of the data, predictive-performance or pilot gates
has passed. Minimum counts are floors, not a statistical power calculation.
Increase them when a prospective analysis or subgroup coverage requires it.

## Current baseline

`StudentModel.evaluate` is a synchronous, network-free TypeScript contract with
versioned input/output schemas. The prototype accepts simulated data only.
The baseline uses Beta(1,1): after n eligible distinct first attempts, of which c
are correct, both the understanding proxy and next-check probability are
`(c + 1) / (n + 2)`. These are response-evidence estimates, not separate estimates
of latent mastery, guessing or item difficulty. Only individual evidence counts
update; fixed priors/thresholds are not learned from pooled data, and no offline
model fitting or neural training occurs.

Confidence is evidence adequacy `n / (n + 10)`, not the probability that an estimate
is correct. Below 0.5 (fewer than ten eligible first checks), the predictor abstains.
No evidence means a neutral 0.5 prior and zero confidence. Explicit choices,
accessibility preferences and direct support after a wrong answer remain separate
rules; abstention blocks prediction-driven routing, not safe corrective help.

Only validated selected assessment outcomes on reviewed same-school/subject/concept
mappings contribute. Retries remain progress evidence but are not independent
trials. Legacy attempts without assessed-item provenance do not count. Pauses,
help, activity completion and questionnaire confidence do not become correctness.
Retention is the last five completed lessons/90 days, plus unfinished work within
90 days. All simulated results are plumbing tests only, never performance claims.

Actual support selections have a versioned device-local private decision record.
Model estimates/confidence are not shown as learner scores or sent to teachers or
language providers. The device ledger shares encrypted-memory retention and
withdrawal, capped at 1,000 records. It is not a training dataset or a new server
upload; losing that device can lose that ledger.

## Gates before a trained replacement

| Gate | Proposed release threshold | Justification and failure handling |
| --- | --- | --- |
| Consent and data volume | At least 500 consented learners and 10,000 eligible attempts in one authorized school/model scope. | Reduce reliance on a tiny correlated sample. This does not guarantee sufficient power. No cross-school pooling; withdrawal must exclude future datasets and remove derived learner features. |
| Concept coverage | At least 500 attempts from 100 learners per supported concept. | An overall count must not hide sparse concepts. Keep the baseline for unsupported concepts. Repeated retries cannot satisfy this floor. |
| Frozen test coverage | At least 100 held-out learners and 2,000 later eligible attempts, with learner separation and chronological safeguards. | Test unseen learners and later outcomes without leakage. Freeze input definitions, labels, split manifests, dataset hashes and metrics before evaluation; never tune on the test set. |
| Beats baseline | At least 5% relative Brier-score improvement, with a learner-clustered 95% confidence interval demonstrating improvement. Accuracy must not decrease. | Require a meaningful probability improvement, not a small point-estimate win. Fix classification thresholds using validation data, not the frozen test set. Report log loss and accuracy alongside Brier score. |
| Calibration | Expected calibration error at most 0.05 and no worse than baseline, using a prespecified binning/interval method. | Accuracy alone can hide overconfident predictions. Report reliability curves, bin counts and uncertainty; insufficient coverage blocks replacement. |
| No subgroup worse | For each supported class-level, language and connectivity group: at least 50 test learners and 500 attempts; no worse Brier score, calibration or accuracy. | Do not hide harm behind an overall average. Require prespecified learner-clustered uncertainty checks, with the relevant 95% bound on deterioration at or below zero. Inconclusive or underpowered groups keep the baseline. Prespecify groups/intersections and review multiple-comparison handling. |
| Privacy/legal/security | Explicit approval of lawful data use, guardian authority where applicable, notices, retention, withdrawal/deletion and deployment scope, with zero unresolved critical findings. | Predictive performance cannot waive privacy or authorization. Pseudonyms alone are not anonymity. Do not collect raw questions, audio, names or questionnaire answers for training. |
| Compatibility/offline | Existing source, objective, safe-activity, access and offline core tests pass; invalid output or unavailable inference safely abstains. | A better predictor cannot break approved learning or silently use an external service. Only evaluated, versioned artifacts may enter a release. |
| Rollback | Immediate baseline fallback for privacy, source or offline violations. Proposed performance trigger: at least 5% Brier deterioration or ECE above 0.08 after 500 new eligible outcomes. | Keep a reviewed baseline available and test an explicit version switch. Small samples or delayed labels require review, not a claim of health. Record model/configuration versions and audit the rollback. No automatic retraining. |
| Consented outcome pilot | Separately consented controlled pilot with at least 100 learners over four weeks, plus a prospective power analysis. | Prediction improvements need not improve learning. Prespecify outcome measures, comparison, safety/stopping rules, subgroup analysis and participant withdrawal. Increase duration/sample as required; inconclusive results do not authorize replacement. |

Each applicable gate must pass for a defined school, concept and population scope.
A failed or unknown gate keeps the baseline; successful narrow evaluation does
not authorize broader deployment. Data or feature changes require renewed review
and evaluation. Record the approving reviewer, evidence, artifact hash, model
version and rollback target before release.

Subgroup labels must come from approved coarse operational metadata (for example,
school class placement and the lesson's language) or a separately consented
evaluation protocol. Do not export private questionnaire answers to construct
training/evaluation groups. The precise fields and linkage need privacy review.

## Deliberately not implemented in Batch 1

- Improvement-data consent and allowlisted training-event collection/export:
  Batch 3, separately reviewed; collection/export remain disabled.
- The offline evaluation harness, frozen datasets, subgroup metrics, calibration
  studies, trained model and outcome pilot: not started and need further approval.
- Broad knowledge/memory/decision/prediction/language/evaluation interface refactor:
  deferred; Batch 1 adds only the student-model boundary and compatible adapters.
- Open-source STT/TTS evaluation and additional local-model work: not started.
  The earlier Qwen text benchmark was real but failed validation and is disabled;
  it is not a speech benchmark or a cost-per-accepted-answer result.
- Neural training, pyKT/pyBKT runtime integration, pooled data and automatic
  retraining: not authorized. Real-child rollout remains independently disabled.

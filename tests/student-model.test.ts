import { describe, expect, it } from 'vitest';
import { bayesianEvidenceBaseline, evaluateStudentModel, validStudentModelInput, validStudentModelOutput, type StudentModel, type StudentModelInput } from '../packages/shared/src/student-model';

const now='2026-11-01T10:00:00Z';
const input=(correct:readonly boolean[]=[]):StudentModelInput=>({schemaVersion:'1.0.0',learnerId:'student-fictional',schoolId:'fictional-school',subjectKey:'fictional-school:science',knowledgeKey:'refraction',conceptId:'refraction',lessonId:'lesson-one',lessonRevision:'revision-one',asOf:now,personalization:true,simulated:true,
  assessments:correct.map((value,i)=>({evidenceId:'event-'+i,assessmentKey:'item-'+i,subjectKey:'fictional-school:science',knowledgeKey:'refraction',at:now,correct:value}))});

describe('student-model contract and Bayesian baseline (simulated plumbing, not performance)',()=>{
  it('uses a neutral cold start and labels probabilities and confidence honestly',()=>{
    const result=evaluateStudentModel(input());
    expect(validStudentModelOutput(result)).toBe(true);
    expect(result).toMatchObject({modelVersion:'bayesian-evidence-count-v1',understanding:0.5,nextCheckProbability:0.5,confidence:0,status:'abstain',abstainReason:'cold-start',calibration:'unvalidated',estimateKind:'response-evidence-proxy',confidenceKind:'evidence-adequacy',sampleCount:0,evidenceIds:[]});
  });
  it('updates the Beta(1,1) counts and only permits prediction routing at ten distinct checks',()=>{
    const one=evaluateStudentModel(input([true]));expect(one.understanding).toBeCloseTo(2/3);expect(one.confidence).toBeCloseTo(1/11);expect(one.status).toBe('abstain');
    const nine=evaluateStudentModel(input(Array(9).fill(true)));expect(nine.status).toBe('abstain');
    const ten=evaluateStudentModel(input([true,true,true,true,true,true,false,false,false,false]));
    expect(ten).toMatchObject({sampleCount:10,correctCount:6,confidence:0.5,status:'estimate',abstainReason:'none'});
    expect(ten.nextCheckProbability).toBeCloseTo(7/12);expect(ten.understanding).toBe(ten.nextCheckProbability);expect(ten.explanation).toContain('6 of 10');
  });
  it('counts first attempts only and isolates concept, subject, time and event identity',()=>{
    const value=input([false]);const original=value.assessments[0];
    value.assessments.push({...original,evidenceId:'retry',correct:true},{...original,assessmentKey:'duplicate-event'},
      {...original,evidenceId:'foreign-subject',assessmentKey:'another',subjectKey:'another-school:science'},
      {...original,evidenceId:'foreign-concept',assessmentKey:'another',knowledgeKey:'another'},
      {...original,evidenceId:'future',assessmentKey:'future',at:'2026-11-02T00:00:00Z'});
    const result=evaluateStudentModel(value);expect(result.evidenceIds).toEqual(['event-0']);expect(result.correctCount).toBe(0);expect(result.nextCheckProbability).toBeCloseTo(1/3);
  });
  it('keeps personalization off without dispatching to an injected model',()=>{
    const unavailable:StudentModel={version:'must-not-run',evaluate(){throw new Error('must not dispatch');}};
    expect(evaluateStudentModel({...input([true]),personalization:false},unavailable)).toMatchObject({status:'abstain',abstainReason:'personalization-off',sampleCount:0,confidence:0,evidenceIds:[]});
  });
  it('supports a replacement through the same interface and protects input from mutation',()=>{
    const original=input(Array(10).fill(true));
    const replacement:StudentModel={version:'fixture-replacement-v1',evaluate(value){const result=bayesianEvidenceBaseline.evaluate(value);value.assessments.length=0;return {...result,modelVersion:this.version,nextCheckProbability:0.4,understanding:0.6};}};
    const result=evaluateStudentModel(original,replacement);expect(result.modelVersion).toBe(replacement.version);expect(result.nextCheckProbability).toBe(0.4);expect(original.assessments).toHaveLength(10);
  });
  it('abstains on model exceptions, invalid numbers, fabricated evidence and false confidence',()=>{
    const original=input(Array(10).fill(true));
    const broken:StudentModel={version:'broken-v1',evaluate(){throw new Error('unavailable');}};
    expect(evaluateStudentModel(original,broken).abstainReason).toBe('model-unavailable');
    for(const change of [{nextCheckProbability:NaN},{understanding:1.1},{evidenceIds:['invented']},{confidence:0.1},{modelVersion:'wrong-version'}]){
      const invalid:StudentModel={version:'invalid-v1',evaluate(value){return {...bayesianEvidenceBaseline.evaluate(value),modelVersion:this.version,...change};}};
      expect(evaluateStudentModel(original,invalid)).toMatchObject({status:'abstain',abstainReason:'invalid-output',confidence:0});
    }
  });
  it('rejects invalid caller contracts rather than dispatching malformed private input',()=>{
    expect(validStudentModelInput({...input(),question:'not part of this inference contract'})).toBe(false);
    expect(()=>evaluateStudentModel({...input(),asOf:'2026-99-99T00:00:00Z'})).toThrow('Invalid student-model input');
  });
});

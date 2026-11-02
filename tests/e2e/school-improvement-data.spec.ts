import {test,expect,type Page} from '@playwright/test';
test.setTimeout(180000);
const origin='http://127.0.0.1:4273',notice='fictional-improvement-v1';
async function profile(page:Page){const r=await page.request.get(origin+'/api/v1/learner/profile');expect(r.status()).toBe(200);return r.json();}
async function login(page:Page,email:string){
  await page.goto(origin);const library=page.getByRole('button',{name:'Open online school library',exact:true});
  await expect(library.or(page.getByLabel('Email or school-issued username',{exact:true}))).toBeVisible();if(await library.isVisible())await library.click();
  await page.getByLabel('Email or school-issued username',{exact:true}).fill(email);await page.getByLabel('Password',{exact:true}).fill('fictional-password-123');await page.getByRole('button',{name:'Sign in',exact:true}).click();
}
async function preferences(page:Page){await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:'Profile',exact:true}).click();await page.getByRole('button',{name:'My learning preferences',exact:true}).click();await expect(page.getByRole('heading',{name:'My learning preferences',exact:true})).toBeVisible();}
async function verify(page:Page,link:string){await page.goto(link);await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Verify simulated token and declaration',exact:true}).click();await expect(page.getByRole('status')).toContainText('Independent relationship review');}
async function review(page:Page,email:string){
  await page.goto('http://127.0.0.1:4275/');const login=page.getByLabel('Email or school-issued username',{exact:true});
  await expect(login.or(page.getByRole('navigation',{name:'School navigation'}))).toBeVisible();
  if(await login.isVisible()){await login.fill('reviewer@fictional.invalid');await page.getByLabel('Password',{exact:true}).fill('fictional-reviewer-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();}
  await page.getByRole('navigation',{name:'School navigation'}).getByRole('button',{name:'Settings',exact:true}).click();
  const row=page.getByRole('article').filter({hasText:email});await row.getByLabel('Relationship decision').selectOption('approve');await row.getByLabel('Independent review reason').fill('Fictional independent relationship and purpose review');await row.getByRole('button',{name:'Save guardian review'}).click();await expect(row).toContainText('approved');
}
test('adult improvement permission persists independently and withdrawal retains private learning choices',async({page})=>{
  const collectionRequests:string[]=[];page.on('request',r=>{if(/training-(events|export)|improvement\/(collect|export)/.test(r.url()))collectionRequests.push(r.url());});
  await login(page,'student@fictional.invalid');await preferences(page);const before=await profile(page);
  await page.getByText('Processing choices',{exact:true}).click();const choice=page.getByLabel('Allow de-identified learning interactions to improve Coteacher (optional)',{exact:true});await expect(choice).not.toBeChecked();
  await expect(page.getByText(/Improvement-data collection is currently off/)).toBeVisible();await choice.check();await page.getByRole('button',{name:'Update processing choices',exact:true}).click();
  await expect(page.getByText(/Improvement permission: recorded/)).toBeVisible();let p=await profile(page);
  expect(p.improvementNoticeVersion).toBe(notice);expect(p.improvementDataAllowed).toBe(true);expect(p.answers).toEqual(before.answers);expect(p.permissions.personalization).toBe(before.permissions.personalization);expect(p.permissions.externalAI).toBe(before.permissions.externalAI);
  expect(p.improvementDataAvailability).toEqual({collectionEnabled:false,featureProductionEnabled:false,exportEnabled:false});
  await page.reload();await preferences(page);await expect(page.getByText(/Improvement permission: recorded/)).toBeVisible();
  await page.getByRole('button',{name:'Withdraw improvement-data permission',exact:true}).click();await expect(page.getByRole('status')).toContainText('Improvement permission withdrawn');
  p=await profile(page);expect(p.improvementDataAllowed).toBe(false);expect(p.answers).toEqual(before.answers);expect(p.personalizationAllowed).toBe(before.personalizationAllowed);expect(p.externalAIAllowed).toBe(before.externalAIAllowed);expect(collectionRequests).toEqual([]);
  await page.reload();await preferences(page);await expect(page.getByText(/Improvement permission: not granted/)).toBeVisible();
});
test('a separate simulated guardian declaration and review authorize improvement without replacing learning permission',async({page,browser})=>{
  const suffix=Date.now(),baseEmail=`base-guardian-${suffix}@fictional.invalid`,improveEmail=`improvement-guardian-${suffix}@fictional.invalid`;
  await page.goto(origin);await page.getByRole('button',{name:'Create an account',exact:true}).click();await page.getByRole('button',{name:'Yes, under 18',exact:true}).click();
  await page.getByLabel('Student display name',{exact:true}).fill('Fictional improvement learner');await page.getByLabel('Guardian email',{exact:true}).fill(`improvement-minor-${suffix}@fictional.invalid`);await page.getByLabel('Password',{exact:true}).fill('fictional-onboarding-password');await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Create account',exact:true}).click();await page.getByRole('button',{name:'Set up my learning preferences',exact:true}).click();
  await page.getByLabel('Authorize essential account and learning processing').check();await page.getByLabel('Guardian email',{exact:true}).fill(baseEmail);await page.getByRole('button',{name:'Create fictional guardian review request',exact:true}).click();
  const first=(await page.getByRole('link',{name:'Open simulated guardian link',exact:true}).getAttribute('href'))!;
  const context=await browser.newContext();try{
    const guardian=await context.newPage();await verify(guardian,first);await review(guardian,baseEmail);await page.getByRole('button',{name:'Check authorization status',exact:true}).click();
    await expect(page.getByText(/Improvement permission: not granted/)).toBeVisible();const before=await profile(page);
    await page.getByLabel('Guardian email for improvement permission',{exact:true}).fill(improveEmail);await page.getByRole('button',{name:'Request separate improvement review',exact:true}).click();
    let p=await profile(page);expect(p.essentialReady).toBe(true);expect(p.permissions.essential).toBe(before.permissions.essential);expect(p.improvementDataAllowed).toBe(false);
    const link=(await page.getByRole('link',{name:'Open simulated improvement guardian link',exact:true}).getAttribute('href'))!;await guardian.goto(link);await expect(guardian.getByText(/Existing essential, personalization and connected-AI choices are unchanged/)).toBeVisible();await verify(guardian,link);
    expect((await profile(page)).improvementDataAllowed).toBe(false);await review(guardian,improveEmail);await page.getByRole('button',{name:'Check improvement authorization',exact:true}).click();
    await expect(page.getByText(/Improvement permission: recorded/)).toBeVisible();p=await profile(page);expect(p.essentialReady).toBe(true);expect(p.permissions.personalization).toBe(before.permissions.personalization);expect(p.permissions.externalAI).toBe(before.permissions.externalAI);expect(p.improvementDataAllowed).toBe(true);
    await page.getByRole('button',{name:'Withdraw improvement-data permission',exact:true}).click();p=await profile(page);expect(p.improvementDataAllowed).toBe(false);expect(p.essentialReady).toBe(true);
  }finally{await context.close();}
});

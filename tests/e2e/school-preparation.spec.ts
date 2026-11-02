import { test,expect } from '@playwright/test';
import { schoolRecording } from '../school-fixture';
test.setTimeout(60000);
test('assigned teacher prepares, inspects and approves reusable support through the browser',async({page},info)=>{
  await page.goto('http://127.0.0.1:4274/');await page.getByLabel('Email or school-issued username',{exact:true}).fill('teacher@fictional.invalid');
  await page.getByLabel('Password',{exact:true}).fill('fictional-password-123');await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page.getByRole('navigation',{name:'Teacher account'})).toBeVisible();
  const current=await page.request.get('http://127.0.0.1:4274/api/v1/me');expect(current.ok()).toBe(true);const me=await current.json();
  // This fixture publication is synthetic. Preparation, model dispatch, review and approval below use the actual UI/service.
  const published=await page.evaluate(async(input)=>{
    const response=await fetch('/api/v1/lessons/publish',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});
    if(!response.ok)throw new Error('Synthetic teacher publication failed.');return response.json();
  },{offeringId:me.assignments[0].offeringId,lesson:schoolRecording().lesson,external:false,privacyReviewed:true});
  await page.getByRole('navigation',{name:'Teacher account'}).getByRole('button',{name:'Published lessons',exact:true}).click();
  const article=page.locator('article').filter({has:page.getByRole('heading',{name:'Why does a pencil look bent in water?',exact:true})}).last();
  await article.getByRole('button',{name:'Prepare reviewed question candidates'}).click();await expect(article).toContainText('Support: draft');
  await article.getByRole('button',{name:'Generate source-checked support with configured model'}).click();
  await article.getByText('Questions and explanations',{exact:true}).click();await expect(article).toContainText('What should I understand about refraction at the water surface?');
  await expect(article.locator('blockquote').first()).toBeVisible();
  await expect(article).toContainText('Sources: notes-light');
  await article.getByLabel('Knowledge key for light-path',{exact:true}).fill('reviewed-science:light-path');
  await article.getByLabel('Knowledge key for refraction',{exact:true}).fill('reviewed-science:refraction');
  await article.getByLabel('Prerequisite keys for refraction',{exact:true}).fill('reviewed-science:light-path');
  await expect(article.getByRole('button',{name:'Approve reusable support'})).toBeDisabled();
  await article.getByRole('checkbox',{name:'I reviewed source support, misconceptions, concept mappings and activity safety.'}).check();
  await article.getByRole('button',{name:'Approve reusable support'}).click();await expect(article).toContainText('Support: approved');
  const response=await page.request.get(`http://127.0.0.1:4274/api/v1/lessons/${published.id}/preparation`);expect(response.ok()).toBe(true);const support=await response.json();
  expect(support.knowledge.concepts.find((c:any)=>c.conceptId==='refraction').prerequisites).toEqual(['reviewed-science:light-path']);
  await page.screenshot({path:info.outputPath('prepared-support-desktop.png'),fullPage:true});await page.setViewportSize({width:360,height:800});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath('prepared-support-mobile.png'),fullPage:true});
});

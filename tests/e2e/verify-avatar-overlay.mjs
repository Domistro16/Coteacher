import { chromium, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
mkdirSync('docs/screenshots',{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1100},reducedMotion:'reduce'});
const errors=[]; page.on('pageerror',error=>errors.push(error.message));
// Read the existing published lesson. Avoid paid AI calls or modifying school records.
await page.route('**/api/**',route=>route.request().method()==='POST'?route.abort():route.continue());
await page.goto('http://127.0.0.1:5173');
await page.getByLabel('Your profile',{exact:true}).selectOption('student-a1b2c3d4');
await page.getByLabel('Six-digit PIN').fill('111111');
await page.getByRole('button',{name:'Unlock my profile'}).click();
await expect(page.getByRole('button',{name:'Watch Now',exact:true})).toBeEnabled({timeout:30000});
await page.getByRole('button',{name:'Watch Now',exact:true}).click();
const player=page.getByRole('region',{name:'Recorded classroom lesson',exact:true});
await expect(player).toBeVisible({timeout:30000});
await page.locator('.chapters [data-concept-id="refraction"]').click();
const results=[];
for(const [name,width,height] of [['desktop',1440,1100],['mobile',360,800],['narrow',320,800],['tablet',768,1000]]) {
 await page.setViewportSize({width,height}); await player.evaluate(el=>window.scrollTo(0,scrollY+el.getBoundingClientRect().top-180));
 const before=await player.boundingBox(), canvasBefore=await player.locator('.replay-stage svg').boundingBox();
 const timeBefore=await player.locator('audio').evaluate(audio=>audio.currentTime);
 if(name==='desktop'||name==='mobile') await page.screenshot({path:`docs/screenshots/avatar-${name}-closed.png`,fullPage:false});
 await page.getByRole('button',{name:'Talk with Coteacher',exact:true}).click();
 const dock=page.getByRole('region',{name:'Coteacher lesson companion',exact:true});
 await expect(dock).toBeVisible(); await player.evaluate(el=>window.scrollTo(0,scrollY+el.getBoundingClientRect().top-180));
 const after=await player.boundingBox(), canvasAfter=await player.locator('.replay-stage svg').boundingBox(), overlay=await dock.boundingBox(), controls=await player.locator('.player-controls').boundingBox();
 for(const key of ['width','height']) { expect(after[key]).toBeCloseTo(before[key],1); expect(canvasAfter[key]).toBeCloseTo(canvasBefore[key],1); }
 expect(overlay.x).toBeGreaterThanOrEqual(canvasAfter.x);
 expect(overlay.x+overlay.width).toBeLessThanOrEqual(canvasAfter.x+canvasAfter.width);
 expect(overlay.y).toBeGreaterThanOrEqual(canvasAfter.y);
 expect(overlay.y+overlay.height).toBeLessThanOrEqual(canvasAfter.y+canvasAfter.height);
 expect(overlay.y+overlay.height).toBeLessThan(controls.y);
 expect(await player.evaluate(el=>getComputedStyle(el).display)).toBe('block');
 await expect(page.getByRole('dialog')).toHaveCount(0);
 expect(await dock.evaluate(el=>[...el.querySelectorAll('*')].filter(child=>['auto','scroll'].includes(getComputedStyle(child).overflowY)&&child.scrollHeight>child.clientHeight).length)).toBe(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(await player.locator('audio').evaluate(audio=>audio.paused)).toBe(true);
 expect(await player.locator('audio').evaluate(audio=>audio.currentTime)).toBeCloseTo(timeBefore,2);
 await player.evaluate(el=>window.scrollTo(0,scrollY+el.getBoundingClientRect().top-180));
 if(name==='desktop'||name==='mobile') await page.screenshot({path:`docs/screenshots/avatar-${name}-open.png`,fullPage:false});
 await dock.getByRole('button',{name:'Ask or explore this concept',exact:true}).click();
 await expect(page.getByLabel('Which part of this recorded concept is unclear?',{exact:true})).toBeVisible();
 const toolsFrame=await player.boundingBox(); expect(toolsFrame.width).toBe(before.width); expect(toolsFrame.height).toBe(before.height);
 await page.getByLabel('Seek recorded lesson',{exact:true}).focus(); await expect(page.getByLabel('Seek recorded lesson',{exact:true})).toBeFocused();
 await dock.getByRole('button',{name:'Close learning panel',exact:true}).click(); await expect(dock).toHaveCount(0);
 expect((await player.boundingBox()).height).toBe(before.height);
 expect(await player.locator('audio').evaluate(audio=>audio.currentTime)).toBeCloseTo(timeBefore,2);
 results.push({name,viewport:{width,height},playerBefore:before,playerAfter:after,canvasBefore,canvasAfter,overlay,controls,recordingPositionSeconds:timeBefore});
}
// The unchanged quiz callback still opens its existing inline check.
await page.getByRole('button',{name:'Check this concept',exact:true}).click();
await expect(page.locator('.companion-lesson-tools .quiz-card')).toBeVisible();
await expect(page.locator('.companion-lesson-tools')).toHaveAttribute('open','');
await page.getByRole('button',{name:'Return to recorded lesson',exact:true}).click();
await expect(page.locator('.companion-dock')).toHaveCount(0);
await expect.poll(()=>player.locator('audio').evaluate(audio=>!audio.paused)).toBe(true);
await player.locator('audio').evaluate(audio=>audio.pause());
expect(errors).toEqual([]);
writeFileSync('docs/screenshots/avatar-overlay-evidence.json',JSON.stringify({source:'Published lesson from configured local backend; prepared companion speech; AI/sync POST calls blocked in isolated screenshot context.',results,checks:['identical player/canvas dimensions','overlay inside canvas','playback controls unobscured','no sidebar/modal/nested scrollbars','same paused recording timestamp','text question controls preserved','quiz accessible','return resumes actual teacher audio','no page errors']},null,2));
console.log(JSON.stringify({passed:true,viewports:results.map(r=>({viewport:r.viewport,playerSize:[r.playerAfter.width,r.playerAfter.height],overlaySize:[r.overlay.width,r.overlay.height]})),screenshots:4,errors}));
await browser.close();



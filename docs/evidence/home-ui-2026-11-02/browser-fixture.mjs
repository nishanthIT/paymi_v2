// Test-only responses. Every backend request is intercepted; no real account or API is used.
const { chromium } = await import(process.env.PAYMI_PLAYWRIGHT_MODULE || '/home/n1sh/Activehub/.tools/costcutter-browser/node_modules/playwright-core/index.mjs');
import fs from 'node:fs/promises';
export const origin=process.env.PAYMI_HOME_ORIGIN || 'http://localhost:8085';
export const output=new URL('.',import.meta.url).pathname;
export const headlines=['A smarter start to the trading week','Seasonal ranges arriving this month','Helping your team serve with confidence','What is changing on the high street','Small improvements, stronger stores','Fresh ideas from independent retailers','Seventh article must stay out of preview'];
export const defaultUser={id:'home-preview',name:'Alex Morgan',email:'alex@example.test',userType:'CUSTOMER',shopId:'preview-shop'};
export const defaultShop={id:'preview-shop',name:'The Neighbourhood Market',address:'High Street',role:'OWNER',permissions:[],isDefault:true};
export const news=headlines.map((title,i)=>({id:`news-${i+1}`,title,description:`Retail news ${i+1}.\n\nPractical updates and useful ideas for your shop and your team.`,imageUrl:i===1?null:`http://localhost:3199/fixture/news-${i}.svg`,sourceUrl:'https://example.test/source',isActive:true,publishedAt:new Date(Date.now()-i*86400000).toISOString()}));
export const ads=['Stock up for the weekend','Fresh ideas for your shelves','Made for your local shop'].map((title,i)=>({id:`ad-${i+1}`,title,imageUrl:`http://localhost:3199/fixture/ad-${i}.svg`,linkUrl:'https://example.test/not-used',isActive:true,sortOrder:i}));
function picture(path){const i=Number(path.match(/-(\d)/)?.[1]||0);return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="503" viewBox="0 0 960 503"><rect width="960" height="503" fill="${['#263C31','#CDA666','#4E5449'][i%3]}"/><circle cx="800" cy="180" r="280" fill="#F1D49B" opacity=".12"/><rect x="685" y="170" width="130" height="220" rx="20" fill="#F9F1DE"/><rect x="720" y="120" width="60" height="60" rx="10" fill="#D1A658"/><rect x="590" y="260" width="130" height="130" rx="10" fill="#B8783B"/><text x="65" y="110" font-family="Arial" font-size="22" letter-spacing="5" fill="#F1D49B">RETAIL SPOTLIGHT</text><text x="65" y="210" font-family="Arial" font-size="58" font-weight="bold" fill="#FFF9EE">${['A fresh perspective.','Good things in store.','Ready for the week.'][i%3]}</text><text x="65" y="275" font-family="Arial" font-size="26" fill="#FFF9EE">News and inspiration for independent retail.</text><text x="65" y="405" font-family="Arial" font-size="18" fill="#FFF9EE">Isolated browser test fixture</text></svg>`;}
export async function launch(){return chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});}
export async function fixture(browser,options={}){
 const user={...defaultUser,...options.user},shop={...defaultShop,...options.shop};
 const context=await browser.newContext({viewport:{width:options.width||390,height:844},isMobile:true,hasTouch:true});
 const requests=[];let release;const held=new Promise(r=>release=r);
 await context.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.pathname.startsWith('/fixture/'))return route.fulfill({status:200,contentType:'image/svg+xml',body:picture(url.pathname)});
  if(url.pathname.startsWith('/api/')){
   const path=url.pathname.slice(4);requests.push({path,method:route.request().method(),search:url.search});
   if(options.loading&&['/news','/advertisements'].includes(path))await held;
   if(options.error&&['/news','/advertisements'].includes(path))return route.fulfill({status:503,contentType:'application/json',body:'{"error":"Test unavailable"}'});
   if(options.shopError&&path==='/shop/supermarkets')return route.fulfill({status:503,contentType:'application/json',body:'{"error":"Test shops unavailable"}'});
   const bodies={'/auth/me':{user},'/shop/supermarkets':{supermarkets:options.noShop?[]:[shop],defaultSupermarketId:options.noShop?null:shop.id,canCreateAdditional:true,canSwitchOperationalContext:true},'/advertisements':{advertisements:options.ads??ads},'/news':{news:options.news??news},'/promotions/public':{promotions:[]},'/chat/unread-count':{unreadCount:0}};
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(bodies[path]??(path.startsWith('/news/')?{news:news.find(n=>n.id===path.split('/').pop())}:{products:[],news:[],employees:[],categories:[],promotions:[]}))});
  }
  if(['localhost','127.0.0.1'].includes(url.hostname)&&url.port===new URL(origin).port&&!url.pathname.startsWith('/socket.io'))return route.continue();
  return route.abort();
 });
 await context.addInitScript(({user})=>{localStorage.setItem('paymi.auth_token','isolated-home-preview');localStorage.setItem('paymi.user',JSON.stringify(user));},{user});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const open=async()=>{await page.goto(origin);await page.getByText(/^Hi Alex/).waitFor({timeout:120000});await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(600);};
 return {context,page,requests,errors,open,release};
}
export async function capture(page,file){await page.waitForTimeout(500);await page.screenshot({path:`${output}/${file}.png`});await fs.writeFile(`${output}/${file}.txt`,await page.locator('body').innerText());}

/** One idempotent upgrade shared by the storefront, metadata and authenticated editor.
 * Reads never write to storage. A normal save persists the upgraded document.
 * Once marked, owner edits are used verbatim, including former default values.
 */
export function lilyContent<T extends Record<string, any>>(source:T):T {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return source;
  if (source.designVersion === 'lily-v1') return restaurantContent(chefContent(source));
  const next:any = structuredClone(source);
  const brand = (value:any) => typeof value === 'string' && !/^(?:https?:|\/|mailto:|tel:)/i.test(value) ? value.replace(/APEX/gi, 'LILY') : value;
  next.copy = Object.fromEntries(Object.entries(next.copy || {}).map(([key,value]) => [key,brand(value)]));
  next.copy.Lily_wordmark ??= 'LILY';
  next.copy.Lily_submark ??= 'DRIVE';
  if(next.meta) next.meta.title = brand(next.meta.title);
  if(next.settings) next.settings.restaurant_name = brand(next.settings.restaurant_name);
  next.appearance = {...next.appearance};
  for(const [key,oldValue,value] of [['accent','#d18a4b','#c92b25'],['background','#0d0d0d','#080a0b'],['surface','#191918','#121415'],['text','#f5f0e8','#f3efe8']]) {
    if(!next.appearance[key] || next.appearance[key] === oldValue) next.appearance[key] = value;
  }
  const media = next.settings?.media;
  if(media) {
    if(!media.hero_image || media.hero_image === '/images/fd_burger_classic.webp') media.hero_image = '/images/lily-hero.webp';
    if(!media.hero_video || media.hero_video === '/videos/food-burger.mp4') media.hero_video = '/videos/lily-atmosphere.mp4';
  }
  next.designVersion = 'lily-v1';
  return restaurantContent(chefContent(next));
}

/** Rename existing CMS snapshots once; subsequent owner edits stay editable. */
function chefContent<T extends Record<string, any>>(source:T):T {
  if (source.brandVersion === 'chefs-burger-v1') return source;
  const next:any = structuredClone(source);
  const rename = (value:any):any => {
    if (typeof value === 'string') {
      if (/^(?:https?:|\/|mailto:|tel:)/i.test(value)) return value;
      return value.replace(/\b(?:APEX|LILY)(?:\s+DRIVE)?(?:\s+BULGARIA)?\b/gi, "CHEF'S BURGER");
    }
    if (Array.isArray(value)) return value.map(rename);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key,item]) => [key,rename(item)]));
    return value;
  };
  // Text only: media paths, product identifiers and design settings stay intact.
  next.copy = rename(next.copy || {});
  Object.assign(next.copy, {Primitives_jsx_1:"CHEF'S",Primitives_jsx_2:' BURGER',Lily_wordmark:"CHEF'S",Lily_submark:'BURGER'});
  if (next.meta) next.meta = rename(next.meta);
  if (next.settings) next.settings.restaurant_name = "CHEF'S BURGER";
  if (next.pages) next.pages = rename(next.pages);
  if (next.navigation) next.navigation = rename(next.navigation);
  if (next.buttons) next.buttons = rename(next.buttons);
  next.brandVersion = 'chefs-burger-v1';
  return next;
}

/** Apply the restaurant update once, retaining subsequent admin edits. */
function restaurantContent<T extends Record<string, any>>(source:T):T {
  if(source.restaurantVersion === 'chef-portrait-v1') return source;
  const next:any = structuredClone(source);
  const address='бул. Владислав Варненчик 260, 9009 Варна, България';
  next.settings.address=address;
  next.settings.map_query=address;
  next.settings.media.head_chef_image ??= '/images/head-chef.jpeg';
  next.settings.media.head_chef_visible ??= true;
  next.pages.home.sections=next.pages.home.sections.filter((s:any)=>s.type!=='assistant');
  next.navigation.header=next.navigation.header.filter((n:any)=>!n.to.includes('kiosk'));
  next.copy.Hero_jsx_12='/#location';
  next.copy.Hero_jsx_13='Как да ни намериш';
  next.copy.Sections_jsx_7='Разгледайте менюто онлайн и изберете любимия си вкус.';
  next.copy.Preview_jsx_3='Тази страница все още се подготвя. Разгледайте нашето меню и актуалните предложения.';
  next.restaurantVersion='chef-portrait-v1';
  return next;
}

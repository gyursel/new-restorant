import {cache} from 'react';
import {state} from './cms';

// A single published CMS snapshot powers server metadata and the browser UI.
// Request-scoped deduplication avoids reading the database twice for the page.
// Every environment reads its own configured CMS database; no old-site bridge.
export const publishedContent=cache(async ():Promise<any|null>=>{
  try{
    return JSON.parse((await state()).published);
  }catch(error){
    // Never embed raw database errors in HTML, metadata or logs.
    console.error('Public content prefetch failed:',
      error instanceof Error?error.name:'unknown');
    return null;
  }
});

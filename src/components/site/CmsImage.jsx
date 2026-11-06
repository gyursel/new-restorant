import {ResponsivePhoto} from '@/lib/ResponsivePhoto';
import {getContent} from '@/content/repository';
export function CmsImage({src,alt='',...props}){return <ResponsivePhoto sizes="(max-width: 359px) 90vw, 45vw" {...props} src={src} alt={getContent()?.mediaMetadata?.[src]?.alt||alt}/>}

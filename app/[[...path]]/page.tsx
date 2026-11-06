import {getImageProps} from 'next/image';
import type {Metadata} from 'next';
import PublicSite from '../public-site';
import {publishedContent} from '../../server/public-content';

export const dynamic='force-dynamic';

const base='https://new-restorant-backend.vercel.app';
type Props={params:Promise<{path?:string[]}>};
const description='Премиум Drive-Thru ресторант. Бургери, меню и вземане от място в CHEF\'S BURGER.';

export async function generateMetadata({params}:Props):Promise<Metadata>{
  const segments=(await params).path||[];
  const [section,slug]=segments;
  const data=await publishedContent();
  const siteName=String(data?.meta?.title||'CHEF\'S BURGER');
  const metaDescription=String(data?.meta?.description||description).slice(0,300);
  const canonicalPath='/'+segments.map(encodeURIComponent).join('/');
  let title=siteName;
  let details=metaDescription;
  let image=data?.settings?.media?.hero_image||'/images/fd_burger_classic.webp';
  const isProduct=section==='product'&&segments.length===2;
  const product=isProduct?data?.menu?.products?.find((p:any)=>p.slug===slug):null;
  const known=!segments.length || (section==='menu'&&segments.length===1) || Boolean(product);
  if(section==='menu'&&segments.length===1){
    title='Меню и цени | '+siteName;
    details='Разгледай менюто на CHEF\'S BURGER: бургери, картофки, напитки и оферти.';
  }
  if(product){
    title=String(product.name)+' | '+siteName;
    details=String(product.description||metaDescription).slice(0,300);
    image=product.image||image;
  }
  const relativeImage=typeof image==='string'&&(/^(https:\/\/|\/(?!\/))/.test(image))?image:'/images/fd_burger_classic.webp';
  return {
    title,description:details,
    alternates:{canonical:known?base+canonicalPath:undefined},
    robots:{index:known&&process.env.VERCEL_ENV!=='preview',follow:known&&process.env.VERCEL_ENV!=='preview'},
    openGraph:{
      type:'website',locale:'bg_BG',siteName,title,description:details,
      url:base+canonicalPath,images:[{url:relativeImage,alt:product?.name||siteName}],
    },
    twitter:{card:'summary_large_image',title,description:details,images:[relativeImage]},
  };
}

export default async function Page({params}:Props){
  const isHome=!(await params).path?.length;
  const initialContent=await publishedContent();
  const media=initialContent?.settings?.media;
  const photo=(src:string,width:number,height:number,sizes:string)=>src.startsWith('/images/')?getImageProps({src,alt:'',width,height,sizes,quality:75}).props:null;
  const heroSection=initialContent?.pages?.home?.sections?.find((section:any)=>section.type==='hero'&&section.visible);
  const heroSource=heroSection?.backgroundImage||media?.hero_image;
  const hero=heroSource?photo(heroSource,1672,941,'110vw'):null;
  const chef=media?.head_chef_image?photo(media.head_chef_image,1254,1254,'88vw'):null;
  return <>
    {isHome && heroSection && heroSource?.startsWith('/') && <link rel="preload" as="image" href={hero?undefined:heroSource} imageSrcSet={hero?.srcSet} imageSizes={hero?.sizes} fetchPriority="high" media="(max-width: 767px)"/>}
    {isHome && heroSection && media?.head_chef_visible && media?.head_chef_image?.startsWith('/') && <link rel="preload" as="image" href={chef?undefined:media.head_chef_image} imageSrcSet={chef?.srcSet} imageSizes={chef?.sizes} fetchPriority="high" media="(max-width: 767px)"/>}
    <PublicSite initialContent={initialContent}/>
  </>;
}

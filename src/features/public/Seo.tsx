import { useEffect } from 'react';
import { OG_IMAGE_URL, SITE_URL } from '@/lib/siteConstants';

interface SeoProps {
  title: string;
  description: string;
  path: string;
}

function setMeta(selector: string, attribute: 'name' | 'property', content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${selector}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, selector);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

export default function Seo({ title, description, path }: SeoProps) {
  useEffect(() => {
    document.title = title;
    setMeta('description', 'name', description);
    setMeta('og:type', 'property', 'website');
    setMeta('og:title', 'property', title);
    setMeta('og:description', 'property', description);
    setMeta('og:url', 'property', `${SITE_URL}${path}`);
    setMeta('og:image', 'property', OG_IMAGE_URL);
    setMeta('twitter:card', 'name', 'summary_large_image');
    setMeta('twitter:title', 'name', title);
    setMeta('twitter:description', 'name', description);
    setMeta('twitter:image', 'name', OG_IMAGE_URL);

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', `${SITE_URL}${path}`);
  }, [title, description, path]);

  return null;
}

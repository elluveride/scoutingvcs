import { useEffect } from 'react';

interface SEOHeadProps {
  title: string;
  description: string;
  path: string;
}

const SITE_URL = 'https://scoutingvcs.lovable.app';
const OG_IMAGE = `${SITE_URL}/favicon.png`;

export function SEOHead({ title, description, path }: SEOHeadProps) {
  useEffect(() => {
    document.title = title;

    const metas: Record<string, string> = {
      'description': description,
      'og:title': title,
      'og:description': description,
      'og:url': `${SITE_URL}${path}`,
      'og:image': OG_IMAGE,
      'og:type': 'website',
      'twitter:card': 'summary_large_image',
      'twitter:title': title,
      'twitter:description': description,
      'twitter:image': OG_IMAGE,
    };

    const cleanup: (() => void)[] = [];

    Object.entries(metas).forEach(([key, value]) => {
      const isOg = key.startsWith('og:');
      const isTwitter = key.startsWith('twitter:');
      const attr = isOg || isTwitter ? 'property' : 'name';

      let el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
      const existed = !!el;

      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }

      const prev = el.getAttribute('content');
      el.setAttribute('content', value);

      cleanup.push(() => {
        if (!existed && el?.parentNode) {
          el.parentNode.removeChild(el);
        } else if (el && prev !== null) {
          el.setAttribute('content', prev);
        }
      });
    });

    // Canonical link
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    const hadCanonical = !!canonical;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', `${SITE_URL}${path}`);

    return () => {
      cleanup.forEach(fn => fn());
      if (!hadCanonical && canonical?.parentNode) {
        canonical.parentNode.removeChild(canonical);
      }
    };
  }, [title, description, path]);

  return null;
}

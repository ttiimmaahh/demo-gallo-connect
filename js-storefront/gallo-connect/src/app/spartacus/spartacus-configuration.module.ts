import { NgModule } from '@angular/core';
import { translationChunksConfig, translationsEn } from "@spartacus/assets";
import { CmsConfig, FeaturesConfig, I18nConfig, OccConfig, provideConfig, provideConfigFactory, SiteContextConfig } from "@spartacus/core";
import { defaultB2bOccConfig } from "@spartacus/setup";
import { defaultCmsContentProviders, layoutConfigFactory, mediaConfig } from "@spartacus/storefront";
import { HeroBannerComponent } from '../components/hero-banner/hero-banner.component';
import { CmsBannerComponent } from '@spartacus/core';

@NgModule({
  declarations: [],
  imports: [
  ],
  providers: [provideConfigFactory(layoutConfigFactory), provideConfig(mediaConfig), ...defaultCmsContentProviders, provideConfig(<OccConfig>{
    backend: {
      occ: {
        // baseUrl: 'https://api.c90spw6e32-arganollc1-d1-public.model-t.cc.commerce.ondemand.com',
        baseUrl: 'https://localhost:9002',
      }
    },
  }), provideConfig(<SiteContextConfig>{
    context: {
      urlParameters: ['baseSite', 'language', 'currency'],
      // baseSite: ['powertools-spa'],
      baseSite: ['galloConnect'],
      currency: ['USD'],
      language: ['en']
    },
  }), provideConfig(<I18nConfig>{
    i18n: {
      resources: { en: translationsEn },
      chunks: translationChunksConfig,
      fallbackLang: 'en'
    },
  }), provideConfig(<FeaturesConfig>{
    features: {
      level: '2211.43'
    }
  }), provideConfig(defaultB2bOccConfig),
  provideConfig(<CmsConfig>{
    cmsComponents: {
      // Map all common banner component types to our custom hero banner
      SimpleResponsiveBannerComponent: {
        component: HeroBannerComponent,
      },
    },
  })
  ]
})
export class SpartacusConfigurationModule { }

// (working)
// https://localhost:9002/medias/GalloConnect-1400x480-BigSplash-EN-01-1400W.jpg?context=bWFzdGVyfGltYWdlc3wyNzEzMTZ8aW1hZ2UvanBlZ3xhVzFoWjJWekwyZ3pOeTlvTnpVdk9EYzVOemt4T0RBd016SXpNQzVxY0djfDVjYWQ4YWI1M2I5ZDJlOGE2NTI2OWNkNTFkYTliZTM5ODMxMzZkMTUwOGY5MWUxNzZlYTQ2ZmE2NTJkMTc3OGM

// (not working)
// http://localhost:4200/medias/GalloConnect-1400x480-BigSplash-EN-01-1400W.jpg?context=bWFzdGVyfGltYWdlc3wyNzEzMTZ8aW1hZ2UvanBlZ3xhVzFoWjJWekwyZ3pOeTlvTnpVdk9EYzVOemt4T0RBd016SXpNQzVxY0djfDVjYWQ4YWI1M2I5ZDJlOGE2NTI2OWNkNTFkYTliZTM5ODMxMzZkMTUwOGY5MWUxNzZlYTQ2ZmE2NTJkMTc3OGM
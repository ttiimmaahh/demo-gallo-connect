import { NgModule } from '@angular/core';
import { translationChunksConfig, translationsEn } from "@spartacus/assets";
import { FeaturesConfig, I18nConfig, OccConfig, provideConfig, provideConfigFactory, SiteContextConfig } from "@spartacus/core";
import { defaultB2bOccConfig } from "@spartacus/setup";
import { defaultCmsContentProviders, layoutConfigFactory, mediaConfig } from "@spartacus/storefront";

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
      baseSite: ['powertools-spa'],
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
  }), provideConfig(defaultB2bOccConfig)]
})
export class SpartacusConfigurationModule { }
